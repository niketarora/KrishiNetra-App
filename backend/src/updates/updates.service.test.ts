import { beforeEach, describe, expect, it, jest } from '@jest/globals';

process.env.NODE_ENV = 'test';
process.env.SUPABASE_URL = 'https://example.supabase.co';
process.env.SUPABASE_ANON_KEY = 'test-anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';

const FARM = {
  id: 'farm-1',
  user_id: 'user-1',
  name: 'North Field',
  boundary: { type: 'Polygon' as const, coordinates: [] },
  area_sq_meters: 1000,
  area_acres: 0.25,
  area_hectares: 0.1,
  centroid_lat: 26.76,
  centroid_lng: 83.37,
  district: 'Gorakhpur',
  state: 'Uttar Pradesh',
  location_source: 'geocode',
  location_accuracy: null,
  created_at: 'now',
  updated_at: 'now',
};

const getFarm = jest.fn<any>().mockResolvedValue(FARM);
const listFarmCrops = jest.fn<any>().mockResolvedValue([]);
const listCrops = jest.fn<any>().mockResolvedValue([]);
const fetchGdeltUpdatesDetailed = jest.fn<any>().mockResolvedValue({ updates: [], hadFailure: false, usefulCount: 0 });
const fetchGoogleNewsUpdates = jest.fn<any>().mockResolvedValue({ updates: [], usefulCount: 0 });
const fetchSachetUpdates = jest.fn<any>().mockResolvedValue([]);

jest.unstable_mockModule('../services/farms.service.js', () => ({ getFarm }));
jest.unstable_mockModule('../services/farmCrops.service.js', () => ({ listFarmCrops }));
jest.unstable_mockModule('../services/reference.service.js', () => ({ listCrops }));
jest.unstable_mockModule('./providers/gdelt.provider.js', () => ({ fetchGdeltUpdatesDetailed }));
jest.unstable_mockModule('./providers/google-news.provider.js', () => ({ fetchGoogleNewsUpdates }));
jest.unstable_mockModule('./providers/sachet.provider.js', () => ({ fetchSachetUpdates }));

const { getUpdatesForFarm, getNationalUpdates } = await import('./updates.service.js');
const { ApiError } = await import('../utils/ApiError.js');

function update(overrides: Record<string, unknown> = {}) {
  return {
    id: overrides.id ?? 'u1',
    title: overrides.title ?? 'An update',
    category: 'agriculture',
    source: { name: 'example.com', type: 'reported' },
    sourceUrl: overrides.sourceUrl ?? 'https://example.com/1',
    publishedAt: new Date().toISOString(),
    relevance: { score: 0, reasons: [] },
    ...overrides,
  };
}

function gdeltResult(updates: ReturnType<typeof update>[], hadFailure = false) {
  return { updates, hadFailure, usefulCount: updates.length };
}

function googleNewsResult(updates: ReturnType<typeof update>[]) {
  return { updates, usefulCount: updates.length };
}

beforeEach(() => {
  getFarm.mockClear().mockResolvedValue(FARM);
  listFarmCrops.mockClear().mockResolvedValue([]);
  listCrops.mockClear().mockResolvedValue([]);
  fetchGdeltUpdatesDetailed.mockClear().mockResolvedValue(gdeltResult([]));
  fetchGoogleNewsUpdates.mockClear().mockResolvedValue(googleNewsResult([]));
  fetchSachetUpdates.mockClear().mockResolvedValue([]);
});

describe('getUpdatesForFarm — ownership', () => {
  it('resolves the farm through farms.service, which enforces ownership', async () => {
    await getUpdatesForFarm('token', 'user-1', 'farm-1');

    expect(getFarm).toHaveBeenCalledWith('token', 'user-1', 'farm-1');
  });

  it('propagates a not-found farm (someone else’s field) rather than fetching providers', async () => {
    getFarm.mockRejectedValue(ApiError.notFound('No such field.'));

    await expect(getUpdatesForFarm('token', 'user-1', 'not-mine')).rejects.toThrow('No such field.');
    expect(fetchGdeltUpdatesDetailed).not.toHaveBeenCalled();
  });
});

