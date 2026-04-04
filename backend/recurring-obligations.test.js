const request = require('supertest');
const express = require('express');
const registerRoute = require('./register');
const { resetBankSyncState } = require('./data/bankSyncStore');

async function registerAndLogin(app, {
  fullname = 'Recurring Obligation User',
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

async function linkAndIngest(app, token, transactions) {
  await request(app)
    .post('/api/bank-sync/mock-link')
    .set('Authorization', `Bearer ${token}`)
    .send({
      accountId: 'acct-detected-001',
      accountName: 'Detected obligations account',
      sortCodeMasked: '12-34-56',
      last4: '1234'
    });

  return request(app)
    .post('/api/bank-sync/mock-ingest')
    .set('Authorization', `Bearer ${token}`)
    .send({
      ingestionId: 'detected-ingest-001',
      transactions
    });
}

describe('Recurring obligations', () => {
  let app;

  beforeEach(() => {
    resetBankSyncState();
    app = express();
    app.use(express.json());
    app.use('/api', registerRoute);
  });

  it('returns no recurring obligations when no linked transaction history exists', async () => {
    const { token } = await registerAndLogin(app, { email: 'recurring-obligations-empty@example.com' });
    const response = await request(app)
      .get('/api/recurring-obligations')
      .set('Authorization', `Bearer ${token}`);

    expect(response.statusCode).toBe(200);
    expect(response.body.recurringObligations).toEqual([]);
  });

  it('detects recurring obligations from repeated booked transactions', async () => {
    const { token } = await registerAndLogin(app, { email: 'recurring-obligations-detected@example.com' });

    await linkAndIngest(app, token, [
      {
        transactionId: 'rent-mar',
        bookedAt: '2026-03-01T09:00:00.000Z',
        amount: 1200,
        currency: 'GBP',
        merchantName: 'Example Homes',
        direction: 'out',
        status: 'booked',
        categoryHint: 'housing'
      },
      {
        transactionId: 'rent-apr',
        bookedAt: '2026-04-01T09:00:00.000Z',
        amount: 1200,
        currency: 'GBP',
        merchantName: 'Example Homes',
        direction: 'out',
        status: 'booked',
        categoryHint: 'housing'
      },
      {
        transactionId: 'council-mar',
        bookedAt: '2026-03-03T09:00:00.000Z',
        amount: 160,
        currency: 'GBP',
        merchantName: 'Camden Council',
        direction: 'out',
        status: 'booked',
        categoryHint: 'household_bills'
      },
      {
        transactionId: 'council-apr',
        bookedAt: '2026-04-03T09:00:00.000Z',
        amount: 160,
        currency: 'GBP',
        merchantName: 'Camden Council',
        direction: 'out',
        status: 'booked',
        categoryHint: 'household_bills'
      }
    ]);

    const response = await request(app)
      .get('/api/recurring-obligations')
      .set('Authorization', `Bearer ${token}`);

    expect(response.statusCode).toBe(200);
    expect(response.body.recurringObligations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: 'Example Homes',
          amount: 1200,
          category: 'housing',
          paymentType: 'rent',
          cadence: 'monthly',
          source: 'bank_linked'
        }),
        expect.objectContaining({
          label: 'Camden Council',
          amount: 160,
          category: 'household_bills',
          paymentType: 'council_tax',
          cadence: 'monthly',
          source: 'bank_linked'
        })
      ])
    );
    expect(response.body.recurringObligations[0].confidence).toBeGreaterThanOrEqual(0.75);
  });

  it('recalculates dashboard totals from detected recurring obligations when linked data is available', async () => {
    const { token } = await registerAndLogin(app, { email: 'recurring-obligations-dashboard@example.com' });

    await linkAndIngest(app, token, [
      {
        transactionId: 'rent-mar-dashboard',
        bookedAt: '2026-03-01T09:00:00.000Z',
        amount: 1200,
        currency: 'GBP',
        merchantName: 'Example Homes',
        direction: 'out',
        status: 'booked',
        categoryHint: 'housing'
      },
      {
        transactionId: 'rent-apr-dashboard',
        bookedAt: '2026-04-01T09:00:00.000Z',
        amount: 1200,
        currency: 'GBP',
        merchantName: 'Example Homes',
        direction: 'out',
        status: 'booked',
        categoryHint: 'housing'
      },
      {
        transactionId: 'council-mar-dashboard',
        bookedAt: '2026-03-03T09:00:00.000Z',
        amount: 160,
        currency: 'GBP',
        merchantName: 'Camden Council',
        direction: 'out',
        status: 'booked',
        categoryHint: 'household_bills'
      },
      {
        transactionId: 'council-apr-dashboard',
        bookedAt: '2026-04-03T09:00:00.000Z',
        amount: 160,
        currency: 'GBP',
        merchantName: 'Camden Council',
        direction: 'out',
        status: 'booked',
        categoryHint: 'household_bills'
      }
    ]);

    const response = await request(app)
      .get('/api/dashboard-summary')
      .set('Authorization', `Bearer ${token}`);

    expect(response.statusCode).toBe(200);
    expect(response.body.recurringDataSource).toEqual(
      expect.objectContaining({ kind: 'bank_linked', detectedCount: 2, status: 'active' })
    );
    expect(response.body.totals.recurringBills).toBe(1360);
    expect(response.body.categories).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Rent or mortgage', amount: 1200 }),
        expect.objectContaining({ name: 'Council tax and household bills', amount: 160 })
      ])
    );
    expect(response.body.reminders).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'Example Homes', dueInDays: 0, status: 'Due soon' }),
        expect.objectContaining({ label: 'Camden Council', dueInDays: 2, status: 'Due soon' })
      ])
    );
  });
});