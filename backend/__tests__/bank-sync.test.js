const request = require('supertest');
const express = require('express');
const registerRoute = require('../register');
const { resetBankSyncState } = require('../db/bankSyncStore');

async function registerAndLogin(app, {
  fullname = 'Bank Sync User',
  email = `bank_sync_${Math.random().toString(36).slice(2,8)}@example.com`,
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

describe('Mock bank-linked data ingestion', () => {
  let app;

  beforeEach(async () => {
    await resetBankSyncState();
    app = express();
    app.use(express.json());
    app.use('/api/v1', registerRoute);
  });

  it('returns mock provider strategy and initial status for an authenticated user', async () => {
    const { token } = await registerAndLogin(app);
    const response = await request(app)
      .get('/api/v1/bank-sync/status')
      .set('Authorization', `Bearer ${token}`);

    expect(response.statusCode).toBe(200);
    expect(response.body.data.metadata.provider).toBe('truelayer_mock');
    expect(response.body.data.metadata.providerStrategy.preferredProvider).toBe('TrueLayer');
    expect(response.body.data.status.consent.status).toBe('not_linked');
    expect(response.body.data.status.transactionCount).toBe(0);
  });

  it('links a mock bank account and ingests transactions with duplicate and partial handling', async () => {
    const { token } = await registerAndLogin(app);

    const linkResponse = await request(app)
      .post('/api/v1/bank-sync/mock-link')
      .set('Authorization', `Bearer ${token}`)
      .send({
        accountId: 'acct-demo-001',
        accountName: 'Main current account',
        sortCodeMasked: '12-34-56',
        last4: '1234'
      });

    expect(linkResponse.statusCode).toBe(201);
    expect(linkResponse.body.data.status.consent.status).toBe('active');
    expect(linkResponse.body.data.status.linkedAccount.accountName).toBe('Main current account');

    const ingestResponse = await request(app)
      .post('/api/v1/bank-sync/mock-ingest')
      .set('Authorization', `Bearer ${token}`)
      .send({
        ingestionId: 'ingest-001',
        transactions: [
          {
            transactionId: 'txn-rent-001',
            bookedAt: '2026-04-01T09:00:00.000Z',
            amount: 1200,
            currency: 'GBP',
            merchantName: 'Example Homes',
            direction: 'out',
            status: 'booked',
            categoryHint: 'housing'
          },
          {
            transactionId: 'txn-rent-001',
            bookedAt: '2026-04-01T09:00:00.000Z',
            amount: 1200,
            currency: 'GBP',
            merchantName: 'Example Homes',
            direction: 'out',
            status: 'booked',
            categoryHint: 'housing'
          },
          {
            transactionId: 'txn-energy-001',
            bookedAt: '2026-04-02T09:00:00.000Z',
            amount: 85,
            currency: 'GBP',
            merchantName: 'North Energy',
            direction: 'out',
            status: 'pending',
            categoryHint: 'household_bills'
          }
        ]
      });

    expect(ingestResponse.statusCode).toBe(207);
    expect(ingestResponse.body.data.syncSummary.outcome).toBe('partial_success');
    expect(ingestResponse.body.data.syncSummary.acceptedCount).toBe(1);
    expect(ingestResponse.body.data.syncSummary.duplicateCount).toBe(1);
    expect(ingestResponse.body.data.syncSummary.rejectedCount).toBe(1);
    expect(ingestResponse.body.data.transactions).toHaveLength(1);

    const statusResponse = await request(app)
      .get('/api/v1/bank-sync/status')
      .set('Authorization', `Bearer ${token}`);

    expect(statusResponse.statusCode).toBe(200);
    expect(statusResponse.body.data.status.transactionCount).toBe(1);
    expect(statusResponse.body.data.status.latestSync.outcome).toBe('partial_success');
  });

  it('persists linked-account state and ingested transactions across app re-instantiation', async () => {
    const { token } = await registerAndLogin(app);

    await request(app)
      .post('/api/v1/bank-sync/mock-link')
      .set('Authorization', `Bearer ${token}`)
      .send({
        accountId: 'acct-persist-001',
        accountName: 'Persistence account',
        sortCodeMasked: '12-34-56',
        last4: '9876'
      });

    await request(app)
      .post('/api/v1/bank-sync/mock-ingest')
      .set('Authorization', `Bearer ${token}`)
      .send({
        ingestionId: 'ingest-persist-001',
        transactions: [
          {
            transactionId: 'txn-persist-rent-001',
            bookedAt: '2026-04-01T09:00:00.000Z',
            amount: 1200,
            currency: 'GBP',
            merchantName: 'Example Homes',
            direction: 'out',
            status: 'booked',
            categoryHint: 'housing'
          }
        ]
      });

    app = express();
    app.use(express.json());
    app.use('/api/v1', registerRoute);

    const statusResponse = await request(app)
      .get('/api/v1/bank-sync/status')
      .set('Authorization', `Bearer ${token}`);

    expect(statusResponse.statusCode).toBe(200);
    expect(statusResponse.body.data.status.consent.status).toBe('active');
    expect(statusResponse.body.data.status.linkedAccount).toEqual(
      expect.objectContaining({ accountName: 'Persistence account', last4: '9876' })
    );
    expect(statusResponse.body.data.status.transactionCount).toBe(1);
    expect(statusResponse.body.data.status.latestSync).toEqual(
      expect.objectContaining({ ingestionId: 'ingest-persist-001', outcome: 'success' })
    );
  });

  it('rejects invalid mock-link and ingest payloads', async () => {
    const { token } = await registerAndLogin(app);

    const badLinkResponse = await request(app)
      .post('/api/v1/bank-sync/mock-link')
      .set('Authorization', `Bearer ${token}`)
      .send({
        accountId: 'a',
        accountName: 'X',
        sortCodeMasked: '123456',
        last4: '12'
      });

    expect(badLinkResponse.statusCode).toBe(400);
    expect(badLinkResponse.body.error).toMatch(/Account ID is required/i);

    const badIngestResponse = await request(app)
      .post('/api/v1/bank-sync/mock-ingest')
      .set('Authorization', `Bearer ${token}`)
      .send({
        ingestionId: 'ingest-invalid',
        transactions: [
          {
            transactionId: 'txn-invalid',
            bookedAt: 'not-a-date',
            amount: 25,
            currency: 'GBP',
            merchantName: 'Cafe',
            direction: 'out',
            status: 'booked'
          }
        ]
      });

    expect(badIngestResponse.statusCode).toBe(400);
    expect(badIngestResponse.body.error).toMatch(/bookedAt timestamp/i);
  });

  it('imports bank-statement CSV rows through the same ingestion flow', async () => {
    const { token } = await registerAndLogin(app);

    await request(app)
      .post('/api/v1/bank-sync/mock-link')
      .set('Authorization', `Bearer ${token}`)
      .send({
        accountId: 'acct-csv-001',
        accountName: 'CSV import account',
        sortCodeMasked: '12-34-56',
        last4: '4567'
      });

    const csvImportResponse = await request(app)
      .post('/api/v1/bank-sync/csv-import')
      .set('Authorization', `Bearer ${token}`)
      .send({
        ingestionId: 'csv-ingest-001',
        csvData: [
          'date,description,amount,currency,status',
          '2026-03-01T09:00:00.000Z,Example Homes,-1200,GBP,booked',
          '2026-04-01T09:00:00.000Z,Example Homes,-1200,GBP,booked'
        ].join('\n')
      });

    expect(csvImportResponse.statusCode).toBe(200);
    expect(csvImportResponse.body.data.syncSummary.outcome).toBe('success');
    expect(csvImportResponse.body.data.syncSummary.acceptedCount).toBe(2);
    expect(csvImportResponse.body.data.syncSummary.duplicateCount).toBe(0);
    expect(csvImportResponse.body.data.transactions).toHaveLength(2);

    const statusResponse = await request(app)
      .get('/api/v1/bank-sync/status')
      .set('Authorization', `Bearer ${token}`);

    expect(statusResponse.statusCode).toBe(200);
    expect(statusResponse.body.data.status.transactionCount).toBe(2);

    const dashboardResponse = await request(app)
      .get('/api/v1/dashboard-summary')
      .set('Authorization', `Bearer ${token}`);

    expect(dashboardResponse.statusCode).toBe(200);
    expect(dashboardResponse.body.data.recurringDataSource).toEqual(
      expect.objectContaining({ kind: 'csv_import', status: 'active' })
    );
  });

  it('supports multipart CSV file upload for import', async () => {
    const { token } = await registerAndLogin(app);

    const csvContent = [
      'date,description,amount,currency,status',
      '2026-03-10T09:00:00.000Z,Acme Utilities,-120,GBP,booked',
      '2026-04-10T09:00:00.000Z,Acme Utilities,-120,GBP,booked'
    ].join('\n');

    const response = await request(app)
      .post('/api/v1/bank-sync/csv-import')
      .set('Authorization', `Bearer ${token}`)
      .field('ingestionId', 'csv-upload-file-001')
      .attach('file', Buffer.from(csvContent, 'utf-8'), 'statement.csv');

    expect(response.statusCode).toBe(200);
    expect(response.body.data.syncSummary.ingestionId).toBe('csv:csv-upload-file-001');
    expect(response.body.data.syncSummary.acceptedCount).toBe(2);
  });

  it('returns persisted csv import history for the authenticated user', async () => {
    const { token } = await registerAndLogin(app);

    await request(app)
      .post('/api/v1/bank-sync/csv-import')
      .set('Authorization', `Bearer ${token}`)
      .send({
        ingestionId: 'history-001',
        csvData: [
          'date,description,amount,currency,status',
          '2026-03-01T09:00:00.000Z,Example Homes,-1200,GBP,booked'
        ].join('\n')
      });

    await request(app)
      .post('/api/v1/bank-sync/mock-ingest')
      .set('Authorization', `Bearer ${token}`)
      .send({
        ingestionId: 'mock-ingest-should-not-appear',
        transactions: [
          {
            transactionId: 'txn-history-noncsv',
            bookedAt: '2026-04-02T09:00:00.000Z',
            amount: 50,
            currency: 'GBP',
            merchantName: 'Corner Shop',
            direction: 'out',
            status: 'booked'
          }
        ]
      });

    const historyResponse = await request(app)
      .get('/api/v1/bank-sync/import-history')
      .set('Authorization', `Bearer ${token}`);

    expect(historyResponse.statusCode).toBe(200);
    expect(historyResponse.body.data.imports).toHaveLength(1);
    expect(historyResponse.body.data.imports[0]).toEqual(
      expect.objectContaining({
        source: 'csv_import',
        ingestionId: 'csv:history-001',
        acceptedCount: 1
      })
    );
  });

  it('rejects CSV import when required columns are missing or values are invalid', async () => {
    const { token } = await registerAndLogin(app);

    const missingColumnResponse = await request(app)
      .post('/api/v1/bank-sync/csv-import')
      .set('Authorization', `Bearer ${token}`)
      .send({
        ingestionId: 'csv-invalid-header',
        csvData: [
          'date,description,currency',
          '2026-04-01T09:00:00.000Z,Example Homes,GBP'
        ].join('\n')
      });

    expect(missingColumnResponse.statusCode).toBe(400);
    expect(missingColumnResponse.body.error).toMatch(/missing required column: amount/i);
    expect(missingColumnResponse.body.details).toEqual(
      expect.objectContaining({
        missingColumn: 'amount',
        rowErrors: []
      })
    );

    const invalidRowResponse = await request(app)
      .post('/api/v1/bank-sync/csv-import')
      .set('Authorization', `Bearer ${token}`)
      .send({
        ingestionId: 'csv-invalid-row',
        csvData: [
          'date,description,amount,currency,status',
          'not-a-date,Example Homes,-1200,GBP,booked'
        ].join('\n')
      });

    expect(invalidRowResponse.statusCode).toBe(400);
    expect(invalidRowResponse.body.error).toMatch(/validation failed/i);
    expect(invalidRowResponse.body.details.rowErrorCount).toBe(1);
    expect(invalidRowResponse.body.details.rowErrors[0]).toEqual(
      expect.objectContaining({ rowNumber: 2 })
    );
  });
});