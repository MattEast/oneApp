const request = require('supertest');
const express = require('express');
const registerRoute = require('../register');

describe('Account Management', () => {
  let app;
  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/api/v1', registerRoute);
  });

  // Helper to register and login a fresh user for each test
  async function getFreshToken(password = 'password123') {
    const email = `profile${Math.random().toString(36).slice(2,8)}@example.com`;
    await request(app)
      .post('/api/v1/register')
      .send({ fullname: 'Profile User', email, password });
    const res = await request(app)
      .post('/api/v1/login')
      .send({ email, password });
    return { token: res.body.data.token, email, password };
  }

  /**
   * Complexity: 2
   * Impact: 3
   */
  it('should return a deprecation response for profile updates', async () => {
    const { token } = await getFreshToken();
    const res = await request(app)
      .put('/api/v1/account')
      .set('Authorization', `Bearer ${token}`)
      .send({ fullname: 'Updated Name' });
    expect(res.statusCode).toBe(410);
    expect(res.headers.deprecation).toBe('true');
    expect(res.body.error).toMatch(/deprecated/i);
  });

  /**
   * Complexity: 2
   * Impact: 3
   */
  it('should return a deprecation response for invalid profile updates as well', async () => {
    const { token } = await getFreshToken();
    const res = await request(app)
      .put('/api/v1/account')
      .set('Authorization', `Bearer ${token}`)
      .send({ fullname: 'A' });
    expect(res.statusCode).toBe(410);
    expect(res.headers.deprecation).toBe('true');
    expect(res.body.error).toMatch(/deprecated/i);
  });

  /**
   * Complexity: 2
   * Impact: 3
   */
  it('should return a deprecation response for password changes', async () => {
    const { token } = await getFreshToken();
    const res = await request(app)
      .put('/api/v1/account/password')
      .set('Authorization', `Bearer ${token}`)
      .send({ oldPassword: 'password123', newPassword: 'newpassword456' });
    expect(res.statusCode).toBe(410);
    expect(res.headers.deprecation).toBe('true');
    expect(res.body.error).toMatch(/deprecated/i);
  });

  /**
   * Complexity: 2
   * Impact: 3
   */
  it('should return a deprecation response for incorrect old password requests', async () => {
    const { token } = await getFreshToken();
    const res = await request(app)
      .put('/api/v1/account/password')
      .set('Authorization', `Bearer ${token}`)
      .send({ oldPassword: 'wrongpass', newPassword: 'newpassword456' });
    expect(res.statusCode).toBe(410);
    expect(res.headers.deprecation).toBe('true');
    expect(res.body.error).toMatch(/deprecated/i);
  });

  /**
   * Complexity: 2
   * Impact: 3
   */
  it('should return a deprecation response for short new passwords', async () => {
    const { token } = await getFreshToken();
    const res = await request(app)
      .put('/api/v1/account/password')
      .set('Authorization', `Bearer ${token}`)
      .send({ oldPassword: 'password123', newPassword: 'short' });
    expect(res.statusCode).toBe(410);
    expect(res.headers.deprecation).toBe('true');
    expect(res.body.error).toMatch(/deprecated/i);
  });
});
