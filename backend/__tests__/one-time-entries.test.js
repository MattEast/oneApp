const request = require('supertest');
const express = require('express');
const registerRoute = require('../register');

async function registerAndLogin(app, {
  fullname = 'One-time Entry User',
  email = `one_time_${Math.random().toString(36).slice(2,8)}@example.com`,
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

describe('One-time entries', () => {
  let app;

  beforeEach(async () => {
    app = express();
    app.use(express.json());
    app.use('/api/v1', registerRoute);
  });

  it('creates, lists, updates, and removes one-time entries for the authenticated user', async () => {
    const { token } = await registerAndLogin(app);

    const createResponse = await request(app)
      .post('/api/v1/one-time-entries')
      .set('Authorization', `Bearer ${token}`)
      .send({
        label: 'Boiler repair',
        type: 'expense',
        amount: 275,
        transactionDate: '2026-04-05',
        category: 'household_bills',
        notes: 'Emergency engineer visit'
      });

    expect(createResponse.statusCode).toBe(201);
    expect(createResponse.body.data.oneTimeEntry).toEqual(
      expect.objectContaining({
        label: 'Boiler repair',
        type: 'expense',
        amount: 275,
        transactionDate: '2026-04-05',
        category: 'household_bills'
      })
    );

    const entryId = createResponse.body.data.oneTimeEntry.id;

    const listResponse = await request(app)
      .get('/api/v1/one-time-entries')
      .set('Authorization', `Bearer ${token}`);

    expect(listResponse.statusCode).toBe(200);
    expect(listResponse.body.data.oneTimeEntries).toHaveLength(1);

    const updateResponse = await request(app)
      .put(`/api/v1/one-time-entries/${entryId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        label: 'Boiler repair refund',
        type: 'income',
        amount: 125,
        transactionDate: '2026-04-06',
        category: 'refund',
        notes: 'Landlord contribution'
      });

    expect(updateResponse.statusCode).toBe(200);
    expect(updateResponse.body.data.oneTimeEntry).toEqual(
      expect.objectContaining({
        id: entryId,
        label: 'Boiler repair refund',
        type: 'income',
        amount: 125,
        transactionDate: '2026-04-06',
        category: 'refund'
      })
    );

    const deleteResponse = await request(app)
      .delete(`/api/v1/one-time-entries/${entryId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(deleteResponse.statusCode).toBe(200);
    expect(deleteResponse.body.data.deletedEntryId).toBe(entryId);

    const finalListResponse = await request(app)
      .get('/api/v1/one-time-entries')
      .set('Authorization', `Bearer ${token}`);

    expect(finalListResponse.statusCode).toBe(200);
    expect(finalListResponse.body.data.oneTimeEntries).toEqual([]);
  });

  it('rejects invalid one-time entry payloads and unknown entries', async () => {
    const { token } = await registerAndLogin(app);

    const invalidCreateResponse = await request(app)
      .post('/api/v1/one-time-entries')
      .set('Authorization', `Bearer ${token}`)
      .send({
        label: 'A',
        type: 'expense',
        amount: -20,
        transactionDate: '04/05/2026',
        category: 'refund'
      });

    expect(invalidCreateResponse.statusCode).toBe(400);
    expect(invalidCreateResponse.body.error).toMatch(/Label is required|Amount is required|Transaction date is required|Category is required/i);

    const missingUpdateResponse = await request(app)
      .put('/api/v1/one-time-entries/missing-entry')
      .set('Authorization', `Bearer ${token}`)
      .send({
        label: 'Refund',
        type: 'income',
        amount: 50,
        transactionDate: '2026-04-06',
        category: 'refund'
      });

    expect(missingUpdateResponse.statusCode).toBe(404);

    const missingDeleteResponse = await request(app)
      .delete('/api/v1/one-time-entries/missing-entry')
      .set('Authorization', `Bearer ${token}`);

    expect(missingDeleteResponse.statusCode).toBe(404);
  });

  it('recalculates dashboard totals and reminders from one-time expenses and income', async () => {
    const { token } = await registerAndLogin(app);

    await request(app)
      .post('/api/v1/one-time-entries')
      .set('Authorization', `Bearer ${token}`)
      .send({
        label: 'Tax rebate',
        type: 'income',
        amount: 300,
        transactionDate: '2026-04-04',
        category: 'refund',
        notes: 'HMRC refund'
      });

    await request(app)
      .post('/api/v1/one-time-entries')
      .set('Authorization', `Bearer ${token}`)
      .send({
        label: 'Boiler repair',
        type: 'expense',
        amount: 275,
        transactionDate: '2026-04-05',
        category: 'household_bills',
        notes: 'Emergency engineer visit'
      });

    const response = await request(app)
      .get('/api/v1/dashboard-summary')
      .set('Authorization', `Bearer ${token}`);

    expect(response.statusCode).toBe(200);
    expect(response.body.data.totals.income).toBe(300);
    expect(response.body.data.totals.flexibleSpending).toBe(275);
    expect(response.body.data.totals.oneTimeIncome).toBe(300);
    expect(response.body.data.totals.oneTimeExpenses).toBe(275);
    expect(response.body.data.totals.availableFunds).toBe(25);
    expect(response.body.data.categories).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Council tax and household bills', amount: 275 })
      ])
    );
    expect(response.body.data.reminders).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'Boiler repair', status: 'Upcoming one-off item', dueInDays: 4 })
      ])
    );
  });

  it('avoids floating-point drift when combining decimal one-time amounts', async () => {
    const { token } = await registerAndLogin(app);

    await request(app)
      .post('/api/v1/one-time-entries')
      .set('Authorization', `Bearer ${token}`)
      .send({
        label: 'Small refund A',
        type: 'income',
        amount: 0.1,
        transactionDate: '2026-04-04',
        category: 'refund',
        notes: ''
      });

    await request(app)
      .post('/api/v1/one-time-entries')
      .set('Authorization', `Bearer ${token}`)
      .send({
        label: 'Small refund B',
        type: 'income',
        amount: 0.2,
        transactionDate: '2026-04-05',
        category: 'refund',
        notes: ''
      });

    const dashboardResponse = await request(app)
      .get('/api/v1/dashboard-summary')
      .set('Authorization', `Bearer ${token}`);

    expect(dashboardResponse.statusCode).toBe(200);
    expect(dashboardResponse.body.data.totals.oneTimeIncome).toBe(0.3);
    expect(dashboardResponse.body.data.totals.income).toBe(0.3);
  });
});