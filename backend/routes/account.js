const express = require('express');
const authenticateJWT = require('../middleware/authenticateJWT');
const { findUserByEmail } = require('../services/authService');
const { buildDashboardSummary } = require('../services/dashboardService');
const { sendInvalidSession } = require('../utils/httpResponses');
const apiResponse = require('../utils/apiResponse');

const router = express.Router();

async function findCurrentUser(req) {
  return await findUserByEmail(req.user.email);
}

router.get('/account', authenticateJWT, async (req, res) => {
  const user = await findCurrentUser(req);
  if (!user) return sendInvalidSession(res);
  return apiResponse.success(res, { fullname: user.fullname, email: user.email });
});

router.get('/dashboard-summary', authenticateJWT, async (req, res) => {
  const user = await findCurrentUser(req);
  if (!user) return sendInvalidSession(res);
  return apiResponse.success(res, await buildDashboardSummary(user));
});

module.exports = router;
