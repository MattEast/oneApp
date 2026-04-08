const request = require('supertest');
const express = require('express');

function buildAppWithUnavailableBankSync() {
  jest.resetModules();
  jest.doMock('../db/bankSyncStore', () => {
    const actual = jest.requireActual('../db/bankSyncStore');
    const unavailable = async () => {
      throw actual.createBankSyncUnavailableError(new Error('Missing BankSync tables'));
    };

    return {
      ...actual,
      createMockBankLink: unavailable,
      getBankSyncStatus: unavailable,
      getBankSyncTransactions: unavailable,
      ingestMockTransactions: unavailable
    };
  });

  const registerRoute = require('../register');
  const app = express();
  app.use(express.json());
  app.use('/api/v1', registerRoute);

  return app;
}

async function registerAndLogin(app, {
  fullname = 'Graceful Degradation User',
  email = `graceful_${Math.random().toString(36).slice(2, 8)}@example.com`,
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

describe('Graceful degradation for unavailable linked-data persistence', () => {
  afterEach(() => {
    jest.resetModules();
    jest.dontMock('../db/bankSyncStore');
  });

  it('keeps the dashboard available with prototype fallback data when bank-linked persistence is unavailable', async () => {
    const app = buildAppWithUnavailableBankSync();
    const { token } = await registerAndLogin(app);

    const response = await request(app)
      .get('/api/v1/dashboard-summary')
      .set('Authorization', `Bearer ${token}`);

    expect(response.statusCode).toBe(200);
    expect(response.body.data.recurringDataSource).toEqual(
      expect.objectContaining({
        kind: 'prototype_seeded',
        detectedCount: 0,
        status: 'degraded',
        issue: 'bank_sync_unavailable'
      })
    );
    expect(response.body.data.recurringDataSource.message).toMatch(/temporarily unavailable/i);
    expect(response.body.data.totals.availableFunds).toBe(
      Number((
        response.body.data.totals.income
        - response.body.data.totals.recurringBills
        - response.body.data.totals.flexibleSpending
      ).toFixed(2))
    );
  });

  it('returns an explicit 503 for recurring-obligations when linked-data persistence is unavailable', async () => {
    const app = buildAppWithUnavailableBankSync();
    const { token } = await registerAndLogin(app);

    const response = await request(app)
      .get('/api/v1/recurring-obligations')
      .set('Authorization', `Bearer ${token}`);

    expect(response.statusCode).toBe(503);
    expect(response.body.error).toMatch(/temporarily unavailable/i);
  });

  it('returns an explicit 503 for bank-sync status when linked-data persistence is unavailable', async () => {
    const app = buildAppWithUnavailableBankSync();
    const { token } = await registerAndLogin(app);

    const response = await request(app)
      .get('/api/v1/bank-sync/status')
      .set('Authorization', `Bearer ${token}`);

    expect(response.statusCode).toBe(503);
    expect(response.body.error).toMatch(/temporarily unavailable/i);
  });
});
