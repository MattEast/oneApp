const request = require('supertest');
const express = require('express');
const registerRoute = require('../register');
const { replaceProfileForUser } = require('../db/financialProfileStore');
const { findUserByEmail } = require('../db/userStore');

async function getToken(app, email, password) {
  const response = await request(app)
    .post('/api/v1/login')
    .send({ email, password });

  return response.body.data.token;
}

async function registerAndLogin(app, {
  fullname = 'Recurring User',
  email = `recurring_${Math.random().toString(36).slice(2,8)}@example.com`,
  password = 'password123'
} = {}) {
  await request(app)
    .post('/api/v1/register')
    .send({ fullname, email, password });

  const token = await getToken(app, email, password);

  return { email, token };
}

describe('Recurring payments', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/v1', registerRoute);
  });

  it('returns an explicit deprecation response for recurring-payments routes', async () => {
    const { token } = await registerAndLogin(app);
    const listResponse = await request(app)
      .get('/api/v1/recurring-payments')
      .set('Authorization', `Bearer ${token}`);

    const createResponse = await request(app)
      .post('/api/v1/recurring-payments')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    const updateResponse = await request(app)
      .put('/api/v1/recurring-payments/deprecated-id')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    const deleteResponse = await request(app)
      .delete('/api/v1/recurring-payments/deprecated-id')
      .set('Authorization', `Bearer ${token}`);

    [listResponse, createResponse, updateResponse, deleteResponse].forEach((response) => {
      expect(response.statusCode).toBe(410);
      expect(response.headers.deprecation).toBe('true');
      expect(response.body.error).toMatch(/deprecated/i);
      expect(response.body.error).toMatch(/bank-linked/i);
    });
  });

  it('returns an empty dashboard when no bank data or seeded profile data exists', async () => {
    const { token } = await registerAndLogin(app);
    const response = await request(app)
      .get('/api/v1/dashboard-summary')
      .set('Authorization', `Bearer ${token}`);

    expect(response.statusCode).toBe(200);
    expect(response.body.data.recurringDataSource).toEqual(
      expect.objectContaining({ kind: 'prototype_seeded', detectedCount: 0, status: 'fallback' })
    );
    expect(response.body.data.totals.recurringBills).toBe(0);
    expect(response.body.data.totals.income).toBe(0);
    expect(response.body.data.totals.flexibleSpending).toBe(0);
    expect(response.body.data.totals.availableFunds).toBe(0);
    expect(response.body.data.categories).toEqual([]);
  });

  it('keeps due-soon reminders when the due date rolls into the next cycle', async () => {
    const { email, token } = await registerAndLogin(app);

    const user = await findUserByEmail(email);
    await replaceProfileForUser(user.id, {
      periodLabel: 'April 2026',
      referenceDayOfMonth: 26,
      monthlyIncome: 3000,
      flexibleCategories: [],
      recurringPayments: [
        {
          label: 'Rent',
          amount: 1200,
          cadence: 'monthly',
          paymentType: 'rent',
          category: 'housing',
          dueDay: 2
        },
        {
          label: 'Energy Direct Debit',
          amount: 90,
          cadence: 'monthly',
          paymentType: 'direct_debit',
          category: 'household_bills',
          dueDay: 27
        }
      ]
    });

    const dashboardResponse = await request(app)
      .get('/api/v1/dashboard-summary')
      .set('Authorization', `Bearer ${token}`);

    expect(dashboardResponse.statusCode).toBe(200);
    expect(dashboardResponse.body.data.reminders).toEqual([
      expect.objectContaining({ label: 'Energy Direct Debit', dueInDays: 1, status: 'Due soon' }),
      expect.objectContaining({ label: 'Rent', dueInDays: 4, status: 'Due soon' })
    ]);
  });

  it('still requires an authenticated session before deprecation is evaluated', async () => {
    const response = await request(app).get('/api/v1/recurring-payments');

    expect(response.statusCode).toBe(401);
    expect(response.body.error).toMatch(/authorization header/i);
  });
});