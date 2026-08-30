import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import request from 'supertest';

/**
 * End-to-end over the real router, middleware, controllers and services, with
 * only the Supabase clients replaced. That keeps the auth guard, the validation
 * layer, the ownership checks and the area guard all under test.
 */

process.env.NODE_ENV = 'test';
process.env.SUPABASE_URL = 'https://example.supabase.co';
process.env.SUPABASE_ANON_KEY = 'test-anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';

const USER_ID = '11111111-1111-1111-1111-111111111111';
const OTHER_FARM_ID = '22222222-2222-2222-2222-222222222222';

type Result = { data: unknown; error: unknown };

const queue: Record<string, Result[]> = {};
const writes: { table: string; op: 'insert' | 'update'; payload: Record<string, unknown> }[] = [];

/** Queue what the next query against `table` should resolve to. */
function whenQuerying(table: string, ...results: Result[]): void {
  queue[table] = results;
}

function nextResult(table: string): Result {
  const pending = queue[table];
  if (!pending || pending.length === 0) return { data: null, error: null };
  return pending.length > 1 ? pending.shift()! : pending[0]!;
}

/** A stand-in for the PostgREST query builder: chainable and thenable. */
function builderFor(table: string) {
  const builder: Record<string, unknown> = {};
  const settle = () => Promise.resolve(nextResult(table));

  for (const method of ['select', 'eq', 'order', 'limit', 'gte', 'lte']) {
    builder[method] = () => builder;
  }
  builder.insert = (payload: Record<string, unknown>) => {
    writes.push({ table, op: 'insert', payload });
    return builder;
  };
  builder.update = (payload: Record<string, unknown>) => {
    writes.push({ table, op: 'update', payload });
    return builder;
  };
  builder.upsert = (payload: Record<string, unknown>) => {
    writes.push({ table, op: 'insert', payload });
    return builder;
  };
  builder.single = settle;
  builder.maybeSingle = settle;
  builder.then = (resolve: unknown, reject: unknown) =>
    settle().then(resolve as never, reject as never);

  return builder;
}

const getUser = jest.fn<() => Promise<{ data: unknown; error: unknown }>>();

jest.unstable_mockModule('./config/supabase.js', () => ({
  authClient: () => ({ auth: { getUser } }),
  userClient: () => ({ from: (table: string) => builderFor(table) }),
  adminClient: () => ({ from: (table: string) => builderFor(table) }),
}));

jest.unstable_mockModule('./ingestion/weather/weatherSource.js', () => ({
  fetchObservedWeather: jest.fn<any>().mockResolvedValue({
    daily: {
      time: ['2026-08-28'],
      temperature_2m_mean: [29.5],
      precipitation_sum: [0],
      relative_humidity_2m_mean: [65],
    },
  }),
  weatherSourceLabel: () => 'Open-Meteo ERA5 archive',
  WeatherSourceError: class extends Error {},
}));

const { createApp } = await import('./app.js');
const { areaFromBoundary, centroidFromBoundary } = await import('./utils/geo.js');
const { NOT_CONNECTED } = await import('./controllers/reference.controller.js');

const app = createApp();

const boundary = {
  type: 'Polygon' as const,
  coordinates: [
    [
      [75.787, 26.912],
      [75.788, 26.912],
      [75.788, 26.913],
      [75.787, 26.913],
      [75.787, 26.912],
    ] as [number, number][],
  ],
};

function truthfulFarmBody() {
  const area = areaFromBoundary(boundary);
  const centre = centroidFromBoundary(boundary);

  return {
    name: 'North field',
    boundary,
    area_sq_meters: area.squareMeters,
    area_acres: area.acres,
    area_hectares: area.hectares,
    centroid_lat: centre.latitude,
    centroid_lng: centre.longitude,
  };
}

const AUTH = { Authorization: 'Bearer valid-token' };

function signedIn(): void {
  getUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null });
}

beforeEach(() => {
  for (const key of Object.keys(queue)) delete queue[key];
  writes.length = 0;
  signedIn();
});

