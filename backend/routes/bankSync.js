const express = require('express');
const multer = require('multer');
const authenticateJWT = require('../middleware/authenticateJWT');
const { findUserByEmail } = require('../services/authService');
const {
  getMockBankSyncStatus,
  linkMockBankAccount,
  listCsvImportHistory,
  runCsvBankStatementImport,
  runMockBankIngestion
} = require('../services/mockBankSyncService');
const {
  getLiveSyncStatus,
  handleConsentCallback,
  initiateConsent,
  revokeConsent,
  runLiveSync
} = require('../services/liveBankSyncService');
const { handleLiveBankWebhook } = require('../services/liveBankWebhookService');
const {
  enqueueSyncJob,
  executeSyncJob,
  getJobHistory,
  getJobStatus,
  JOB_TYPES
} = require('../services/syncJobOrchestrator');
const { getBankSyncTransactions } = require('../db/bankSyncStore');
const { logInfo, logWarn, maskEmail } = require('../utils/observability');
const apiResponse = require('../utils/apiResponse');
const { sendInvalidSession } = require('../utils/httpResponses');

const router = express.Router();
const MAX_CSV_UPLOAD_BYTES = 1024 * 1024;
const MAX_TRANSACTION_LIMIT = 500;
const ALLOWED_CSV_MIME_TYPES = new Set(['text/csv', 'text/plain', 'application/vnd.ms-excel']);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_CSV_UPLOAD_BYTES
  },
  fileFilter: (req, file, callback) => {
    if (ALLOWED_CSV_MIME_TYPES.has(file.mimetype)) {
      callback(null, true);
      return;
    }

    const error = new Error('Only CSV uploads are supported.');
    error.code = 'INVALID_CSV_FILE_TYPE';
    callback(error);
  }
});

async function findCurrentUser(req) {
  return await findUserByEmail(req.user.email);
}

router.get('/status', authenticateJWT, async (req, res) => {
  const user = await findCurrentUser(req);
  if (!user) return sendInvalidSession(res);
  const result = await getMockBankSyncStatus(user.email);
  if (result.error) {
    logWarn('bank_sync.status.unavailable', {
      email: maskEmail(user.email),
      reason: result.error
    });
    return apiResponse.error(res, result.error, result.statusCode || 503);
  }
  return apiResponse.success(res, result.value);
});

router.post('/mock-link', authenticateJWT, async (req, res) => {
  const user = await findCurrentUser(req);
  if (!user) return sendInvalidSession(res);
  const result = await linkMockBankAccount(user.email, req.body);
  if (result.error) {
    logWarn('bank_sync.mock_link.rejected', {
      email: maskEmail(user.email),
      reason: result.error
    });
    return apiResponse.error(res, result.error, result.statusCode || 400);
  }
  logInfo('bank_sync.mock_link.created', { email: maskEmail(user.email) });
  return apiResponse.success(res, result.value, 201);
});

router.post('/mock-ingest', authenticateJWT, async (req, res) => {
  const user = await findCurrentUser(req);
  if (!user) return sendInvalidSession(res);
  const result = await runMockBankIngestion(user.email, req.body);
  if (result.error) {
    logWarn('bank_sync.mock_ingest.rejected', {
      email: maskEmail(user.email),
      reason: result.error
    });
    return apiResponse.error(res, result.error, result.statusCode || 400);
  }
  const outcome = result.value.syncSummary.outcome;
  const statusCode = outcome === 'partial_success' ? 207 : 200;
  logInfo('bank_sync.mock_ingest.completed', {
    email: maskEmail(user.email),
    outcome,
    acceptedCount: result.value.syncSummary.acceptedCount,
    duplicateCount: result.value.syncSummary.duplicateCount,
    rejectedCount: result.value.syncSummary.rejectedCount
  });
  return apiResponse.success(res, result.value, statusCode);
});

