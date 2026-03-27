const request = require('supertest');
const { app } = require('../../src/app');

const validHelpRequest = {
  title: 'Need help carrying heavy boxes downstairs',
  description: 'I have 5 large boxes full of belongings that need to go down 3 floors.',
  category: 'Moving Help',
  urgency: 'Medium',
  coordinates: [72.8777, 19.0760],
  creditValue: 15
};

describe('Task API', () => {
  let userToken, helperToken, requestId, taskId;

  beforeEach(async () => {
    const user = await global.createUserAndGetToken();
    const helper = await global.createHelperAndGetToken();
    userToken = user.token;
    helperToken = helper.token;

    // Create a help request
    const hRes = await request(app)
      .post('/api/requests')
      .set('Authorization', `Bearer ${userToken}`)
      .send(validHelpRequest);
    requestId = hRes.body.data._id;
  });

  // ─── POST /api/tasks/accept/:requestId ────────────────────────────────────
  describe('POST /api/tasks/accept/:requestId', () => {
    it('should allow a helper to accept an open request', async () => {
      const res = await request(app)
        .post(`/api/tasks/accept/${requestId}`)
        .set('Authorization', `Bearer ${helperToken}`);
      expect(res.statusCode).toBe(201);
      expect(res.body.data.status).toBe('Assigned');
      taskId = res.body.data._id;
    });

    it('should prevent user from accepting their own request', async () => {
      const res = await request(app)
        .post(`/api/tasks/accept/${requestId}`)
        .set('Authorization', `Bearer ${userToken}`);
      expect(res.statusCode).toBe(400);
      expect(res.body.error.code).toBe('OWN_REQUEST');
    });

    it('should prevent accepting an already-assigned request', async () => {
      await request(app)
        .post(`/api/tasks/accept/${requestId}`)
        .set('Authorization', `Bearer ${helperToken}`);

      const helper2 = await global.createHelperAndGetToken();
      const res = await request(app)
        .post(`/api/tasks/accept/${requestId}`)
        .set('Authorization', `Bearer ${helper2.token}`);
      expect(res.statusCode).toBe(400);
      expect(res.body.error.code).toBe('INVALID_STATE');
    });
  });

  // ─── Full task lifecycle ───────────────────────────────────────────────────
  describe('Task lifecycle: accept → start → complete → confirm', () => {
    let taskId;

    beforeEach(async () => {
      const acceptRes = await request(app)
        .post(`/api/tasks/accept/${requestId}`)
        .set('Authorization', `Bearer ${helperToken}`);
      taskId = acceptRes.body.data._id;
    });

    it('should start an assigned task', async () => {
      const res = await request(app)
        .put(`/api/tasks/${taskId}/start`)
        .set('Authorization', `Bearer ${helperToken}`);
      expect(res.statusCode).toBe(200);
      expect(res.body.data.status).toBe('In Progress');
    });

    it('should complete task (moves to Pending Confirmation)', async () => {
      await request(app).put(`/api/tasks/${taskId}/start`).set('Authorization', `Bearer ${helperToken}`);
      const res = await request(app)
        .put(`/api/tasks/${taskId}/complete`)
        .set('Authorization', `Bearer ${helperToken}`);
      expect(res.statusCode).toBe(200);
      expect(res.body.data.status).toBe('Pending Confirmation');
    });

    it('should allow requester to confirm task completion', async () => {
      await request(app).put(`/api/tasks/${taskId}/start`).set('Authorization', `Bearer ${helperToken}`);
      await request(app).put(`/api/tasks/${taskId}/complete`).set('Authorization', `Bearer ${helperToken}`);
      const res = await request(app)
        .put(`/api/tasks/${taskId}/confirm`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({});
      expect(res.statusCode).toBe(200);
      expect(res.body.data.status).toBe('Completed');
      expect(res.body).toHaveProperty('creditsAwarded');
    });

    it('should not allow helper to confirm their own task', async () => {
      await request(app).put(`/api/tasks/${taskId}/start`).set('Authorization', `Bearer ${helperToken}`);
      await request(app).put(`/api/tasks/${taskId}/complete`).set('Authorization', `Bearer ${helperToken}`);
      const res = await request(app)
        .put(`/api/tasks/${taskId}/confirm`)
        .set('Authorization', `Bearer ${helperToken}`)
        .send({});
      expect(res.statusCode).toBe(403);
    });
  });

  // ─── Cancel & Dispute ─────────────────────────────────────────────────────
  describe('Cancel task', () => {
    let taskId;
    beforeEach(async () => {
      const r = await request(app).post(`/api/tasks/accept/${requestId}`).set('Authorization', `Bearer ${helperToken}`);
      taskId = r.body.data._id;
    });

    it('should allow helper to cancel an assigned task', async () => {
      const res = await request(app)
        .put(`/api/tasks/${taskId}/cancel`)
        .set('Authorization', `Bearer ${helperToken}`)
        .send({ reason: 'Changed plans' });
      expect(res.statusCode).toBe(200);
      expect(res.body.data.status).toBe('Cancelled');
    });

    it('should allow requester to cancel the task', async () => {
      const res = await request(app)
        .put(`/api/tasks/${taskId}/cancel`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ reason: 'No longer needed' });
      expect(res.statusCode).toBe(200);
    });
  });

  describe('Raise dispute', () => {
    let taskId;
    beforeEach(async () => {
      const r = await request(app).post(`/api/tasks/accept/${requestId}`).set('Authorization', `Bearer ${helperToken}`);
      taskId = r.body.data._id;
    });

    it('should raise a dispute with reason', async () => {
      const res = await request(app)
        .put(`/api/tasks/${taskId}/dispute`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ reason: 'Helper did not complete the task properly' });
      expect(res.statusCode).toBe(200);
      expect(res.body.data.isDisputed).toBe(true);
      expect(res.body.data.status).toBe('Disputed');
    });

    it('should return 400 when dispute reason is missing', async () => {
      const res = await request(app)
        .put(`/api/tasks/${taskId}/dispute`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({});
      expect(res.statusCode).toBe(400);
    });
  });
});
