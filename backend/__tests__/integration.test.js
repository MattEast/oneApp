const request = require('supertest');
const express = require('express');
const registerRoute = require('../register');

describe('Integration: Registration → Login → Authenticated Access → Logout', () => {
  let app;
  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/api/v1', registerRoute);
  });

  /**
   * Complexity: 3
   * Impact: 3
   */
  it('should register, login, access protected routes, and logout', async () => {
    // Register
    const uniqueEmail = `integration_${Math.random().toString(36).slice(2,8)}@example.com`;
    // Register
    const regRes = await request(app)
      .post('/api/v1/register')
      .send({ fullname: 'Integration User', email: uniqueEmail, password: 'integration123' });
    expect(regRes.statusCode).toBe(201);

    // Login
    const loginRes = await request(app)
      .post('/api/v1/login')
      .send({ email: uniqueEmail, password: 'integration123' });
    expect(loginRes.statusCode).toBe(200);
    expect(loginRes.body.data).toHaveProperty('token');
    const token = loginRes.body.data.token;

    // Access protected route
    const accountRes = await request(app)
      .get('/api/v1/account')
      .set('Authorization', `Bearer ${token}`);
    expect(accountRes.statusCode).toBe(200);
    expect(accountRes.body.data).toHaveProperty('fullname', 'Integration User');
    expect(accountRes.body.data).toHaveProperty('email', uniqueEmail);

    const dashboardRes = await request(app)
      .get('/api/v1/dashboard-summary')
      .set('Authorization', `Bearer ${token}`);
    expect(dashboardRes.statusCode).toBe(200);
    expect(dashboardRes.body.data).toHaveProperty('periodLabel');
    expect(dashboardRes.body.data.periodLabel).toMatch(/^[A-Z][a-z]+ \d{4}$/);
    expect(dashboardRes.body.data).toHaveProperty('totals');
    expect(dashboardRes.body.data.user).toHaveProperty('fullname', 'Integration User');

    // Logout acknowledges stateless sign-out for the current device session.
    const logoutRes = await request(app)
      .post('/api/v1/logout')
      .set('Authorization', `Bearer ${token}`);
    expect(logoutRes.statusCode).toBe(204);
    expect(logoutRes.text).toBe('');
  });
});
