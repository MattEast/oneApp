const jwt = require('jsonwebtoken');
const { logWarn } = require('../utils/observability');

function authenticateJWT(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    logWarn('auth.missing_or_invalid_header', {
      method: req.method,
      path: req.originalUrl
    });
    return res.status(401).json({ error: 'Missing or invalid Authorization header.' });
  }

  const token = authHeader.split(' ')[1];

  return jwt.verify(token, process.env.JWT_SECRET || 'dev_secret', (error, user) => {
    if (error) {
      logWarn('auth.invalid_or_expired_token', {
        method: req.method,
        path: req.originalUrl,
        reason: error.name
      });
      return res.status(401).json({ error: 'Invalid or expired token.' });
    }

    req.user = user;
    return next();
  });
}

module.exports = authenticateJWT;