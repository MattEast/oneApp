const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { findUserByEmail, createUser, normalizeEmail, updateUserPassword } = require('../db/userStore');
const { seedDefaultProfile } = require('../db/financialProfileStore');

const DEMO_EMAIL = 'demo@oneapp.local';
const DEMO_PASSWORD = 'DemoPass123!';
const DEMO_FULLNAME = 'Demo Customer';

const JWT_SECRET = process.env.JWT_SECRET || (process.env.NODE_ENV === 'production' ? undefined : 'dev_secret');
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required in production');
}

function buildAuthResponse(user) {
  const payload = { email: user.email, fullname: user.fullname };
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });

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
  const saltRounds = process.env.NODE_ENV === 'production' ? 12 : 6;
  try {
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    const user = await createUser({ email: normalizedEmail, password: hashedPassword, fullname });
    await seedDefaultProfile(user.id);
    return user;
  } catch (err) {
    console.error('Error in registerUser:', err);
    throw new Error('Registration failed');
  }
}

async function ensurePrototypeDemoUser() {
  if (process.env.NODE_ENV === 'production') {
    return;
  }

  const existing = await findUserByEmail(DEMO_EMAIL);
  if (existing) {
    const valid = await bcrypt.compare(DEMO_PASSWORD, existing.password);
    if (valid) {
      return;
    }
  }

  const hashedPassword = await bcrypt.hash(DEMO_PASSWORD, 6);

  if (!existing) {
    const user = await createUser({
      email: DEMO_EMAIL,
      password: hashedPassword,
      fullname: DEMO_FULLNAME
    });
    await seedDefaultProfile(user.id);
    return;
  }

  await updateUserPassword(DEMO_EMAIL, hashedPassword);
}

async function validateUserCredentials({ email, password }) {
  try {
    const normalizedEmail = normalizeEmail(email);

    if (normalizedEmail === DEMO_EMAIL) {
      await ensurePrototypeDemoUser();
    }

    const user = await findUserByEmail(normalizedEmail);
    if (!user) {
      return null;
    }
    const passwordMatches = await bcrypt.compare(password, user.password);
    return passwordMatches ? user : null;
  } catch (err) {
    console.error('Error in validateUserCredentials:', err);
    throw new Error('Authentication failed');
  }
}

module.exports = {
  buildAuthResponse,
  ensurePrototypeDemoUser,
  findUserByEmail,
  normalizeEmail,
  registerUser,
  validateUserCredentials
};