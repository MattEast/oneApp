// Live bank sync service — orchestrates provider adapter, consent flow, and transaction ingestion.
// This sits between the HTTP routes and the provider implementation + bank sync store.

const crypto = require('crypto');
const { CONSENT_STATUSES, PROVIDER_ERRORS, isProviderError } = require('./bankProviderAdapter');
const trueLayerProvider = require('./trueLayerProvider');
const {
  getBankSyncStatus,
  getProviderTokens,
  ingestMockTransactions,
  isBankSyncUnavailableError,
  persistConsentTokens,
  revokeConsentState,
  updateLastSyncAt,
  updateProviderTokens
} = require('../db/bankSyncStore');
const { logInfo, logWarn, logError, maskEmail } = require('../utils/observability');

const CONSENT_STATE_PREFIX = 'oneapp:consent:';
const LIVE_SYNC_CONTRACT_VERSION = '2026-04-live-sync-v1';
const FRESH_LAG_MINUTES = 30;
const DEGRADED_LAG_MINUTES = 360;

function getProvider() {
  return trueLayerProvider;
}

function generateConsentState(email) {
  const nonce = crypto.randomBytes(16).toString('hex');
  return `${CONSENT_STATE_PREFIX}${Buffer.from(email).toString('base64url')}:${nonce}`;
}

function parseConsentState(state) {
  if (!state || !state.startsWith(CONSENT_STATE_PREFIX)) {
    return null;
  }

  const payload = state.slice(CONSENT_STATE_PREFIX.length);
  const colonIndex = payload.indexOf(':');

  if (colonIndex === -1) {
    return null;
  }

  try {
    const email = Buffer.from(payload.slice(0, colonIndex), 'base64url').toString('utf-8');
    return { email };
  } catch {
    return null;
  }
}

function toIsoStringOrNull(value) {
  if (!value) {
    return null;
  }

  const parsed = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString();
}

function buildLinkedDataFreshness({ configured, linked, tokenStatus, lastSyncAt, lastWebhookAt }) {
  const normalizedLastSyncAt = toIsoStringOrNull(lastSyncAt);
  const normalizedLastWebhookAt = toIsoStringOrNull(lastWebhookAt);

  if (!linked) {
    return {
      status: 'not_linked',
      lagMinutes: null,
      lastSuccessfulSyncAt: normalizedLastSyncAt,
      lastWebhookAt: normalizedLastWebhookAt
    };
  }

  if (!configured && !normalizedLastSyncAt) {
    return {
      status: 'pending_initial_sync',
      lagMinutes: null,
      lastSuccessfulSyncAt: null,
      lastWebhookAt: normalizedLastWebhookAt
    };
  }

  if (!normalizedLastSyncAt) {
    return {
      status: 'pending_initial_sync',
      lagMinutes: null,
      lastSuccessfulSyncAt: null,
      lastWebhookAt: normalizedLastWebhookAt
    };
  }

  const lagMinutes = Math.max(
    Math.round((Date.now() - new Date(normalizedLastSyncAt).getTime()) / 60000),
    0
  );

  let status = 'fresh';

  if (tokenStatus !== 'valid' || lagMinutes >= DEGRADED_LAG_MINUTES) {
    status = 'degraded';
  } else if (lagMinutes >= FRESH_LAG_MINUTES) {
    status = 'stale';
  }

  return {
    status,
    lagMinutes,
    lastSuccessfulSyncAt: normalizedLastSyncAt,
    lastWebhookAt: normalizedLastWebhookAt
  };
}

async function initiateConsent(email) {
  const provider = getProvider();

  if (!provider.isConfigured()) {
    return {
      error: 'Bank linking is not available. The provider has not been configured.',
      statusCode: 503,
      configured: false
    };
  }

  const state = generateConsentState(email);

  try {
    const consentUrl = provider.buildConsentUrl(state);

    logInfo('bank_sync.consent.initiated', {
      email: maskEmail(email),
      provider: provider.getProviderName()
    });

    return {
      value: {
        consentUrl,
        provider: provider.getProviderName(),
        state
      }
    };
  } catch (error) {
    logError('bank_sync.consent.initiation_failed', {
      email: maskEmail(email),
      code: error.code,
      message: error.message
    });

    return {
      error: 'Unable to start bank linking. Please try again.',
      statusCode: 500
    };
  }
}

