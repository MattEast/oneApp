const SUPPORTED_PROVIDER = 'truelayer_mock';

const bankSyncProfiles = new Map();

function cloneValue(value) {
  return JSON.parse(JSON.stringify(value));
}

function createDefaultProfile(email) {
  return {
    email,
    provider: SUPPORTED_PROVIDER,
    providerDisplayName: 'TrueLayer sandbox-compatible mock feed',
    providerStrategy: {
      preferredProvider: 'TrueLayer',
      reason: 'UK-first Open Banking coverage with a clear sandbox path for development and testing.'
    },
    consent: {
      status: 'not_linked',
      scopes: ['accounts', 'transactions'],
      grantedAt: null,
      expiresAt: null
    },
    linkedAccount: null,
    transactions: [],
    transactionIds: [],
    syncHistory: []
  };
}

function getOrCreateStoredProfile(email) {
  if (!bankSyncProfiles.has(email)) {
    bankSyncProfiles.set(email, createDefaultProfile(email));
  }

  return bankSyncProfiles.get(email);
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
    latestSync: cloneValue(latestSync)
  };
}

function createMockBankLink(email, payload) {
  const profile = getOrCreateStoredProfile(email);
  const linkedAt = payload.linkedAt || new Date().toISOString();
  const expiryDate = payload.expiresAt || new Date(Date.now() + (90 * 24 * 60 * 60 * 1000)).toISOString();

  profile.consent = {
    status: 'active',
    scopes: ['accounts', 'transactions'],
    grantedAt: linkedAt,
    expiresAt: expiryDate
  };

  profile.linkedAccount = {
    accountId: payload.accountId,
    accountName: payload.accountName,
    sortCodeMasked: payload.sortCodeMasked,
    last4: payload.last4,
    linkedAt
  };

  return buildStatus(profile);
}

function ingestMockTransactions(email, ingestion) {
  const profile = getOrCreateStoredProfile(email);
  const accepted = [];
  const duplicates = [];
  const rejected = [];

  ingestion.transactions.forEach((transaction) => {
    if (profile.transactionIds.includes(transaction.transactionId)) {
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

    profile.transactions.push(cloneValue(transaction));
    profile.transactionIds.push(transaction.transactionId);
    accepted.push(transaction.transactionId);
  });

  const outcome = rejected.length > 0
    ? 'partial_success'
    : duplicates.length > 0
      ? 'success_with_duplicates'
      : 'success';

  const syncSummary = {
    ingestionId: ingestion.ingestionId,
    receivedAt: ingestion.receivedAt,
    outcome,
    acceptedCount: accepted.length,
    duplicateCount: duplicates.length,
    rejectedCount: rejected.length,
    acceptedTransactionIds: accepted,
    duplicateTransactionIds: duplicates,
    rejectedTransactions: rejected
  };

  profile.syncHistory.push(syncSummary);

  return {
    status: buildStatus(profile),
    syncSummary: cloneValue(syncSummary),
    transactions: cloneValue(profile.transactions)
  };
}

function getBankSyncStatus(email) {
  return buildStatus(getOrCreateStoredProfile(email));
}

function getBankSyncTransactions(email) {
  return cloneValue(getOrCreateStoredProfile(email).transactions);
}

function resetBankSyncState() {
  bankSyncProfiles.clear();
}

module.exports = {
  SUPPORTED_PROVIDER,
  createMockBankLink,
  getBankSyncTransactions,
  getBankSyncStatus,
  ingestMockTransactions,
  resetBankSyncState
};