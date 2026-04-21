const prisma = require('../db/prisma');
const { JOB_TYPES, enqueueSyncJob } = require('./syncJobOrchestrator');
const trueLayerProvider = require('./trueLayerProvider');
const { logInfo, logWarn, maskEmail } = require('../utils/observability');

const MAX_RECORDED_EVENT_IDS = 25;
const DEFAULT_FALLBACK_POLLING_LAG_MINUTES = 180;

function readSignatureHeader(headers = {}) {
  return headers['x-truelayer-signature']
    || headers['tl-signature']
    || headers['x-tl-signature']
    || '';
}

function normalizeEventIds(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => `${entry || ''}`.trim())
    .filter(Boolean)
    .slice(0, MAX_RECORDED_EVENT_IDS);
}

function buildUpdatedCheckpoint(existingCheckpoint, event, jobId) {
  const recentWebhookEventIds = [
    event.eventId,
    ...normalizeEventIds(existingCheckpoint?.recentWebhookEventIds).filter((entry) => entry !== event.eventId)
  ].slice(0, MAX_RECORDED_EVENT_IDS);

  return {
    ...(existingCheckpoint || {}),
    recentWebhookEventIds,
    lastWebhookAt: event.occurredAt,
    lastWebhookEventId: event.eventId,
    lastWebhookType: event.eventType,
    lastWebhookJobId: jobId || existingCheckpoint?.lastWebhookJobId || null,
    lastFallbackPollingAt: existingCheckpoint?.lastFallbackPollingAt || null,
    lastFallbackPollingJobId: existingCheckpoint?.lastFallbackPollingJobId || null
  };
}

async function findProfileByAccountId(accountId) {
  const profiles = await prisma.bankSyncProfile.findMany({
    include: {
      user: {
        select: {
          email: true
        }
      }
    }
  });

  return profiles.find((profile) => {
    if (profile.provider !== 'truelayer') {
      return false;
    }

    return profile.linkedAccount && profile.linkedAccount.accountId === accountId;
  }) || null;
}

async function handleLiveBankWebhook({ headers, payload }) {
  if (!trueLayerProvider.isWebhookConfigured()) {
    return {
      error: 'Webhook verification is not configured for the provider.',
      statusCode: 503
    };
  }

  const signature = readSignatureHeader(headers);

  if (!trueLayerProvider.verifyWebhookSignature(payload, signature)) {
    return {
      error: 'Webhook signature is invalid.',
      statusCode: 401
    };
  }

  let event;

  try {
    event = trueLayerProvider.normalizeWebhookEvent(payload);
  } catch (error) {
    return {
      error: error.message || 'Webhook payload is invalid.',
      statusCode: 400
    };
  }

  if (!/transaction/i.test(event.eventType)) {
    return {
      value: {
        acknowledged: true,
        ignored: true,
        reason: 'unsupported_event_type',
        eventId: event.eventId,
        eventType: event.eventType
      }
    };
  }

  const profile = await findProfileByAccountId(event.accountId);

  if (!profile) {
    return {
      value: {
        acknowledged: true,
        ignored: true,
        reason: 'unmatched_account',
        eventId: event.eventId,
        accountId: event.accountId
      }
    };
  }

  const checkpoint = profile.syncCheckpoint || {};
  const recentWebhookEventIds = normalizeEventIds(checkpoint.recentWebhookEventIds);

  if (recentWebhookEventIds.includes(event.eventId)) {
    logInfo('bank_sync.webhook.replayed', {
      email: maskEmail(profile.user.email),
      eventId: event.eventId,
      eventType: event.eventType
    });

    return {
      value: {
        acknowledged: true,
        deduplicated: true,
        eventId: event.eventId,
        jobId: checkpoint.lastWebhookJobId || null
      }
    };
  }

  const enqueueResult = await enqueueSyncJob(profile.user.email, {
    jobType: JOB_TYPES.INCREMENTAL_SYNC
  });

  if (enqueueResult.error) {
    return enqueueResult;
  }

  await prisma.bankSyncProfile.update({
    where: { id: profile.id },
    data: {
      syncCheckpoint: buildUpdatedCheckpoint(checkpoint, event, enqueueResult.value.jobId)
    }
  });

  logInfo('bank_sync.webhook.accepted', {
    email: maskEmail(profile.user.email),
    eventId: event.eventId,
    eventType: event.eventType,
    jobId: enqueueResult.value.jobId,
    deduplicated: enqueueResult.value.deduplicated
  });

  return {
    value: {
      acknowledged: true,
      deduplicated: Boolean(enqueueResult.value.deduplicated),
      eventId: event.eventId,
      jobId: enqueueResult.value.jobId
    }
  };
}

async function runFallbackPollingSweep({ maxLagMinutes = DEFAULT_FALLBACK_POLLING_LAG_MINUTES } = {}) {
  const profiles = await prisma.bankSyncProfile.findMany({
    include: {
      user: {
        select: {
          email: true
        }
      }
    }
  });

  const now = new Date();
  let scanned = 0;
  let enqueued = 0;
  let deduplicated = 0;

  for (const profile of profiles) {
    if (!profile.providerTokens?.accessToken || !profile.linkedAccount?.accountId) {
      continue;
    }

    scanned += 1;

    const lastSyncAt = profile.lastSyncAt ? new Date(profile.lastSyncAt) : null;
    const lagMinutes = lastSyncAt
      ? Math.max(Math.round((now.getTime() - lastSyncAt.getTime()) / 60000), 0)
      : Number.POSITIVE_INFINITY;

    if (lagMinutes < maxLagMinutes) {
      continue;
    }

    const enqueueResult = await enqueueSyncJob(profile.user.email, {
      jobType: JOB_TYPES.INCREMENTAL_SYNC
    });

    if (enqueueResult.error) {
      logWarn('bank_sync.fallback_polling.enqueue_failed', {
        email: maskEmail(profile.user.email),
        reason: enqueueResult.error
      });
      continue;
    }

    if (enqueueResult.value.deduplicated) {
      deduplicated += 1;
    } else {
      enqueued += 1;
    }

    const checkpoint = profile.syncCheckpoint || {};
    await prisma.bankSyncProfile.update({
      where: { id: profile.id },
      data: {
        syncCheckpoint: {
          ...checkpoint,
          lastFallbackPollingAt: now.toISOString(),
          lastFallbackPollingJobId: enqueueResult.value.jobId
        }
      }
    });
  }

  return {
    scanned,
    enqueued,
    deduplicated,
    maxLagMinutes
  };
}

module.exports = {
  DEFAULT_FALLBACK_POLLING_LAG_MINUTES,
  handleLiveBankWebhook,
  runFallbackPollingSweep
};