async function handleConsentCallback(code, state) {
  const parsed = parseConsentState(state);

  if (!parsed) {
    logWarn('bank_sync.callback.invalid_state', { state: state?.slice(0, 30) });
    return {
      error: 'Invalid or expired consent state. Please restart the bank linking process.',
      statusCode: 400
    };
  }

  const { email } = parsed;
  const provider = getProvider();

  try {
    const tokens = await provider.exchangeCode(code);

    logInfo('bank_sync.callback.token_exchanged', {
      email: maskEmail(email),
      provider: provider.getProviderName()
    });

    let linkedAccount = null;

    try {
      const accounts = await provider.fetchAccounts(tokens.accessToken);

      if (accounts.length > 0) {
        linkedAccount = accounts[0];
        logInfo('bank_sync.callback.account_discovered', {
          email: maskEmail(email),
          accountCount: accounts.length,
          selectedAccount: linkedAccount.accountName
        });
      }
    } catch (accountError) {
      logWarn('bank_sync.callback.account_discovery_failed', {
        email: maskEmail(email),
        code: accountError.code,
        message: accountError.message
      });
    }

    const status = await persistConsentTokens(email, {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.expiresIn,
      scopes: tokens.scopes,
      provider: provider.getProviderName(),
      linkedAccount
    });

    return {
      value: {
        status,
        linked: Boolean(linkedAccount),
        provider: provider.getProviderName(),
        contractVersion: LIVE_SYNC_CONTRACT_VERSION
      }
    };
  } catch (error) {
    logError('bank_sync.callback.failed', {
      email: maskEmail(email),
      code: error.code,
      message: error.message
    });

    if (isProviderError(error)) {
      return {
        error: 'Bank linking failed. The provider did not accept the authorisation. Please try again.',
        statusCode: 502
      };
    }

    return {
      error: 'An unexpected error occurred during bank linking.',
      statusCode: 500
    };
  }
}

