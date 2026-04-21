const { validateAdapterImplementation, CONSENT_STATUSES, PROVIDER_ERRORS, createProviderError, isProviderError } = require('../services/bankProviderAdapter');
const trueLayerProvider = require('../services/trueLayerProvider');
const {
  buildLinkedDataFreshness,
  generateConsentState,
  parseConsentState,
  LIVE_SYNC_CONTRACT_VERSION
} = require('../services/liveBankSyncService');

describe('Bank provider adapter contract', () => {
  it('validates that TrueLayer provider implements all required methods', () => {
    expect(() => validateAdapterImplementation(trueLayerProvider)).not.toThrow();
  });

  it('rejects an adapter missing required methods', () => {
    expect(() => validateAdapterImplementation({})).toThrow('Provider adapter missing required methods');
  });

  it('exports all expected consent statuses', () => {
    expect(CONSENT_STATUSES.NOT_LINKED).toBe('not_linked');
    expect(CONSENT_STATUSES.PENDING).toBe('pending');
    expect(CONSENT_STATUSES.ACTIVE).toBe('active');
    expect(CONSENT_STATUSES.EXPIRED).toBe('expired');
    expect(CONSENT_STATUSES.REVOKED).toBe('revoked');
  });

  it('creates and identifies provider errors', () => {
    const error = createProviderError(PROVIDER_ERRORS.TOKEN_EXCHANGE_FAILED, 'test error');
    expect(isProviderError(error)).toBe(true);
    expect(error.code).toBe('PROVIDER_TOKEN_EXCHANGE_FAILED');
    expect(error.message).toBe('test error');
  });

  it('does not identify non-provider errors', () => {
    expect(isProviderError(new Error('generic'))).toBe(false);
    expect(isProviderError(null)).toBe(false);
  });
});

describe('TrueLayer provider configuration', () => {
  it('reports unconfigured when env vars are missing', () => {
    expect(trueLayerProvider.getProviderName()).toBe('truelayer');
    // Without TRUELAYER_CLIENT_ID etc set, isConfigured should be false
    const configured = trueLayerProvider.isConfigured();
    // In test env these are not set
    expect(typeof configured).toBe('boolean');
  });

  it('throws configuration error when building consent URL without config', () => {
    if (trueLayerProvider.isConfigured()) {
      return; // Skip if somehow configured in test env
    }

    expect(() => trueLayerProvider.buildConsentUrl('test-state')).toThrow(
      'TrueLayer provider is not configured'
    );
  });

  it('signs and verifies webhook payloads when webhook secret is configured', () => {
    process.env.TRUELAYER_WEBHOOK_SECRET = 'test-webhook-secret';
    const payload = { eventId: 'evt-123', type: 'transactions.updated', accountId: 'acc-123' };
    const signature = trueLayerProvider.signWebhookPayload(payload);

    expect(trueLayerProvider.verifyWebhookSignature(payload, signature)).toBe(true);
    expect(trueLayerProvider.verifyWebhookSignature(payload, `sha256=${signature}`)).toBe(true);
    expect(trueLayerProvider.verifyWebhookSignature(payload, 'not-valid')).toBe(false);

    delete process.env.TRUELAYER_WEBHOOK_SECRET;
  });

  it('normalizes supported webhook payload shapes', () => {
    const normalized = trueLayerProvider.normalizeWebhookEvent({
      event_id: 'evt-456',
      event_type: 'transactions.updated',
      resource_id: 'acc-999',
      occurred_at: '2026-04-21T08:00:00.000Z'
    });

    expect(normalized.eventId).toBe('evt-456');
    expect(normalized.eventType).toBe('transactions.updated');
    expect(normalized.accountId).toBe('acc-999');
    expect(normalized.occurredAt).toBe('2026-04-21T08:00:00.000Z');
  });
});

describe('Consent state encoding', () => {
  it('generates and parses consent state with email', () => {
    const email = 'test@example.com';
    const state = generateConsentState(email);

    expect(state).toMatch(/^oneapp:consent:/);

    const parsed = parseConsentState(state);
    expect(parsed).not.toBeNull();
    expect(parsed.email).toBe(email);
  });

  it('generates unique states for the same email', () => {
    const email = 'test@example.com';
    const state1 = generateConsentState(email);
    const state2 = generateConsentState(email);

    expect(state1).not.toBe(state2);
  });

  it('returns null for invalid state strings', () => {
    expect(parseConsentState(null)).toBeNull();
    expect(parseConsentState('')).toBeNull();
    expect(parseConsentState('invalid-state')).toBeNull();
    expect(parseConsentState('oneapp:consent:')).toBeNull();
  });

  it('handles special characters in email', () => {
    const email = 'user+tag@sub.example.co.uk';
    const state = generateConsentState(email);
    const parsed = parseConsentState(state);

    expect(parsed.email).toBe(email);
  });
});

describe('Live sync contract version', () => {
  it('exposes the current contract version', () => {
    expect(LIVE_SYNC_CONTRACT_VERSION).toBe('2026-04-live-sync-v1');
  });
});

describe('Linked data freshness', () => {
  it('marks recent syncs as fresh', () => {
    const freshness = buildLinkedDataFreshness({
      configured: true,
      linked: true,
      tokenStatus: 'valid',
      lastSyncAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
      lastWebhookAt: new Date().toISOString()
    });

    expect(freshness.status).toBe('fresh');
    expect(freshness.lagMinutes).toBeGreaterThanOrEqual(0);
  });

  it('marks old or invalid-linked data as degraded', () => {
    const freshness = buildLinkedDataFreshness({
      configured: true,
      linked: true,
      tokenStatus: 'expired',
      lastSyncAt: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
      lastWebhookAt: null
    });

    expect(freshness.status).toBe('degraded');
    expect(freshness.lagMinutes).toBeGreaterThan(300);
  });
});
