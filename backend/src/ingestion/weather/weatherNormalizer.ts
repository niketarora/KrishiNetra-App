/**
 * Turns an Open-Meteo daily response into `weather` rows — or rejects it.
 *
 * Pure, no network, for the same reason as the market normalizer: every rule in
 * IMPLEMENTATION_PHASE2_5.md §3 is checkable here without a provider.
 *
 * The rule this file exists to enforce is §3.2: **observed weather only**. A
 * dated-in-the-future reading is a forecast, and a forecast in this table would
 * silently turn a prediction into a recorded fact. Every such row is dropped,
 * loudly, with a reason.
 */

export type RawWeatherResponse = {
  daily?: {
    time?: unknown;
    temperature_2m_mean?: unknown;
    precipitation_sum?: unknown;
    relative_humidity_2m_mean?: unknown;
  };
};

export type NormalizedWeather = {
  observed_on: string;
  temperature_c: number | null;
  rainfall_mm: number | null;
  humidity_pct: number | null;
};

export type NormalizeWeatherResult = {
  rows: NormalizedWeather[];
  skipped: { reason: string; count: number }[];
};

/** A provider number, or null. Never zero-as-a-fallback. */
function numberAt(series: unknown, index: number): number | null {
  if (!Array.isArray(series)) return null;
  const value = series[index];
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isIsoDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function normalizeWeatherResponse(
  payload: RawWeatherResponse,
  options: { today?: Date } = {},
): NormalizeWeatherResult {
  const times = payload.daily?.time;
  const rows: NormalizedWeather[] = [];
  const reasons = new Map<string, number>();
  const skip = (reason: string) => reasons.set(reason, (reasons.get(reason) ?? 0) + 1);

  if (!Array.isArray(times)) {
    return { rows, skipped: [{ reason: 'response had no daily.time array', count: 1 }] };
  }

  const todayIso = (options.today ?? new Date()).toISOString().slice(0, 10);

  for (let index = 0; index < times.length; index += 1) {
    const observed_on = times[index];

    if (!isIsoDate(observed_on)) {
      skip('unparseable date');
      continue;
    }

    // §3.2. The archive endpoint should never return these; if the caller ever
    // points this at the forecast endpoint by mistake, the rows stop here
    // rather than entering the observed table.
    if (observed_on > todayIso) {
      skip('forecast date rejected from observed weather');
      continue;
    }

    const temperature_c = numberAt(payload.daily?.temperature_2m_mean, index);

    const rainfallRaw = numberAt(payload.daily?.precipitation_sum, index);
    // Negative rainfall is physically impossible: treat it as a provider error
    // and drop the value rather than clamping it to zero, which would assert a
    // dry day the provider never reported.
    const rainfall_mm = rainfallRaw !== null && rainfallRaw >= 0 ? rainfallRaw : null;
    if (rainfallRaw !== null && rainfallRaw < 0) skip('negative rainfall discarded');

    const humidityRaw = numberAt(payload.daily?.relative_humidity_2m_mean, index);
    const humidity_pct = humidityRaw !== null && humidityRaw >= 0 && humidityRaw <= 100 ? humidityRaw : null;
    if (humidityRaw !== null && (humidityRaw < 0 || humidityRaw > 100)) {
      skip('humidity outside 0-100 discarded');
    }

    // A row with a date but no measurements at all says nothing. Storing it
    // would make the API report "weather available" with three em dashes.
    if (temperature_c === null && rainfall_mm === null && humidity_pct === null) {
      skip('no measurements for this date');
      continue;
    }

    rows.push({ observed_on, temperature_c, rainfall_mm, humidity_pct });
  }

  return {
    rows,
    skipped: [...reasons.entries()].map(([reason, count]) => ({ reason, count })),
  };
}
