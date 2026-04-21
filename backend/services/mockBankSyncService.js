const validator = require('validator');
const {
  BANK_SYNC_UNAVAILABLE_MESSAGE,
  SUPPORTED_PROVIDER,
  createMockBankLink,
  getCsvImportHistory,
  getBankSyncStatus,
  ingestMockTransactions,
  isBankSyncUnavailableError
} = require('../db/bankSyncStore');

const SUPPORTED_SCOPES = ['accounts', 'transactions'];
const ALLOWED_DIRECTIONS = new Set(['in', 'out']);
const ALLOWED_STATUSES = new Set(['booked', 'pending']);
const INTERNAL_CONTRACT_VERSION = '2026-04-mock-linked-transactions-v1';
const CSV_REQUIRED_COLUMNS = ['bookedAt', 'amount', 'merchantName'];
const CSV_COLUMN_ALIASES = {
  bookedAt: ['bookedAt', 'date', 'booked_at', 'transactionDate'],
  amount: ['amount', 'value', 'transactionAmount'],
  merchantName: ['merchantName', 'merchant', 'description', 'payee'],
  transactionId: ['transactionId', 'transaction_id', 'id', 'reference'],
  currency: ['currency', 'ccy'],
  direction: ['direction', 'flow', 'type', 'transaction type'],
  status: ['status', 'transactionStatus'],
  categoryHint: ['categoryHint', 'category', 'category_hint'],
  // Split debit/credit columns used by some UK bank exports (e.g. Nationwide)
  paidOut: ['paid out', 'debit', 'debit amount', 'money out', 'withdrawal amount'],
  paidIn: ['paid in', 'credit', 'credit amount', 'money in', 'deposit amount']
};

function validateMockBankLinkPayload(payload) {
  const accountId = typeof payload.accountId === 'string' ? payload.accountId.trim() : '';
  const accountName = typeof payload.accountName === 'string' ? payload.accountName.trim() : '';
  const sortCodeMasked = typeof payload.sortCodeMasked === 'string' ? payload.sortCodeMasked.trim() : '';
  const last4 = typeof payload.last4 === 'string' ? payload.last4.trim() : '';

  if (accountId.length < 3 || accountId.length > 64) {
    return { error: 'Account ID is required and must be between 3 and 64 characters.' };
  }

  if (accountName.length < 2 || accountName.length > 80) {
    return { error: 'Account name is required and must be between 2 and 80 characters.' };
  }

  if (!/^\d{2}-\d{2}-\d{2}$/.test(sortCodeMasked)) {
    return { error: 'Sort code must use the masked UK format 00-00-00.' };
  }

  if (!/^\d{4}$/.test(last4)) {
    return { error: 'Last 4 digits must be exactly 4 numeric characters.' };
  }

  return {
    value: {
      accountId,
      accountName,
      sortCodeMasked,
      last4,
      linkedAt: payload.linkedAt,
      expiresAt: payload.expiresAt
    }
  };
}

function validateTransaction(transaction, index) {
  const transactionId = typeof transaction.transactionId === 'string' ? transaction.transactionId.trim() : '';
  const bookedAt = typeof transaction.bookedAt === 'string' ? transaction.bookedAt.trim() : '';
  const amount = Number(transaction.amount);
  const currency = typeof transaction.currency === 'string' ? transaction.currency.trim().toUpperCase() : '';
  const merchantName = typeof transaction.merchantName === 'string' ? transaction.merchantName.trim() : '';
  const direction = typeof transaction.direction === 'string' ? transaction.direction.trim() : '';
  const status = typeof transaction.status === 'string' ? transaction.status.trim() : '';

  if (transactionId.length < 3 || transactionId.length > 80) {
    return { error: `Transaction ${index + 1} must include a transactionId between 3 and 80 characters.` };
  }

  if (!validator.isISO8601(bookedAt)) {
    return { error: `Transaction ${index + 1} must include a valid bookedAt timestamp.` };
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    return { error: `Transaction ${index + 1} must include an amount greater than 0.` };
  }

  if (currency !== 'GBP') {
    return { error: `Transaction ${index + 1} must use GBP for the UK-first mock ingestion flow.` };
  }

  if (merchantName.length < 2 || merchantName.length > 120) {
    return { error: `Transaction ${index + 1} must include a merchantName between 2 and 120 characters.` };
  }

  if (!ALLOWED_DIRECTIONS.has(direction)) {
    return { error: `Transaction ${index + 1} must use a supported direction.` };
  }

  if (!ALLOWED_STATUSES.has(status)) {
    return { error: `Transaction ${index + 1} must use a supported status.` };
  }

  return {
    value: {
      transactionId,
      bookedAt,
      amount: Math.round(amount * 100) / 100,
      currency,
      merchantName,
      direction,
      status,
      categoryHint: typeof transaction.categoryHint === 'string' ? transaction.categoryHint.trim() : ''
    }
  };
}

