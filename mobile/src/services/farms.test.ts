import type { LatLng } from '@/utils/geo';

import { apiFetch } from './api';
import { createFarm, getCurrentFarm, updateFarmBoundary } from './farms';

jest.mock('./api', () => ({
  apiFetch: jest.fn(),
  asNumber: (value: unknown) => (typeof value === 'number' ? value : Number(value)),
}));

const mockedFetch = apiFetch as jest.MockedFunction<typeof apiFetch>;

const points: LatLng[] = [
  { latitude: 26.912, longitude: 75.787 },
  { latitude: 26.912, longitude: 75.788 },
  { latitude: 26.913, longitude: 75.788 },
  { latitude: 26.913, longitude: 75.787 },
];

const savedFarm = {
  id: 'farm-1',
  user_id: 'user-1',
  name: 'North field',
  area_sq_meters: 11_009.63,
  area_acres: 2.7205,
  area_hectares: 1.101,
  centroid_lat: 26.9125,
  centroid_lng: 75.7875,
};

beforeEach(() => jest.clearAllMocks());

describe('getCurrentFarm', () => {
  it('asks the API for the single newest field', async () => {
    mockedFetch.mockResolvedValue([savedFarm] as never);

    await getCurrentFarm('user-1');

    expect(mockedFetch).toHaveBeenCalledWith(
      '/api/v1/farms?limit=1',
      expect.objectContaining({ fallbackKey: 'home.loadError' }),
    );
  });

  it('returns null when the farmer has not drawn a field yet', async () => {
    mockedFetch.mockResolvedValue([] as never);

    await expect(getCurrentFarm('user-1')).resolves.toBeNull();
  });

  it('coerces numeric fields that arrived as strings', async () => {
    mockedFetch.mockResolvedValue([
      { ...savedFarm, area_acres: '2.7205', centroid_lat: '26.912500' },
    ] as never);

    const farm = await getCurrentFarm('user-1');

    expect(typeof farm?.area_acres).toBe('number');
    expect(typeof farm?.centroid_lat).toBe('number');
    expect(farm?.area_acres).toBeCloseTo(2.7205, 6);
  });
});

describe('createFarm', () => {
  it('posts the drawn boundary with its measurements', async () => {
    mockedFetch.mockResolvedValue(savedFarm as never);

    await createFarm({ userId: 'user-1', points, name: 'North field' });

    const [path, init] = mockedFetch.mock.calls[0];
    expect(path).toBe('/api/v1/farms');
    expect(init.method).toBe('POST');

    const body = init.body as Record<string, unknown>;
    expect(body.boundary).toMatchObject({ type: 'Polygon' });
    expect(body.area_sq_meters).toBeGreaterThan(0);
    expect(body.name).toBe('North field');
  });

  it('never sends a user_id — the token identifies the farmer', async () => {
    mockedFetch.mockResolvedValue(savedFarm as never);

    await createFarm({ userId: 'user-1', points });

    const body = mockedFetch.mock.calls[0][1].body as Record<string, unknown>;
    expect(body).not.toHaveProperty('user_id');
  });

  it('sends a blank name as null rather than an empty string', async () => {
    mockedFetch.mockResolvedValue(savedFarm as never);

    await createFarm({ userId: 'user-1', points, name: '   ' });

    const body = mockedFetch.mock.calls[0][1].body as Record<string, unknown>;
    expect(body.name).toBeNull();
  });
});

describe('updateFarmBoundary', () => {
  it('patches the specific field', async () => {
    mockedFetch.mockResolvedValue(savedFarm as never);

    await updateFarmBoundary('farm-1', { userId: 'user-1', points });

    const [path, init] = mockedFetch.mock.calls[0];
    expect(path).toBe('/api/v1/farms/farm-1');
    expect(init.method).toBe('PATCH');
    expect(init.fallbackKey).toBe('onboarding.saveError');
  });
});
