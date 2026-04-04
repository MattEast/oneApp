const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const registerRoute = require('./register');

// Helper to get JWT token
async function getToken(app, email, password) {
  const res = await request(app)
    .post('/api/login')
    .send({ email, password });
  return res.body.token;
}

describe('Session Management', () => {
  let app;
  beforeAll(async () => {
    app = express();
    app.use(express.json());
    app.use('/api', registerRoute);
    // Register a user for session tests
    await request(app)
      .post('/api/register')
      .send({ fullname: 'Session User', email: 'session@example.com', password: 'password123' });
  });

  /**
   * Complexity: 2
   * Impact: 3
   */
  it('should deny access to /account without token', async () => {
    const res = await request(app).get('/api/account');
    expect(res.statusCode).toBe(401);
    expect(res.body.error).toMatch(/Authorization/);
  });

  /**
   * Complexity: 2
   * Impact: 3
   */
  it('should allow access to /account with valid token', async () => {
    const token = await getToken(app, 'session@example.com', 'password123');
    const res = await request(app)
      .get('/api/account')
      .set('Authorization', `Bearer ${token}`);
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('fullname', 'Session User');
    expect(res.body).toHaveProperty('email', 'session@example.com');
  });

  it('should allow access to /dashboard-summary with valid token', async () => {
    const token = await getToken(app, 'session@example.com', 'password123');
    const res = await request(app)
      .get('/api/dashboard-summary')
      .set('Authorization', `Bearer ${token}`);
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('periodLabel', 'April 2026');
    expect(res.body).toHaveProperty('totals');
    expect(res.body).toHaveProperty('categories');
  });

  it('should treat tokens for missing users as invalid sessions', async () => {
    const token = jwt.sign(
      { email: 'missing@example.com', fullname: 'Missing User' },
      process.env.JWT_SECRET || 'dev_secret',
      { expiresIn: '1h' }
    );

    const res = await request(app)
      .get('/api/dashboard-summary')
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(401);
    expect(res.body.error).toBe('Session is no longer valid. Please sign in again.');
  });

  /**
   * Complexity: 1
   * Impact: 2
   */
  it('should acknowledge logout for the current client session', async () => {
    const token = await getToken(app, 'session@example.com', 'password123');
    const res = await request(app)
      .post('/api/logout')
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(204);
    expect(res.text).toBe('');
  });
});
