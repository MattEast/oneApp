const request = require('supertest');
const express = require('express');
const registerRoute = require('../register');
const prisma = require('../db/prisma');
const trueLayerProvider = require('../services/trueLayerProvider');

async function registerAndLogin(app, {
  fullname = 'Live Sync Route User',
  email = `livesync_${Math.random().toString(36).slice(2, 8)}@example.com`,
  password = 'password123'
} = {}) {
  await request(app)
    .post('/api/v1/register')
    .send({ fullname, email, password });

  const loginResponse = await request(app)
    .post('/api/v1/login')
    .send({ email, password });

  return {
    email,
    token: loginResponse.body.data.token
  };
}

async function createLiveLinkedProfile(email, accountId = 'acc-live-123') {
  const user = await prisma.user.findUnique({ where: { email } });
  const profile = await prisma.bankSyncProfile.upsert({
    where: { userId: user.id },
    update: {},
    create: {
      userId: user.id,
      provider: 'truelayer',
      providerDisplayName: 'TrueLayer',
      providerStrategy: { preferredProvider: 'TrueLayer', reason: 'test' },
      consent: { status: 'active', scopes: ['accounts', 'transactions'], grantedAt: new Date().toISOString() }
    }
  });

  const futureExpiry = new Date(Date.now() + 3600 * 1000).toISOString();

  await prisma.bankSyncProfile.update({
    where: { id: profile.id },
    data: {
      providerTokens: {
        accessToken: 'test-access-token',
        refreshToken: 'test-refresh-token',
        expiresAt: futureExpiry,
        issuedAt: new Date().toISOString()
      },
      linkedAccount: {
        accountId,
        accountName: 'Webhook Test Account',
        sortCodeMasked: '**-**-01',
        last4: '1234'
      }
    }
  });

  return profile;
}

afterAll(async () => {
  delete process.env.TRUELAYER_WEBHOOK_SECRET;
  await prisma.$disconnect();
});

