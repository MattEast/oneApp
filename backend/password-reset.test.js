const request = require('supertest');
const express = require('express');
const registerRoute = require('./register');

describe('POST /api/password-reset', () => {
  let app;
  beforeAll(async () => {
    app = express();
    app.use(express.json());
    app.use('/api', registerRoute);
    // Register a user for reset tests
    await request(app)
      .post('/api/register')
      .send({ fullname: 'Reset User', email: 'reset@example.com', password: 'password123' });
  });

  /**
   * Complexity: 1
   * Impact: 3
   */
  it('should return a deprecation response for password reset requests', async () => {
    const res = await request(app).post('/api/password-reset').send({});
    expect(res.statusCode).toBe(410);
    expect(res.headers.deprecation).toBe('true');
    expect(res.body.error).toMatch(/deprecated/i);
  });

  /**
   * Complexity: 1
   * Impact: 3
   */
  it('should return a deprecation response even if email does not exist', async () => {
    const res = await request(app)
      .post('/api/password-reset')
      .send({ email: 'notfound@example.com' });
    expect(res.statusCode).toBe(410);
    expect(res.headers.deprecation).toBe('true');
    expect(res.body.error).toMatch(/deprecated/i);
  });

  /**
   * Complexity: 2
   * Impact: 3
   */
  it('should return a deprecation response for valid email reset requests', async () => {
    const res = await request(app)
      .post('/api/password-reset')
      .send({ email: 'reset@example.com' });
    expect(res.statusCode).toBe(410);
    expect(res.headers.deprecation).toBe('true');
    expect(res.body.error).toMatch(/deprecated/i);
  });
});

describe('POST /api/password-reset/confirm', () => {
  let app;
  beforeAll(async () => {
    app = express();
    app.use(express.json());
    app.use('/api', registerRoute);
  });

  /**
   * Complexity: 1
   * Impact: 3
   */
  it('should return a deprecation response when token is missing', async () => {
    const res = await request(app)
      .post('/api/password-reset/confirm')
      .send({ newPassword: 'newpassword123' });
    expect(res.statusCode).toBe(410);
    expect(res.headers.deprecation).toBe('true');
    expect(res.body.error).toMatch(/deprecated/i);
  });

  /**
   * Complexity: 1
   * Impact: 3
   */
  it('should return a deprecation response for short new passwords', async () => {
    const res = await request(app)
      .post('/api/password-reset/confirm')
      .send({ token: 'sometoken', newPassword: 'short' });
    expect(res.statusCode).toBe(410);
    expect(res.headers.deprecation).toBe('true');
    expect(res.body.error).toMatch(/deprecated/i);
  });

  /**
   * Complexity: 2
   * Impact: 3
   */
  it('should return a deprecation response for invalid tokens', async () => {
    const res = await request(app)
      .post('/api/password-reset/confirm')
      .send({ token: 'invalidtoken', newPassword: 'newpassword123' });
    expect(res.statusCode).toBe(410);
    expect(res.headers.deprecation).toBe('true');
    expect(res.body.error).toMatch(/deprecated/i);
  });

  /**
   * Complexity: 2
   * Impact: 3
   */
  it('should return a deprecation response for valid-looking reset confirmations', async () => {
    const res = await request(app)
      .post('/api/password-reset/confirm')
      .send({ token: 'valid-looking-token', newPassword: 'newpassword123' });
    expect(res.statusCode).toBe(410);
    expect(res.headers.deprecation).toBe('true');
    expect(res.body.error).toMatch(/deprecated/i);
  });
});
