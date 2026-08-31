import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { getElevationForCoordinates } from './elevation.service.js';

describe('elevation.service', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('returns fallback elevation for null/undefined coordinates', async () => {
    const elevation = await getElevationForCoordinates(null, null);
    expect(elevation).toBe(350.0);
  });

  it('fetches elevation from Open-Meteo API when available', async () => {
    const mockFetch = jest.fn<any>().mockResolvedValue({
      ok: true,
      json: async () => ({ elevation: [450.5] }),
    });
    global.fetch = mockFetch as any;

    const elevation = await getElevationForCoordinates(26.91, 75.78);
    expect(elevation).toBe(450.5);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('latitude=26.91'),
      expect.anything(),
    );
  });

  it('returns fallback elevation if API call fails', async () => {
    const mockFetch = jest.fn<any>().mockRejectedValue(new Error('Network offline'));
    global.fetch = mockFetch as any;

    const elevation = await getElevationForCoordinates(12.34, 56.78);
    expect(elevation).toBe(350.0);
  });
});
