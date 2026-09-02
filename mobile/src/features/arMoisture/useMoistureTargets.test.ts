import { renderHook, waitFor } from '@testing-library/react-native';

import type { FarmMoistureZones } from '@/services/predictions';

import { useMoistureTargets } from './useMoistureTargets';
import type { MoistureTarget } from './types';

jest.mock('@/services/predictions', () => ({ getFarmMoistureZones: jest.fn() }));
jest.mock('@/features/demo/demoMode', () => ({ isDemoMode: jest.fn(() => false) }));

import { isDemoMode } from '@/features/demo/demoMode';
import { getFarmMoistureZones } from '@/services/predictions';

const mockedGetZones = getFarmMoistureZones as jest.MockedFunction<typeof getFarmMoistureZones>;
const mockedIsDemoMode = isDemoMode as jest.MockedFunction<typeof isDemoMode>;

const FARM_CENTER = { latitude: 26.9125, longitude: 75.7875 };

function zones(overrides: Partial<FarmMoistureZones> = {}): FarmMoistureZones {
  return {
    farmId: 'farm-1',
    farmAverageMoisturePercent: 20,
    method: 'prototype_spatial_estimate',
    provenance: 'existing_krishinetra_moisture_engine',
    generatedAt: '2026-09-03T00:00:00.000Z',
    gridSpacingMeters: 20,
    cellCount: 6,
    targets: [
      {
        id: 'zone-1',
        center: { lat: 26.9126, lng: 75.7876 },
        estimatedMoisturePercent: 12.5,
        relativeStatus: 'LOWER_THAN_FARM_AVERAGE',
        priority: 1,
        source: 'prototype_spatial_estimate',
        provenance: 'existing_krishinetra_moisture_engine',
        generatedAt: '2026-09-03T00:00:00.000Z',
      },
    ],
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockedIsDemoMode.mockReturnValue(false);
});

describe('useMoistureTargets', () => {
  it('returns nothing without a farmId/farmCenter and never calls the API', async () => {
    const { result } = await renderHook(() => useMoistureTargets(null, null));

    expect(result.current.targets).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(result.current.unavailable).toBe(false);
    expect(mockedGetZones).not.toHaveBeenCalled();
  });

  it('maps API targets into MoistureTarget, carrying provenance and the moisture estimate', async () => {
    mockedGetZones.mockResolvedValue(zones());

    const { result } = await renderHook(() => useMoistureTargets('farm-1', FARM_CENTER));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.targets).toHaveLength(1);
    const target = result.current.targets[0]!;
    expect(target.latitude).toBe(26.9126);
    expect(target.longitude).toBe(75.7876);
    expect(target.estimatedMoisturePercent).toBe(12.5);
    expect(target.relativeStatus).toBe('LOWER_THAN_FARM_AVERAGE');
    expect(target.provenance).toEqual({ source: 'api', type: 'sampling_target' });
    expect(result.current.unavailable).toBe(false);
  });

  it('never silently falls back to fabricated targets when the API fails and demo mode is off', async () => {
    mockedGetZones.mockResolvedValue(null);

    const { result } = await renderHook(() => useMoistureTargets('farm-1', FARM_CENTER));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.targets).toEqual([]);
    expect(result.current.unavailable).toBe(true);
  });

  it('never silently falls back to fabricated targets when the API returns no usable cells, demo mode off', async () => {
    mockedGetZones.mockResolvedValue(zones({ targets: [] }));

    const { result } = await renderHook(() => useMoistureTargets('farm-1', FARM_CENTER));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.targets).toEqual([]);
    expect(result.current.unavailable).toBe(true);
  });

  it('only uses the demo fallback when EXPO_PUBLIC_DEMO_MODE is explicitly on, never automatically', async () => {
    mockedIsDemoMode.mockReturnValue(true);
    mockedGetZones.mockResolvedValue(null);

    const { result } = await renderHook(() => useMoistureTargets('farm-1', FARM_CENTER));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.targets.length).toBeGreaterThan(0);
    expect(result.current.targets.every((t: MoistureTarget) => t.provenance.source === 'demo')).toBe(true);
    expect(result.current.unavailable).toBe(false);
  });
});
