process.env.NODE_ENV = 'test';
const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const registerRoute = require('../register');

// Helper to get JWT token
async function getToken(app, email, password) {
  const res = await request(app)
    .post('/api/v1/login')
    .send({ email, password });
  return res.body.data.token;
}

describe('Session Management', () => {
  let app;
  let sessionEmail;
  beforeAll(async () => {
    sessionEmail = `session_${Math.random().toString(36).slice(2,8)}@example.com`;
    app = express();
    app.use(express.json());
    app.use('/api/v1', registerRoute);
    // Register a user for session tests
    await request(app)
      .post('/api/v1/register')
      .send({ fullname: 'Session User', email: sessionEmail, password: 'password123' });
  });

  /**
   * Complexity: 2
   * Impact: 3
   */
  it('should deny access to /account without token', async () => {
    const res = await request(app).get('/api/v1/account');
    expect(res.statusCode).toBe(401);
    expect(res.body.error).toMatch(/Authorization/);
  });

  /**
   * Complexity: 2
   * Impact: 3
   */
  it('should allow access to /account with valid token', async () => {
    const token = await getToken(app, sessionEmail, 'password123');
    const res = await request(app)
      .get('/api/v1/account')
      .set('Authorization', `Bearer ${token}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.data).toHaveProperty('fullname', 'Session User');
    expect(res.body.data).toHaveProperty('email', sessionEmail);
  });

  it('should allow access to /dashboard-summary with valid token', async () => {
    const token = await getToken(app, sessionEmail, 'password123');
    const res = await request(app)
      .get('/api/v1/dashboard-summary')
      .set('Authorization', `Bearer ${token}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.data).toHaveProperty('periodLabel');
    expect(res.body.data.periodLabel).toMatch(/^[A-Z][a-z]+ \d{4}$/);
    expect(res.body.data).toHaveProperty('totals');
    expect(res.body.data).toHaveProperty('categories');
  });

  it('should treat tokens for missing users as invalid sessions', async () => {
    const token = jwt.sign(
      { email: 'missing@example.com', fullname: 'Missing User' },
      process.env.JWT_SECRET || 'dev_secret',
      { expiresIn: '1h' }
    );

    const res = await request(app)
      .get('/api/v1/dashboard-summary')
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(401);
    expect(res.body.error).toBe('Session is no longer valid. Please sign in again.');
  });

  /**
   * Complexity: 1
   * Impact: 2
   */
  it('should acknowledge logout for the current client session', async () => {
    const token = await getToken(app, sessionEmail, 'password123');
    const res = await request(app)
      .post('/api/v1/logout')
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(204);
    expect(res.text).toBe('');
  });
});
