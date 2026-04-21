// Provider-agnostic bank integration adapter contract.
// All provider-specific implementations must conform to this interface.
// See ADR 0005 (UK market baseline) and docs/TECH_STACK.md for provider strategy.

const ADAPTER_CONTRACT_VERSION = '2026-04-provider-adapter-v1';

const CONSENT_STATUSES = {
  NOT_LINKED: 'not_linked',
  PENDING: 'pending',
  ACTIVE: 'active',
  EXPIRED: 'expired',
  REVOKED: 'revoked'
};

const PROVIDER_ERRORS = {
  CONFIGURATION_MISSING: 'PROVIDER_CONFIGURATION_MISSING',
  CONSENT_FAILED: 'PROVIDER_CONSENT_FAILED',
  TOKEN_EXCHANGE_FAILED: 'PROVIDER_TOKEN_EXCHANGE_FAILED',
  FETCH_FAILED: 'PROVIDER_FETCH_FAILED',
  REVOCATION_FAILED: 'PROVIDER_REVOCATION_FAILED',
  TOKEN_EXPIRED: 'PROVIDER_TOKEN_EXPIRED'
};

function createProviderError(code, message, cause) {
  const error = new Error(message);
  error.code = code;
  if (cause) {
    error.cause = cause;
  }
  return error;
}

function isProviderError(error) {
  return Boolean(error && Object.values(PROVIDER_ERRORS).includes(error.code));
}

function validateAdapterImplementation(adapter) {
  const required = [
    'getProviderName',
    'isConfigured',
    'buildConsentUrl',
    'exchangeCode',
    'fetchAccounts',
    'fetchTransactions',
    'revokeConsent'
  ];

  const missing = required.filter((method) => typeof adapter[method] !== 'function');

  if (missing.length > 0) {
    throw new Error(`Provider adapter missing required methods: ${missing.join(', ')}`);
  }
}

module.exports = {
  ADAPTER_CONTRACT_VERSION,
  CONSENT_STATUSES,
  PROVIDER_ERRORS,
  createProviderError,
  isProviderError,
  validateAdapterImplementation
};
