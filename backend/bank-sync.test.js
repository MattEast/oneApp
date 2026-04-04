const request = require('supertest');
const express = require('express');
const registerRoute = require('./register');
const { resetBankSyncState } = require('./data/bankSyncStore');

async function registerAndLogin(app, {
  fullname = 'Bank Sync User',
  email,
  password = 'password123'
}) {
  await request(app)
    .post('/api/register')
    .send({ fullname, email, password });

  const loginResponse = await request(app)
    .post('/api/login')
    .send({ email, password });

  return {
    email,
    token: loginResponse.body.token
  };
}

describe('Mock bank-linked data ingestion', () => {
  let app;

  beforeEach(() => {
    resetBankSyncState();
    app = express();
    app.use(express.json());
    app.use('/api', registerRoute);
  });

  it('returns mock provider strategy and initial status for an authenticated user', async () => {
    const { token } = await registerAndLogin(app, { email: 'bank-status@example.com' });
    const response = await request(app)
      .get('/api/bank-sync/status')
      .set('Authorization', `Bearer ${token}`);

    expect(response.statusCode).toBe(200);
    expect(response.body.metadata.provider).toBe('truelayer_mock');
    expect(response.body.metadata.providerStrategy.preferredProvider).toBe('TrueLayer');
    expect(response.body.status.consent.status).toBe('not_linked');
    expect(response.body.status.transactionCount).toBe(0);
  });

  it('links a mock bank account and ingests transactions with duplicate and partial handling', async () => {
    const { token } = await registerAndLogin(app, { email: 'bank-ingest@example.com' });

    const linkResponse = await request(app)
      .post('/api/bank-sync/mock-link')
      .set('Authorization', `Bearer ${token}`)
      .send({
        accountId: 'acct-demo-001',
        accountName: 'Main current account',
        sortCodeMasked: '12-34-56',
        last4: '1234'
      });

    expect(linkResponse.statusCode).toBe(201);
    expect(linkResponse.body.status.consent.status).toBe('active');
    expect(linkResponse.body.status.linkedAccount.accountName).toBe('Main current account');

    const ingestResponse = await request(app)
      .post('/api/bank-sync/mock-ingest')
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
    expect(ingestResponse.body.syncSummary.outcome).toBe('partial_success');
    expect(ingestResponse.body.syncSummary.acceptedCount).toBe(1);
    expect(ingestResponse.body.syncSummary.duplicateCount).toBe(1);
    expect(ingestResponse.body.syncSummary.rejectedCount).toBe(1);
    expect(ingestResponse.body.transactions).toHaveLength(1);

    const statusResponse = await request(app)
      .get('/api/bank-sync/status')
      .set('Authorization', `Bearer ${token}`);

    expect(statusResponse.statusCode).toBe(200);
    expect(statusResponse.body.status.transactionCount).toBe(1);
    expect(statusResponse.body.status.latestSync.outcome).toBe('partial_success');
  });

  it('rejects invalid mock-link and ingest payloads', async () => {
    const { token } = await registerAndLogin(app, { email: 'bank-invalid@example.com' });

    const badLinkResponse = await request(app)
      .post('/api/bank-sync/mock-link')
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
      .post('/api/bank-sync/mock-ingest')
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
});