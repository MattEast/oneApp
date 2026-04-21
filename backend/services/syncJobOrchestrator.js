// Sync job orchestrator — manages queued sync jobs with retry, checkpoint, and idempotency.
// Sits between routes/services and the actual provider sync pipeline.
// See apps/worker/src/queue/retry-policy.json for retry conventions.

const crypto = require('crypto');
const prisma = require('../db/prisma');
const {
  getBankSyncStatus,
  getProviderTokens,
  ingestMockTransactions,
  isBankSyncUnavailableError,
  updateLastSyncAt,
  updateProviderTokens
} = require('../db/bankSyncStore');
const { PROVIDER_ERRORS, isProviderError } = require('./bankProviderAdapter');
const { logInfo, logWarn, logError, maskEmail } = require('../utils/observability');

const SYNC_JOB_CONTRACT_VERSION = '2026-04-sync-job-v1';

const JOB_TYPES = {
  INITIAL_SYNC: 'initial_sync',
  INCREMENTAL_SYNC: 'incremental_sync',
  RETRY_SYNC: 'retry_sync'
};

const JOB_STATUSES = {
  PENDING: 'pending',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
  DEAD_LETTER: 'dead_letter'
};

const DEFAULT_MAX_ATTEMPTS = 5;
const INITIAL_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 300000;
const SYNC_WINDOW_DAYS = 30;

function calculateBackoffMs(attempt) {
  const delayMs = INITIAL_BACKOFF_MS * Math.pow(2, attempt - 1);
  return Math.min(delayMs, MAX_BACKOFF_MS);
}

function buildSyncWindow(checkpoint) {
  const now = new Date();
  const defaultFrom = new Date(now.getTime() - (SYNC_WINDOW_DAYS * 24 * 60 * 60 * 1000));

  const from = checkpoint?.lastSyncedTo
    ? new Date(checkpoint.lastSyncedTo)
    : defaultFrom;

  return {
    from: from.toISOString().split('T')[0],
    to: now.toISOString().split('T')[0]
  };
}

function generateIdempotencyKey(email, jobType, syncWindow) {
  const input = `${email}:${jobType}:${syncWindow.from}:${syncWindow.to}`;
  return crypto.createHash('sha256').update(input).digest('hex').slice(0, 32);
}

async function getProfileForEmail(email) {
  const user = await prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() },
    select: { id: true }
  });

  if (!user) {
    return null;
  }

  return await prisma.bankSyncProfile.findUnique({
    where: { userId: user.id }
  });
}

async function enqueueSyncJob(email, { jobType = JOB_TYPES.INCREMENTAL_SYNC, scheduledAt } = {}) {
  const profile = await getProfileForEmail(email);

  if (!profile) {
    return {
      error: 'No bank sync profile found. Please connect your bank account first.',
      statusCode: 400
    };
  }

  const checkpoint = profile.syncCheckpoint || null;
  const syncWindow = buildSyncWindow(checkpoint);
  const idempotencyKey = generateIdempotencyKey(email, jobType, syncWindow);

  const existingJob = await prisma.syncJob.findFirst({
    where: {
      profileId: profile.id,
      status: { in: [JOB_STATUSES.PENDING, JOB_STATUSES.RUNNING] }
    },
    orderBy: { createdAt: 'desc' }
  });

  if (existingJob) {
    logInfo('sync_job.enqueue.duplicate_suppressed', {
      email: maskEmail(email),
      existingJobId: existingJob.id,
      existingStatus: existingJob.status
    });

    return {
      value: {
        jobId: existingJob.id,
        status: existingJob.status,
        deduplicated: true,
        contractVersion: SYNC_JOB_CONTRACT_VERSION
      }
    };
  }

  const job = await prisma.syncJob.create({
    data: {
      profileId: profile.id,
      jobType,
      status: JOB_STATUSES.PENDING,
      attempt: 0,
      maxAttempts: DEFAULT_MAX_ATTEMPTS,
      scheduledAt: scheduledAt ? new Date(scheduledAt) : new Date(),
      syncCheckpoint: {
        idempotencyKey,
        syncWindow,
        previousCheckpoint: checkpoint
      }
    }
  });

  logInfo('sync_job.enqueue.created', {
    email: maskEmail(email),
    jobId: job.id,
    jobType,
    syncWindow
  });

  return {
    value: {
      jobId: job.id,
      status: job.status,
      jobType: job.jobType,
      syncWindow,
      deduplicated: false,
      contractVersion: SYNC_JOB_CONTRACT_VERSION
    }
  };
}

