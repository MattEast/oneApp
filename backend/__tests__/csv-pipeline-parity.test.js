const request = require('supertest');
const express = require('express');
const registerRoute = require('../register');
const prisma = require('../db/prisma');
const { ingestMockTransactions, getBankSyncStatus, getBankSyncTransactions } = require('../db/bankSyncStore');
const { detectRecurringObligationsFromTransactions } = require('../services/recurringObligationsService');

async function registerAndLogin(app, {
  fullname = 'Pipeline Parity User',
  email = `parity_${Math.random().toString(36).slice(2, 8)}@example.com`,
  password = 'password123'
} = {}) {
  await request(app)
    .post('/api/v1/register')
    .send({ fullname, email, password });

  const loginResponse = await request(app)
    .post('/api/v1/login')
    .send({ email, password });

  return {
    email,
    token: loginResponse.body.data.token
  };
}

function buildRecurringTransactions({ prefix, count = 3, startDate = '2026-01-15' }) {
  const transactions = [];
  const base = new Date(startDate);

  for (let i = 0; i < count; i++) {
    const bookedAt = new Date(base);
    bookedAt.setMonth(bookedAt.getMonth() + i);
    transactions.push({
      transactionId: `${prefix}-rent-${i}`,
      bookedAt: bookedAt.toISOString(),
      amount: 950,
      currency: 'GBP',
      merchantName: 'Acme Properties',
      direction: 'out',
      status: 'booked',
      categoryHint: 'housing'
    });
  }

  return transactions;
}

afterAll(async () => {
  await prisma.$disconnect();
});

