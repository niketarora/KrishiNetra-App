import type { SupabaseClient } from '@supabase/supabase-js';

import { adminClient } from '../../config/supabase.js';

import { normalizeWeatherResponse, type RawWeatherResponse } from './weatherNormalizer.js';
import { fetchObservedWeather, weatherSourceLabel } from './weatherSource.js';

/**
 * Writes observed weather into the `weather` table, one 0.25° grid cell at a time.
 *
 * Snapping farm centroids to a 0.25° ERA5 grid:
 *   - Matches Open-Meteo's own reanalysis resolution (~750 km²).
 *   - Groups multiple farms in the same cell into a single fetch.
 *   - Preserves farmer privacy.
 */

export type WeatherTarget = {
  gridLat: number;
  gridLng: number;
  district: string | null;
  state: string | null;
};

export type WeatherIngestionReport = {
  districts: number;
  inserted: number;
  skipped: { reason: string; count: number }[];
  failures: { district: string; reason: string }[];
};

/** One representative coordinate per 0.25° grid cell that at least one farm sits in. */
export async function findWeatherTargets(db: SupabaseClient): Promise<WeatherTarget[]> {
  const { data, error } = await db
    .from('farms')
    .select('district, state, centroid_lat, centroid_lng')
    .not('centroid_lat', 'is', null)
    .not('centroid_lng', 'is', null);

  if (error) throw new Error(`Could not read farm coordinates: ${error.message}`);

  const byGrid = new Map<string, WeatherTarget>();

  for (const row of data ?? []) {
    const lat = Number(row.centroid_lat);
    const lng = Number(row.centroid_lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

    const gridLat = Math.round(lat * 4) / 4;
    const gridLng = Math.round(lng * 4) / 4;
    const key = `${gridLat}:${gridLng}`;
    if (byGrid.has(key)) continue;

    byGrid.set(key, {
      gridLat,
      gridLng,
      district: row.district ? String(row.district) : null,
      state: row.state ? String(row.state) : null,
    });
  }

  return [...byGrid.values()];
}

/** Store one grid cell's observations. Exported so a test can drive it directly. */
export async function ingestWeatherPayload(
  target: WeatherTarget,
  payload: RawWeatherResponse,
  options: { db?: SupabaseClient; source?: string; today?: Date } = {},
): Promise<{ inserted: number; skipped: { reason: string; count: number }[] }> {
  const db = options.db ?? adminClient();
  const source = options.source ?? weatherSourceLabel();

  const { rows, skipped } = normalizeWeatherResponse(
    payload,
    options.today ? { today: options.today } : {},
  );

  if (rows.length === 0) return { inserted: 0, skipped };

  const { error, count } = await db.from('weather').upsert(
    rows.map((row) => ({
      grid_lat: target.gridLat,
      grid_lng: target.gridLng,
      district: target.district,
      state: target.state,
      observed_on: row.observed_on,
      temperature_c: row.temperature_c,
      rainfall_mm: row.rainfall_mm,
      humidity_pct: row.humidity_pct,
      source,
    })),
    { onConflict: 'grid_lat,grid_lng,observed_on', count: 'exact' },
  );

  if (error) throw new Error(`Could not write weather: ${error.message}`);

  return { inserted: count ?? rows.length, skipped };
}

function isoDaysAgo(days: number, from = new Date()): string {
  const date = new Date(from);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

/**
 * Fetch and store recent observations for every 0.25° grid cell a farm sits in.
 */
export async function runWeatherIngestion(
  options: { days?: number; db?: SupabaseClient } = {},
): Promise<WeatherIngestionReport> {
  const db = options.db ?? adminClient();
  const days = options.days ?? 14;

  const targets = await findWeatherTargets(db);

  const report: WeatherIngestionReport = {
    districts: targets.length,
    inserted: 0,
    skipped: [],
    failures: [],
  };

  const skipTally = new Map<string, number>();

  for (const target of targets) {
    try {
      const payload = await fetchObservedWeather({
        latitude: target.gridLat,
        longitude: target.gridLng,
        startDate: isoDaysAgo(days),
        endDate: isoDaysAgo(5),
      });

      const result = await ingestWeatherPayload(target, payload, { db });
      report.inserted += result.inserted;

      for (const { reason, count } of result.skipped) {
        skipTally.set(reason, (skipTally.get(reason) ?? 0) + count);
      }
    } catch (error) {
      report.failures.push({
        district: target.district ? `${target.state} / ${target.district}` : `Grid (${target.gridLat}, ${target.gridLng})`,
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }

  report.skipped = [...skipTally.entries()].map(([reason, count]) => ({ reason, count }));
  return report;
}
