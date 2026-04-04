const bcrypt = require('bcrypt');

const DEMO_USER = {
  fullname: 'Demo Customer',
  email: 'demo@oneapp.local',
  password: 'DemoPass123!'
};

const users = [
  {
    fullname: DEMO_USER.fullname,
    email: DEMO_USER.email,
    password: bcrypt.hashSync(DEMO_USER.password, 12)
  }
];

function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

function findUserByEmail(email) {
  const normalizedEmail = normalizeEmail(email);

  return users.find(user => user.email === normalizedEmail);
}

function addUser(user) {
  users.push(user);

  return user;
}

module.exports = {
  DEMO_USER,
  addUser,
  findUserByEmail,
  normalizeEmail
};