describe('CSV and live-sync ingestion pipeline parity', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/v1', registerRoute);
  });

  describe('deduplication parity', () => {
    it('produces identical dedup outcomes for same transactions via CSV and mock-ingest', async () => {
      const { email: csvEmail, token: csvToken } = await registerAndLogin(app);
      const { email: liveEmail, token: liveToken } = await registerAndLogin(app);

      const sharedTransactions = [
        {
          transactionId: 'dedup-txn-001',
          bookedAt: '2026-04-01T09:00:00.000Z',
          amount: 42.50,
          currency: 'GBP',
          merchantName: 'Test Shop',
          direction: 'out',
          status: 'booked'
        },
        {
          transactionId: 'dedup-txn-001',
          bookedAt: '2026-04-01T09:00:00.000Z',
          amount: 42.50,
          currency: 'GBP',
          merchantName: 'Test Shop',
          direction: 'out',
          status: 'booked'
        }
      ];

      // Link mock account for live-sync path
      await request(app)
        .post('/api/v1/bank-sync/mock-link')
        .set('Authorization', `Bearer ${liveToken}`)
        .send({
          accountId: 'acct-dedup',
          accountName: 'Dedup Test',
          sortCodeMasked: '12-34-56',
          last4: '9999'
        });

      // Ingest via mock (live-sync proxy)
      const liveResult = await request(app)
        .post('/api/v1/bank-sync/mock-ingest')
        .set('Authorization', `Bearer ${liveToken}`)
        .send({ ingestionId: 'live-dedup-001', transactions: sharedTransactions });

      // Ingest via CSV
      const csvData = [
        'transactionId,bookedAt,amount,merchantName,direction,status,currency',
        'dedup-txn-001,2026-04-01T09:00:00.000Z,42.50,Test Shop,out,booked,GBP',
        'dedup-txn-001,2026-04-01T09:00:00.000Z,42.50,Test Shop,out,booked,GBP'
      ].join('\n');

      const csvResult = await request(app)
        .post('/api/v1/bank-sync/csv-import')
        .set('Authorization', `Bearer ${csvToken}`)
        .field('ingestionId', 'csv-dedup-001')
        .attach('file', Buffer.from(csvData), { filename: 'dedup.csv', contentType: 'text/csv' });

      // Both should have identical dedup behaviour
      expect(liveResult.body.data.syncSummary.acceptedCount).toBe(1);
      expect(liveResult.body.data.syncSummary.duplicateCount).toBe(1);
      expect(csvResult.body.data.syncSummary.acceptedCount).toBe(1);
      expect(csvResult.body.data.syncSummary.duplicateCount).toBe(1);
    });

    it('deduplicates cross-ingestion replays identically for both paths', async () => {
      const { email, token } = await registerAndLogin(app);

      await request(app)
        .post('/api/v1/bank-sync/mock-link')
        .set('Authorization', `Bearer ${token}`)
        .send({
          accountId: 'acct-cross',
          accountName: 'Cross Dedup',
          sortCodeMasked: '12-34-56',
          last4: '8888'
        });

      // First ingestion via mock
      const first = await request(app)
        .post('/api/v1/bank-sync/mock-ingest')
        .set('Authorization', `Bearer ${token}`)
        .send({
          ingestionId: 'live-cross-001',
          transactions: [{
            transactionId: 'cross-txn-001',
            bookedAt: '2026-04-01T09:00:00.000Z',
            amount: 25.00,
            currency: 'GBP',
            merchantName: 'Repeat Merchant',
            direction: 'out',
            status: 'booked'
          }]
        });

      expect(first.body.data.syncSummary.acceptedCount).toBe(1);

      // Same transaction replayed via CSV — should be deduplicated
      const csvData = [
        'transactionId,bookedAt,amount,merchantName,direction,status,currency',
        'cross-txn-001,2026-04-01T09:00:00.000Z,25.00,Repeat Merchant,out,booked,GBP'
      ].join('\n');

      const csvReplay = await request(app)
        .post('/api/v1/bank-sync/csv-import')
        .set('Authorization', `Bearer ${token}`)
        .field('ingestionId', 'csv-cross-001')
        .attach('file', Buffer.from(csvData), { filename: 'replay.csv', contentType: 'text/csv' });

      expect(csvReplay.body.data.syncSummary.acceptedCount).toBe(0);
      expect(csvReplay.body.data.syncSummary.duplicateCount).toBe(1);
    });
  });

  describe('pending transaction rejection parity', () => {
    it('rejects pending transactions identically via both paths', async () => {
      const { email: csvEmail, token: csvToken } = await registerAndLogin(app);
      const { email: liveEmail, token: liveToken } = await registerAndLogin(app);

      await request(app)
        .post('/api/v1/bank-sync/mock-link')
        .set('Authorization', `Bearer ${liveToken}`)
        .send({
          accountId: 'acct-pending',
          accountName: 'Pending Test',
          sortCodeMasked: '12-34-56',
          last4: '7777'
        });

      const pending = [{
        transactionId: 'pending-txn-001',
        bookedAt: '2026-04-01T09:00:00.000Z',
        amount: 50.00,
        currency: 'GBP',
        merchantName: 'Pending Shop',
        direction: 'out',
        status: 'pending'
      }];

      const liveResult = await request(app)
        .post('/api/v1/bank-sync/mock-ingest')
        .set('Authorization', `Bearer ${liveToken}`)
        .send({ ingestionId: 'live-pending-001', transactions: pending });

      const csvData = [
        'transactionId,bookedAt,amount,merchantName,direction,status,currency',
        'pending-txn-001,2026-04-01T09:00:00.000Z,50.00,Pending Shop,out,pending,GBP'
      ].join('\n');

      const csvResult = await request(app)
        .post('/api/v1/bank-sync/csv-import')
        .set('Authorization', `Bearer ${csvToken}`)
        .field('ingestionId', 'csv-pending-001')
        .attach('file', Buffer.from(csvData), { filename: 'pending.csv', contentType: 'text/csv' });

      // Both reject pending transactions with identical counts
      expect(liveResult.body.data.syncSummary.rejectedCount).toBe(1);
      expect(liveResult.body.data.syncSummary.acceptedCount).toBe(0);
      expect(csvResult.body.data.syncSummary.rejectedCount).toBe(1);
      expect(csvResult.body.data.syncSummary.acceptedCount).toBe(0);
    });
  });

  describe('obligation detection parity', () => {
    it('detects identical recurring obligations from CSV and mock-ingest transactions', async () => {
      const csvTransactions = buildRecurringTransactions({ prefix: 'csv_parity' });
      const liveTransactions = buildRecurringTransactions({ prefix: 'live_parity' });

      // Use service-level function directly to verify parity at detection layer
      const csvObligations = detectRecurringObligationsFromTransactions(csvTransactions);
      const liveObligations = detectRecurringObligationsFromTransactions(liveTransactions);

      expect(csvObligations.length).toBe(liveObligations.length);
      expect(csvObligations.length).toBeGreaterThanOrEqual(1);

      const csvObligation = csvObligations[0];
      const liveObligation = liveObligations[0];

      // Same detection outcome regardless of source
      expect(csvObligation.label).toBe(liveObligation.label);
      expect(csvObligation.amountMinor).toBe(liveObligation.amountMinor);
      expect(csvObligation.cadence).toBe(liveObligation.cadence);
      expect(csvObligation.category).toBe(liveObligation.category);
      expect(csvObligation.confidence).toBe(liveObligation.confidence);

      // Source correctly inferred per path
      expect(csvObligation.source).toBe('csv_import');
      expect(liveObligation.source).toBe('bank_linked');
    });
  });

  describe('dashboard totals parity', () => {
    it('produces identical dashboard totals from CSV and mock-ingest data', async () => {
      const { token: csvToken } = await registerAndLogin(app);
      const { token: liveToken } = await registerAndLogin(app);

      await request(app)
        .post('/api/v1/bank-sync/mock-link')
        .set('Authorization', `Bearer ${liveToken}`)
        .send({
          accountId: 'acct-totals',
          accountName: 'Totals Test',
          sortCodeMasked: '12-34-56',
          last4: '6666'
        });

      // Ingest recurring transactions via mock (live proxy)
      const liveTransactions = buildRecurringTransactions({ prefix: 'live_totals' });
      await request(app)
        .post('/api/v1/bank-sync/mock-ingest')
        .set('Authorization', `Bearer ${liveToken}`)
        .send({ ingestionId: 'live-totals-001', transactions: liveTransactions });

      // Ingest identical recurring transactions via CSV
      const csvLines = ['transactionId,bookedAt,amount,merchantName,direction,status,currency,categoryHint'];
      const csvTransactions = buildRecurringTransactions({ prefix: 'csv_totals' });
      csvTransactions.forEach((txn) => {
        csvLines.push(
          `${txn.transactionId},${txn.bookedAt},${txn.amount},${txn.merchantName},${txn.direction},${txn.status},${txn.currency},${txn.categoryHint}`
        );
      });

      await request(app)
        .post('/api/v1/bank-sync/csv-import')
        .set('Authorization', `Bearer ${csvToken}`)
        .field('ingestionId', 'csv-totals-001')
        .attach('file', Buffer.from(csvLines.join('\n')), { filename: 'totals.csv', contentType: 'text/csv' });

      // Get dashboards for both
      const liveDashboard = await request(app)
        .get('/api/v1/dashboard-summary')
        .set('Authorization', `Bearer ${liveToken}`);

      const csvDashboard = await request(app)
        .get('/api/v1/dashboard-summary')
        .set('Authorization', `Bearer ${csvToken}`);

      expect(liveDashboard.statusCode).toBe(200);
      expect(csvDashboard.statusCode).toBe(200);

      // Totals should be numerically identical
      expect(csvDashboard.body.data.totals.monthlyBills).toBe(liveDashboard.body.data.totals.monthlyBills);
      expect(csvDashboard.body.data.totals.availableFunds).toBe(liveDashboard.body.data.totals.availableFunds);

      // Daily spending limit should also match
      expect(csvDashboard.body.data.dailySpendingLimit.amount).toBe(liveDashboard.body.data.dailySpendingLimit.amount);
    });
  });
});

