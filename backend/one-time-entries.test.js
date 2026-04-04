const request = require('supertest');
const express = require('express');
const registerRoute = require('./register');
const { resetBankSyncState } = require('./data/bankSyncStore');

async function registerAndLogin(app, {
  fullname = 'One-time Entry User',
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

describe('One-time entries', () => {
  let app;

  beforeEach(() => {
    resetBankSyncState();
    app = express();
    app.use(express.json());
    app.use('/api', registerRoute);
  });

  it('creates, lists, updates, and removes one-time entries for the authenticated user', async () => {
    const { token } = await registerAndLogin(app, { email: 'one-time-crud@example.com' });

    const createResponse = await request(app)
      .post('/api/one-time-entries')
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
    expect(createResponse.body.oneTimeEntry).toEqual(
      expect.objectContaining({
        label: 'Boiler repair',
        type: 'expense',
        amount: 275,
        transactionDate: '2026-04-05',
        category: 'household_bills'
      })
    );

    const entryId = createResponse.body.oneTimeEntry.id;

    const listResponse = await request(app)
      .get('/api/one-time-entries')
      .set('Authorization', `Bearer ${token}`);

    expect(listResponse.statusCode).toBe(200);
    expect(listResponse.body.oneTimeEntries).toHaveLength(1);

    const updateResponse = await request(app)
      .put(`/api/one-time-entries/${entryId}`)
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
    expect(updateResponse.body.oneTimeEntry).toEqual(
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
      .delete(`/api/one-time-entries/${entryId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(deleteResponse.statusCode).toBe(200);
    expect(deleteResponse.body.deletedEntryId).toBe(entryId);

    const finalListResponse = await request(app)
      .get('/api/one-time-entries')
      .set('Authorization', `Bearer ${token}`);

    expect(finalListResponse.statusCode).toBe(200);
    expect(finalListResponse.body.oneTimeEntries).toEqual([]);
  });

  it('rejects invalid one-time entry payloads and unknown entries', async () => {
    const { token } = await registerAndLogin(app, { email: 'one-time-invalid@example.com' });

    const invalidCreateResponse = await request(app)
      .post('/api/one-time-entries')
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
      .put('/api/one-time-entries/missing-entry')
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
      .delete('/api/one-time-entries/missing-entry')
      .set('Authorization', `Bearer ${token}`);

    expect(missingDeleteResponse.statusCode).toBe(404);
  });

  it('recalculates dashboard totals and reminders from one-time expenses and income', async () => {
    const { token } = await registerAndLogin(app, { email: 'one-time-dashboard@example.com' });

    await request(app)
      .post('/api/one-time-entries')
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
      .post('/api/one-time-entries')
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
      .get('/api/dashboard-summary')
      .set('Authorization', `Bearer ${token}`);

    expect(response.statusCode).toBe(200);
    expect(response.body.totals.income).toBe(4550);
    expect(response.body.totals.flexibleSpending).toBe(915);
    expect(response.body.totals.oneTimeIncome).toBe(300);
    expect(response.body.totals.oneTimeExpenses).toBe(275);
    expect(response.body.totals.availableFunds).toBe(1950);
    expect(response.body.categories).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Council tax and household bills', amount: 555 })
      ])
    );
    expect(response.body.reminders).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'Boiler repair', status: 'Upcoming one-off item', dueInDays: 4 })
      ])
    );
  });
});