router.post('/csv-import', authenticateJWT, (req, res, next) => {
  upload.single('file')(req, res, (error) => {
    if (!error) {
      next();
      return;
    }

    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
      logWarn('bank_sync.csv_import.rejected', {
        email: maskEmail(req.user?.email || ''),
        reason: 'csv_upload_too_large',
        maxBytes: MAX_CSV_UPLOAD_BYTES
      });
      return apiResponse.error(
        res,
        'CSV upload exceeds the maximum upload size.',
        413,
        { maxBytes: MAX_CSV_UPLOAD_BYTES, field: error.field || 'file' }
      );
    }

    if (error.code === 'INVALID_CSV_FILE_TYPE') {
      logWarn('bank_sync.csv_import.rejected', {
        email: maskEmail(req.user?.email || ''),
        reason: 'csv_upload_invalid_type'
      });
      return apiResponse.error(
        res,
        'CSV file type is required for multipart uploads.',
        415,
        { acceptedMimeTypes: Array.from(ALLOWED_CSV_MIME_TYPES) }
      );
    }

    return apiResponse.error(res, 'CSV upload could not be processed.', 400);
  });
}, async (req, res) => {
  const user = await findCurrentUser(req);
  if (!user) return sendInvalidSession(res);

  const payload = {
    ...req.body,
    csvData: req.file ? req.file.buffer.toString('utf-8') : req.body?.csvData,
    filename: req.file?.originalname
  };

  const result = await runCsvBankStatementImport(user.email, payload);
  if (result.error) {
    logWarn('bank_sync.csv_import.rejected', {
      email: maskEmail(user.email),
      reason: result.error
    });
    return apiResponse.error(res, result.error, result.statusCode || 400, result.details);
  }
  const outcome = result.value.syncSummary.outcome;
  const statusCode = outcome === 'partial_success' ? 207 : 200;
  logInfo('bank_sync.csv_import.completed', {
    email: maskEmail(user.email),
    outcome,
    acceptedCount: result.value.syncSummary.acceptedCount,
    duplicateCount: result.value.syncSummary.duplicateCount,
    rejectedCount: result.value.syncSummary.rejectedCount
  });
  return apiResponse.success(res, result.value, statusCode);
});

router.get('/import-history', authenticateJWT, async (req, res) => {
  const user = await findCurrentUser(req);
  if (!user) return sendInvalidSession(res);
  const result = await listCsvImportHistory(user.email);
  if (result.error) {
    logWarn('bank_sync.import_history.unavailable', {
      email: maskEmail(user.email),
      reason: result.error
    });
    return apiResponse.error(res, result.error, result.statusCode || 503);
  }
  return apiResponse.success(res, result.value);
});

router.get('/transactions', authenticateJWT, async (req, res) => {
  const user = await findCurrentUser(req);
  if (!user) return sendInvalidSession(res);

  const rawLimit = req.query.limit;
  let limit = 0;

  if (rawLimit !== undefined) {
    const parsedLimit = Number.parseInt(String(rawLimit), 10);
    if (!Number.isFinite(parsedLimit) || parsedLimit < 1 || parsedLimit > MAX_TRANSACTION_LIMIT) {
      return apiResponse.error(
        res,
        `limit must be an integer between 1 and ${MAX_TRANSACTION_LIMIT}.`,
        400
      );
    }
    limit = parsedLimit;
  }

  let transactions = await getBankSyncTransactions(user.email);
  transactions = transactions.sort((a, b) => new Date(b.bookedAt) - new Date(a.bookedAt));

  const total = transactions.length;
  if (limit > 0) {
    transactions = transactions.slice(0, limit);
  }

  return apiResponse.success(res, { transactions, total, count: transactions.length });
});

router.post('/webhook', async (req, res) => {
  const result = await handleLiveBankWebhook({
    headers: req.headers,
    payload: req.body
  });

  if (result.error) {
    logWarn('bank_sync.webhook.rejected', {
      reason: result.error
    });
    return apiResponse.error(res, result.error, result.statusCode || 400);
  }

  const statusCode = result.value.deduplicated || result.value.ignored ? 200 : 202;
  return apiResponse.success(res, result.value, statusCode);
});

// --- Live bank sync routes ---

router.post('/connect', authenticateJWT, async (req, res) => {
  const user = await findCurrentUser(req);
  if (!user) return sendInvalidSession(res);
  const result = await initiateConsent(user.email);
  if (result.error) {
    logWarn('bank_sync.connect.failed', {
      email: maskEmail(user.email),
      reason: result.error
    });
    return apiResponse.error(res, result.error, result.statusCode || 503);
  }
  logInfo('bank_sync.connect.initiated', { email: maskEmail(user.email) });
  return apiResponse.success(res, result.value);
});

router.post('/callback', authenticateJWT, async (req, res) => {
  const user = await findCurrentUser(req);
  if (!user) return sendInvalidSession(res);

  const { code, state } = req.body;

  if (!code || typeof code !== 'string') {
    return apiResponse.error(res, 'Authorization code is required.', 400);
  }

  if (!state || typeof state !== 'string') {
    return apiResponse.error(res, 'Consent state parameter is required.', 400);
  }

  const result = await handleConsentCallback(code, state);
  if (result.error) {
    logWarn('bank_sync.callback.failed', {
      email: maskEmail(user.email),
      reason: result.error
    });
    return apiResponse.error(res, result.error, result.statusCode || 400);
  }
  logInfo('bank_sync.callback.completed', {
    email: maskEmail(user.email),
    linked: result.value.linked
  });
  return apiResponse.success(res, result.value, 201);
});

