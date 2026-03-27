const request = require('supertest');
const { app } = require('../../src/app');

describe('Auth API', () => {
  const validUser = {
    name: 'John Doe',
    email: 'john@test.com',
    password: 'Password1!',
    phone: '9876543210'
  };

  // ─── POST /api/auth/register ───────────────────────────────────────────────
  describe('POST /api/auth/register', () => {
    it('should register a new user and return tokens', async () => {
      const res = await request(app).post('/api/auth/register').send(validUser);
      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('accessToken');
      expect(res.body.data).toHaveProperty('refreshToken');
      expect(res.body.data).toHaveProperty('_id');
      expect(res.body.data.email).toBe(validUser.email);
      expect(res.body.data).not.toHaveProperty('password');
    });

    it('should reject duplicate email with 409', async () => {
      await request(app).post('/api/auth/register').send(validUser);
      const res = await request(app).post('/api/auth/register').send(validUser);
      expect(res.statusCode).toBe(409);
      expect(res.body.error.code).toBe('USER_EXISTS');
    });

    it('should reject weak password', async () => {
      const res = await request(app).post('/api/auth/register').send({ ...validUser, email: 'weak@test.com', password: 'weak' });
      expect(res.statusCode).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject invalid phone number', async () => {
      const res = await request(app).post('/api/auth/register').send({ ...validUser, email: 'phone@test.com', phone: '123' });
      expect(res.statusCode).toBe(400);
    });

    it('should reject invalid email format', async () => {
      const res = await request(app).post('/api/auth/register').send({ ...validUser, email: 'not-an-email' });
      expect(res.statusCode).toBe(400);
    });

    it('should accept user with location coordinates', async () => {
      const res = await request(app).post('/api/auth/register').send({
        ...validUser,
        email: 'loc@test.com',
        coordinates: [72.8777, 19.0760]
      });
      expect(res.statusCode).toBe(201);
    });

    it('should grant 50 signup credits', async () => {
      const res = await request(app).post('/api/auth/register').send({ ...validUser, email: 'credits@test.com' });
      expect(res.statusCode).toBe(201);
      expect(res.body.data.credits).toBe(50);
    });
  });

  // ─── POST /api/auth/login ──────────────────────────────────────────────────
  describe('POST /api/auth/login', () => {
    // Register before each login test
    beforeEach(async () => {
      await request(app).post('/api/auth/register').send(validUser);
    });

    it('should login with valid credentials', async () => {
      const res = await request(app).post('/api/auth/login').send({
        email: validUser.email,
        password: validUser.password
      });
      expect(res.statusCode).toBe(200);
      expect(res.body.data).toHaveProperty('accessToken');
    });

    it('should reject wrong password with 401', async () => {
      const res = await request(app).post('/api/auth/login').send({
        email: validUser.email,
        password: 'WrongPass1!'
      });
      expect(res.statusCode).toBe(401);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('should reject non-existent email', async () => {
      const res = await request(app).post('/api/auth/login').send({
        email: 'nobody@test.com',
        password: 'Password1!'
      });
      expect(res.statusCode).toBe(401);
    });
  });

  // ─── GET /api/auth/me ──────────────────────────────────────────────────────
  describe('GET /api/auth/me', () => {
    it('should return current user when authenticated', async () => {
      // Register & login within the same test to ensure user exists
      const regRes = await request(app).post('/api/auth/register').send({ ...validUser, email: 'me@test.com' });
      const token = regRes.body.data.accessToken;

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);
      expect(res.statusCode).toBe(200);
      expect(res.body.data).toHaveProperty('name');
    });

    it('should return 401 without token', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.statusCode).toBe(401);
    });

    it('should return 401 with invalid token', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid_token');
      expect(res.statusCode).toBe(401);
    });
  });

  // ─── POST /api/auth/refresh-token ─────────────────────────────────────────
  describe('POST /api/auth/refresh-token', () => {
    it('should issue new access token with valid refresh token', async () => {
      const registerRes = await request(app).post('/api/auth/register').send({ ...validUser, email: 'refresh@test.com' });
      const refreshToken = registerRes.body.data.refreshToken;

      const res = await request(app)
        .post('/api/auth/refresh-token')
        .send({ refreshToken });
      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('accessToken');
    });

    it('should return 400 without refresh token', async () => {
      const res = await request(app).post('/api/auth/refresh-token').send({});
      expect(res.statusCode).toBe(400);
    });
  });

  // ─── PUT /api/auth/update-password ────────────────────────────────────────
  describe('PUT /api/auth/update-password', () => {
    it('should update password with current password', async () => {
      const regRes = await request(app).post('/api/auth/register').send({ ...validUser, email: 'pwupdate@test.com' });
      const token = regRes.body.data.accessToken;

      const res = await request(app)
        .put('/api/auth/update-password')
        .set('Authorization', `Bearer ${token}`)
        .send({ currentPassword: 'Password1!', newPassword: 'NewPass1!' });
      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('accessToken');
    });

    it('should reject wrong current password', async () => {
      const regRes = await request(app).post('/api/auth/register').send({ ...validUser, email: 'pwwrong@test.com' });
      const token = regRes.body.data.accessToken;

      const res = await request(app)
        .put('/api/auth/update-password')
        .set('Authorization', `Bearer ${token}`)
        .send({ currentPassword: 'WrongPass1!', newPassword: 'NewPass1!' });
      expect(res.statusCode).toBe(401);
    });
  });
});
