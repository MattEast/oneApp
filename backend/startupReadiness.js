const prisma = require('./db/prisma');

const REQUIRED_TABLES = [
  'User',
  'FinancialProfile',
  'OneTimeEntry',
  'FlexibleCategory',
  'RecurringPayment',
  'BankSyncProfile',
  'BankSyncTransaction',
  'BankSyncSyncSummary'
];

const MIGRATION_ACTION = 'cd backend && npx prisma migrate deploy';

function createStartupReadinessError(message, details = {}) {
  const error = new Error(message);
  error.code = 'STARTUP_READINESS_FAILED';
  error.details = {
    action: MIGRATION_ACTION,
    ...details
  };
  return error;
}

function isStartupReadinessError(error) {
  return Boolean(error && error.code === 'STARTUP_READINESS_FAILED');
}

async function listExistingTables() {
  const rows = await prisma.$queryRawUnsafe(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = current_schema()
  `);

  return new Set(rows.map((row) => row.table_name));
}

async function ensureStartupReadiness() {
  let existingTables;

  try {
    existingTables = await listExistingTables();
  } catch (error) {
    throw createStartupReadinessError(
      `Database readiness check failed. Ensure PostgreSQL is running and the schema is migrated. Run '${MIGRATION_ACTION}'.`,
      {
        kind: 'database_unreachable',
        causeMessage: error.message
      }
    );
  }

  const missingTables = REQUIRED_TABLES.filter((tableName) => !existingTables.has(tableName));

  if (missingTables.length > 0) {
    throw createStartupReadinessError(
      `Database schema is not ready. Missing tables: ${missingTables.join(', ')}. Run '${MIGRATION_ACTION}'.`,
      {
        kind: 'missing_tables',
        missingTables
      }
    );
  }
}

module.exports = {
  MIGRATION_ACTION,
  REQUIRED_TABLES,
  createStartupReadinessError,
  ensureStartupReadiness,
  isStartupReadinessError
};