// backend/db/userStore.js
// User persistence using Prisma/PostgreSQL

const prisma = require('./prisma');

function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

async function findUserByEmail(email) {
  try {
    return await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  } catch (err) {
    console.error('Error in findUserByEmail:', err);
    throw new Error('Database error');
  }
}


async function createUser({ email, password, fullname }) {
  try {
    return await prisma.user.create({ data: { email: email.trim().toLowerCase(), password, fullname } });
  } catch (err) {
    console.error('Error in createUser:', err);
    throw new Error('Database error');
  }
}


async function updateUserPassword(email, password) {
  try {
    return await prisma.user.update({ where: { email: email.trim().toLowerCase() }, data: { password } });
  } catch (err) {
    console.error('Error in updateUserPassword:', err);
    throw new Error('Database error');
  }
}

module.exports = {
  findUserByEmail,
  createUser,
  updateUserPassword,
  normalizeEmail
};
