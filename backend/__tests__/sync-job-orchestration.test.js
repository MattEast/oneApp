const request = require('supertest');
const express = require('express');
const registerRoute = require('../register');
const prisma = require('../db/prisma');
const {
  SYNC_JOB_CONTRACT_VERSION,
  JOB_TYPES,
  JOB_STATUSES,
  DEFAULT_MAX_ATTEMPTS,
  calculateBackoffMs,
  buildSyncWindow,
  enqueueSyncJob,
  executeSyncJob,
  getJobHistory,
  getJobStatus,
  getRetryableJobs,
  processRetryableJobs
} = require('../services/syncJobOrchestrator');
const { createProviderError, PROVIDER_ERRORS } = require('../services/bankProviderAdapter');
const { runFallbackPollingSweep } = require('../services/liveBankWebhookService');

async function registerAndLogin(app, {
  fullname = 'Sync Job User',
  email = `syncjob_${Math.random().toString(36).slice(2, 8)}@example.com`,
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

async function createProfileWithTokens(email) {
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
        accountId: 'acc-123',
        accountName: 'Test Account',
        sortCodeMasked: '**-**-01',
        last4: '1234'
      }
    }
  });

  return profile;
}

function createMockProvider({ transactions = [], shouldFail = false, failCode } = {}) {
  return {
    getProviderName: () => 'truelayer',
    isConfigured: () => true,
    buildConsentUrl: () => 'https://auth.example.com/consent',
    exchangeCode: async () => ({ accessToken: 'new-token', refreshToken: 'new-refresh', expiresIn: 3600 }),
    fetchAccounts: async () => [{ accountId: 'acc-123', accountName: 'Test' }],
    fetchTransactions: async () => {
      if (shouldFail) {
        throw createProviderError(
          failCode || PROVIDER_ERRORS.FETCH_FAILED,
          'Provider fetch failed'
        );
      }
      return transactions;
    },
    refreshAccessToken: async () => ({ accessToken: 'refreshed-token', refreshToken: 'refreshed-refresh', expiresIn: 3600 }),
    revokeConsent: async () => ({})
  };
}

afterAll(async () => {
  await prisma.$disconnect();
});