// ---------------------------------------------------------------------------

describe('GET /health', () => {
  it('answers without a token and without touching the database', async () => {
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('ok');
    expect(getUser).not.toHaveBeenCalled();
  });
});

describe('requireAuth', () => {
  it('rejects a request with no Authorization header', async () => {
    const res = await request(app).get('/api/v1/farms');

    expect(res.status).toBe(401);
    expect(res.body).toEqual({
      success: false,
      error: { code: 'UNAUTHENTICATED', message: expect.any(String) },
    });
  });

  it('rejects a non-bearer scheme', async () => {
    const res = await request(app).get('/api/v1/farms').set('Authorization', 'Basic abc123');
    expect(res.status).toBe(401);
  });

  it('rejects an empty bearer token', async () => {
    const res = await request(app).get('/api/v1/farms').set('Authorization', 'Bearer ');
    expect(res.status).toBe(401);
  });

  it('rejects a token Supabase does not recognise', async () => {
    getUser.mockResolvedValue({ data: null, error: { message: 'jwt expired' } });

    const res = await request(app).get('/api/v1/farms').set(AUTH);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
    // The Supabase message must not travel to the client.
    expect(JSON.stringify(res.body)).not.toMatch(/jwt expired/i);
  });
});

describe('the response envelope', () => {
  it('matches TRD §15 on success', async () => {
    whenQuerying('farms', { data: [], error: null });

    const res = await request(app).get('/api/v1/farms').set(AUTH);

    expect(res.status).toBe(200);
    expect(Object.keys(res.body).sort()).toEqual(['data', 'message', 'success']);
    expect(res.body.success).toBe(true);
  });

  it('matches TRD §15 on failure, and carries nothing else', async () => {
    const res = await request(app).get('/api/v1/farms');

    expect(Object.keys(res.body).sort()).toEqual(['error', 'success']);
    expect(Object.keys(res.body.error).sort()).toEqual(['code', 'message']);
  });

  it('never leaks a stack trace', async () => {
    getUser.mockRejectedValue(new Error('kaboom at Object.<anonymous> (/srv/app.js:1:1)'));

    const res = await request(app).get('/api/v1/farms').set(AUTH);

    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('INTERNAL_ERROR');
    const body = JSON.stringify(res.body);
    expect(body).not.toMatch(/kaboom/);
    expect(body).not.toMatch(/stack/i);
    expect(body).not.toMatch(/\.js:\d+/);
  });

  it('translates a Postgres unique violation into CONFLICT without its text', async () => {
    whenQuerying('farms', {
      data: null,
      error: { code: '23505', message: 'duplicate key value violates unique constraint "farms_pkey"' },
    });

    const res = await request(app).post('/api/v1/farms').set(AUTH).send(truthfulFarmBody());

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
    expect(JSON.stringify(res.body)).not.toMatch(/farms_pkey/);
  });
});

