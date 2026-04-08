const request = require('supertest');
const express = require('express');
const registerRoute = require('../register');

async function registerAndLogin(app, {
  fullname = 'Available Funds User',
  email = `available_${Math.random().toString(36).slice(2, 8)}@example.com`,
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

function expectAvailableFundsFormula(totals) {
  const expected = Number((totals.income - totals.recurringBills - totals.flexibleSpending).toFixed(2));
  expect(totals.availableFunds).toBe(expected);
}

describe('Available funds calculation', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/v1', registerRoute);
  });

  it('uses the documented formula for baseline dashboard totals', async () => {
    const { token } = await registerAndLogin(app);

    const response = await request(app)
      .get('/api/v1/dashboard-summary')
      .set('Authorization', `Bearer ${token}`);

    expect(response.statusCode).toBe(200);
    expectAvailableFundsFormula(response.body.data.totals);
  });

  it('includes one-time income and expenses in available-funds updates', async () => {
    const { token } = await registerAndLogin(app);

    const beforeResponse = await request(app)
      .get('/api/v1/dashboard-summary')
      .set('Authorization', `Bearer ${token}`);
    expect(beforeResponse.statusCode).toBe(200);

    const incomeCreateResponse = await request(app)
      .post('/api/v1/one-time-entries')
      .set('Authorization', `Bearer ${token}`)
      .send({
        label: 'Freelance invoice',
        type: 'income',
        amount: 125.25,
        transactionDate: '2026-04-10',
        category: 'other_income',
        notes: 'Monthly side gig'
      });
    expect(incomeCreateResponse.statusCode).toBe(201);

    const expenseCreateResponse = await request(app)
      .post('/api/v1/one-time-entries')
      .set('Authorization', `Bearer ${token}`)
      .send({
        label: 'Emergency bike repair',
        type: 'expense',
        amount: 40.1,
        transactionDate: '2026-04-11',
        category: 'travel',
        notes: 'Unexpected maintenance'
      });
    expect(expenseCreateResponse.statusCode).toBe(201);

    const afterResponse = await request(app)
      .get('/api/v1/dashboard-summary')
      .set('Authorization', `Bearer ${token}`);

    expect(afterResponse.statusCode).toBe(200);
    expectAvailableFundsFormula(afterResponse.body.data.totals);

    const beforeAvailableFunds = beforeResponse.body.data.totals.availableFunds;
    const afterAvailableFunds = afterResponse.body.data.totals.availableFunds;
    const oneTimeIncomeDelta = afterResponse.body.data.totals.oneTimeIncome - beforeResponse.body.data.totals.oneTimeIncome;
    const oneTimeExpenseDelta = afterResponse.body.data.totals.oneTimeExpenses - beforeResponse.body.data.totals.oneTimeExpenses;
    const expectedDelta = Number((oneTimeIncomeDelta - oneTimeExpenseDelta).toFixed(2));

    expect(afterAvailableFunds).toBe(Number((beforeAvailableFunds + expectedDelta).toFixed(2)));
  });
});