describe('Sync job orchestrator — unit tests', () => {
  describe('calculateBackoffMs', () => {
    it('returns exponential backoff clamped to max', () => {
      expect(calculateBackoffMs(1)).toBe(1000);
      expect(calculateBackoffMs(2)).toBe(2000);
      expect(calculateBackoffMs(3)).toBe(4000);
      expect(calculateBackoffMs(4)).toBe(8000);
      expect(calculateBackoffMs(5)).toBe(16000);
      // Very high attempt should clamp
      expect(calculateBackoffMs(20)).toBe(300000);
    });
  });

  describe('buildSyncWindow', () => {
    it('builds default 30-day window without checkpoint', () => {
      const window = buildSyncWindow(null);
      expect(window.from).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(window.to).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      const from = new Date(window.from);
      const to = new Date(window.to);
      const diffDays = (to - from) / (1000 * 60 * 60 * 24);
      expect(diffDays).toBeGreaterThanOrEqual(29);
      expect(diffDays).toBeLessThanOrEqual(31);
    });

    it('uses checkpoint lastSyncedTo as start', () => {
      const checkpoint = { lastSyncedTo: '2026-04-10' };
      const window = buildSyncWindow(checkpoint);
      expect(window.from).toBe('2026-04-10');
      expect(window.to).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe('JOB_TYPES and JOB_STATUSES', () => {
    it('exports expected job types', () => {
      expect(JOB_TYPES.INITIAL_SYNC).toBe('initial_sync');
      expect(JOB_TYPES.INCREMENTAL_SYNC).toBe('incremental_sync');
      expect(JOB_TYPES.RETRY_SYNC).toBe('retry_sync');
    });

    it('exports expected job statuses', () => {
      expect(JOB_STATUSES.PENDING).toBe('pending');
      expect(JOB_STATUSES.RUNNING).toBe('running');
      expect(JOB_STATUSES.COMPLETED).toBe('completed');
      expect(JOB_STATUSES.FAILED).toBe('failed');
      expect(JOB_STATUSES.DEAD_LETTER).toBe('dead_letter');
    });

    it('has expected default max attempts', () => {
      expect(DEFAULT_MAX_ATTEMPTS).toBe(5);
    });
  });
});

describe('Sync job orchestrator — integration tests', () => {
  let app;

  beforeEach(async () => {
    app = express();
    app.use(express.json());
    app.use('/api/v1', registerRoute);
    await prisma.syncJob.deleteMany();
  });

  describe('enqueueSyncJob', () => {
    it('creates a pending job for a valid user', async () => {
      const { email } = await registerAndLogin(app);
      await createProfileWithTokens(email);

      const result = await enqueueSyncJob(email);

      expect(result.value).toBeDefined();
      expect(result.value.jobId).toBeDefined();
      expect(result.value.status).toBe('pending');
      expect(result.value.deduplicated).toBe(false);
      expect(result.value.contractVersion).toBe(SYNC_JOB_CONTRACT_VERSION);
    });

    it('deduplicates when a pending job already exists', async () => {
      const { email } = await registerAndLogin(app);
      await createProfileWithTokens(email);

      const first = await enqueueSyncJob(email);
      const second = await enqueueSyncJob(email);

      expect(second.value.deduplicated).toBe(true);
      expect(second.value.jobId).toBe(first.value.jobId);
    });

    it('returns error when no profile exists', async () => {
      const { email } = await registerAndLogin(app);

      const result = await enqueueSyncJob(email);

      expect(result.error).toMatch(/no bank sync profile/i);
      expect(result.statusCode).toBe(400);
    });
  });

  describe('executeSyncJob', () => {
    it('executes a pending job successfully with transactions', async () => {
      const { email } = await registerAndLogin(app);
      await createProfileWithTokens(email);

      const enqueued = await enqueueSyncJob(email);
      const mockProvider = createMockProvider({
        transactions: [
          {
            transactionId: `txn-exec-${Date.now()}`,
            bookedAt: new Date().toISOString(),
            amount: 42.50,
            currency: 'GBP',
            merchantName: 'Test Merchant',
            direction: 'outbound',
            status: 'booked'
          }
        ]
      });

      const result = await executeSyncJob(enqueued.value.jobId, mockProvider);

      expect(result.value).toBeDefined();
      expect(result.value.status).toBe('completed');
      expect(result.value.syncSummary.acceptedCount).toBe(1);
      expect(result.value.checkpoint.lastSyncedTo).toBeDefined();
    });

    it('handles zero transactions gracefully', async () => {
      const { email } = await registerAndLogin(app);
      await createProfileWithTokens(email);

      const enqueued = await enqueueSyncJob(email);
      const mockProvider = createMockProvider({ transactions: [] });

      const result = await executeSyncJob(enqueued.value.jobId, mockProvider);

      expect(result.value.status).toBe('completed');
      expect(result.value.syncSummary.acceptedCount).toBe(0);
    });

    it('rejects executing already completed job', async () => {
      const { email } = await registerAndLogin(app);
      await createProfileWithTokens(email);

      const enqueued = await enqueueSyncJob(email);
      const mockProvider = createMockProvider({ transactions: [] });

      await executeSyncJob(enqueued.value.jobId, mockProvider);

      const retryResult = await executeSyncJob(enqueued.value.jobId, mockProvider);
      expect(retryResult.error).toMatch(/cannot be executed/i);
      expect(retryResult.statusCode).toBe(409);
    });

    it('returns 404 for unknown job ID', async () => {
      const result = await executeSyncJob('nonexistent-id', createMockProvider());
      expect(result.error).toMatch(/not found/i);
      expect(result.statusCode).toBe(404);
    });

    it('deduplicates replayed transactions via existing ingestion pipeline', async () => {
      const { email } = await registerAndLogin(app);
      await createProfileWithTokens(email);

      const txnId = `txn-dedup-${Date.now()}`;
      const txn = {
        transactionId: txnId,
        bookedAt: new Date().toISOString(),
        amount: 15.00,
        currency: 'GBP',
        merchantName: 'Replay Merchant',
        direction: 'outbound',
        status: 'booked'
      };

      // First job ingests the transaction
      const enqueued1 = await enqueueSyncJob(email);
      const provider1 = createMockProvider({ transactions: [txn] });
      const result1 = await executeSyncJob(enqueued1.value.jobId, provider1);
      expect(result1.value.syncSummary.acceptedCount).toBe(1);

      // Second job replays the same transaction — it should be deduplicated
      const enqueued2 = await enqueueSyncJob(email, { jobType: JOB_TYPES.RETRY_SYNC });
      const provider2 = createMockProvider({ transactions: [txn] });
      const result2 = await executeSyncJob(enqueued2.value.jobId, provider2);
      expect(result2.value.syncSummary.duplicateCount).toBe(1);
      expect(result2.value.syncSummary.acceptedCount).toBe(0);
    });
  });

  describe('retry and backoff', () => {
    it('marks job as failed with retry time on transient provider error', async () => {
      const { email } = await registerAndLogin(app);
      await createProfileWithTokens(email);

      const enqueued = await enqueueSyncJob(email);
      const failingProvider = createMockProvider({
        shouldFail: true,
        failCode: PROVIDER_ERRORS.FETCH_FAILED
      });

      const result = await executeSyncJob(enqueued.value.jobId, failingProvider);

      expect(result.error).toMatch(/retried/i);
      expect(result.statusCode).toBe(502);

      const jobStatus = await getJobStatus(enqueued.value.jobId);
      expect(jobStatus.value.status).toBe('failed');
      expect(jobStatus.value.nextRetryAt).toBeDefined();
      expect(jobStatus.value.attempt).toBe(1);
    });

    it('moves job to dead letter on non-transient provider error', async () => {
      const { email } = await registerAndLogin(app);
      await createProfileWithTokens(email);

      const enqueued = await enqueueSyncJob(email);
      const failingProvider = createMockProvider({
        shouldFail: true,
        failCode: PROVIDER_ERRORS.TOKEN_EXCHANGE_FAILED
      });

      const result = await executeSyncJob(enqueued.value.jobId, failingProvider);

      expect(result.error).toMatch(/not recoverable/i);

      const jobStatus = await getJobStatus(enqueued.value.jobId);
      expect(jobStatus.value.status).toBe('dead_letter');
    });

    it('moves to dead letter after max attempts exhausted', async () => {
      const { email } = await registerAndLogin(app);
      await createProfileWithTokens(email);

      const enqueued = await enqueueSyncJob(email);
      const failingProvider = createMockProvider({
        shouldFail: true,
        failCode: PROVIDER_ERRORS.FETCH_FAILED
      });

      // Simulate reaching max attempts by updating the job
      await prisma.syncJob.update({
        where: { id: enqueued.value.jobId },
        data: { attempt: DEFAULT_MAX_ATTEMPTS - 1 }
      });

      const result = await executeSyncJob(enqueued.value.jobId, failingProvider);

      const jobStatus = await getJobStatus(enqueued.value.jobId);
      expect(jobStatus.value.status).toBe('dead_letter');
      expect(jobStatus.value.lastError).toMatch(/Max attempts/);
    });

    it('retries a failed job successfully', async () => {
      const { email } = await registerAndLogin(app);
      await createProfileWithTokens(email);

      const enqueued = await enqueueSyncJob(email);
      const failingProvider = createMockProvider({
        shouldFail: true,
        failCode: PROVIDER_ERRORS.FETCH_FAILED
      });

      // First attempt fails
      await executeSyncJob(enqueued.value.jobId, failingProvider);

      const statusAfterFail = await getJobStatus(enqueued.value.jobId);
      expect(statusAfterFail.value.status).toBe('failed');

      // Retry with working provider succeeds
      const workingProvider = createMockProvider({ transactions: [] });
      const retryResult = await executeSyncJob(enqueued.value.jobId, workingProvider);

      expect(retryResult.value.status).toBe('completed');
    });
  });

  describe('getRetryableJobs', () => {
    it('finds failed jobs past their retry time', async () => {
      const { email } = await registerAndLogin(app);
      const profile = await createProfileWithTokens(email);

      await prisma.syncJob.create({
        data: {
          profileId: profile.id,
          jobType: JOB_TYPES.INCREMENTAL_SYNC,
          status: JOB_STATUSES.FAILED,
          attempt: 1,
          maxAttempts: 5,
          nextRetryAt: new Date(Date.now() - 1000),
          lastError: 'transient error'
        }
      });

      const retryable = await getRetryableJobs();
      expect(retryable.length).toBeGreaterThanOrEqual(1);
    });

    it('excludes jobs not yet due for retry', async () => {
      const { email } = await registerAndLogin(app);
      const profile = await createProfileWithTokens(email);

      await prisma.syncJob.create({
        data: {
          profileId: profile.id,
          jobType: JOB_TYPES.INCREMENTAL_SYNC,
          status: JOB_STATUSES.FAILED,
          attempt: 1,
          maxAttempts: 5,
          nextRetryAt: new Date(Date.now() + 60000),
          lastError: 'transient error'
        }
      });

      const retryable = await getRetryableJobs();
      const futureJobs = retryable.filter(
        (j) => new Date(j.nextRetryAt) > new Date()
      );
      expect(futureJobs.length).toBe(0);
    });
  });

  describe('runFallbackPollingSweep', () => {
    it('enqueues sync jobs for stale linked profiles', async () => {
      const { email } = await registerAndLogin(app);
      const profile = await createProfileWithTokens(email);

      await prisma.bankSyncProfile.update({
        where: { id: profile.id },
        data: { lastSyncAt: new Date(Date.now() - 5 * 60 * 60 * 1000) }
      });

      const result = await runFallbackPollingSweep({ maxLagMinutes: 60 });

      expect(result.scanned).toBeGreaterThanOrEqual(1);
      expect(result.enqueued).toBeGreaterThanOrEqual(1);

      const jobs = await prisma.syncJob.findMany({ where: { profileId: profile.id } });
      expect(jobs).toHaveLength(1);
    });
  });

  describe('getJobHistory', () => {
    it('returns job history for a user', async () => {
      const { email } = await registerAndLogin(app);
      await createProfileWithTokens(email);
      await enqueueSyncJob(email);

      const result = await getJobHistory(email);

      expect(result.value.jobs.length).toBe(1);
      expect(result.value.total).toBe(1);
      expect(result.value.contractVersion).toBe(SYNC_JOB_CONTRACT_VERSION);
    });

    it('returns empty history for user with no profile', async () => {
      const { email } = await registerAndLogin(app);

      const result = await getJobHistory(email);

      expect(result.value.jobs).toEqual([]);
      expect(result.value.total).toBe(0);
    });
  });

  describe('checkpoint-based incremental sync', () => {
    it('updates profile checkpoint after successful sync', async () => {
      const { email } = await registerAndLogin(app);
      const profile = await createProfileWithTokens(email);
      const mockProvider = createMockProvider({ transactions: [] });

      const enqueued = await enqueueSyncJob(email);
      await executeSyncJob(enqueued.value.jobId, mockProvider);

      const updatedProfile = await prisma.bankSyncProfile.findUnique({
        where: { id: profile.id }
      });

      expect(updatedProfile.syncCheckpoint).toBeDefined();
      expect(updatedProfile.syncCheckpoint.lastSyncedTo).toBeDefined();
      expect(updatedProfile.syncCheckpoint.lastJobId).toBe(enqueued.value.jobId);
    });

    it('uses previous checkpoint as sync window start', async () => {
      const { email } = await registerAndLogin(app);
      const profile = await createProfileWithTokens(email);

      // Set an existing checkpoint
      await prisma.bankSyncProfile.update({
        where: { id: profile.id },
        data: {
          syncCheckpoint: {
            lastSyncedTo: '2026-04-15',
            lastJobId: 'previous-job',
            lastSyncAt: '2026-04-15T12:00:00.000Z'
          }
        }
      });

      const enqueued = await enqueueSyncJob(email);
      const job = await prisma.syncJob.findUnique({ where: { id: enqueued.value.jobId } });
      const jobCheckpoint = job.syncCheckpoint;

      expect(jobCheckpoint.syncWindow.from).toBe('2026-04-15');
      expect(jobCheckpoint.previousCheckpoint.lastSyncedTo).toBe('2026-04-15');
    });
  });
});

describe('Sync job routes — integration tests', () => {
  let app;

  beforeEach(async () => {
    app = express();
    app.use(express.json());
    app.use('/api/v1', registerRoute);
    await prisma.syncJob.deleteMany();
  });

  describe('POST /bank-sync/jobs/enqueue', () => {
    it('creates a job and returns 201', async () => {
      const { email, token } = await registerAndLogin(app);
      await createProfileWithTokens(email);

      const response = await request(app)
        .post('/api/v1/bank-sync/jobs/enqueue')
        .set('Authorization', `Bearer ${token}`)
        .send({ jobType: 'incremental_sync' });

      expect(response.statusCode).toBe(201);
      expect(response.body.data.jobId).toBeDefined();
      expect(response.body.data.status).toBe('pending');
      expect(response.body.data.deduplicated).toBe(false);
    });

    it('returns 200 for deduplicated job', async () => {
      const { email, token } = await registerAndLogin(app);
      await createProfileWithTokens(email);

      await request(app)
        .post('/api/v1/bank-sync/jobs/enqueue')
        .set('Authorization', `Bearer ${token}`)
        .send({ jobType: 'incremental_sync' });

      const response = await request(app)
        .post('/api/v1/bank-sync/jobs/enqueue')
        .set('Authorization', `Bearer ${token}`)
        .send({ jobType: 'incremental_sync' });

      expect(response.statusCode).toBe(200);
      expect(response.body.data.deduplicated).toBe(true);
    });

    it('rejects invalid job type', async () => {
      const { token } = await registerAndLogin(app);

      const response = await request(app)
        .post('/api/v1/bank-sync/jobs/enqueue')
        .set('Authorization', `Bearer ${token}`)
        .send({ jobType: 'invalid_type' });

      expect(response.statusCode).toBe(400);
      expect(response.body.error).toMatch(/invalid job type/i);
    });

    it('rejects unauthenticated requests', async () => {
      const response = await request(app)
        .post('/api/v1/bank-sync/jobs/enqueue');

      expect(response.statusCode).toBe(401);
    });
  });

  describe('GET /bank-sync/jobs/:jobId', () => {
    it('returns job status', async () => {
      const { email, token } = await registerAndLogin(app);
      await createProfileWithTokens(email);

      const enqueueResponse = await request(app)
        .post('/api/v1/bank-sync/jobs/enqueue')
        .set('Authorization', `Bearer ${token}`)
        .send({ jobType: 'incremental_sync' });

      const jobId = enqueueResponse.body.data.jobId;

      const response = await request(app)
        .get(`/api/v1/bank-sync/jobs/${jobId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.statusCode).toBe(200);
      expect(response.body.data.jobId).toBe(jobId);
      expect(response.body.data.status).toBe('pending');
      expect(response.body.data.contractVersion).toBe(SYNC_JOB_CONTRACT_VERSION);
    });

    it('returns 404 for unknown job', async () => {
      const { token } = await registerAndLogin(app);

      const response = await request(app)
        .get('/api/v1/bank-sync/jobs/nonexistent-id')
        .set('Authorization', `Bearer ${token}`);

      expect(response.statusCode).toBe(404);
    });
  });

  describe('GET /bank-sync/jobs', () => {
    it('returns job history', async () => {
      const { email, token } = await registerAndLogin(app);
      await createProfileWithTokens(email);
      await enqueueSyncJob(email);

      const response = await request(app)
        .get('/api/v1/bank-sync/jobs')
        .set('Authorization', `Bearer ${token}`);

      expect(response.statusCode).toBe(200);
      expect(response.body.data.jobs.length).toBe(1);
      expect(response.body.data.total).toBe(1);
    });

    it('rejects unauthenticated requests', async () => {
      const response = await request(app)
        .get('/api/v1/bank-sync/jobs');

      expect(response.statusCode).toBe(401);
    });
  });
});