describe('CSV source metadata contract tests', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/v1', registerRoute);
  });

  it('dashboard returns recurringDataSource.kind = csv_import for CSV-only data', async () => {
    const { token } = await registerAndLogin(app);

    const csvTransactions = buildRecurringTransactions({ prefix: 'csv_meta' });
    const csvLines = ['transactionId,bookedAt,amount,merchantName,direction,status,currency,categoryHint'];
    csvTransactions.forEach((txn) => {
      csvLines.push(
        `${txn.transactionId},${txn.bookedAt},${txn.amount},${txn.merchantName},${txn.direction},${txn.status},${txn.currency},${txn.categoryHint}`
      );
    });

    await request(app)
      .post('/api/v1/bank-sync/csv-import')
      .set('Authorization', `Bearer ${token}`)
      .field('ingestionId', 'csv-meta-001')
      .attach('file', Buffer.from(csvLines.join('\n')), { filename: 'meta.csv', contentType: 'text/csv' });

    const dashboard = await request(app)
      .get('/api/v1/dashboard-summary')
      .set('Authorization', `Bearer ${token}`);

    expect(dashboard.statusCode).toBe(200);
    expect(dashboard.body.data.recurringDataSource.kind).toBe('csv_import');
    expect(dashboard.body.data.recurringDataSource.status).toBe('active');
    expect(dashboard.body.data.recurringDataSource.detectedCount).toBeGreaterThanOrEqual(1);
  });

  it('dashboard returns recurringDataSource.kind = bank_linked for mock-ingest-only data', async () => {
    const { token } = await registerAndLogin(app);

    await request(app)
      .post('/api/v1/bank-sync/mock-link')
      .set('Authorization', `Bearer ${token}`)
      .send({
        accountId: 'acct-meta-live',
        accountName: 'Meta Live',
        sortCodeMasked: '12-34-56',
        last4: '5555'
      });

    const liveTransactions = buildRecurringTransactions({ prefix: 'live_meta' });
    await request(app)
      .post('/api/v1/bank-sync/mock-ingest')
      .set('Authorization', `Bearer ${token}`)
      .send({ ingestionId: 'live-meta-001', transactions: liveTransactions });

    const dashboard = await request(app)
      .get('/api/v1/dashboard-summary')
      .set('Authorization', `Bearer ${token}`);

    expect(dashboard.statusCode).toBe(200);
    expect(dashboard.body.data.recurringDataSource.kind).toBe('bank_linked');
    expect(dashboard.body.data.recurringDataSource.status).toBe('active');
  });

  it('dashboard returns recurringDataSource.kind = mixed for combined CSV and live data', async () => {
    const { token } = await registerAndLogin(app);

    await request(app)
      .post('/api/v1/bank-sync/mock-link')
      .set('Authorization', `Bearer ${token}`)
      .send({
        accountId: 'acct-mixed',
        accountName: 'Mixed Test',
        sortCodeMasked: '12-34-56',
        last4: '4444'
      });

    // Ingest bank-linked recurring obligations (3 months of rent via mock)
    const liveTransactions = buildRecurringTransactions({ prefix: 'live_mixed', count: 3 });
    await request(app)
      .post('/api/v1/bank-sync/mock-ingest')
      .set('Authorization', `Bearer ${token}`)
      .send({ ingestionId: 'live-mixed-001', transactions: liveTransactions });

    // Also ingest CSV-sourced recurring obligations (3 months of different merchant)
    const csvTransactions = [];
    const base = new Date('2026-01-20');

    for (let i = 0; i < 3; i++) {
      const bookedAt = new Date(base);
      bookedAt.setMonth(bookedAt.getMonth() + i);
      csvTransactions.push({
        transactionId: `csv_mixed-energy-${i}`,
        bookedAt: bookedAt.toISOString(),
        amount: 85,
        merchantName: 'Green Energy Co',
        direction: 'out',
        status: 'booked',
        currency: 'GBP',
        categoryHint: 'household_bills'
      });
    }

    const csvLines = ['transactionId,bookedAt,amount,merchantName,direction,status,currency,categoryHint'];
    csvTransactions.forEach((txn) => {
      csvLines.push(
        `${txn.transactionId},${txn.bookedAt},${txn.amount},${txn.merchantName},${txn.direction},${txn.status},${txn.currency},${txn.categoryHint}`
      );
    });

    await request(app)
      .post('/api/v1/bank-sync/csv-import')
      .set('Authorization', `Bearer ${token}`)
      .field('ingestionId', 'csv-mixed-001')
      .attach('file', Buffer.from(csvLines.join('\n')), { filename: 'mixed.csv', contentType: 'text/csv' });

    const dashboard = await request(app)
      .get('/api/v1/dashboard-summary')
      .set('Authorization', `Bearer ${token}`);

    expect(dashboard.statusCode).toBe(200);
    expect(dashboard.body.data.recurringDataSource.kind).toBe('mixed');
    expect(dashboard.body.data.recurringDataSource.status).toBe('active');
    expect(dashboard.body.data.recurringDataSource.detectedCount).toBeGreaterThanOrEqual(2);
  });

  it('bank-sync status returns correct source in latestSync for CSV import', async () => {
    const { token } = await registerAndLogin(app);

    const csvData = [
      'transactionId,bookedAt,amount,merchantName,direction,status,currency',
      'src-txn-001,2026-04-01T09:00:00.000Z,15.00,Source Test,out,booked,GBP'
    ].join('\n');

    await request(app)
      .post('/api/v1/bank-sync/csv-import')
      .set('Authorization', `Bearer ${token}`)
      .field('ingestionId', 'csv-source-001')
      .attach('file', Buffer.from(csvData), { filename: 'source.csv', contentType: 'text/csv' });

    const status = await request(app)
      .get('/api/v1/bank-sync/status')
      .set('Authorization', `Bearer ${token}`);

    expect(status.statusCode).toBe(200);
    expect(status.body.data.status.latestSync.source).toBe('csv_import');
  });

  it('bank-sync status returns correct source in latestSync for mock-ingest', async () => {
    const { token } = await registerAndLogin(app);

    await request(app)
      .post('/api/v1/bank-sync/mock-link')
      .set('Authorization', `Bearer ${token}`)
      .send({
        accountId: 'acct-src-live',
        accountName: 'Source Live',
        sortCodeMasked: '12-34-56',
        last4: '3333'
      });

    await request(app)
      .post('/api/v1/bank-sync/mock-ingest')
      .set('Authorization', `Bearer ${token}`)
      .send({
        ingestionId: 'live-source-001',
        transactions: [{
          transactionId: 'src-live-txn-001',
          bookedAt: '2026-04-01T09:00:00.000Z',
          amount: 15.00,
          currency: 'GBP',
          merchantName: 'Source Test',
          direction: 'out',
          status: 'booked'
        }]
      });

    const status = await request(app)
      .get('/api/v1/bank-sync/status')
      .set('Authorization', `Bearer ${token}`);

    expect(status.statusCode).toBe(200);
    expect(status.body.data.status.latestSync.source).toBe('bank_linked');
  });

  it('import-history endpoint only returns CSV imports', async () => {
    const { token } = await registerAndLogin(app);

    await request(app)
      .post('/api/v1/bank-sync/mock-link')
      .set('Authorization', `Bearer ${token}`)
      .send({
        accountId: 'acct-hist',
        accountName: 'History Test',
        sortCodeMasked: '12-34-56',
        last4: '2222'
      });

    // Ingest via mock
    await request(app)
      .post('/api/v1/bank-sync/mock-ingest')
      .set('Authorization', `Bearer ${token}`)
      .send({
        ingestionId: 'live-hist-001',
        transactions: [{
          transactionId: 'hist-live-001',
          bookedAt: '2026-04-01T09:00:00.000Z',
          amount: 10.00,
          currency: 'GBP',
          merchantName: 'History Test',
          direction: 'out',
          status: 'booked'
        }]
      });

    // Ingest via CSV
    const csvData = [
      'transactionId,bookedAt,amount,merchantName,direction,status,currency',
      'hist-csv-001,2026-04-01T09:00:00.000Z,20.00,CSV History,out,booked,GBP'
    ].join('\n');

    await request(app)
      .post('/api/v1/bank-sync/csv-import')
      .set('Authorization', `Bearer ${token}`)
      .field('ingestionId', 'csv-hist-001')
      .attach('file', Buffer.from(csvData), { filename: 'hist.csv', contentType: 'text/csv' });

    const history = await request(app)
      .get('/api/v1/bank-sync/import-history')
      .set('Authorization', `Bearer ${token}`);

    expect(history.statusCode).toBe(200);
    expect(history.body.data.imports.length).toBe(1);
    expect(history.body.data.imports[0].source).toBe('csv_import');
    expect(history.body.data.imports[0].ingestionId).toMatch(/^csv:/i);
  });
});
