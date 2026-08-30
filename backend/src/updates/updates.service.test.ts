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
const fetchGdeltUpdates = jest.fn<any>().mockResolvedValue([]);
const fetchSachetUpdates = jest.fn<any>().mockResolvedValue([]);
const fetchPibUpdates = jest.fn<any>().mockResolvedValue([]);

jest.unstable_mockModule('../services/farms.service.js', () => ({ getFarm }));
jest.unstable_mockModule('../services/farmCrops.service.js', () => ({ listFarmCrops }));
jest.unstable_mockModule('../services/reference.service.js', () => ({ listCrops }));
jest.unstable_mockModule('./providers/gdelt.provider.js', () => ({ fetchGdeltUpdates }));
jest.unstable_mockModule('./providers/sachet.provider.js', () => ({ fetchSachetUpdates }));
jest.unstable_mockModule('./providers/pib.provider.js', () => ({ fetchPibUpdates }));

const { getUpdatesForFarm } = await import('./updates.service.js');
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

beforeEach(() => {
  getFarm.mockClear().mockResolvedValue(FARM);
  listFarmCrops.mockClear().mockResolvedValue([]);
  listCrops.mockClear().mockResolvedValue([]);
  fetchGdeltUpdates.mockClear().mockResolvedValue([]);
  fetchSachetUpdates.mockClear().mockResolvedValue([]);
  fetchPibUpdates.mockClear().mockResolvedValue([]);
});

describe('getUpdatesForFarm — ownership', () => {
  it('resolves the farm through farms.service, which enforces ownership', async () => {
    await getUpdatesForFarm('token', 'user-1', 'farm-1');

    expect(getFarm).toHaveBeenCalledWith('token', 'user-1', 'farm-1');
  });

  it('propagates a not-found farm (someone else’s field) rather than fetching providers', async () => {
    getFarm.mockRejectedValue(ApiError.notFound('No such field.'));

    await expect(getUpdatesForFarm('token', 'user-1', 'not-mine')).rejects.toThrow('No such field.');
    expect(fetchGdeltUpdates).not.toHaveBeenCalled();
  });
});

describe('getUpdatesForFarm — provider failure handling', () => {
  it('still returns results when one provider rejects', async () => {
    fetchGdeltUpdates.mockRejectedValue(new Error('GDELT down'));
    fetchSachetUpdates.mockResolvedValue([update({ id: 'sachet-1', source: { name: 'NDMA', type: 'official' } })]);

    const result = await getUpdatesForFarm('token', 'user-1', 'farm-1');

    expect(result.updates).toHaveLength(1);
    expect(result.updates[0]?.id).toBe('sachet-1');
  });

  it('returns an empty list, not a throw, when every provider fails', async () => {
    fetchGdeltUpdates.mockRejectedValue(new Error('down'));
    fetchSachetUpdates.mockRejectedValue(new Error('down'));
    fetchPibUpdates.mockRejectedValue(new Error('down'));

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
    expect(fetchGdeltUpdates).toHaveBeenCalledWith(expect.objectContaining({ cropCode: 'wheat', cropName: 'Wheat' }));
  });

  it('reports no crop, honestly, rather than guessing one', async () => {
    const result = await getUpdatesForFarm('token', 'user-1', 'farm-1');

    expect(result.crop).toBeNull();
    expect(fetchGdeltUpdates).toHaveBeenCalledWith(expect.objectContaining({ cropCode: null, cropName: null }));
  });
});

describe('getUpdatesForFarm — dedup and ordering', () => {
  it('deduplicates the same story surfaced by two providers', async () => {
    fetchGdeltUpdates.mockResolvedValue([update({ id: 'a', sourceUrl: 'https://x.com/story', title: 'Flood in Gorakhpur' })]);
    fetchSachetUpdates.mockResolvedValue([update({ id: 'b', sourceUrl: 'https://x.com/story', title: 'Flood in Gorakhpur' })]);

    const result = await getUpdatesForFarm('token', 'user-1', 'farm-1');

    expect(result.updates).toHaveLength(1);
  });

  it('sorts by relevance score, most relevant first', async () => {
    fetchGdeltUpdates.mockResolvedValue([
      update({ id: 'low', sourceUrl: 'https://x.com/1', title: 'Unrelated general update', location: { country: 'India' } }),
    ]);
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
    fetchGdeltUpdates.mockResolvedValue(many);

    const result = await getUpdatesForFarm('token', 'user-1', 'farm-1');

    expect(result.updates.length).toBeLessThanOrEqual(20);
  });
});