describe('POST /api/v1/farms', () => {
  it('saves a field and returns it', async () => {
    const body = truthfulFarmBody();
    whenQuerying('farms', {
      data: { id: 'farm-1', user_id: USER_ID, ...body, created_at: 'now', updated_at: 'now' },
      error: null,
    });

    const res = await request(app).post('/api/v1/farms').set(AUTH).send(body);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe('farm-1');
  });

  it('takes user_id from the token, not the request', async () => {
    const body = truthfulFarmBody();
    whenQuerying('farms', { data: { id: 'farm-1', user_id: USER_ID, ...body }, error: null });

    await request(app).post('/api/v1/farms').set(AUTH).send(body);

    const insert = writes.find((w) => w.op === 'insert');
    expect(insert?.payload.user_id).toBe(USER_ID);
  });

  it('refuses a user_id sent in the body rather than ignoring it', async () => {
    const res = await request(app)
      .post('/api/v1/farms')
      .set(AUTH)
      .send({ ...truthfulFarmBody(), user_id: OTHER_FARM_ID });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_REQUEST');
  });

  it('rejects an area that does not match the boundary', async () => {
    const body = truthfulFarmBody();

    const res = await request(app)
      .post('/api/v1/farms')
      .set(AUTH)
      .send({ ...body, area_sq_meters: body.area_sq_meters * 5, area_acres: body.area_acres * 5, area_hectares: body.area_hectares * 5 });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/area does not match/i);
    expect(writes).toHaveLength(0);
  });

  it('stores the server-derived area, not the number that was sent', async () => {
    const body = truthfulFarmBody();
    // Inside the 1% tolerance, so it is accepted — but not what gets stored.
    const nudged = { ...body, area_sq_meters: body.area_sq_meters * 1.005 };
    whenQuerying('farms', { data: { id: 'farm-1', user_id: USER_ID, ...body }, error: null });

    await request(app).post('/api/v1/farms').set(AUTH).send(nudged);

    const insert = writes.find((w) => w.op === 'insert');
    expect(insert?.payload.area_sq_meters).toBeCloseTo(body.area_sq_meters, 6);
    expect(insert?.payload.area_sq_meters).not.toBe(nudged.area_sq_meters);
  });

  it('rejects an unclosed boundary ring', async () => {
    const body = truthfulFarmBody();
    const open = {
      ...body,
      boundary: { type: 'Polygon' as const, coordinates: [boundary.coordinates[0]!.slice(0, -1)] },
    };

    const res = await request(app).post('/api/v1/farms').set(AUTH).send(open);

    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/closed/i);
  });
});

