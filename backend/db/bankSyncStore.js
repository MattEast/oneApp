const prisma = require('./prisma');
const { toMajorUnits, toMinorUnits } = require('../utils/money');
const { logWarn } = require('../utils/observability');

const SUPPORTED_PROVIDER = 'truelayer_mock';
const BANK_SYNC_UNAVAILABLE_MESSAGE = 'Linked-account features are temporarily unavailable until required database migrations are applied.';

const DEFAULT_PROVIDER_STRATEGY = {
  preferredProvider: 'TrueLayer',
  reason: 'UK-first Open Banking coverage with a clear sandbox path for development and testing.'
};

const DEFAULT_CONSENT = {
  status: 'not_linked',
  scopes: ['accounts', 'transactions'],
  grantedAt: null,
  expiresAt: null
};

function cloneValue(value) {
  return JSON.parse(JSON.stringify(value));
}

function getProfileInclude() {
  return {
    transactions: {
      orderBy: [
        { bookedAt: 'asc' },
        { createdAt: 'asc' }
      ]
    },
    syncHistory: {
      orderBy: [
        { receivedAt: 'asc' },
        { createdAt: 'asc' }
      ]
    }
  };
}

function serializeTransaction(transaction) {
  return {
    transactionId: transaction.transactionId,
    bookedAt: transaction.bookedAt.toISOString(),
    amount: toMajorUnits(transaction.amountMinor),
    currency: transaction.currency,
    merchantName: transaction.merchantName,
    direction: transaction.direction,
    status: transaction.status,
    categoryHint: transaction.categoryHint || ''
  };
}

function serializeSyncSummary(summary) {
  return {
    ingestionId: summary.ingestionId,
    receivedAt: summary.receivedAt.toISOString(),
    source: inferSyncSource(summary.ingestionId),
    outcome: summary.outcome,
    acceptedCount: summary.acceptedCount,
    duplicateCount: summary.duplicateCount,
    rejectedCount: summary.rejectedCount,
    acceptedTransactionIds: cloneValue(summary.acceptedTransactionIds),
    duplicateTransactionIds: cloneValue(summary.duplicateTransactionIds),
    rejectedTransactions: cloneValue(summary.rejectedTransactions)
  };
}

function inferSyncSource(ingestionId) {
  const normalized = `${ingestionId || ''}`.toLowerCase();

  if (normalized.startsWith('csv:') || normalized.startsWith('csv-') || normalized.startsWith('csv_')) {
    return 'csv_import';
  }

  return 'bank_linked';
}

function buildStatus(profile) {
  const latestSync = profile.syncHistory[profile.syncHistory.length - 1] || null;

  return {
    provider: profile.provider,
    providerDisplayName: profile.providerDisplayName,
    providerStrategy: cloneValue(profile.providerStrategy),
    consent: cloneValue(profile.consent),
    linkedAccount: cloneValue(profile.linkedAccount),
    transactionCount: profile.transactions.length,
    latestSync: latestSync ? serializeSyncSummary(latestSync) : null
  };
}

function buildUnavailableStatus() {
  return {
    provider: SUPPORTED_PROVIDER,
    providerDisplayName: 'TrueLayer sandbox-compatible mock feed',
    providerStrategy: cloneValue(DEFAULT_PROVIDER_STRATEGY),
    consent: cloneValue(DEFAULT_CONSENT),
    linkedAccount: null,
    transactionCount: 0,
    latestSync: null,
    availability: {
      status: 'unavailable',
      message: BANK_SYNC_UNAVAILABLE_MESSAGE
    }
  };
}

function isMissingBankSyncPersistenceError(error) {
  if (!error || (error.code !== 'P2021' && error.code !== 'P2022')) {
    return false;
  }

  const tableName = `${error.meta?.table || ''}`;
  const modelName = `${error.meta?.modelName || ''}`;
  const message = error.message || '';

  return tableName.includes('BankSync') || modelName.includes('BankSync') || message.includes('BankSync');
}

function createBankSyncUnavailableError(cause) {
  const error = new Error(BANK_SYNC_UNAVAILABLE_MESSAGE);
  error.code = 'BANK_SYNC_UNAVAILABLE';
  error.cause = cause;
  return error;
}

function isBankSyncUnavailableError(error) {
  return Boolean(error && error.code === 'BANK_SYNC_UNAVAILABLE');
}

function handleBankSyncPersistenceError(operationName, error) {
  if (!isMissingBankSyncPersistenceError(error)) {
    throw error;
  }

  logWarn('bank_sync.persistence.unavailable', {
    operation: operationName,
    code: error.code,
    table: error.meta?.table,
    modelName: error.meta?.modelName
  });

  throw createBankSyncUnavailableError(error);
}

async function getUserByEmail(email) {
  return await prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() },
    select: { id: true }
  });
}

