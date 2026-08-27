import { apiFetch } from './api';
import { getCurrentCrop, getLatestMsp, getWeather, selectCurrentPlanting } from './agronomy';
import type { FarmCrop } from './agronomy';
import { DataError } from './errors';

jest.mock('./api', () => ({
  apiFetch: jest.fn(),
  asNumber: (value: unknown) => (typeof value === 'number' ? value : Number(value)),
}));

const mockedFetch = apiFetch as jest.MockedFunction<typeof apiFetch>;

function planting(overrides: Partial<FarmCrop> = {}): FarmCrop {
  return {
    id: 'planting-1',
    farm_id: 'farm-1',
    crop_id: 'crop-wheat',
    variety: 'Dara',
    sown_on: '2025-11-15',
    expected_harvest_on: '2026-04-05',
    area_acres: 2.5,
    status: 'sown',
    notes: null,
    ...overrides,
  };
}

const catalogue = [
  {
    id: 'crop-wheat',
    code: 'wheat',
    name_en: 'Wheat',
    name_hi: 'गेहूँ',
    category: 'cereal',
    default_unit: 'quintal',
  },
];

beforeEach(() => {
  jest.clearAllMocks();
});

describe('selectCurrentPlanting', () => {
  it('returns the newest planting still in the ground', () => {
    const current = selectCurrentPlanting([
      planting({ id: 'old', sown_on: '2024-11-15' }),
      planting({ id: 'new', sown_on: '2025-11-15' }),
    ]);

    expect(current?.id).toBe('new');
  });

  it('ignores a harvested crop, because it is no longer growing', () => {
    const current = selectCurrentPlanting([
      planting({ id: 'harvested', sown_on: '2025-11-15', status: 'harvested' }),
      planting({ id: 'growing', sown_on: '2024-11-15', status: 'growing' }),
    ]);

    expect(current?.id).toBe('growing');
  });

  it('returns null when every planting has been harvested', () => {
    // A field between seasons has no current crop, and saying so beats naming
    // one that is already out of the ground.
    expect(selectCurrentPlanting([planting({ status: 'harvested' })])).toBeNull();
  });

  it('returns null for a field with no plantings', () => {
    expect(selectCurrentPlanting([])).toBeNull();
  });

  it('does not let an undated planting outrank a dated one', () => {
    const current = selectCurrentPlanting([
      planting({ id: 'undated', sown_on: null }),
      planting({ id: 'dated', sown_on: '2025-11-15' }),
    ]);

    expect(current?.id).toBe('dated');
  });
});

describe('getCurrentCrop', () => {
  it('joins the planting to its catalogue entry', async () => {
    mockedFetch.mockResolvedValueOnce([planting()]).mockResolvedValueOnce(catalogue);

    const current = await getCurrentCrop('farm-1');

    expect(current?.crop.name_en).toBe('Wheat');
    expect(current?.planting.variety).toBe('Dara');
  });

  it('returns null rather than naming a crop the catalogue does not have', async () => {
    mockedFetch
      .mockResolvedValueOnce([planting({ crop_id: 'crop-unknown' })])
      .mockResolvedValueOnce(catalogue);

    expect(await getCurrentCrop('farm-1')).toBeNull();
  });
});

describe('getLatestMsp', () => {
  it('takes the newest marketing year the API returned', async () => {
    mockedFetch.mockResolvedValueOnce([
      { id: 'a', marketing_year: '2025-26', price_per_quintal: 2425 },
      { id: 'b', marketing_year: '2024-25', price_per_quintal: 2275 },
    ]);

    const msp = await getLatestMsp('wheat');

    expect(msp?.marketing_year).toBe('2025-26');
    expect(msp?.price_per_quintal).toBe(2425);
  });

  it('coerces a numeric string so the tile never renders one', async () => {
    mockedFetch.mockResolvedValueOnce([{ id: 'a', price_per_quintal: '2425' }]);

    expect((await getLatestMsp('wheat'))?.price_per_quintal).toBe(2425);
  });

  it('returns null when no support price is recorded', async () => {
    mockedFetch.mockResolvedValueOnce([]);

    expect(await getLatestMsp('barley')).toBeNull();
  });
});

describe('getWeather', () => {
  it('returns the observation', async () => {
    mockedFetch.mockResolvedValueOnce({
      id: 'w1',
      district: 'Alwar',
      observed_on: '2026-08-21',
      temperature_c: 30.1,
      rainfall_mm: null,
      humidity_pct: 62,
    });

    const weather = await getWeather('farm-1');

    expect(weather?.temperature_c).toBe(30.1);
    expect(weather?.rainfall_mm).toBeNull();
  });

  it('treats "not connected" as no data rather than an error', async () => {
    // The backend answers 503 when the district is unresolved or nothing has
    // been ingested. The tile should go empty, not throw a banner.
    mockedFetch.mockRejectedValueOnce(
      new DataError('home.loadError', 'SERVICE_NOT_CONNECTED', { absent: true }),
    );

    expect(await getWeather('farm-1')).toBeNull();
  });

  it('still raises a genuine failure', async () => {
    // A network outage is not an empty state — the farmer should learn the app
    // is broken rather than believe their district has no weather.
    mockedFetch.mockRejectedValueOnce(new DataError('auth.errors.network'));

    await expect(getWeather('farm-1')).rejects.toBeInstanceOf(DataError);
  });
});