function validateMockIngestionPayload(payload) {
  const ingestionId = typeof payload.ingestionId === 'string' ? payload.ingestionId.trim() : '';
  const transactions = Array.isArray(payload.transactions) ? payload.transactions : null;

  if (ingestionId.length < 3 || ingestionId.length > 80) {
    return { error: 'Ingestion ID is required and must be between 3 and 80 characters.' };
  }

  if (!transactions || transactions.length === 0) {
    return { error: 'At least one transaction is required for mock ingestion.' };
  }

  const validatedTransactions = [];

  for (let index = 0; index < transactions.length; index += 1) {
    const result = validateTransaction(transactions[index], index);

    if (result.error) {
      return result;
    }

    validatedTransactions.push(result.value);
  }

  return {
    value: {
      ingestionId,
      receivedAt: payload.receivedAt || new Date().toISOString(),
      transactions: validatedTransactions
    }
  };
}

function normalizeCsvHeader(header) {
  return `${header || ''}`.trim().replace(/^\uFEFF/, '');
}

function parseCsvLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];

    if (char === '"') {
      const nextChar = line[i + 1];
      if (inQuotes && nextChar === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values;
}

function resolveHeaderIndexMap(headers) {
  const indexByName = new Map();
  headers.forEach((header, index) => {
    indexByName.set(normalizeCsvHeader(header).toLowerCase(), index);
  });

  const resolved = {};

  Object.entries(CSV_COLUMN_ALIASES).forEach(([key, aliases]) => {
    for (const alias of aliases) {
      const index = indexByName.get(alias.toLowerCase());
      if (typeof index === 'number') {
        resolved[key] = index;
        break;
      }
    }
  });

  return resolved;
}

function inferDirectionFromAmount(rawAmount) {
  if (!Number.isFinite(rawAmount) || rawAmount === 0) {
    return null;
  }

  return rawAmount < 0 ? 'out' : 'in';
}

function buildDeterministicTransactionId(ingestionId, rowIndex, bookedAt, amount, merchantName, direction) {
  const seed = `${ingestionId}|${bookedAt}|${amount}|${merchantName}|${direction}|${rowIndex}`;
  let hash = 2166136261;

  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return `csv_${Math.abs(hash)}`;
}

// Strip currency symbols and thousands separators so amounts like £1,234.56 become 1234.56.
function stripCurrencyChars(raw) {
  return `${raw || ''}`.replace(/[£$€¥₹]/g, '').replace(/,/g, '').trim();
}

// Normalize human-readable UK date strings ("21 Mar 2026", "01 April 2026") to ISO 8601.
// ISO-ish strings (starting with a 4-digit year) are returned unchanged.
function normalizeDateString(raw) {
  const trimmed = `${raw || ''}`.trim();

  // Already looks like ISO (2026-03-21 or 2026-03-21T...)
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    return trimmed;
  }

  // "DD Mon YYYY" or "DD Month YYYY" (e.g. "21 Mar 2026", "01 April 2026")
  const match = trimmed.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
  if (match) {
    const parsed = new Date(`${match[2]} ${Number(match[1])}, ${match[3]}`);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }

  return trimmed;
}

// Map verbose UK bank transaction-type labels to a binary direction.
// Returns 'in', 'out', or null (unknown — caller falls back to other signals).
function mapTransactionTypeToDirection(typeValue) {
  const lower = `${typeValue || ''}`.toLowerCase().trim();

  const OUT_PATTERNS = [
    'payment to', 'direct debit', 'visa purchase', 'standing order',
    'mortgage', 'monthly account fee', 'withdrawal', 'transfer to',
    'fee', 'charge', 'debit'
  ];
  const IN_PATTERNS = [
    'bank credit', 'transfer from', 'payment from', 'bacs credit',
    'faster payment received', 'credit', 'interest'
  ];

  if (OUT_PATTERNS.some((p) => lower.includes(p))) return 'out';
  if (IN_PATTERNS.some((p) => lower.includes(p))) return 'in';
  return null;
}

