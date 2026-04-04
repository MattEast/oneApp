
const express = require('express');
const validator = require('validator');
const router = express.Router();
const { getOrCreateFinancialProfile } = require('./data/financialStore');
const authenticateJWT = require('./middleware/authenticateJWT');
const { buildAuthResponse, findUserByEmail, registerUser, validateUserCredentials } = require('./services/authService');
const { buildDashboardSummary } = require('./services/dashboardService');
const {
  getMockBankSyncStatus,
  linkMockBankAccount,
  runMockBankIngestion
} = require('./services/mockBankSyncService');
const { listRecurringObligationsForUser } = require('./services/recurringObligationsService');
const {
  createOneTimeEntryForUser,
  listOneTimeEntriesForUser,
  removeOneTimeEntryForUser,
  updateOneTimeEntryForUser
} = require('./services/oneTimeEntriesService');
const { logInfo, logWarn, maskEmail } = require('./utils/observability');
const { sendDeprecatedFeature, sendInvalidSession } = require('./utils/httpResponses');

const RECURRING_PAYMENTS_DEPRECATION_MESSAGE =
  'Manual recurring-payment management is deprecated while the product moves to bank-linked recurring obligation detection.';

function findCurrentUser(req) {
  return findUserByEmail(req.user.email);
}

router.post('/register', async (req, res) => {
  const { fullname, email, password } = req.body;
  // Robust validation
  if (!fullname || typeof fullname !== 'string' || fullname.trim().length < 2) {
    return res.status(400).json({ error: 'Full name is required and must be at least 2 characters.' });
  }
  if (!email || !validator.isEmail(email)) {
    return res.status(400).json({ error: 'A valid email address is required.' });
  }
  if (!password || typeof password !== 'string' || password.length < 8) {
    return res.status(400).json({ error: 'Password is required and must be at least 8 characters.' });
  }

  const existingUser = findUserByEmail(email);
  if (existingUser) {
    logWarn('auth.register.duplicate_email', { email: maskEmail(email) });
    return res.status(409).json({ error: 'An account with this email already exists.' });
  }

  const user = await registerUser({ fullname, email, password });
  getOrCreateFinancialProfile(user.email);
  logInfo('auth.register.success', { email: maskEmail(user.email) });

  return res.status(201).json(buildAuthResponse(user));
});

// Login endpoint (JWT-based, ready for future migration)
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !validator.isEmail(email)) {
    return res.status(400).json({ error: 'A valid email address is required.' });
  }
  if (!password || typeof password !== 'string') {
    return res.status(400).json({ error: 'Password is required.' });
  }
  const user = await validateUserCredentials({ email, password });
  if (!user) {
    logWarn('auth.login.invalid_credentials', { email: maskEmail(email) });
    return res.status(401).json({ error: 'Invalid credentials.' });
  }

  logInfo('auth.login.success', { email: maskEmail(user.email) });

  return res.status(200).json(buildAuthResponse(user));
});


router.get('/account', authenticateJWT, (req, res) => {
  const user = findCurrentUser(req);
  if (!user) return sendInvalidSession(res);
  return res.status(200).json({ fullname: user.fullname, email: user.email });
});

router.get('/dashboard-summary', authenticateJWT, (req, res) => {
  const user = findCurrentUser(req);
  if (!user) return sendInvalidSession(res);
  return res.status(200).json(buildDashboardSummary(user));
});

router.get('/one-time-entries', authenticateJWT, (req, res) => {
  const user = findCurrentUser(req);

  if (!user) {
    return sendInvalidSession(res);
  }

  return res.status(200).json({
    oneTimeEntries: listOneTimeEntriesForUser(user.email)
  });
});

router.post('/one-time-entries', authenticateJWT, (req, res) => {
  const user = findCurrentUser(req);

  if (!user) {
    return sendInvalidSession(res);
  }

  const result = createOneTimeEntryForUser(user.email, req.body);

  if (result.error) {
    logWarn('financial.one_time_entry.create.rejected', {
      email: maskEmail(user.email),
      reason: result.error
    });
    return res.status(result.statusCode || 400).json({ error: result.error });
  }

  logInfo('financial.one_time_entry.created', {
    email: maskEmail(user.email),
    entryId: result.value.id,
    type: result.value.type
  });

  return res.status(201).json({ oneTimeEntry: result.value });
});

