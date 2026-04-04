const request = require('supertest');
const express = require('express');
const registerRoute = require('./register');

describe('POST /api/login', () => {
  let app;
  beforeAll(async () => {
    app = express();
    app.use(express.json());
    app.use('/api', registerRoute);
    // Register a user for login tests
    await request(app)
      .post('/api/register')
      .send({ fullname: 'Login User', email: 'login@example.com', password: 'password123' });
  });

  /**
   * Complexity: 1 (simple input validation)
   * Impact: 3 (prevents invalid logins)
   */
  it('should return 400 if fields are missing', async () => {
    const res = await request(app).post('/api/login').send({});
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('A valid email address is required.');
  });

  /**
   * Complexity: 1
   * Impact: 3
   */
  it('should return 400 if email is invalid', async () => {
    const res = await request(app)
      .post('/api/login')
      .send({ email: 'not-an-email', password: 'password123' });
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('A valid email address is required.');
  });

  /**
   * Complexity: 1
   * Impact: 3
   */
  it('should return 400 if password is missing', async () => {
    const res = await request(app)
      .post('/api/login')
      .send({ email: 'login@example.com' });
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('Password is required.');
  });

  /**
   * Complexity: 2 (logic + bcrypt)
   * Impact: 3 (security)
   */
  it('should return 401 if credentials are invalid', async () => {
    const res = await request(app)
      .post('/api/login')
      .send({ email: 'login@example.com', password: 'wrongpassword' });
    expect(res.statusCode).toBe(401);
    expect(res.body.error).toBe('Invalid credentials.');
  });

  /**
   * Complexity: 2 (logic + JWT)
   * Impact: 3 (core login)
   */
  it('should return 200 and a JWT if credentials are valid', async () => {
    const res = await request(app)
      .post('/api/login')
      .send({ email: 'login@example.com', password: 'password123' });
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body).toHaveProperty('expiresIn', 3600);
  });

  it('should allow sign-in with the seeded demo account', async () => {
    const res = await request(app)
      .post('/api/login')
      .send({ email: 'demo@oneapp.local', password: 'DemoPass123!' });

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body).toHaveProperty('user');
    expect(res.body.user).toEqual({ fullname: 'Demo Customer', email: 'demo@oneapp.local' });
  });
});
