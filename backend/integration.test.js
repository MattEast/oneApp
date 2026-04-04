const request = require('supertest');
const express = require('express');
const registerRoute = require('./register');

describe('Integration: Registration → Login → Authenticated Access → Logout', () => {
  let app;
  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/api', registerRoute);
  });

  /**
   * Complexity: 3
   * Impact: 3
   */
  it('should register, login, access protected routes, and logout', async () => {
    // Register
    const regRes = await request(app)
      .post('/api/register')
      .send({ fullname: 'Integration User', email: 'integration@example.com', password: 'integration123' });
    expect(regRes.statusCode).toBe(201);

    // Login
    const loginRes = await request(app)
      .post('/api/login')
      .send({ email: 'integration@example.com', password: 'integration123' });
    expect(loginRes.statusCode).toBe(200);
    expect(loginRes.body).toHaveProperty('token');
    const token = loginRes.body.token;

    // Access protected route
    const accountRes = await request(app)
      .get('/api/account')
      .set('Authorization', `Bearer ${token}`);
    expect(accountRes.statusCode).toBe(200);
    expect(accountRes.body).toHaveProperty('fullname', 'Integration User');
    expect(accountRes.body).toHaveProperty('email', 'integration@example.com');

    const dashboardRes = await request(app)
      .get('/api/dashboard-summary')
      .set('Authorization', `Bearer ${token}`);
    expect(dashboardRes.statusCode).toBe(200);
    expect(dashboardRes.body).toHaveProperty('periodLabel', 'April 2026');
    expect(dashboardRes.body).toHaveProperty('totals');
    expect(dashboardRes.body.user).toHaveProperty('fullname', 'Integration User');

    // Logout acknowledges stateless sign-out for the current device session.
    const logoutRes = await request(app)
      .post('/api/logout')
      .set('Authorization', `Bearer ${token}`);
    expect(logoutRes.statusCode).toBe(204);
    expect(logoutRes.text).toBe('');
  });
});
