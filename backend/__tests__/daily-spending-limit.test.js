const request = require('supertest');
const express = require('express');
const registerRoute = require('../register');
const { calculateDailySpendingLimit, DAILY_LIMIT_FORMULA_VERSION } = require('../services/dashboardService');
const { replaceProfileForUser } = require('../db/financialProfileStore');
const { findUserByEmail } = require('../db/userStore');

async function registerAndLogin(app, {
  fullname = 'Daily Limit User',
  email = `daily_${Math.random().toString(36).slice(2, 8)}@example.com`,
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

describe('Daily spending limit calculation', () => {
  describe('calculateDailySpendingLimit unit tests', () => {
    it('divides available funds by remaining days', () => {
      const result = calculateDailySpendingLimit({
        availableFundsMinor: 28000,
        referenceDayOfMonth: 1
      });

      expect(result.amountMinor).toBeGreaterThanOrEqual(0);
      expect(result.remainingDays).toBeGreaterThanOrEqual(1);
      expect(result.availableFundsMinor).toBe(28000);
      expect(result.formulaVersion).toBe(DAILY_LIMIT_FORMULA_VERSION);
      expect(result.amountMinor).toBe(Math.floor(28000 / result.remainingDays));
    });

    it('returns zero daily limit when available funds are zero', () => {
      const result = calculateDailySpendingLimit({
        availableFundsMinor: 0,
        referenceDayOfMonth: 15
      });

      expect(result.amountMinor).toBe(0);
      expect(result.remainingDays).toBeGreaterThanOrEqual(1);
    });

    it('clamps negative available funds to zero', () => {
      const result = calculateDailySpendingLimit({
        availableFundsMinor: -5000,
        referenceDayOfMonth: 1
      });

      expect(result.amountMinor).toBe(0);
      expect(result.availableFundsMinor).toBe(0);
    });

    it('ensures at least 1 remaining day to avoid division by zero', () => {
      const result = calculateDailySpendingLimit({
        availableFundsMinor: 10000,
        referenceDayOfMonth: new Date().getUTCDate()
      });

      expect(result.remainingDays).toBeGreaterThanOrEqual(1);
      expect(result.amountMinor).toBeGreaterThanOrEqual(0);
    });

    it('defaults referenceDayOfMonth to 1 when falsy', () => {
      const result = calculateDailySpendingLimit({
        availableFundsMinor: 14000,
        referenceDayOfMonth: 0
      });

      expect(result.remainingDays).toBeGreaterThanOrEqual(1);
      expect(result.amountMinor).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Dashboard summary integration', () => {
    let app;

    beforeEach(() => {
      app = express();
      app.use(express.json());
      app.use('/api/v1', registerRoute);
    });

    it('includes dailySpendingLimit in dashboard summary', async () => {
      const { token } = await registerAndLogin(app);

      const response = await request(app)
        .get('/api/v1/dashboard-summary')
        .set('Authorization', `Bearer ${token}`);

      expect(response.statusCode).toBe(200);

      const { dailySpendingLimit } = response.body.data;
      expect(dailySpendingLimit).toBeDefined();
      expect(typeof dailySpendingLimit.amount).toBe('number');
      expect(typeof dailySpendingLimit.remainingDays).toBe('number');
      expect(typeof dailySpendingLimit.availableFundsUsed).toBe('number');
      expect(dailySpendingLimit.formulaVersion).toBe(DAILY_LIMIT_FORMULA_VERSION);
      expect(dailySpendingLimit.remainingDays).toBeGreaterThanOrEqual(1);
    });

    it('daily limit reflects available funds accurately', async () => {
      const { token } = await registerAndLogin(app);

      const response = await request(app)
        .get('/api/v1/dashboard-summary')
        .set('Authorization', `Bearer ${token}`);

      expect(response.statusCode).toBe(200);

      const { totals, dailySpendingLimit } = response.body.data;
      const clampedAvailable = Math.max(totals.availableFunds, 0);
      expect(dailySpendingLimit.availableFundsUsed).toBe(clampedAvailable);

      const expectedDaily = Number(
        (Math.floor(Math.round(clampedAvailable * 100) / dailySpendingLimit.remainingDays) / 100).toFixed(2)
      );
      expect(dailySpendingLimit.amount).toBe(expectedDaily);
    });

    it('daily limit updates after adding a one-time expense', async () => {
      const { email, token } = await registerAndLogin(app);

      // Set up a profile with income so the limit is non-zero
      const user = await findUserByEmail(email);
      await replaceProfileForUser(user.id, {
        periodLabel: 'April 2026',
        referenceDayOfMonth: 1,
        monthlyIncome: 3000,
        flexibleCategories: [],
        recurringPayments: []
      });

      const beforeResponse = await request(app)
        .get('/api/v1/dashboard-summary')
        .set('Authorization', `Bearer ${token}`);
      expect(beforeResponse.statusCode).toBe(200);

      await request(app)
        .post('/api/v1/one-time-entries')
        .set('Authorization', `Bearer ${token}`)
        .send({
          label: 'Car service',
          type: 'expense',
          amount: 200,
          transactionDate: '2026-04-15',
          category: 'travel',
          notes: ''
        });

      const afterResponse = await request(app)
        .get('/api/v1/dashboard-summary')
        .set('Authorization', `Bearer ${token}`);
      expect(afterResponse.statusCode).toBe(200);

      const beforeLimit = beforeResponse.body.data.dailySpendingLimit.amount;
      const afterLimit = afterResponse.body.data.dailySpendingLimit.amount;
      expect(afterLimit).toBeLessThan(beforeLimit);
    });
  });
});