async function executeSyncJob(jobId, provider) {
  const job = await prisma.syncJob.findUnique({ where: { id: jobId } });

  if (!job) {
    return { error: 'Job not found.', statusCode: 404 };
  }

  if (job.status !== JOB_STATUSES.PENDING && job.status !== JOB_STATUSES.FAILED) {
    return {
      error: `Job cannot be executed in status "${job.status}".`,
      statusCode: 409
    };
  }

  const profile = await prisma.bankSyncProfile.findUnique({ where: { id: job.profileId } });

  if (!profile) {
    await markJobDeadLetter(jobId, 'Profile no longer exists.');
    return { error: 'Bank sync profile not found.', statusCode: 400 };
  }

  const email = await getEmailForProfile(profile.userId);

  await prisma.syncJob.update({
    where: { id: jobId },
    data: {
      status: JOB_STATUSES.RUNNING,
      attempt: job.attempt + 1,
      startedAt: new Date()
    }
  });

  logInfo('sync_job.execute.started', {
    email: maskEmail(email),
    jobId,
    attempt: job.attempt + 1,
    jobType: job.jobType
  });

  try {
    const tokens = profile.providerTokens;

    if (!tokens || !tokens.accessToken) {
      await markJobFailed(jobId, job.attempt + 1, job.maxAttempts, 'No active provider tokens.');
      return {
        error: 'No active bank link. Please reconnect your bank account.',
        statusCode: 400
      };
    }

    let activeAccessToken = tokens.accessToken;
    const isTokenExpired = tokens.expiresAt && new Date(tokens.expiresAt) <= new Date();

    if (isTokenExpired) {
      if (!tokens.refreshToken) {
        await markJobFailed(jobId, job.attempt + 1, job.maxAttempts, 'Token expired, no refresh token.');
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
      } catch (refreshError) {
        await markJobFailed(jobId, job.attempt + 1, job.maxAttempts,
          `Token refresh failed: ${refreshError.message}`);
        return {
          error: 'Bank link could not be refreshed. Please reconnect.',
          statusCode: 401
        };
      }
    }

    const checkpoint = job.syncCheckpoint || {};
    const syncWindow = checkpoint.syncWindow || buildSyncWindow(profile.syncCheckpoint);
    const accountId = profile.linkedAccount?.accountId;

    if (!accountId) {
      await markJobFailed(jobId, job.attempt + 1, job.maxAttempts, 'No linked account.');
      return {
        error: 'No linked account found. Please connect your bank account.',
        statusCode: 400
      };
    }

    const transactions = await provider.fetchTransactions(
      activeAccessToken, accountId, syncWindow.from, syncWindow.to
    );

    logInfo('sync_job.execute.transactions_fetched', {
      email: maskEmail(email),
      jobId,
      count: transactions.length,
      syncWindow
    });

    const now = new Date();
    const ingestion = {
      ingestionId: `sync_job:${jobId}:${now.toISOString()}`,
      receivedAt: now.toISOString(),
      transactions
    };

    let syncResult;

    if (transactions.length === 0) {
      syncResult = {
        syncSummary: {
          ingestionId: ingestion.ingestionId,
          source: 'bank_linked',
          outcome: 'success',
          acceptedCount: 0,
          duplicateCount: 0,
          rejectedCount: 0
        },
        transactionCount: 0
      };
    } else {
      syncResult = await ingestMockTransactions(email, ingestion);
    }

    await updateLastSyncAt(email);

    const newCheckpoint = {
      lastSyncedTo: syncWindow.to,
      lastJobId: jobId,
      lastSyncAt: now.toISOString(),
      lastOutcome: syncResult.syncSummary.outcome
    };

    await prisma.bankSyncProfile.update({
      where: { id: profile.id },
      data: { syncCheckpoint: newCheckpoint }
    });

    await prisma.syncJob.update({
      where: { id: jobId },
      data: {
        status: JOB_STATUSES.COMPLETED,
        completedAt: now,
        syncCheckpoint: {
          ...checkpoint,
          resolvedCheckpoint: newCheckpoint
        },
        result: {
          acceptedCount: syncResult.syncSummary.acceptedCount,
          duplicateCount: syncResult.syncSummary.duplicateCount,
          rejectedCount: syncResult.syncSummary.rejectedCount,
          outcome: syncResult.syncSummary.outcome
        }
      }
    });

    logInfo('sync_job.execute.completed', {
      email: maskEmail(email),
      jobId,
      outcome: syncResult.syncSummary.outcome,
      acceptedCount: syncResult.syncSummary.acceptedCount,
      duplicateCount: syncResult.syncSummary.duplicateCount
    });

    return {
      value: {
        jobId,
        status: JOB_STATUSES.COMPLETED,
        syncSummary: syncResult.syncSummary,
        checkpoint: newCheckpoint,
        contractVersion: SYNC_JOB_CONTRACT_VERSION
      }
    };
  } catch (error) {
    if (isProviderError(error)) {
      logError('sync_job.execute.provider_error', {
        email: maskEmail(email),
        jobId,
        code: error.code,
        message: error.message
      });

      const isTransient = error.code === PROVIDER_ERRORS.FETCH_FAILED;

      if (isTransient) {
        const result = await markJobFailed(jobId, job.attempt + 1, job.maxAttempts, error.message);
        return {
          error: 'Temporary provider error. The sync will be retried.',
          statusCode: 502,
          retryScheduled: result.retryScheduled
        };
      }

      await markJobDeadLetter(jobId, `Non-transient provider error: ${error.code}`);
      return {
        error: 'Provider error is not recoverable. Please reconnect your bank account.',
        statusCode: 502
      };
    }

    if (isBankSyncUnavailableError(error)) {
      await markJobFailed(jobId, job.attempt + 1, job.maxAttempts, 'Bank sync persistence unavailable.');
      return {
        error: 'Bank sync features are temporarily unavailable.',
        statusCode: 503,
        retryScheduled: true
      };
    }

    logError('sync_job.execute.unexpected_error', {
      email: maskEmail(email),
      jobId,
      message: error.message
    });

    await markJobFailed(jobId, job.attempt + 1, job.maxAttempts, error.message);

    return {
      error: 'An unexpected error occurred during sync.',
      statusCode: 500
    };
  }
}

