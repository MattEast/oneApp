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
const { logInfo, logWarn, maskEmail } = require('../utils/observability');
const apiResponse = require('../utils/apiResponse');
const { sendInvalidSession } = require('../utils/httpResponses');

const router = express.Router();
const MAX_CSV_UPLOAD_BYTES = 1024 * 1024;
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

module.exports = router;
