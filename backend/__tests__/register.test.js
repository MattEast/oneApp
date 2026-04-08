const request = require('supertest');
const express = require('express');
const registerRoute = require('../register');

describe('POST /api/register', () => {
  let app;
  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/api/v1', registerRoute);
  });


  it('should return 400 if fields are missing', async () => {
    const res = await request(app).post('/api/v1/register').send({});
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('Full name is required and must be at least 2 characters.');
  });

  it('should return 400 if email is invalid', async () => {
    const res = await request(app)
      .post('/api/v1/register')
      .send({ fullname: 'Test User', email: 'not-an-email', password: 'password123' });
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('A valid email address is required.');
  });

  it('should return 400 if password is too short', async () => {
    const res = await request(app)
      .post('/api/v1/register')
      .send({ fullname: 'Test User', email: 'test@example.com', password: 'short' });
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('Password is required and must be at least 8 characters.');
  });

  it('should return 201 if registration is successful', async () => {
    const uniqueEmail = `testuser_${Math.random().toString(36).slice(2,8)}@example.com`;
    const res = await request(app)
      .post('/api/v1/register')
      .send({ fullname: 'Test User', email: uniqueEmail, password: 'password123' });
    expect(res.statusCode).toBe(201);
    expect(res.body.data).toHaveProperty('token');
    expect(res.body.data).toHaveProperty('expiresIn', 3600);
    expect(res.body.data).toHaveProperty('user');
    expect(res.body.data.user).toEqual({ fullname: 'Test User', email: uniqueEmail });
  });

  it('should return 409 if the email already exists', async () => {
    const uniqueEmail = `existinguser_${Math.random().toString(36).slice(2,8)}@example.com`;
    await request(app)
      .post('/api/v1/register')
      .send({ fullname: 'Existing User', email: uniqueEmail, password: 'password123' });

    const res = await request(app)
      .post('/api/v1/register')
      .send({ fullname: 'Existing User', email: uniqueEmail, password: 'password123' });

    expect(res.statusCode).toBe(409);
    expect(res.body.error).toBe('An account with this email already exists.');
  });
});