describe('getUpdatesForFarm — provider failure handling', () => {
  it('still returns SACHET results when GDELT/Google News both come back empty (e.g. GDELT down, no fallback content either)', async () => {
    fetchGdeltUpdatesDetailed.mockResolvedValue(gdeltResult([], true));
    fetchGoogleNewsUpdates.mockResolvedValue(googleNewsResult([]));
    fetchSachetUpdates.mockResolvedValue([update({ id: 'sachet-1', source: { name: 'NDMA', type: 'official' } })]);

    const result = await getUpdatesForFarm('token', 'user-1', 'farm-1');

    expect(result.updates).toHaveLength(1);
    expect(result.updates[0]?.id).toBe('sachet-1');
  });

  it('returns an empty list, not a throw, when every provider fails/returns nothing', async () => {
    fetchGdeltUpdatesDetailed.mockRejectedValue(new Error('down'));
    fetchGoogleNewsUpdates.mockResolvedValue(googleNewsResult([]));
    fetchSachetUpdates.mockRejectedValue(new Error('down'));

    const result = await getUpdatesForFarm('token', 'user-1', 'farm-1');

    expect(result.updates).toEqual([]);
  });
});

describe('getUpdatesForFarm — crop relevance', () => {
  it('resolves the farm’s current crop and passes it to the providers', async () => {
    listFarmCrops.mockResolvedValue([
      { id: 'fc1', farm_id: 'farm-1', user_id: 'user-1', crop_id: 'c1', status: 'growing', sown_on: '2026-06-01', variety: null, area_acres: null, notes: null, created_at: 'now', updated_at: 'now', expected_harvest_on: null },
    ]);
    listCrops.mockResolvedValue([{ id: 'c1', code: 'wheat', name_en: 'Wheat', name_hi: null, category: null, default_unit: 'quintal', created_at: 'now', updated_at: 'now' }]);

    const result = await getUpdatesForFarm('token', 'user-1', 'farm-1');

    expect(result.crop).toEqual({ code: 'wheat', name: 'Wheat' });
    expect(fetchGdeltUpdatesDetailed).toHaveBeenCalledWith(expect.objectContaining({ cropCode: 'wheat', cropName: 'Wheat' }));
  });

  it('reports no crop, honestly, rather than guessing one', async () => {
    const result = await getUpdatesForFarm('token', 'user-1', 'farm-1');

    expect(result.crop).toBeNull();
    expect(fetchGdeltUpdatesDetailed).toHaveBeenCalledWith(expect.objectContaining({ cropCode: null, cropName: null }));
  });
});

describe('getUpdatesForFarm — dedup and ordering', () => {
  it('deduplicates the same story surfaced by two providers (SACHET + GDELT)', async () => {
    fetchGdeltUpdatesDetailed.mockResolvedValue(gdeltResult([update({ id: 'a', sourceUrl: 'https://x.com/story', title: 'Flood in Gorakhpur' })]));
    fetchSachetUpdates.mockResolvedValue([update({ id: 'b', sourceUrl: 'https://x.com/story', title: 'Flood in Gorakhpur' })]);

    const result = await getUpdatesForFarm('token', 'user-1', 'farm-1');

    expect(result.updates).toHaveLength(1);
  });

  it('deduplicates the same story surfaced by GDELT and the Google News fallback', async () => {
    fetchGdeltUpdatesDetailed.mockResolvedValue(gdeltResult([], true)); // triggers fallback
    fetchGoogleNewsUpdates.mockResolvedValue(
      googleNewsResult([update({ id: 'gn-1', sourceUrl: 'https://news.example.com/mandi-story', title: 'Mandi prices rise for wheat' })]),
    );
    fetchSachetUpdates.mockResolvedValue([]);
    // Simulate GDELT having actually returned the same story before the (mocked) failure flag —
    // more realistically this exercises dedupe across the two *raw* arrays the service combines.
    fetchGdeltUpdatesDetailed.mockResolvedValue(
      gdeltResult([update({ id: 'gd-1', sourceUrl: 'https://news.example.com/mandi-story', title: 'Mandi prices rise for wheat' })], true),
    );

    const result = await getUpdatesForFarm('token', 'user-1', 'farm-1');

    expect(result.updates).toHaveLength(1);
  });

  it('sorts by relevance score, most relevant first', async () => {
    fetchGdeltUpdatesDetailed.mockResolvedValue(
      gdeltResult([update({ id: 'low', sourceUrl: 'https://x.com/1', title: 'Unrelated general update', location: { country: 'India' } })]),
    );
    fetchSachetUpdates.mockResolvedValue([
      update({
        id: 'high',
        sourceUrl: 'https://x.com/2',
        title: 'Official flood alert for Gorakhpur',
        source: { name: 'NDMA SACHET', type: 'official' },
        severity: 'high',
        location: { district: 'Gorakhpur' },
      }),
    ]);

    const result = await getUpdatesForFarm('token', 'user-1', 'farm-1');

    expect(result.updates[0]?.id).toBe('high');
  });

  it('caps the result at the documented maximum rather than returning everything', async () => {
    const many = Array.from({ length: 40 }, (_, i) => update({ id: `u${i}`, sourceUrl: `https://x.com/${i}`, title: `Story ${i}` }));
    fetchGdeltUpdatesDetailed.mockResolvedValue(gdeltResult(many));

    const result = await getUpdatesForFarm('token', 'user-1', 'farm-1');

    expect(result.updates.length).toBeLessThanOrEqual(20);
  });
});

