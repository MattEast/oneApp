// backend/db/prisma.js
// Initializes and exports a singleton Prisma client instance

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

module.exports = prisma;
