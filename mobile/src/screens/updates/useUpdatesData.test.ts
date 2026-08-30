import { act, renderHook, waitFor } from '@testing-library/react-native';

import type { Farm } from '@/services/farms';
import type { KrishiUpdate } from '@/features/updates/types';

import { useUpdatesData } from './useUpdatesData';

jest.mock('@/services/farms', () => ({ listFarms: jest.fn() }));
jest.mock('@/services/updates', () => ({ getUpdates: jest.fn() }));
jest.mock('@/features/demo/demoMode', () => ({ isDemoMode: jest.fn(() => false) }));

import { isDemoMode } from '@/features/demo/demoMode';
import { listFarms } from '@/services/farms';
import { getUpdates } from '@/services/updates';

const mockedListFarms = listFarms as jest.MockedFunction<typeof listFarms>;
const mockedGetUpdates = getUpdates as jest.MockedFunction<typeof getUpdates>;
const mockedIsDemoMode = isDemoMode as jest.MockedFunction<typeof isDemoMode>;

function farm(overrides: Partial<Farm> = {}): Farm {
  return {
    id: 'farm-1',
    user_id: 'user-1',
    name: 'North Field',
    boundary: { type: 'Polygon', coordinates: [] },
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
    ...overrides,
  };
}

function update(overrides: Partial<KrishiUpdate> = {}): KrishiUpdate {
  return {
    id: 'u1',
    title: 'Flood alert for Gorakhpur',
    category: 'risk',
    source: { name: 'news.example.com', type: 'reported' },
    sourceUrl: 'https://news.example.com/a',
    publishedAt: new Date().toISOString(),
    relevance: { score: 40, reasons: ['Relevant to Gorakhpur'] },
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockedIsDemoMode.mockReturnValue(false);
});

describe('useUpdatesData — loading the first field', () => {
  it('loads every field and fetches updates for the first one', async () => {
    mockedListFarms.mockResolvedValue([farm({ id: 'farm-1' }), farm({ id: 'farm-2', name: 'South Field' })]);
    mockedGetUpdates.mockResolvedValue([update()]);

    const { result } = await renderHook(() => useUpdatesData());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.farms).toHaveLength(2);
    expect(result.current.selectedFarmId).toBe('farm-1');
    expect(result.current.updates).toHaveLength(1);
    expect(mockedGetUpdates).toHaveBeenCalledWith('farm-1');
  });

  it('reports no updates, honestly, rather than falling back when the feed is genuinely empty', async () => {
    mockedListFarms.mockResolvedValue([farm()]);
    mockedGetUpdates.mockResolvedValue([]);

    const { result } = await renderHook(() => useUpdatesData());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.updates).toEqual([]);
    expect(result.current.errorKey).toBeNull();
    expect(result.current.demoFallback).toBe(false);
  });
});

describe('useUpdatesData — switching fields', () => {
  it('reloads the feed for the newly selected field, per the success test in the product brief', async () => {
    mockedListFarms.mockResolvedValue([farm({ id: 'farm-1' }), farm({ id: 'farm-2', name: 'South Field', district: 'Alwar', state: 'Rajasthan' })]);
    mockedGetUpdates.mockImplementation(async (farmId: string) =>
      farmId === 'farm-1' ? [update({ id: 'north-1' })] : [update({ id: 'south-1', title: 'MSP news for Alwar' })],
    );

    const { result } = await renderHook(() => useUpdatesData());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.updates[0]?.id).toBe('north-1');

    await act(async () => {
      result.current.selectFarm('farm-2');
    });
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.selectedFarmId).toBe('farm-2');
    expect(result.current.updates[0]?.id).toBe('south-1');
    expect(mockedGetUpdates).toHaveBeenCalledWith('farm-2');
  });
});

describe('useUpdatesData — error handling', () => {
  it('surfaces an error and no demo content when the backend fails and demo mode is off', async () => {
    mockedListFarms.mockResolvedValue([farm()]);
    mockedGetUpdates.mockRejectedValue(new Error('network down'));

    const { result } = await renderHook(() => useUpdatesData());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.errorKey).toBeTruthy();
    expect(result.current.demoFallback).toBe(false);
    expect(result.current.updates).toEqual([]);
  });

  it('falls back to the labelled demo feed, not a bare error, when demo mode is on', async () => {
    mockedIsDemoMode.mockReturnValue(true);
    mockedListFarms.mockResolvedValue([farm()]);
    mockedGetUpdates.mockRejectedValue(new Error('network down'));

    const { result } = await renderHook(() => useUpdatesData());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.demoFallback).toBe(true);
    expect(result.current.errorKey).toBeNull();
  });

  it('never mixes demo content with an error state', async () => {
    mockedIsDemoMode.mockReturnValue(true);
    mockedListFarms.mockResolvedValue([farm()]);
    mockedGetUpdates.mockRejectedValue(new Error('network down'));

    const { result } = await renderHook(() => useUpdatesData());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.demoFallback && result.current.errorKey).toBeFalsy();
  });
});

describe('useUpdatesData — no field yet', () => {
  it('reports no farms rather than throwing when the farmer has none', async () => {
    mockedListFarms.mockResolvedValue([]);

    const { result } = await renderHook(() => useUpdatesData());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.farms).toEqual([]);
    expect(result.current.selectedFarmId).toBeNull();
    expect(result.current.updates).toEqual([]);
    expect(mockedGetUpdates).not.toHaveBeenCalled();
  });
});