async function getOrCreateStoredProfile(email) {
  try {
    const user = await getUserByEmail(email);

    if (!user) {
      throw new Error('User not found for bank sync profile');
    }

    await prisma.bankSyncProfile.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        provider: SUPPORTED_PROVIDER,
        providerDisplayName: 'TrueLayer sandbox-compatible mock feed',
        providerStrategy: DEFAULT_PROVIDER_STRATEGY,
        consent: DEFAULT_CONSENT
      }
    });

    return await prisma.bankSyncProfile.findUnique({
      where: { userId: user.id },
      include: getProfileInclude()
    });
  } catch (error) {
    handleBankSyncPersistenceError('get_or_create_profile', error);
  }
}

async function createMockBankLink(email, payload) {
  const profile = await getOrCreateStoredProfile(email);
  const linkedAt = payload.linkedAt || new Date().toISOString();
  const expiryDate = payload.expiresAt || new Date(Date.now() + (90 * 24 * 60 * 60 * 1000)).toISOString();

  const updatedProfile = await prisma.bankSyncProfile.update({
    where: { userId: profile.userId },
    data: {
      consent: {
        status: 'active',
        scopes: ['accounts', 'transactions'],
        grantedAt: linkedAt,
        expiresAt: expiryDate
      },
      linkedAccount: {
        accountId: payload.accountId,
        accountName: payload.accountName,
        sortCodeMasked: payload.sortCodeMasked,
        last4: payload.last4,
        linkedAt
      }
    },
    include: getProfileInclude()
  });

  return buildStatus(updatedProfile);
}

async function ingestMockTransactions(email, ingestion) {
  const profile = await getOrCreateStoredProfile(email);
  const existingTransactionIds = new Set(profile.transactions.map((transaction) => transaction.transactionId));
  const accepted = [];
  const duplicates = [];
  const rejected = [];
  const transactionsToCreate = [];

  ingestion.transactions.forEach((transaction) => {
    if (existingTransactionIds.has(transaction.transactionId)) {
      duplicates.push(transaction.transactionId);
      return;
    }

    if (transaction.status === 'pending') {
      rejected.push({
        transactionId: transaction.transactionId,
        reason: 'Pending transactions are not ingested until they are booked.'
      });
      return;
    }

    existingTransactionIds.add(transaction.transactionId);
    accepted.push(transaction.transactionId);
    transactionsToCreate.push({
      profileId: profile.id,
      transactionId: transaction.transactionId,
      bookedAt: new Date(transaction.bookedAt),
      amountMinor: toMinorUnits(transaction.amount),
      currency: transaction.currency,
      merchantName: transaction.merchantName,
      direction: transaction.direction,
      status: transaction.status,
      categoryHint: transaction.categoryHint || null
    });
  });

  const outcome = rejected.length > 0
    ? 'partial_success'
    : duplicates.length > 0
      ? 'success_with_duplicates'
      : 'success';

  try {
    await prisma.$transaction(async (tx) => {
      if (transactionsToCreate.length > 0) {
        await tx.bankSyncTransaction.createMany({ data: transactionsToCreate });
      }

      await tx.bankSyncSyncSummary.create({
        data: {
          profileId: profile.id,
          ingestionId: ingestion.ingestionId,
          receivedAt: new Date(ingestion.receivedAt),
          outcome,
          acceptedCount: accepted.length,
          duplicateCount: duplicates.length,
          rejectedCount: rejected.length,
          acceptedTransactionIds: accepted,
          duplicateTransactionIds: duplicates,
          rejectedTransactions: rejected
        }
      });
    });

    const updatedProfile = await prisma.bankSyncProfile.findUnique({
      where: { id: profile.id },
      include: getProfileInclude()
    });
    const latestSync = updatedProfile.syncHistory[updatedProfile.syncHistory.length - 1];

    return {
      status: buildStatus(updatedProfile),
      syncSummary: serializeSyncSummary(latestSync),
      transactions: updatedProfile.transactions.map(serializeTransaction)
    };
  } catch (error) {
    handleBankSyncPersistenceError('ingest_transactions', error);
  }
}

async function getBankSyncStatus(email) {
  try {
    return buildStatus(await getOrCreateStoredProfile(email));
  } catch (error) {
    if (isBankSyncUnavailableError(error)) {
      return buildUnavailableStatus();
    }

    throw error;
  }
}

async function getBankSyncTransactions(email) {
  const profile = await getOrCreateStoredProfile(email);
  return profile.transactions.map(serializeTransaction);
}

async function getCsvImportHistory(email) {
  const profile = await getOrCreateStoredProfile(email);

  return profile.syncHistory
    .map(serializeSyncSummary)
    .filter((summary) => summary.source === 'csv_import')
    .sort((left, right) => new Date(right.receivedAt) - new Date(left.receivedAt));
}

async function resetBankSyncState() {
  await prisma.bankSyncSyncSummary.deleteMany();
  await prisma.bankSyncTransaction.deleteMany();
  await prisma.bankSyncProfile.deleteMany();
}

module.exports = {
  BANK_SYNC_UNAVAILABLE_MESSAGE,
  SUPPORTED_PROVIDER,
  createMockBankLink,
  createBankSyncUnavailableError,
  getCsvImportHistory,
  getBankSyncTransactions,
  getBankSyncStatus,
  ingestMockTransactions,
  isBankSyncUnavailableError,
  resetBankSyncState
};