// Find the index of the first line that looks like a valid transaction header
// (contains at least one recognized canonical column name). This lets us skip
// bank-export preamble rows like "Account Name:", "Account Balance:", etc.
function findHeaderLineIndex(lines) {
  for (let i = 0; i < lines.length; i += 1) {
    const headers = parseCsvLine(lines[i]);
    const resolved = resolveHeaderIndexMap(headers);
    // A valid header must at least identify when the transaction happened
    if (typeof resolved.bookedAt === 'number') {
      return i;
    }
  }
  return 0; // fallback: treat first line as header
}

function parseCsvIngestionPayload(payload) {
  const ingestionId = typeof payload.ingestionId === 'string' ? payload.ingestionId.trim() : '';
  const csvData = typeof payload.csvData === 'string' ? payload.csvData : '';
  const filename = typeof payload.filename === 'string' ? payload.filename.trim() : '';

  if (ingestionId.length < 3 || ingestionId.length > 80) {
    return { error: 'Ingestion ID is required and must be between 3 and 80 characters.' };
  }

  if (!csvData.trim()) {
    return {
      error: 'CSV content is required and must contain a header row plus at least one transaction row.',
      details: {
        filename,
        rowErrors: []
      }
    };
  }

  const lines = csvData
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length < 2) {
    return {
      error: 'CSV content must include a header row and at least one transaction row.',
      details: {
        filename,
        rowErrors: []
      }
    };
  }

  const headerLineIndex = findHeaderLineIndex(lines);
  const headers = parseCsvLine(lines[headerLineIndex]);
  const headerIndexes = resolveHeaderIndexMap(headers);

  // Amount can be satisfied by a single 'amount' column OR by split 'paid out'/'paid in' columns.
  const hasSplitAmountColumns = typeof headerIndexes.paidOut === 'number' || typeof headerIndexes.paidIn === 'number';

  for (const requiredColumn of CSV_REQUIRED_COLUMNS) {
    if (requiredColumn === 'amount' && hasSplitAmountColumns) {
      continue;
    }

    if (typeof headerIndexes[requiredColumn] !== 'number') {
      return {
        error: `CSV header is missing required column: ${requiredColumn}.`,
        details: {
          filename,
          missingColumn: requiredColumn,
          rowErrors: []
        }
      };
    }
  }

  const transactions = [];
  const rowErrors = [];

  for (let rowIndex = headerLineIndex + 1; rowIndex < lines.length; rowIndex += 1) {
    const rowValues = parseCsvLine(lines[rowIndex]);

    const bookedAtRaw = `${rowValues[headerIndexes.bookedAt] || ''}`.trim();
    const bookedAt = normalizeDateString(bookedAtRaw);
    const merchantName = `${rowValues[headerIndexes.merchantName] || ''}`.trim();
    const categoryHint = `${rowValues[headerIndexes.categoryHint] || ''}`.trim();
    const providedTransactionId = `${rowValues[headerIndexes.transactionId] || ''}`.trim();
    const currency = `${rowValues[headerIndexes.currency] || 'GBP'}`.trim().toUpperCase();
    const status = `${rowValues[headerIndexes.status] || 'booked'}`.trim().toLowerCase();

    // Resolve amount and direction
    let amount;
    let direction;

    if (hasSplitAmountColumns) {
      // Separate paid-out / paid-in columns (e.g. Nationwide exports)
      const paidOutRaw = stripCurrencyChars(rowValues[headerIndexes.paidOut]);
      const paidInRaw = stripCurrencyChars(rowValues[headerIndexes.paidIn]);
      const paidOutVal = Number(paidOutRaw) || 0;
      const paidInVal = Number(paidInRaw) || 0;

      if (paidOutVal > 0) {
        amount = paidOutVal;
        direction = 'out';
      } else if (paidInVal > 0) {
        amount = paidInVal;
        direction = 'in';
      } else {
        amount = 0;
        direction = null;
      }
    } else {
      // Single signed or unsigned amount column
      const amountRaw = stripCurrencyChars(rowValues[headerIndexes.amount]);
      const parsedAmount = Number(amountRaw);
      const typeColumnValue = typeof headerIndexes.direction === 'number'
        ? `${rowValues[headerIndexes.direction] || ''}`.trim()
        : '';
      const binaryDirection = ALLOWED_DIRECTIONS.has(typeColumnValue.toLowerCase())
        ? typeColumnValue.toLowerCase()
        : null;
      direction = binaryDirection
        || inferDirectionFromAmount(parsedAmount)
        || mapTransactionTypeToDirection(typeColumnValue);
      amount = Math.abs(parsedAmount);
    }

    const transactionId = providedTransactionId || buildDeterministicTransactionId(
      ingestionId,
      rowIndex,
      bookedAt,
      amount,
      merchantName,
      direction || ''
    );

    const transactionResult = validateTransaction(
      {
        transactionId,
        bookedAt,
        amount,
        currency,
        merchantName,
        direction,
        status,
        categoryHint
      },
      rowIndex - headerLineIndex - 1
    );

    if (transactionResult.error) {
      rowErrors.push({
        rowNumber: rowIndex + 1,
        reason: transactionResult.error,
        row: lines[rowIndex]
      });
      continue;
    }

    transactions.push(transactionResult.value);
  }

  if (rowErrors.length > 0) {
    return {
      error: 'CSV import validation failed for one or more rows.',
      details: {
        filename,
        rowErrorCount: rowErrors.length,
        rowErrors
      }
    };
  }

  return {
    value: {
      ingestionId: ingestionId.toLowerCase().startsWith('csv:') ? ingestionId : `csv:${ingestionId}`,
      receivedAt: payload.receivedAt || new Date().toISOString(),
      transactions
    }
  };
}

