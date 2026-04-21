const crypto = require('crypto');

const GENERATED_SECRET_FLAG = '__ONEAPP_GENERATED_JWT_SECRET';

function getJwtSecret() {
  if (process.env.JWT_SECRET) {
    return process.env.JWT_SECRET;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET environment variable is required in production');
  }

  const generatedSecret = crypto.randomBytes(48).toString('hex');
  process.env.JWT_SECRET = generatedSecret;

  if (process.env.NODE_ENV !== 'test' && !global[GENERATED_SECRET_FLAG]) {
    global[GENERATED_SECRET_FLAG] = true;
    console.warn('[security] JWT_SECRET is not set; generated an ephemeral secret for this process.');
  }

  return generatedSecret;
}

module.exports = {
  getJwtSecret
};