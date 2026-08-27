import type { SupabaseClient } from '@supabase/supabase-js';

import { adminClient } from '../../config/supabase.js';

import { normalizeWeatherResponse, type RawWeatherResponse } from './weatherNormalizer.js';
import { fetchObservedWeather, weatherSourceLabel } from './weatherSource.js';

/**
 * Writes observed weather into the `weather` table, one district at a time.
 *
 * Open-Meteo needs a coordinate, but `weather` is keyed by district and the
 * `mandis` table has null coordinates by design — Phase 2 refused to guess
 * them. The sample point therefore comes from a farm that has already resolved
 * to that district: a real coordinate inside the district, not an invented
 * centre for it.
 *
 * That means this script reads farm rows through the service-role client. It is
 * an offline script, not a request path — it selects only district, state and
 * centroid, aggregates them, and returns nothing farmer-owned to any caller.
 * The rule in config/supabase.ts (never serve farmer-owned rows through the
 * admin client) is intact.
 */

export type WeatherTarget = {
  district: string;
  state: string;
  latitude: number;
  longitude: number;
};

export type WeatherIngestionReport = {
  districts: number;
  inserted: number;
  skipped: { reason: string; count: number }[];
  failures: { district: string; reason: string }[];
};

/** One representative coordinate per district that at least one farm sits in. */
export async function findWeatherTargets(db: SupabaseClient): Promise<WeatherTarget[]> {
  const { data, error } = await db
    .from('farms')
    .select('district, state, centroid_lat, centroid_lng')
    .not('district', 'is', null)
    .not('state', 'is', null);

  if (error) throw new Error(`Could not read farm districts: ${error.message}`);

  const byDistrict = new Map<string, WeatherTarget>();

  for (const row of data ?? []) {
    const district = String(row.district);
    const state = String(row.state);
    const key = `${state}|${district}`.toLowerCase();
    if (byDistrict.has(key)) continue;

    const latitude = Number(row.centroid_lat);
    const longitude = Number(row.centroid_lng);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;

    byDistrict.set(key, { district, state, latitude, longitude });
  }

  return [...byDistrict.values()];
}

/** Store one district's observations. Exported so a test can drive it directly. */
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
      district: target.district,
      state: target.state,
      observed_on: row.observed_on,
      temperature_c: row.temperature_c,
      rainfall_mm: row.rainfall_mm,
      humidity_pct: row.humidity_pct,
      source,
    })),
    { onConflict: 'district,state,observed_on', count: 'exact' },
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
 * Fetch and store recent observations for every district a farm sits in.
 *
 * The window starts a few days back because the ERA5 archive lags real time.
 * A district whose fetch fails is reported and skipped — one bad district never
 * aborts the run, and a total provider outage simply writes nothing.
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
        latitude: target.latitude,
        longitude: target.longitude,
        startDate: isoDaysAgo(days),
        // The archive trails live time; asking for today returns nulls.
        endDate: isoDaysAgo(5),
      });

      const result = await ingestWeatherPayload(target, payload, { db });
      report.inserted += result.inserted;

      for (const { reason, count } of result.skipped) {
        skipTally.set(reason, (skipTally.get(reason) ?? 0) + count);
      }
    } catch (error) {
      report.failures.push({
        district: `${target.state} / ${target.district}`,
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }

  report.skipped = [...skipTally.entries()].map(([reason, count]) => ({ reason, count }));
  return report;
}