router.put('/one-time-entries/:entryId', authenticateJWT, (req, res) => {
  const user = findCurrentUser(req);

  if (!user) {
    return sendInvalidSession(res);
  }

  const result = updateOneTimeEntryForUser(user.email, req.params.entryId, req.body);

  if (result.error) {
    logWarn('financial.one_time_entry.update.rejected', {
      email: maskEmail(user.email),
      entryId: req.params.entryId,
      reason: result.error
    });
    return res.status(result.statusCode || 400).json({ error: result.error });
  }

  logInfo('financial.one_time_entry.updated', {
    email: maskEmail(user.email),
    entryId: result.value.id,
    type: result.value.type
  });

  return res.status(200).json({ oneTimeEntry: result.value });
});

router.delete('/one-time-entries/:entryId', authenticateJWT, (req, res) => {
  const user = findCurrentUser(req);

  if (!user) {
    return sendInvalidSession(res);
  }

  const result = removeOneTimeEntryForUser(user.email, req.params.entryId);

  if (result.error) {
    logWarn('financial.one_time_entry.delete.rejected', {
      email: maskEmail(user.email),
      entryId: req.params.entryId,
      reason: result.error
    });
    return res.status(result.statusCode || 400).json({ error: result.error });
  }

  logInfo('financial.one_time_entry.deleted', {
    email: maskEmail(user.email),
    entryId: result.value.id
  });

  return res.status(200).json({ deletedEntryId: result.value.id });
});

router.get('/bank-sync/status', authenticateJWT, (req, res) => {
  const user = findCurrentUser(req);

  if (!user) {
    return sendInvalidSession(res);
  }

  return res.status(200).json(getMockBankSyncStatus(user.email).value);
});

router.post('/bank-sync/mock-link', authenticateJWT, (req, res) => {
  const user = findCurrentUser(req);

  if (!user) {
    return sendInvalidSession(res);
  }

  const result = linkMockBankAccount(user.email, req.body);

  if (result.error) {
    logWarn('bank_sync.mock_link.rejected', {
      email: maskEmail(user.email),
      reason: result.error
    });
    return res.status(400).json({ error: result.error });
  }

  logInfo('bank_sync.mock_link.created', { email: maskEmail(user.email) });

  return res.status(201).json(result.value);
});

router.post('/bank-sync/mock-ingest', authenticateJWT, (req, res) => {
  const user = findCurrentUser(req);

  if (!user) {
    return sendInvalidSession(res);
  }

  const result = runMockBankIngestion(user.email, req.body);

  if (result.error) {
    logWarn('bank_sync.mock_ingest.rejected', {
      email: maskEmail(user.email),
      reason: result.error
    });
    return res.status(400).json({ error: result.error });
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

  return res.status(statusCode).json(result.value);
});

router.get('/recurring-obligations', authenticateJWT, (req, res) => {
  const user = findCurrentUser(req);

  if (!user) {
    return sendInvalidSession(res);
  }

  return res.status(200).json({
    recurringObligations: listRecurringObligationsForUser(user.email)
  });
});

router.get('/recurring-payments', authenticateJWT, (req, res) => {
  return sendDeprecatedFeature(res, RECURRING_PAYMENTS_DEPRECATION_MESSAGE);
});

router.post('/recurring-payments', authenticateJWT, (req, res) => {
  return sendDeprecatedFeature(res, RECURRING_PAYMENTS_DEPRECATION_MESSAGE);
});

router.put('/recurring-payments/:paymentId', authenticateJWT, (req, res) => {
  return sendDeprecatedFeature(res, RECURRING_PAYMENTS_DEPRECATION_MESSAGE);
});

router.delete('/recurring-payments/:paymentId', authenticateJWT, (req, res) => {
  return sendDeprecatedFeature(res, RECURRING_PAYMENTS_DEPRECATION_MESSAGE);
});

// Update profile (fullname)
router.put('/account', authenticateJWT, (req, res) => {
  return sendDeprecatedFeature(
    res,
    'Profile updates are deprecated until the account management design is realigned with the documented product scope.'
  );
});

// Change password
router.put('/account/password', authenticateJWT, async (req, res) => {
  return sendDeprecatedFeature(
    res,
    'Password changes are deprecated until the account management design is realigned with the documented product scope.'
  );
});

// --- Logout Endpoint (stateless, for frontend to clear token) ---
router.post('/logout', (req, res) => {
  return res.status(204).send();
});

module.exports = router;

// --- Password Reset Endpoints ---

// Initiate password reset
router.post('/password-reset', async (req, res) => {
  return sendDeprecatedFeature(
    res,
    'Password reset is deprecated until the reset workflow is realigned with the documented product design.'
  );
});

// Complete password reset
router.post('/password-reset/confirm', async (req, res) => {
  return sendDeprecatedFeature(
    res,
    'Password reset confirmation is deprecated until the reset workflow is realigned with the documented product design.'
  );
});
