const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { addUser, findUserByEmail, normalizeEmail } = require('../data/userStore');

function buildAuthResponse(user) {
  const payload = { email: user.email, fullname: user.fullname };
  const token = jwt.sign(payload, process.env.JWT_SECRET || 'dev_secret', { expiresIn: '1h' });

  return {
    token,
    expiresIn: 3600,
    user: {
      fullname: user.fullname,
      email: user.email
    }
  };
}

async function registerUser({ fullname, email, password }) {
  const normalizedEmail = normalizeEmail(email);
  const hashedPassword = await bcrypt.hash(password, 12);
  const user = {
    fullname: fullname.trim(),
    email: normalizedEmail,
    password: hashedPassword
  };

  return addUser(user);
}

async function validateUserCredentials({ email, password }) {
  const user = findUserByEmail(email);

  if (!user) {
    return null;
  }

  const passwordMatches = await bcrypt.compare(password, user.password);

  return passwordMatches ? user : null;
}

module.exports = {
  buildAuthResponse,
  findUserByEmail,
  normalizeEmail,
  registerUser,
  validateUserCredentials
};