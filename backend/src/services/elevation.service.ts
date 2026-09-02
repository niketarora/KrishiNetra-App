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

/**
 * Fetches elevation for many points in a single Open-Meteo request (it
 * accepts comma-separated latitude/longitude lists), rather than one request
 * per point. Used by `moistureZones.service.ts` for its grid of sample
 * points — bounded concurrency isn't enough on its own to be polite to a
 * free public API when a farm's grid can be dozens of points; one batched
 * call is both faster and friendlier.
 *
 * On any failure the whole batch falls back to the same baseline elevation
 * `getElevationForCoordinates` uses, rather than partially succeeding with a
 * mismatched array length.
 */
export async function getElevationBatch(
  points: Array<{ lat: number; lng: number }>,
  options: { timeoutMs?: number } = {},
): Promise<number[]> {
  if (points.length === 0) return [];

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 8_000);

  try {
    const latitudes = points.map((p) => p.lat).join(',');
    const longitudes = points.map((p) => p.lng).join(',');
    const url = `https://api.open-meteo.com/v1/elevation?latitude=${encodeURIComponent(
      latitudes,
    )}&longitude=${encodeURIComponent(longitudes)}`;

    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      console.warn(`[elevation] Open-Meteo batch elevation returned HTTP ${response.status}`);
      return points.map(() => 350.0);
    }

    const data = (await response.json()) as { elevation?: number[] };
    if (!Array.isArray(data.elevation) || data.elevation.length !== points.length) {
      console.warn('[elevation] Open-Meteo batch elevation returned an unexpected shape');
      return points.map(() => 350.0);
    }

    return data.elevation.map((value) =>
      Number.isFinite(value) ? Math.round(value * 10) / 10 : 350.0,
    );
  } catch (error) {
    console.warn('[elevation] Batch elevation fetch failed, using fallback:', error);
    return points.map(() => 350.0);
  } finally {
    clearTimeout(timeout);
  }
}
