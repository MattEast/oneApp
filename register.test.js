const request = require('supertest');
const express = require('express');
const registerRoute = require('./register');

describe('POST /api/register', () => {
  let app;
  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/api', registerRoute);
  });

  it('should return 400 if fields are missing', async () => {
    const res = await request(app).post('/api/register').send({});
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('All fields are required.');
  });

  it('should return 201 if registration is successful', async () => {
    const res = await request(app)
      .post('/api/register')
      .send({ fullname: 'Test User', email: 'test@example.com', password: 'password123' });
    expect(res.statusCode).toBe(201);
    expect(res.body.message).toBe('User registered successfully.');
  });
});