async function markJobFailed(jobId, attempt, maxAttempts, errorMessage) {
  const isTerminal = attempt >= maxAttempts;

  if (isTerminal) {
    await markJobDeadLetter(jobId, `Max attempts (${maxAttempts}) reached: ${errorMessage}`);
    return { retryScheduled: false };
  }

  const backoffMs = calculateBackoffMs(attempt);
  const nextRetryAt = new Date(Date.now() + backoffMs);

  await prisma.syncJob.update({
    where: { id: jobId },
    data: {
      status: JOB_STATUSES.FAILED,
      lastError: errorMessage,
      nextRetryAt
    }
  });

  logWarn('sync_job.execute.failed_will_retry', {
    jobId,
    attempt,
    maxAttempts,
    nextRetryAt: nextRetryAt.toISOString(),
    backoffMs,
    error: errorMessage
  });

  return { retryScheduled: true, nextRetryAt };
}

async function markJobDeadLetter(jobId, reason) {
  await prisma.syncJob.update({
    where: { id: jobId },
    data: {
      status: JOB_STATUSES.DEAD_LETTER,
      lastError: reason,
      completedAt: new Date()
    }
  });

  logError('sync_job.execute.dead_letter', {
    jobId,
    reason
  });
}

async function getJobStatus(jobId) {
  const job = await prisma.syncJob.findUnique({ where: { id: jobId } });

  if (!job) {
    return { error: 'Job not found.', statusCode: 404 };
  }

  return {
    value: {
      jobId: job.id,
      jobType: job.jobType,
      status: job.status,
      attempt: job.attempt,
      maxAttempts: job.maxAttempts,
      lastError: job.lastError,
      scheduledAt: job.scheduledAt?.toISOString() || null,
      startedAt: job.startedAt?.toISOString() || null,
      completedAt: job.completedAt?.toISOString() || null,
      nextRetryAt: job.nextRetryAt?.toISOString() || null,
      result: job.result,
      contractVersion: SYNC_JOB_CONTRACT_VERSION
    }
  };
}

async function getJobHistory(email, { limit = 20 } = {}) {
  const profile = await getProfileForEmail(email);

  if (!profile) {
    return { value: { jobs: [], total: 0 } };
  }

  const [jobs, total] = await Promise.all([
    prisma.syncJob.findMany({
      where: { profileId: profile.id },
      orderBy: { createdAt: 'desc' },
      take: limit
    }),
    prisma.syncJob.count({
      where: { profileId: profile.id }
    })
  ]);

  return {
    value: {
      jobs: jobs.map((job) => ({
        jobId: job.id,
        jobType: job.jobType,
        status: job.status,
        attempt: job.attempt,
        maxAttempts: job.maxAttempts,
        lastError: job.lastError,
        scheduledAt: job.scheduledAt?.toISOString() || null,
        startedAt: job.startedAt?.toISOString() || null,
        completedAt: job.completedAt?.toISOString() || null,
        result: job.result
      })),
      total,
      contractVersion: SYNC_JOB_CONTRACT_VERSION
    }
  };
}

async function getRetryableJobs({ limit = 10 } = {}) {
  const now = new Date();

  const jobs = await prisma.syncJob.findMany({
    where: {
      status: JOB_STATUSES.FAILED,
      nextRetryAt: { lte: now }
    },
    orderBy: { nextRetryAt: 'asc' },
    take: limit
  });

  return jobs;
}

async function processRetryableJobs(provider, { limit = 10 } = {}) {
  const jobs = await getRetryableJobs({ limit });

  if (jobs.length === 0) {
    return { processed: 0, results: [] };
  }

  logInfo('sync_job.retry.batch_started', { count: jobs.length });

  const results = [];

  for (const job of jobs) {
    const result = await executeSyncJob(job.id, provider);
    results.push({ jobId: job.id, result });
  }

  logInfo('sync_job.retry.batch_completed', {
    processed: results.length,
    succeeded: results.filter((r) => r.result.value).length,
    failed: results.filter((r) => r.result.error).length
  });

  return { processed: results.length, results };
}

async function getEmailForProfile(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true }
  });
  return user?.email || '';
}

module.exports = {
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
};
