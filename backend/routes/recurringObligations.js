const express = require('express');
const authenticateJWT = require('../middleware/authenticateJWT');
const { BANK_SYNC_UNAVAILABLE_MESSAGE, isBankSyncUnavailableError } = require('../db/bankSyncStore');
const { findUserByEmail } = require('../services/authService');
const { listRecurringObligationsForUser } = require('../services/recurringObligationsService');
const apiResponse = require('../utils/apiResponse');
const { sendInvalidSession } = require('../utils/httpResponses');

const router = express.Router();

async function findCurrentUser(req) {
  return await findUserByEmail(req.user.email);
}

router.get('/', authenticateJWT, async (req, res) => {
  const user = await findCurrentUser(req);
  if (!user) return sendInvalidSession(res);

  try {
    return apiResponse.success(res, { recurringObligations: await listRecurringObligationsForUser(user.email) });
  } catch (error) {
    if (isBankSyncUnavailableError(error)) {
      return apiResponse.error(res, BANK_SYNC_UNAVAILABLE_MESSAGE, 503);
    }

    throw error;
  }
});

module.exports = router;
