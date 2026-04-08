const express = require('express');
const authenticateJWT = require('../middleware/authenticateJWT');
const { sendDeprecatedFeature } = require('../utils/httpResponses');

const router = express.Router();

const PASSWORD_RESET_DEPRECATION = 'Password reset is deprecated. Please contact support.';
const ACCOUNT_UPDATE_DEPRECATION = 'Profile updates are deprecated. Please contact support.';
const RECURRING_PAYMENTS_DEPRECATION = 'Manual recurring-payment management is deprecated while the product moves to bank-linked recurring obligation detection.';

router.all('/password-reset', (req, res) => {
  return sendDeprecatedFeature(res, PASSWORD_RESET_DEPRECATION);
});
router.all('/password-reset/confirm', (req, res) => {
  return sendDeprecatedFeature(res, PASSWORD_RESET_DEPRECATION);
});
router.put('/account', (req, res) => {
  return sendDeprecatedFeature(res, ACCOUNT_UPDATE_DEPRECATION);
});
router.put('/account/password', (req, res) => {
  return sendDeprecatedFeature(res, ACCOUNT_UPDATE_DEPRECATION);
});
router.all('/recurring-payments', authenticateJWT, (req, res) => {
  return sendDeprecatedFeature(res, RECURRING_PAYMENTS_DEPRECATION);
});
router.all('/recurring-payments/:id', authenticateJWT, (req, res) => {
  return sendDeprecatedFeature(res, RECURRING_PAYMENTS_DEPRECATION);
});

module.exports = router;