describe('Live bank sync routes', () => {
  let app;

  beforeEach(() => {
    process.env.TRUELAYER_WEBHOOK_SECRET = 'test-webhook-secret';
    app = express();
    app.use(express.json());
    app.use('/api/v1', registerRoute);
  });

  afterEach(() => {
    delete process.env.TRUELAYER_WEBHOOK_SECRET;
  });

  describe('POST /bank-sync/connect', () => {
    it('returns 503 when provider is not configured', async () => {
      const { token } = await registerAndLogin(app);

      const response = await request(app)
        .post('/api/v1/bank-sync/connect')
        .set('Authorization', `Bearer ${token}`);

      // Provider env vars not set in test, so should return 503
      expect(response.statusCode).toBe(503);
      expect(response.body.error).toMatch(/not available|not configured/i);
    });

    it('rejects unauthenticated requests', async () => {
      const response = await request(app)
        .post('/api/v1/bank-sync/connect');

      expect(response.statusCode).toBe(401);
    });
  });

  describe('POST /bank-sync/callback', () => {
    it('rejects missing code parameter', async () => {
      const { token } = await registerAndLogin(app);

      const response = await request(app)
        .post('/api/v1/bank-sync/callback')
        .set('Authorization', `Bearer ${token}`)
        .send({ state: 'some-state' });

      expect(response.statusCode).toBe(400);
      expect(response.body.error).toMatch(/code/i);
    });

    it('rejects missing state parameter', async () => {
      const { token } = await registerAndLogin(app);

      const response = await request(app)
        .post('/api/v1/bank-sync/callback')
        .set('Authorization', `Bearer ${token}`)
        .send({ code: 'some-code' });

      expect(response.statusCode).toBe(400);
      expect(response.body.error).toMatch(/state/i);
    });

    it('rejects invalid state token', async () => {
      const { token } = await registerAndLogin(app);

      const response = await request(app)
        .post('/api/v1/bank-sync/callback')
        .set('Authorization', `Bearer ${token}`)
        .send({ code: 'some-code', state: 'invalid-state' });

      expect(response.statusCode).toBe(400);
      expect(response.body.error).toMatch(/invalid|expired/i);
    });

    it('rejects unauthenticated requests', async () => {
      const response = await request(app)
        .post('/api/v1/bank-sync/callback')
        .send({ code: 'some-code', state: 'some-state' });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('POST /bank-sync/sync', () => {
    it('returns error when no bank link exists', async () => {
      const { token } = await registerAndLogin(app);

      const response = await request(app)
        .post('/api/v1/bank-sync/sync')
        .set('Authorization', `Bearer ${token}`);

      // Either 503 (not configured) or 400 (no active link)
      expect([400, 503]).toContain(response.statusCode);
    });

    it('rejects unauthenticated requests', async () => {
      const response = await request(app)
        .post('/api/v1/bank-sync/sync');

      expect(response.statusCode).toBe(401);
    });
  });

  describe('GET /bank-sync/live-status', () => {
    it('returns live sync status for authenticated user', async () => {
      const { token } = await registerAndLogin(app);

      const response = await request(app)
        .get('/api/v1/bank-sync/live-status')
        .set('Authorization', `Bearer ${token}`);

      expect(response.statusCode).toBe(200);
      expect(response.body.data.liveSync).toBeDefined();
      expect(typeof response.body.data.liveSync.configured).toBe('boolean');
      expect(response.body.data.liveSync.provider).toBe('truelayer');
      expect(response.body.data.liveSync.linked).toBe(false);
      expect(response.body.data.liveSync.tokenStatus).toBe('none');
      expect(response.body.data.liveSync.contractVersion).toBe('2026-04-live-sync-v1');
      expect(response.body.data.linkedDataFreshness.status).toBe('not_linked');
    });

    it('returns linked freshness metadata for live-linked accounts', async () => {
      const { email, token } = await registerAndLogin(app);
      const accountId = `acc-freshness-${Date.now()}`;
      const profile = await createLiveLinkedProfile(email, accountId);

      await prisma.bankSyncProfile.update({
        where: { id: profile.id },
        data: {
          lastSyncAt: new Date(Date.now() - 15 * 60 * 1000),
          syncCheckpoint: {
            lastWebhookAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
            lastWebhookEventId: 'evt-freshness-001',
            recentWebhookEventIds: ['evt-freshness-001']
          }
        }
      });

      const response = await request(app)
        .get('/api/v1/bank-sync/live-status')
        .set('Authorization', `Bearer ${token}`);

      expect(response.statusCode).toBe(200);
      expect(response.body.data.liveSync.linked).toBe(true);
      expect(response.body.data.linkedDataFreshness.status).toBe('fresh');
      expect(response.body.data.linkedDataFreshness.lastSuccessfulSyncAt).toBeDefined();
      expect(response.body.data.webhookState.lastEventId).toBe('evt-freshness-001');
    });

    it('rejects unauthenticated requests', async () => {
      const response = await request(app)
        .get('/api/v1/bank-sync/live-status');

      expect(response.statusCode).toBe(401);
    });
  });

  describe('POST /bank-sync/disconnect', () => {
    it('revokes consent state for authenticated user', async () => {
      const { token } = await registerAndLogin(app);

      const response = await request(app)
        .post('/api/v1/bank-sync/disconnect')
        .set('Authorization', `Bearer ${token}`);

      expect(response.statusCode).toBe(200);
      expect(response.body.data.revoked).toBe(true);
      expect(response.body.data.provider).toBe('truelayer');
    });

    it('rejects unauthenticated requests', async () => {
      const response = await request(app)
        .post('/api/v1/bank-sync/disconnect');

      expect(response.statusCode).toBe(401);
    });

    it('shows revoked consent in live-status after disconnect', async () => {
      const { token } = await registerAndLogin(app);

      await request(app)
        .post('/api/v1/bank-sync/disconnect')
        .set('Authorization', `Bearer ${token}`);

      const statusResponse = await request(app)
        .get('/api/v1/bank-sync/live-status')
        .set('Authorization', `Bearer ${token}`);

      expect(statusResponse.statusCode).toBe(200);
      expect(statusResponse.body.data.consent.status).toBe('revoked');
      expect(statusResponse.body.data.liveSync.linked).toBe(false);
      expect(statusResponse.body.data.liveSync.tokenStatus).toBe('none');
    });
  });

  describe('POST /bank-sync/webhook', () => {
    it('rejects invalid webhook signatures', async () => {
      const response = await request(app)
        .post('/api/v1/bank-sync/webhook')
        .set('x-truelayer-signature', 'invalid')
        .send({ eventId: 'evt-invalid', type: 'transactions.updated', accountId: 'acc-invalid' });

      expect(response.statusCode).toBe(401);
      expect(response.body.error).toMatch(/signature/i);
    });

    it('accepts a valid webhook and enqueues an incremental sync job', async () => {
      const { email } = await registerAndLogin(app);
      const accountId = `acc-webhook-${Date.now()}`;
      const createdProfile = await createLiveLinkedProfile(email, accountId);

      const payload = {
        eventId: 'evt-webhook-001',
        type: 'transactions.updated',
        accountId,
        occurredAt: '2026-04-21T08:30:00.000Z'
      };

      const response = await request(app)
        .post('/api/v1/bank-sync/webhook')
        .set('x-truelayer-signature', trueLayerProvider.signWebhookPayload(payload))
        .send(payload);

      expect([200, 202]).toContain(response.statusCode);
      expect(response.body.data.acknowledged).toBe(true);
      expect(response.body.data.eventId).toBe('evt-webhook-001');
      expect(response.body.data.jobId).toBeDefined();

      const profile = await prisma.bankSyncProfile.findFirst({
        where: { id: createdProfile.id }
      });

      expect(profile.syncCheckpoint.lastWebhookEventId).toBe('evt-webhook-001');
    });

    it('treats replayed webhook events as deduplicated acknowledgements', async () => {
      const { email } = await registerAndLogin(app);
      const accountId = `acc-webhook-${Date.now()}-replay`;
      await createLiveLinkedProfile(email, accountId);

      const payload = {
        eventId: 'evt-webhook-002',
        type: 'transactions.updated',
        accountId,
        occurredAt: '2026-04-21T09:00:00.000Z'
      };
      const signature = trueLayerProvider.signWebhookPayload(payload);

      await request(app)
        .post('/api/v1/bank-sync/webhook')
        .set('x-truelayer-signature', signature)
        .send(payload);

      const replay = await request(app)
        .post('/api/v1/bank-sync/webhook')
        .set('x-truelayer-signature', signature)
        .send(payload);

      expect(replay.statusCode).toBe(200);
      expect(replay.body.data.acknowledged).toBe(true);
      expect(replay.body.data.deduplicated).toBe(true);
    });
  });

  describe('GET /dashboard-summary', () => {
    it('includes linked-data freshness metadata for live-linked users', async () => {
      const { email, token } = await registerAndLogin(app);
      const accountId = `acc-dashboard-${Date.now()}`;
      const profile = await createLiveLinkedProfile(email, accountId);

      await prisma.bankSyncProfile.update({
        where: { id: profile.id },
        data: {
          lastSyncAt: new Date(Date.now() - 20 * 60 * 1000),
          syncCheckpoint: {
            lastWebhookAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
            recentWebhookEventIds: ['evt-dashboard-001']
          }
        }
      });

      const response = await request(app)
        .get('/api/v1/dashboard-summary')
        .set('Authorization', `Bearer ${token}`);

      expect(response.statusCode).toBe(200);
      expect(response.body.data.linkedDataFreshness).toEqual(
        expect.objectContaining({ status: 'fresh' })
      );
    });
  });
});
