const validator = require('validator');
const {
  SUPPORTED_PROVIDER,
  createMockBankLink,
  getBankSyncStatus,
  ingestMockTransactions
} = require('../data/bankSyncStore');

const SUPPORTED_SCOPES = ['accounts', 'transactions'];
const ALLOWED_DIRECTIONS = new Set(['in', 'out']);
const ALLOWED_STATUSES = new Set(['booked', 'pending']);
const INTERNAL_CONTRACT_VERSION = '2026-04-mock-linked-transactions-v1';

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

function linkMockBankAccount(email, payload) {
  const validationResult = validateMockBankLinkPayload(payload);

  if (validationResult.error) {
    return validationResult;
  }

  return {
    value: {
      metadata: getMockBankSyncMetadata(),
      status: createMockBankLink(email, validationResult.value)
    }
  };
}

function getMockBankSyncStatus(email) {
  return {
    value: {
      metadata: getMockBankSyncMetadata(),
      status: getBankSyncStatus(email)
    }
  };
}

function runMockBankIngestion(email, payload) {
  const validationResult = validateMockIngestionPayload(payload);

  if (validationResult.error) {
    return validationResult;
  }

  return {
    value: {
      metadata: getMockBankSyncMetadata(),
      ...ingestMockTransactions(email, validationResult.value)
    }
  };
}

module.exports = {
  getMockBankSyncMetadata,
  getMockBankSyncStatus,
  linkMockBankAccount,
  runMockBankIngestion
};