describe('GET /api/v1/farms/:id', () => {
  it("reports another farmer's field as missing, not as forbidden", async () => {
    // RLS returns nothing for a row the caller does not own.
    whenQuerying('farms', { data: null, error: null });

    const res = await request(app).get(`/api/v1/farms/${OTHER_FARM_ID}`).set(AUTH);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('rejects an id that is not a uuid', async () => {
    const res = await request(app).get('/api/v1/farms/not-a-uuid').set(AUTH);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_REQUEST');
  });

  it('normalises numeric columns that PostgREST returned as strings', async () => {
    whenQuerying('farms', {
      data: {
        id: 'farm-1',
        user_id: USER_ID,
        name: null,
        boundary,
        area_sq_meters: '11009.63',
        area_acres: '2.7205',
        area_hectares: '1.1010',
        centroid_lat: '26.912500',
        centroid_lng: '75.787500',
      },
      error: null,
    });

    const res = await request(app)
      .get('/api/v1/farms/33333333-3333-3333-3333-333333333333')
      .set(AUTH);

    expect(res.status).toBe(200);
    expect(typeof res.body.data.area_acres).toBe('number');
    expect(typeof res.body.data.centroid_lat).toBe('number');
  });
});

describe('PATCH /api/v1/farmers/me', () => {
  it('updates the allowed fields', async () => {
    whenQuerying('profiles', {
      data: { id: USER_ID, full_name: 'Asha', phone: null, language: 'hi' },
      error: null,
    });

    const res = await request(app).patch('/api/v1/farmers/me').set(AUTH).send({ language: 'hi' });

    expect(res.status).toBe(200);
    expect(res.body.data.language).toBe('hi');
  });

  it('refuses a field it does not own', async () => {
    const res = await request(app)
      .patch('/api/v1/farmers/me')
      .set(AUTH)
      .send({ id: OTHER_FARM_ID });

    expect(res.status).toBe(400);
  });

  it('refuses an empty update', async () => {
    const res = await request(app).patch('/api/v1/farmers/me').set(AUTH).send({});
    expect(res.status).toBe(400);
  });

  it('updates the optional email and notification preferences', async () => {
    whenQuerying('profiles', {
      data: { id: USER_ID, full_name: 'Asha', phone: null, email: 'asha@example.com', language: 'en', sms_alerts: false },
      error: null,
    });

    const res = await request(app)
      .patch('/api/v1/farmers/me')
      .set(AUTH)
      .send({ email: 'asha@example.com', sms_alerts: false });

    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe('asha@example.com');
    expect(res.body.data.sms_alerts).toBe(false);
  });
});

describe('data that is not connected yet', () => {
  it('returns no market prices, and says so', async () => {
    whenQuerying('market_prices', { data: [], error: null });

    const res = await request(app).get('/api/v1/market-prices?crop=wheat').set(AUTH);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.message).toBe(NOT_CONNECTED.marketPrices);
  });

  it('never invents a market price', async () => {
    whenQuerying('market_prices', { data: [], error: null });

    const res = await request(app).get('/api/v1/market-prices').set(AUTH);

    expect(JSON.stringify(res.body.data)).not.toMatch(/\d/);
  });

  it('reports weather as unavailable rather than returning an empty reading', async () => {
    const res = await request(app).get('/api/v1/weather').set(AUTH);

    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('SERVICE_NOT_CONNECTED');
    expect(res.body.error.message).toBe(NOT_CONNECTED.weather);
  });

  it('still validates its query parameters', async () => {
    const res = await request(app).get('/api/v1/market-prices?from=15-01-2025').set(AUTH);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_REQUEST');
  });
});

describe('reference data', () => {
  it('lists the crop catalogue', async () => {
    whenQuerying('crops', { data: [{ id: 'c1', code: 'wheat', name_en: 'Wheat' }], error: null });

    const res = await request(app).get('/api/v1/crops').set(AUTH);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });

  it('lists mandis', async () => {
    whenQuerying('mandis', {
      data: [{ id: 'm1', code: 'RJ-ALWAR', name: 'Alwar', district: 'Alwar', state: 'Rajasthan' }],
      error: null,
    });

    const res = await request(app).get('/api/v1/mandis?state=Rajasthan').set(AUTH);

    expect(res.status).toBe(200);
    expect(res.body.data[0].code).toBe('RJ-ALWAR');
  });
});

describe('GET /api/v1/updates', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    // Every external provider (GDELT/SACHET/PIB) talks to the real network
    // via the global fetch — stub it so these tests never touch it, and so a
    // provider outage is exercised deliberately rather than by accident.
    // A fresh Response per call: the providers fire their queries
    // concurrently, and a Fetch Response body can only be read once.
    global.fetch = jest.fn<typeof fetch>().mockImplementation(async () => new Response('', { status: 503 }));
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('requires farmId', async () => {
    const res = await request(app).get('/api/v1/updates').set(AUTH);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_REQUEST');
  });

  it('rejects a farmId that is not a uuid', async () => {
    const res = await request(app).get('/api/v1/updates?farmId=not-a-uuid').set(AUTH);

    expect(res.status).toBe(400);
  });

  it("reports another farmer's field as not found, not forbidden", async () => {
    whenQuerying('farms', { data: null, error: null });

    const res = await request(app).get(`/api/v1/updates?farmId=${OTHER_FARM_ID}`).set(AUTH);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('returns the envelope with an empty array when every provider is unavailable', async () => {
    whenQuerying('farms', {
      data: { id: OTHER_FARM_ID, user_id: USER_ID, ...truthfulFarmBody(), district: 'Gorakhpur', state: 'Uttar Pradesh' },
      error: null,
    });

    const res = await request(app).get(`/api/v1/updates?farmId=${OTHER_FARM_ID}`).set(AUTH);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual([]);
  });

  it('requires authentication like every other route under /api/v1', async () => {
    const res = await request(app).get(`/api/v1/updates?farmId=${OTHER_FARM_ID}`);

    expect(res.status).toBe(401);
  });
});

describe('routes reserved for later phases', () => {
  it.each(['/api/v1/buyers', '/api/v1/lots', '/api/v1/offers', '/api/v1/predictions'])(
    '%s is not stubbed, it is absent',
    async (path) => {
      const res = await request(app).get(path).set(AUTH);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    },
  );
});