async function runLiveSync(email) {
  const provider = getProvider();

  if (!provider.isConfigured()) {
    return {
      error: 'Live bank sync is not available. The provider has not been configured.',
      statusCode: 503
    };
  }

  const tokens = await getProviderTokens(email);

  if (!tokens || !tokens.accessToken) {
    return {
      error: 'No active bank link found. Please connect your bank account first.',
      statusCode: 400
    };
  }

  const isTokenExpired = tokens.expiresAt && new Date(tokens.expiresAt) <= new Date();

  let activeAccessToken = tokens.accessToken;

  if (isTokenExpired) {
    if (!tokens.refreshToken) {
      logWarn('bank_sync.live_sync.token_expired_no_refresh', {
        email: maskEmail(email)
      });
      return {
        error: 'Bank link has expired. Please reconnect your bank account.',
        statusCode: 401
      };
    }

    try {
      const refreshed = await provider.refreshAccessToken(tokens.refreshToken);
      activeAccessToken = refreshed.accessToken;

      await updateProviderTokens(email, {
        accessToken: refreshed.accessToken,
        refreshToken: refreshed.refreshToken,
        expiresIn: refreshed.expiresIn
      });

      logInfo('bank_sync.live_sync.token_refreshed', {
        email: maskEmail(email)
      });
    } catch (refreshError) {
      logError('bank_sync.live_sync.token_refresh_failed', {
        email: maskEmail(email),
        code: refreshError.code,
        message: refreshError.message
      });
      return {
        error: 'Bank link has expired and could not be refreshed. Please reconnect your bank account.',
        statusCode: 401
      };
    }
  }

  try {
    const status = await getBankSyncStatus(email);
    const accountId = status?.linkedAccount?.accountId;

    if (!accountId) {
      return {
        error: 'No linked account found. Please connect your bank account first.',
        statusCode: 400
      };
    }

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
    const from = thirtyDaysAgo.toISOString().split('T')[0];
    const to = now.toISOString().split('T')[0];

    const transactions = await provider.fetchTransactions(activeAccessToken, accountId, from, to);

    logInfo('bank_sync.live_sync.transactions_fetched', {
      email: maskEmail(email),
      count: transactions.length,
      from,
      to
    });

    if (transactions.length === 0) {
      await updateLastSyncAt(email);
      return {
        value: {
          syncSummary: {
            ingestionId: `live:${now.toISOString()}`,
            source: 'bank_linked',
            outcome: 'success',
            acceptedCount: 0,
            duplicateCount: 0,
            rejectedCount: 0
          },
          transactionCount: 0,
          contractVersion: LIVE_SYNC_CONTRACT_VERSION
        }
      };
    }

    const ingestion = {
      ingestionId: `live:${now.toISOString()}`,
      receivedAt: now.toISOString(),
      transactions
    };

    const result = await ingestMockTransactions(email, ingestion);
    await updateLastSyncAt(email);

    logInfo('bank_sync.live_sync.completed', {
      email: maskEmail(email),
      acceptedCount: result.syncSummary.acceptedCount,
      duplicateCount: result.syncSummary.duplicateCount,
      rejectedCount: result.syncSummary.rejectedCount
    });

    return {
      value: {
        ...result,
        contractVersion: LIVE_SYNC_CONTRACT_VERSION
      }
    };
  } catch (error) {
    if (isProviderError(error) && error.code === PROVIDER_ERRORS.TOKEN_EXPIRED) {
      return {
        error: 'Bank link session has expired. Please reconnect your bank account.',
        statusCode: 401
      };
    }

    if (isProviderError(error)) {
      logError('bank_sync.live_sync.provider_error', {
        email: maskEmail(email),
        code: error.code,
        message: error.message
      });
      return {
        error: 'Unable to fetch transactions from your bank. Please try again later.',
        statusCode: 502
      };
    }

    if (isBankSyncUnavailableError(error)) {
      return {
        error: 'Bank sync features are temporarily unavailable.',
        statusCode: 503
      };
    }

    throw error;
  }
}

async function revokeConsent(email) {
  const provider = getProvider();

  try {
    await provider.revokeConsent();
    await revokeConsentState(email);

    logInfo('bank_sync.consent.revoked', {
      email: maskEmail(email),
      provider: provider.getProviderName()
    });

    return {
      value: { revoked: true, provider: provider.getProviderName() }
    };
  } catch (error) {
    logError('bank_sync.consent.revocation_failed', {
      email: maskEmail(email),
      code: error.code,
      message: error.message
    });

    return {
      error: 'Unable to revoke bank link. Please try again.',
      statusCode: 500
    };
  }
}

async function getLiveSyncStatus(email) {
  const provider = getProvider();

  const status = await getBankSyncStatus(email);
  const tokens = await getProviderTokens(email);
  const isActive = Boolean(tokens?.accessToken);
  const isExpired = isActive && tokens.expiresAt && new Date(tokens.expiresAt) <= new Date();
  const canRefresh = isExpired && Boolean(tokens?.refreshToken);
  const tokenStatus = isActive
    ? (isExpired ? (canRefresh ? 'expired_refreshable' : 'expired') : 'valid')
    : 'none';

  return {
    ...status,
    liveSync: {
      configured: provider.isConfigured(),
      provider: provider.getProviderName(),
      linked: isActive,
      tokenStatus,
      contractVersion: LIVE_SYNC_CONTRACT_VERSION
    },
    linkedDataFreshness: buildLinkedDataFreshness({
      configured: provider.isConfigured(),
      linked: isActive,
      tokenStatus,
      lastSyncAt: status.lastSyncAt,
      lastWebhookAt: status.webhookState?.lastReceivedAt
    })
  };
}

module.exports = {
  LIVE_SYNC_CONTRACT_VERSION,
  buildLinkedDataFreshness,
  generateConsentState,
  getLiveSyncStatus,
  handleConsentCallback,
  initiateConsent,
  parseConsentState,
  revokeConsent,
  runLiveSync
};
