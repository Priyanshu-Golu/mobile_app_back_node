const request = require('supertest');
const { app } = require('../../src/app');

const validRequest = {
  title: 'Need help moving a heavy sofa',
  description: 'My sofa needs to be moved from living room to bedroom, it is quite heavy.',
  category: 'Moving Help',
  urgency: 'Low',
  coordinates: [72.8777, 19.0760],
  address: 'Flat 5, Building A, Mumbai'
};

describe('Request API', () => {
  let userToken, helperId;

  beforeEach(async () => {
    const { token } = await global.createUserAndGetToken();
    const helperData = await global.createHelperAndGetToken();
    userToken = token;
    helperId = helperData.userId;
  });

  // ─── POST /api/requests ────────────────────────────────────────────────────
  describe('POST /api/requests', () => {
    it('should create a help request', async () => {
      const res = await request(app)
        .post('/api/requests')
        .set('Authorization', `Bearer ${userToken}`)
        .send(validRequest);
      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('requestId');
      expect(res.body.data.status).toBe('Open');
    });

    it('should reject request without title', async () => {
      const { title, ...noTitle } = validRequest;
      const res = await request(app)
        .post('/api/requests')
        .set('Authorization', `Bearer ${userToken}`)
        .send(noTitle);
      expect(res.statusCode).toBe(400);
    });

    it('should reject request with invalid category', async () => {
      const res = await request(app)
        .post('/api/requests')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ ...validRequest, category: 'BadCategory' });
      expect(res.statusCode).toBe(400);
    });

    it('should reject unauthenticated request', async () => {
      const res = await request(app).post('/api/requests').send(validRequest);
      expect(res.statusCode).toBe(401);
    });

    it('should reject out-of-range coordinates', async () => {
      const res = await request(app)
        .post('/api/requests')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ ...validRequest, coordinates: [200, 200] });
      expect(res.statusCode).toBe(400);
    });
  });

  // ─── GET /api/requests ─────────────────────────────────────────────────────
  describe('GET /api/requests', () => {
    it('should return paginated list of requests', async () => {
      await request(app)
        .post('/api/requests')
        .set('Authorization', `Bearer ${userToken}`)
        .send(validRequest);

      const res = await request(app).get('/api/requests');
      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('count');
      expect(res.body).toHaveProperty('total');
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('should filter by status', async () => {
      const res = await request(app).get('/api/requests?status=Open');
      expect(res.statusCode).toBe(200);
    });
  });

  // ─── GET /api/requests/my-requests ────────────────────────────────────────
  describe('GET /api/requests/my-requests', () => {
    it('should return only own requests', async () => {
      await request(app)
        .post('/api/requests')
        .set('Authorization', `Bearer ${userToken}`)
        .send(validRequest);

      const res = await request(app)
        .get('/api/requests/my-requests')
        .set('Authorization', `Bearer ${userToken}`);
      expect(res.statusCode).toBe(200);
      expect(res.body.count).toBeGreaterThan(0);
    });
  });

  // ─── GET /api/requests/:id ─────────────────────────────────────────────────
  describe('GET /api/requests/:id', () => {
    it('should return request by ID', async () => {
      const createRes = await request(app)
        .post('/api/requests')
        .set('Authorization', `Bearer ${userToken}`)
        .send(validRequest);
      const requestId = createRes.body.data._id;

      const res = await request(app).get(`/api/requests/${requestId}`);
      expect(res.statusCode).toBe(200);
      expect(res.body.data._id).toBe(requestId);
    });

    it('should return 404 for non-existent request', async () => {
      const res = await request(app).get('/api/requests/000000000000000000000001');
      expect(res.statusCode).toBe(404);
    });
  });

  // ─── DELETE /api/requests/:id (Cancel) ────────────────────────────────────
  describe('DELETE /api/requests/:id', () => {
    it('should cancel own request', async () => {
      const createRes = await request(app)
        .post('/api/requests')
        .set('Authorization', `Bearer ${userToken}`)
        .send(validRequest);
      const requestId = createRes.body.data._id;

      const res = await request(app)
        .delete(`/api/requests/${requestId}`)
        .set('Authorization', `Bearer ${userToken}`);
      expect(res.statusCode).toBe(200);
    });

    it('should not allow cancelling another user\'s request', async () => {
      const createRes = await request(app)
        .post('/api/requests')
        .set('Authorization', `Bearer ${userToken}`)
        .send(validRequest);
      const requestId = createRes.body.data._id;

      const { token: otherToken } = await global.createUserAndGetToken({ email: 'other@t.com' });
      const res = await request(app)
        .delete(`/api/requests/${requestId}`)
        .set('Authorization', `Bearer ${otherToken}`);
      expect(res.statusCode).toBe(403);
    });
  });
});