router.post('/sync', authenticateJWT, async (req, res) => {
  const user = await findCurrentUser(req);
  if (!user) return sendInvalidSession(res);
  const result = await runLiveSync(user.email);
  if (result.error) {
    logWarn('bank_sync.sync.failed', {
      email: maskEmail(user.email),
      reason: result.error
    });
    return apiResponse.error(res, result.error, result.statusCode || 500);
  }
  const outcome = result.value.syncSummary?.outcome || 'success';
  const statusCode = outcome === 'partial_success' ? 207 : 200;
  logInfo('bank_sync.sync.completed', {
    email: maskEmail(user.email),
    outcome,
    acceptedCount: result.value.syncSummary?.acceptedCount || 0
  });
  return apiResponse.success(res, result.value, statusCode);
});

router.get('/live-status', authenticateJWT, async (req, res) => {
  const user = await findCurrentUser(req);
  if (!user) return sendInvalidSession(res);
  try {
    const status = await getLiveSyncStatus(user.email);
    return apiResponse.success(res, status);
  } catch (error) {
    logWarn('bank_sync.live_status.failed', {
      email: maskEmail(user.email),
      message: error.message
    });
    return apiResponse.error(res, 'Unable to retrieve live sync status.', 503);
  }
});

router.post('/disconnect', authenticateJWT, async (req, res) => {
  const user = await findCurrentUser(req);
  if (!user) return sendInvalidSession(res);
  const result = await revokeConsent(user.email);
  if (result.error) {
    logWarn('bank_sync.disconnect.failed', {
      email: maskEmail(user.email),
      reason: result.error
    });
    return apiResponse.error(res, result.error, result.statusCode || 500);
  }
  logInfo('bank_sync.disconnect.completed', { email: maskEmail(user.email) });
  return apiResponse.success(res, result.value);
});

// --- Sync job orchestration routes ---

router.post('/jobs/enqueue', authenticateJWT, async (req, res) => {
  const user = await findCurrentUser(req);
  if (!user) return sendInvalidSession(res);

  const jobType = req.body?.jobType || JOB_TYPES.INCREMENTAL_SYNC;
  const validTypes = Object.values(JOB_TYPES);

  if (!validTypes.includes(jobType)) {
    return apiResponse.error(res, `Invalid job type. Must be one of: ${validTypes.join(', ')}`, 400);
  }

  const result = await enqueueSyncJob(user.email, { jobType });
  if (result.error) {
    logWarn('bank_sync.job.enqueue_failed', {
      email: maskEmail(user.email),
      reason: result.error
    });
    return apiResponse.error(res, result.error, result.statusCode || 400);
  }

  const statusCode = result.value.deduplicated ? 200 : 201;
  logInfo('bank_sync.job.enqueued', {
    email: maskEmail(user.email),
    jobId: result.value.jobId,
    deduplicated: result.value.deduplicated
  });
  return apiResponse.success(res, result.value, statusCode);
});

router.post('/jobs/:jobId/execute', authenticateJWT, async (req, res) => {
  const user = await findCurrentUser(req);
  if (!user) return sendInvalidSession(res);

  const { jobId } = req.params;
  const trueLayerProvider = require('../services/trueLayerProvider');
  const result = await executeSyncJob(jobId, trueLayerProvider);

  if (result.error) {
    logWarn('bank_sync.job.execute_failed', {
      email: maskEmail(user.email),
      jobId,
      reason: result.error
    });
    return apiResponse.error(res, result.error, result.statusCode || 500);
  }

  logInfo('bank_sync.job.executed', {
    email: maskEmail(user.email),
    jobId,
    outcome: result.value.syncSummary?.outcome
  });
  return apiResponse.success(res, result.value);
});

router.get('/jobs/:jobId', authenticateJWT, async (req, res) => {
  const user = await findCurrentUser(req);
  if (!user) return sendInvalidSession(res);

  const result = await getJobStatus(req.params.jobId);
  if (result.error) {
    return apiResponse.error(res, result.error, result.statusCode || 404);
  }
  return apiResponse.success(res, result.value);
});

router.get('/jobs', authenticateJWT, async (req, res) => {
  const user = await findCurrentUser(req);
  if (!user) return sendInvalidSession(res);

  const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
  const result = await getJobHistory(user.email, { limit });
  if (result.error) {
    return apiResponse.error(res, result.error, result.statusCode || 500);
  }
  return apiResponse.success(res, result.value);
});

module.exports = router;