function getMockBankSyncMetadata() {
  return {
    provider: SUPPORTED_PROVIDER,
    contractVersion: INTERNAL_CONTRACT_VERSION,
    providerStrategy: {
      preferredProvider: 'TrueLayer',
      rollout: 'Use a mock feed first, then progress to live UK Open Banking integration after contract and consent boundaries are stable.',
      reasons: [
        'UK-first bank coverage',
        'Suitable sandbox and consent journey for early development',
        'Clear path to production-grade Open Banking integration'
      ]
    },
    consentBoundaries: {
      requiredScopes: SUPPORTED_SCOPES,
      inScopeData: ['account metadata', 'booked transactions'],
      outOfScopeData: ['payments initiation', 'beneficiary management', 'live provider credentials']
    }
  };
}

async function linkMockBankAccount(email, payload) {
  const validationResult = validateMockBankLinkPayload(payload);

  if (validationResult.error) {
    return validationResult;
  }

  try {
    return {
      value: {
        metadata: getMockBankSyncMetadata(),
        status: await createMockBankLink(email, validationResult.value)
      }
    };
  } catch (error) {
    if (isBankSyncUnavailableError(error)) {
      return { error: BANK_SYNC_UNAVAILABLE_MESSAGE, statusCode: 503 };
    }

    throw error;
  }
}

async function getMockBankSyncStatus(email) {
  try {
    return {
      value: {
        metadata: getMockBankSyncMetadata(),
        status: await getBankSyncStatus(email)
      }
    };
  } catch (error) {
    if (isBankSyncUnavailableError(error)) {
      return { error: BANK_SYNC_UNAVAILABLE_MESSAGE, statusCode: 503 };
    }

    throw error;
  }
}

async function runMockBankIngestion(email, payload) {
  const validationResult = validateMockIngestionPayload(payload);

  if (validationResult.error) {
    return validationResult;
  }

  try {
    return {
      value: {
        metadata: getMockBankSyncMetadata(),
        ...(await ingestMockTransactions(email, validationResult.value))
      }
    };
  } catch (error) {
    if (isBankSyncUnavailableError(error)) {
      return { error: BANK_SYNC_UNAVAILABLE_MESSAGE, statusCode: 503 };
    }

    throw error;
  }
}

async function runCsvBankStatementImport(email, payload) {
  const parseResult = parseCsvIngestionPayload(payload);

  if (parseResult.error) {
    return {
      error: parseResult.error,
      details: parseResult.details,
      statusCode: 400
    };
  }

  try {
    return {
      value: {
        metadata: getMockBankSyncMetadata(),
        ...(await ingestMockTransactions(email, parseResult.value))
      }
    };
  } catch (error) {
    if (isBankSyncUnavailableError(error)) {
      return { error: BANK_SYNC_UNAVAILABLE_MESSAGE, statusCode: 503 };
    }

    throw error;
  }
}

async function listCsvImportHistory(email) {
  try {
    return {
      value: {
        metadata: getMockBankSyncMetadata(),
        imports: await getCsvImportHistory(email)
      }
    };
  } catch (error) {
    if (isBankSyncUnavailableError(error)) {
      return { error: BANK_SYNC_UNAVAILABLE_MESSAGE, statusCode: 503 };
    }

    throw error;
  }
}

module.exports = {
  getMockBankSyncMetadata,
  getMockBankSyncStatus,
  linkMockBankAccount,
  listCsvImportHistory,
  runCsvBankStatementImport,
  runMockBankIngestion
};