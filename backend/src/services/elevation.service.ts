/**
 * Elevation Service — Fetches real-world ground elevation in meters using Open-Meteo Elevation API.
 * Uses farm centroid latitude and longitude.
 */

const elevationCache = new Map<string, number>();

export async function getElevationForCoordinates(
  lat?: number | null,
  lng?: number | null,
  options: { timeoutMs?: number } = {},
): Promise<number> {
  if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return 350.0; // Standard baseline agricultural elevation in meters
  }

  // Round to ~1km resolution for caching
  const cacheKey = `${Math.round(lat * 100) / 100},${Math.round(lng * 100) / 100}`;
  if (elevationCache.has(cacheKey)) {
    return elevationCache.get(cacheKey)!;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 5_000);

  try {
    const url = `https://api.open-meteo.com/v1/elevation?latitude=${encodeURIComponent(
      lat,
    )}&longitude=${encodeURIComponent(lng)}`;

    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      console.warn(`[elevation] Open-Meteo elevation returned HTTP ${response.status}`);
      return 350.0;
    }

    const data = (await response.json()) as { elevation?: number[] };
    if (Array.isArray(data.elevation) && typeof data.elevation[0] === 'number' && Number.isFinite(data.elevation[0])) {
      const elevationMeters = Math.round(data.elevation[0] * 10) / 10;
      elevationCache.set(cacheKey, elevationMeters);
      return elevationMeters;
    }

    return 350.0;
  } catch (error) {
    console.warn('[elevation] Failed to fetch elevation, using fallback:', error);
    return 350.0;
  } finally {
    clearTimeout(timeout);
  }
}
