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
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 1024 * 1024
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

router.post('/csv-import', authenticateJWT, upload.single('file'), async (req, res) => {
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
