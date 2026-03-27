const request = require('supertest');
const { app } = require('../../src/app');

describe('User API', () => {
  let token, userId;

  beforeEach(async () => {
    const { token: t, userId: id } = await global.createUserAndGetToken();
    token = t;
    userId = id;
  });

  // ─── GET /api/users/profile ────────────────────────────────────────────────
  describe('GET /api/users/profile', () => {
    it('should return current user profile', async () => {
      const res = await request(app)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${token}`);
      expect(res.statusCode).toBe(200);
      expect(res.body.data).toHaveProperty('name');
      expect(res.body.data).not.toHaveProperty('password');
    });

    it('should return 401 without token', async () => {
      const res = await request(app).get('/api/users/profile');
      expect(res.statusCode).toBe(401);
    });
  });

  // ─── PUT /api/users/profile ────────────────────────────────────────────────
  describe('PUT /api/users/profile', () => {
    it('should update name and bio', async () => {
      const res = await request(app)
        .put('/api/users/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Updated Name', bio: 'I help my neighbors!' });
      expect(res.statusCode).toBe(200);
      expect(res.body.data.name).toBe('Updated Name');
      expect(res.body.data.bio).toBe('I help my neighbors!');
    });

    it('should NOT allow updating role or credits', async () => {
      const res = await request(app)
        .put('/api/users/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({ role: 'admin', credits: 9999 });
      expect(res.statusCode).toBe(200);
      // Role and credits should remain unchanged
      expect(res.body.data.role).toBe('user');
      expect(res.body.data.credits).toBe(50);
    });
  });

  // ─── PUT /api/users/skills ─────────────────────────────────────────────────
  describe('PUT /api/users/skills', () => {
    it('should update skills array', async () => {
      const res = await request(app)
        .put('/api/users/skills')
        .set('Authorization', `Bearer ${token}`)
        .send({ skills: ['Plumbing', 'Electrical'] });
      expect(res.statusCode).toBe(200);
      expect(res.body.data.skills).toContain('Plumbing');
    });

    it('should return 400 if skills is not an array', async () => {
      const res = await request(app)
        .put('/api/users/skills')
        .set('Authorization', `Bearer ${token}`)
        .send({ skills: 'Plumbing' });
      expect(res.statusCode).toBe(400);
    });
  });

  // ─── PUT /api/users/location ───────────────────────────────────────────────
  describe('PUT /api/users/location', () => {
    it('should update location with valid coordinates', async () => {
      const res = await request(app)
        .put('/api/users/location')
        .set('Authorization', `Bearer ${token}`)
        .send({ coordinates: [72.8777, 19.0760] });
      expect(res.statusCode).toBe(200);
      expect(res.body.data.location.coordinates).toEqual([72.8777, 19.0760]);
    });

    it('should reject invalid coordinates', async () => {
      const res = await request(app)
        .put('/api/users/location')
        .set('Authorization', `Bearer ${token}`)
        .send({ coordinates: [200, 200] });
      expect(res.statusCode).toBe(400);
    });

    it('should reject missing coordinates', async () => {
      const res = await request(app)
        .put('/api/users/location')
        .set('Authorization', `Bearer ${token}`)
        .send({});
      expect(res.statusCode).toBe(400);
    });
  });

  // ─── PUT /api/users/availability ──────────────────────────────────────────
  describe('PUT /api/users/availability', () => {
    it('should toggle availability to false', async () => {
      const res = await request(app)
        .put('/api/users/availability')
        .set('Authorization', `Bearer ${token}`)
        .send({ isAvailable: false });
      expect(res.statusCode).toBe(200);
      expect(res.body.data.isAvailable).toBe(false);
    });
  });

  // ─── GET /api/users/:userId ────────────────────────────────────────────────
  describe('GET /api/users/:userId', () => {
    it('should return public user profile', async () => {
      const res = await request(app)
        .get(`/api/users/${userId}`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.statusCode).toBe(200);
      expect(res.body.data).toHaveProperty('name');
      // Should NOT expose email or phone in public view
      expect(res.body.data).not.toHaveProperty('email');
      expect(res.body.data).not.toHaveProperty('phone');
    });

    it('should return 404 for non-existent user', async () => {
      const fakeId = '000000000000000000000001';
      const res = await request(app)
        .get(`/api/users/${fakeId}`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.statusCode).toBe(404);
    });
  });
});
