const express = require('express');
const validator = require('validator');
const { buildAuthResponse, findUserByEmail, registerUser, validateUserCredentials } = require('../services/authService');
const { logInfo, logWarn, maskEmail } = require('../utils/observability');
const apiResponse = require('../utils/apiResponse');

const router = express.Router();

router.post('/register', async (req, res) => {
  const { fullname, email, password } = req.body;
  if (!fullname || typeof fullname !== 'string' || fullname.trim().length < 2) {
    return apiResponse.error(res, 'Full name is required and must be at least 2 characters.');
  }
  if (!email || !validator.isEmail(email)) {
    return apiResponse.error(res, 'A valid email address is required.');
  }
  if (!password || typeof password !== 'string' || password.length < 8) {
    return apiResponse.error(res, 'Password is required and must be at least 8 characters.');
  }

  const existingUser = await findUserByEmail(email);
  if (existingUser) {
    logWarn('auth.register.duplicate_email', { email: maskEmail(email) });
    return apiResponse.error(res, 'An account with this email already exists.', 409);
  }

  const user = await registerUser({ fullname, email, password });
  logInfo('auth.register.success', { email: maskEmail(user.email) });

  return apiResponse.success(res, buildAuthResponse(user), 201);
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !validator.isEmail(email)) {
    return apiResponse.error(res, 'A valid email address is required.');
  }
  if (!password || typeof password !== 'string') {
    return apiResponse.error(res, 'Password is required.');
  }
  const user = await validateUserCredentials({ email, password });
  if (!user) {
    logWarn('auth.login.invalid_credentials', { email: maskEmail(email) });
    return apiResponse.error(res, 'Invalid credentials.', 401);
  }

  logInfo('auth.login.success', { email: maskEmail(user.email) });

  return apiResponse.success(res, buildAuthResponse(user));
});

router.post('/logout', (req, res) => {
  return res.status(204).send();
});

module.exports = router;
