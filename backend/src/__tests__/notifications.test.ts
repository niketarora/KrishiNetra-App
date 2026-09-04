import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import request from 'supertest';

process.env.NODE_ENV = 'test';
process.env.SUPABASE_URL = 'https://example.supabase.co';
process.env.SUPABASE_ANON_KEY = 'test-anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';

const USER_ID = '11111111-1111-1111-1111-111111111111';

const getUser = jest.fn<any>().mockResolvedValue({
  data: { user: { id: USER_ID } },
  error: null,
});

jest.unstable_mockModule('../config/supabase.js', () => ({
  authClient: () => ({ auth: { getUser } }),
  userClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () => ({
            limit: () => ({
              maybeSingle: () => Promise.resolve({ data: null, error: null }),
            }),
          }),
        }),
      }),
    }),
  }),
  adminClient: () => ({ from: () => ({}) }),
}));

const { createApp } = await import('../app.js');

describe('Notifications Endpoints (Twilio SMS & Voice Call)', () => {
  const app = createApp();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/v1/notifications/sms', () => {
    it('dispatches or simulates SMS notification', async () => {
      const res = await request(app)
        .post('/api/v1/notifications/sms')
        .send({
          phone: '+91 98765 43210',
          message: 'Heavy rain warning in your district.',
          alertId: 'alert-rainfall-warning',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('channel', 'sms');
      expect(res.body.data).toHaveProperty('phone', '+91 98765 43210');
      expect(res.body.data).toHaveProperty('status', 'sent');
    });

    it('rejects invalid request body missing phone or message', async () => {
      const res = await request(app)
        .post('/api/v1/notifications/sms')
        .send({
          alertId: 'alert-rainfall-warning',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /api/v1/notifications/call', () => {
    it('initiates or simulates Voice Call notification with language support', async () => {
      const res = await request(app)
        .post('/api/v1/notifications/call')
        .send({
          phone: '+91 98765 43210',
          message: 'Heavy rain warning in your district.',
          language: 'hi',
          alertId: 'alert-rainfall-warning',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('channel', 'voice');
      expect(res.body.data).toHaveProperty('phone', '+91 98765 43210');
      expect(res.body.data).toHaveProperty('status', 'initiated');
    });

    it('rejects invalid request body missing phone or message', async () => {
      const res = await request(app)
        .post('/api/v1/notifications/call')
        .send({
          language: 'hi',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });
});
