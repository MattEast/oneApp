// TrueLayer provider implementation conforming to the bank provider adapter contract.
// Uses TrueLayer Data API v2 for UK Open Banking.
// See: https://truelayer.com/docs/

const crypto = require('crypto');
const {
  CONSENT_STATUSES,
  PROVIDER_ERRORS,
  createProviderError
} = require('./bankProviderAdapter');
const { logInfo, logWarn, logError } = require('../utils/observability');

const REQUIRED_SCOPES = ['info', 'accounts', 'transactions', 'offline_access'];
const PROVIDER_NAME = 'truelayer';
const PROVIDER_DISPLAY_NAME = 'TrueLayer';

function getAuthBase() {
  return process.env.TRUELAYER_AUTH_BASE || 'https://auth.truelayer.com';
}

function getApiBase() {
  return process.env.TRUELAYER_API_BASE || 'https://api.truelayer.com';
}

function getClientId() {
  return process.env.TRUELAYER_CLIENT_ID || '';
}

function getClientSecret() {
  return process.env.TRUELAYER_CLIENT_SECRET || '';
}

function getRedirectUri() {
  return process.env.TRUELAYER_REDIRECT_URI || '';
}

function getWebhookSecret() {
  return process.env.TRUELAYER_WEBHOOK_SECRET || '';
}

function isConfigured() {
  return Boolean(getClientId() && getClientSecret() && getRedirectUri());
}

function isWebhookConfigured() {
  return Boolean(getWebhookSecret());
}

function getProviderName() {
  return PROVIDER_NAME;
}

function buildConsentUrl(state) {
  if (!isConfigured()) {
    throw createProviderError(
      PROVIDER_ERRORS.CONFIGURATION_MISSING,
      'TrueLayer provider is not configured. Set TRUELAYER_CLIENT_ID, TRUELAYER_CLIENT_SECRET, and TRUELAYER_REDIRECT_URI.'
    );
  }

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: getClientId(),
    scope: REQUIRED_SCOPES.join(' '),
    redirect_uri: getRedirectUri(),
    state
  });

  return `${getAuthBase()}/?${params.toString()}`;
}

async function exchangeCode(code) {
  if (!isConfigured()) {
    throw createProviderError(
      PROVIDER_ERRORS.CONFIGURATION_MISSING,
      'TrueLayer provider is not configured.'
    );
  }

  const response = await fetch(`${getAuthBase()}/connect/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      client_id: getClientId(),
      client_secret: getClientSecret(),
      redirect_uri: getRedirectUri(),
      code
    })
  });

  if (!response.ok) {
    const body = await response.text();
    logError('truelayer.token_exchange.failed', {
      status: response.status,
      body: body.slice(0, 200)
    });
    throw createProviderError(
      PROVIDER_ERRORS.TOKEN_EXCHANGE_FAILED,
      `Token exchange failed with status ${response.status}.`
    );
  }

  const tokens = await response.json();

  logInfo('truelayer.token_exchange.succeeded', {
    expiresIn: tokens.expires_in,
    scopes: tokens.scope
  });

  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token || null,
    expiresIn: tokens.expires_in,
    tokenType: tokens.token_type || 'Bearer',
    scopes: typeof tokens.scope === 'string' ? tokens.scope.split(' ') : REQUIRED_SCOPES
  };
}

async function refreshAccessToken(refreshToken) {
  if (!isConfigured()) {
    throw createProviderError(
      PROVIDER_ERRORS.CONFIGURATION_MISSING,
      'TrueLayer provider is not configured.'
    );
  }

  const response = await fetch(`${getAuthBase()}/connect/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'refresh_token',
      client_id: getClientId(),
      client_secret: getClientSecret(),
      refresh_token: refreshToken
    })
  });

  if (!response.ok) {
    const body = await response.text();
    logWarn('truelayer.token_refresh.failed', {
      status: response.status,
      body: body.slice(0, 200)
    });
    throw createProviderError(
      PROVIDER_ERRORS.TOKEN_EXPIRED,
      `Token refresh failed with status ${response.status}. User must re-consent.`
    );
  }

  const tokens = await response.json();

  logInfo('truelayer.token_refresh.succeeded', {
    expiresIn: tokens.expires_in
  });

  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token || refreshToken,
    expiresIn: tokens.expires_in
  };
}

