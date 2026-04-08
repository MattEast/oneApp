jest.mock('../db/prisma', () => ({
  $queryRawUnsafe: jest.fn()
}));

const prisma = require('../db/prisma');
const {
  MIGRATION_ACTION,
  REQUIRED_TABLES,
  ensureStartupReadiness,
  isStartupReadinessError
} = require('../startupReadiness');

describe('Startup readiness checks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('passes when all required tables exist', async () => {
    prisma.$queryRawUnsafe.mockResolvedValue(REQUIRED_TABLES.map((table_name) => ({ table_name })));

    await expect(ensureStartupReadiness()).resolves.toBeUndefined();
  });

  it('fails with an actionable migration message when required tables are missing', async () => {
    prisma.$queryRawUnsafe.mockResolvedValue([
      { table_name: 'User' },
      { table_name: 'FinancialProfile' },
      { table_name: 'OneTimeEntry' },
      { table_name: 'FlexibleCategory' },
      { table_name: 'RecurringPayment' }
    ]);

    await expect(ensureStartupReadiness()).rejects.toMatchObject({
      code: 'STARTUP_READINESS_FAILED',
      details: expect.objectContaining({
        kind: 'missing_tables',
        action: MIGRATION_ACTION,
        missingTables: ['BankSyncProfile', 'BankSyncTransaction', 'BankSyncSyncSummary']
      })
    });
  });

  it('fails with a readiness error when the database cannot be queried', async () => {
    prisma.$queryRawUnsafe.mockRejectedValue(new Error('connect ECONNREFUSED'));

    try {
      await ensureStartupReadiness();
      throw new Error('Expected readiness failure');
    } catch (error) {
      expect(isStartupReadinessError(error)).toBe(true);
      expect(error.message).toMatch(/Database readiness check failed/);
      expect(error.details).toEqual(expect.objectContaining({
        kind: 'database_unreachable',
        action: MIGRATION_ACTION
      }));
    }
  });
});