import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import request from 'supertest';

process.env.NODE_ENV = 'test';
process.env.SUPABASE_URL = 'https://example.supabase.co';
process.env.SUPABASE_ANON_KEY = 'test-anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
process.env.GEMINI_API_KEY = 'AIzaSyFakeTestKeyForGeminiLive12345';
process.env.GEMINI_MODEL = 'gemini-2.0-flash';

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
const { createLiveSessionToken } = await import('../ai/live.service.js');

describe('Live Assistant Backend Services', () => {
  const app = createApp();

  beforeEach(() => {
    getUser.mockResolvedValue({
      data: { user: { id: USER_ID } },
      error: null,
    });
  });

  describe('createLiveSessionToken', () => {
    it('returns a valid Gemini Live session config with wsUrl and model', async () => {
      const config = await createLiveSessionToken();

      expect(config).toHaveProperty('token');
      expect(config.model).toBe('models/gemini-3.1-flash-live-preview');
      expect(config.wsUrl).toContain('wss://generativelanguage.googleapis.com');
      expect(config.expiresInSeconds).toBeGreaterThan(0);
    });
  });

  describe('API Endpoints', () => {
    it('GET /api/v1/ai/live-token issues credentials', async () => {
      const res = await request(app)
        .get('/api/v1/ai/live-token')
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.model).toBe('models/gemini-3.1-flash-live-preview');
      expect(res.body.data.wsUrl).toContain('wss://');
    });

    it('POST /api/v1/irrigation/advice returns recommendation', async () => {
      const res = await request(app)
        .post('/api/v1/irrigation/advice')
        .set('Authorization', 'Bearer valid-token')
        .send({ crop: 'Wheat', latitude: 24.03, longitude: 74.78 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(typeof res.body.data.irrigate).toBe('boolean');
      expect(typeof res.body.data.reason).toBe('string');
    });

    it('POST /api/v1/crop/analyze handles fallback analysis gracefully', async () => {
      const res = await request(app)
        .post('/api/v1/crop/analyze')
        .set('Authorization', 'Bearer valid-token')
        .send({ imageBase64: '' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('health_score');
      expect(res.body.data).toHaveProperty('possible_issue');
      expect(res.body.data).toHaveProperty('confidence');
      expect(Array.isArray(res.body.data.observations)).toBe(true);
    });

    it('POST /api/v1/ai/visual-ask rejects invalid requests cleanly', async () => {
      const res = await request(app)
        .post('/api/v1/ai/visual-ask')
        .set('Authorization', 'Bearer valid-token')
        .send({ imageBase64: '', question: '' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });
});