describe('getUpdatesForFarm — Google News fallback trigger', () => {
  it('calls Google News when GDELT had a query failure', async () => {
    fetchGdeltUpdatesDetailed.mockResolvedValue(gdeltResult([update({ id: 'g1' })], true));

    await getUpdatesForFarm('token', 'user-1', 'farm-1');

    expect(fetchGoogleNewsUpdates).toHaveBeenCalledTimes(1);
  });

  it('calls Google News when GDELT succeeded but returned too few useful results', async () => {
    fetchGdeltUpdatesDetailed.mockResolvedValue(gdeltResult([update({ id: 'g1' }), update({ id: 'g2', sourceUrl: 'https://x.com/2' })], false));

    await getUpdatesForFarm('token', 'user-1', 'farm-1');

    expect(fetchGoogleNewsUpdates).toHaveBeenCalledTimes(1);
  });

  it('does NOT call Google News when GDELT already returned enough useful results', async () => {
    const plenty = Array.from({ length: 5 }, (_, i) => update({ id: `g${i}`, sourceUrl: `https://x.com/${i}` }));
    fetchGdeltUpdatesDetailed.mockResolvedValue(gdeltResult(plenty, false));

    await getUpdatesForFarm('token', 'user-1', 'farm-1');

    expect(fetchGoogleNewsUpdates).not.toHaveBeenCalled();
  });

  it('includes Google News fallback results in the final feed when triggered', async () => {
    fetchGdeltUpdatesDetailed.mockResolvedValue(gdeltResult([], true));
    fetchGoogleNewsUpdates.mockResolvedValue(googleNewsResult([update({ id: 'gn-1', sourceUrl: 'https://news.example.com/fallback-story' })]));

    const result = await getUpdatesForFarm('token', 'user-1', 'farm-1');

    expect(result.updates.some((u) => u.id === 'gn-1')).toBe(true);
  });

  it('still returns SACHET results when GDELT and the Google News fallback both fail', async () => {
    fetchGdeltUpdatesDetailed.mockResolvedValue(gdeltResult([], true));
    fetchGoogleNewsUpdates.mockRejectedValue(new Error('google news down'));
    fetchSachetUpdates.mockResolvedValue([update({ id: 'sachet-1', source: { name: 'NDMA', type: 'official' } })]);

    const result = await getUpdatesForFarm('token', 'user-1', 'farm-1');

    expect(result.updates.some((u) => u.id === 'sachet-1')).toBe(true);
  });
});

describe('getNationalUpdates — no farm registered yet', () => {
  it('returns a feed without ever calling getFarm or SACHET', async () => {
    fetchGdeltUpdatesDetailed.mockResolvedValue(gdeltResult([update({ id: 'national-1', title: 'National agritech update' })]));

    const result = await getNationalUpdates();

    expect(result.farm).toBeNull();
    expect(result.crop).toBeNull();
    expect(result.updates).toHaveLength(1);
    expect(getFarm).not.toHaveBeenCalled();
    expect(fetchSachetUpdates).not.toHaveBeenCalled();
  });

  it('returns an empty list, not a throw, when GDELT and Google News both fail', async () => {
    fetchGdeltUpdatesDetailed.mockRejectedValue(new Error('down'));
    fetchGoogleNewsUpdates.mockRejectedValue(new Error('down'));

    const result = await getNationalUpdates();

    expect(result.updates).toEqual([]);
  });
});