async function fetchAccounts(accessToken) {
  const response = await fetch(`${getApiBase()}/data/v1/accounts`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (response.status === 401) {
    throw createProviderError(
      PROVIDER_ERRORS.TOKEN_EXPIRED,
      'Access token expired. Refresh required.'
    );
  }

  if (!response.ok) {
    throw createProviderError(
      PROVIDER_ERRORS.FETCH_FAILED,
      `Failed to fetch accounts: status ${response.status}.`
    );
  }

  const body = await response.json();

  return (body.results || []).map((account) => ({
    accountId: account.account_id,
    accountName: account.display_name || account.account_id,
    accountType: account.account_type || 'unknown',
    currency: account.currency || 'GBP',
    sortCodeMasked: maskSortCode(account.account_number?.sort_code || ''),
    last4: (account.account_number?.number || '').slice(-4) || '0000'
  }));
}

function maskSortCode(sortCode) {
  const digits = sortCode.replace(/\D/g, '');

  if (digits.length !== 6) {
    return '00-00-00';
  }

  return `${digits.slice(0, 2)}-${digits.slice(2, 4)}-${digits.slice(4, 6)}`;
}

async function fetchTransactions(accessToken, accountId, from, to) {
  const params = new URLSearchParams();

  if (from) {
    params.set('from', from);
  }

  if (to) {
    params.set('to', to);
  }

  const queryString = params.toString();
  const url = `${getApiBase()}/data/v1/accounts/${encodeURIComponent(accountId)}/transactions${queryString ? `?${queryString}` : ''}`;

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (response.status === 401) {
    throw createProviderError(
      PROVIDER_ERRORS.TOKEN_EXPIRED,
      'Access token expired. Refresh required.'
    );
  }

  if (!response.ok) {
    throw createProviderError(
      PROVIDER_ERRORS.FETCH_FAILED,
      `Failed to fetch transactions: status ${response.status}.`
    );
  }

  const body = await response.json();

  return (body.results || []).map((tx) => ({
    transactionId: tx.transaction_id,
    bookedAt: tx.timestamp,
    amount: Math.abs(tx.amount),
    currency: tx.currency || 'GBP',
    merchantName: tx.merchant_name || tx.description || 'Unknown',
    direction: tx.amount < 0 ? 'out' : 'in',
    status: tx.transaction_type === 'Pending' ? 'pending' : 'booked',
    categoryHint: tx.transaction_category || ''
  }));
}

async function revokeConsent() {
  logInfo('truelayer.consent.revoked', {
    note: 'Client-side consent record cleared. TrueLayer tokens expire naturally; explicit revocation is via TrueLayer dashboard or user bank app.'
  });

  return { revoked: true };
}

function signWebhookPayload(payload) {
  const secret = getWebhookSecret();

  if (!secret) {
    throw createProviderError(
      PROVIDER_ERRORS.CONFIGURATION_MISSING,
      'TrueLayer webhook verification is not configured.'
    );
  }

  const body = typeof payload === 'string' ? payload : JSON.stringify(payload || {});
  return crypto.createHmac('sha256', secret).update(body).digest('hex');
}

function verifyWebhookSignature(payload, signature) {
  if (!isWebhookConfigured()) {
    throw createProviderError(
      PROVIDER_ERRORS.CONFIGURATION_MISSING,
      'TrueLayer webhook verification is not configured.'
    );
  }

  if (!signature || typeof signature !== 'string') {
    return false;
  }

  const expected = signWebhookPayload(payload);
  const normalizedSignature = signature.replace(/^sha256=/i, '').trim().toLowerCase();

  if (normalizedSignature.length !== expected.length) {
    return false;
  }

  return crypto.timingSafeEqual(Buffer.from(expected, 'utf-8'), Buffer.from(normalizedSignature, 'utf-8'));
}

function normalizeWebhookEvent(payload) {
  const eventId = `${payload?.eventId || payload?.event_id || payload?.id || ''}`.trim();
  const eventType = `${payload?.type || payload?.eventType || payload?.event_type || ''}`.trim();
  const accountId = `${payload?.accountId || payload?.account_id || payload?.resource_id || payload?.account?.id || ''}`.trim();
  const occurredAt = `${payload?.occurredAt || payload?.occurred_at || payload?.created_at || new Date().toISOString()}`.trim();

  if (!eventId || !eventType || !accountId) {
    throw createProviderError(
      PROVIDER_ERRORS.FETCH_FAILED,
      'Webhook payload must include eventId, type, and accountId.'
    );
  }

  return {
    eventId,
    eventType,
    accountId,
    occurredAt,
    raw: payload || {}
  };
}

module.exports = {
  buildConsentUrl,
  exchangeCode,
  fetchAccounts,
  fetchTransactions,
  getProviderName,
  isConfigured,
  isWebhookConfigured,
  normalizeWebhookEvent,
  refreshAccessToken,
  revokeConsent,
  signWebhookPayload,
  verifyWebhookSignature
};
