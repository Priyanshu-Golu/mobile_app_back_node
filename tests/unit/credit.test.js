const request = require('supertest');
const { app } = require('../../src/app');

describe('Credit & Notification API', () => {
  let token, userId;

  beforeEach(async () => {
    const { token: t, userId: id } = await global.createUserAndGetToken();
    token = t;
    userId = id;
  });

  // ─── Credits ───────────────────────────────────────────────────────────────
  describe('GET /api/credits/balance', () => {
    it('should return credit balance', async () => {
      const res = await request(app)
        .get('/api/credits/balance')
        .set('Authorization', `Bearer ${token}`);
      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('credits');
      expect(res.body.credits).toBe(50); // Signup bonus
    });

    it('should return 401 without token', async () => {
      const res = await request(app).get('/api/credits/balance');
      expect(res.statusCode).toBe(401);
    });
  });

  describe('GET /api/credits/transactions', () => {
    it('should return transactions list', async () => {
      const res = await request(app)
        .get('/api/credits/transactions')
        .set('Authorization', `Bearer ${token}`);
      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  describe('GET /api/credits/leaderboard', () => {
    it('should return top helpers leaderboard', async () => {
      const res = await request(app).get('/api/credits/leaderboard');
      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  // ─── Notifications ─────────────────────────────────────────────────────────
  describe('GET /api/notifications', () => {
    it('should return empty notifications list for new user', async () => {
      const res = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${token}`);
      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.count).toBe(0);
    });
  });

  describe('PUT /api/notifications/read-all', () => {
    it('should mark all notifications as read', async () => {
      const res = await request(app)
        .put('/api/notifications/read-all')
        .set('Authorization', `Bearer ${token}`);
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  // ─── Review ────────────────────────────────────────────────────────────────
  describe('Review API requires completed task', () => {
    it('should return 404 for review on non-existent task', async () => {
      const res = await request(app)
        .post('/api/reviews')
        .set('Authorization', `Bearer ${token}`)
        .send({
          taskId: '000000000000000000000001',
          rating: 5,
          comment: 'Great helper!'
        });
      expect(res.statusCode).toBe(404);
    });

    it('should return 404 for review with invalid task and invalid rating', async () => {
      const res = await request(app)
        .post('/api/reviews')
        .set('Authorization', `Bearer ${token}`)
        .send({
          taskId: '000000000000000000000001',
          rating: 10, // invalid, but task check runs first
          comment: 'Out of range'
        });
      // 404 because task doesn't exist (task lookup runs before DB validation)
      expect(res.statusCode).toBe(404);
    });
  });
});
