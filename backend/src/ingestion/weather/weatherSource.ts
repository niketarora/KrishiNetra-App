import { getEnv } from '../../config/env.js';

import type { RawWeatherResponse } from './weatherNormalizer.js';

/**
 * Fetches observed daily weather from Open-Meteo's archive endpoint.
 *
 * The archive API is reanalysis of what actually happened, which is what the
 * `weather` table stores. The forecast endpoint is deliberately not used here:
 * §3.2 requires observed and forecast to stay in separate tables, and the
 * cleanest way to guarantee that is never to fetch a forecast in the first
 * place. The normalizer rejects future dates as a second line of defence.
 *
 * Open-Meteo needs no API key, so there is no secret on this path at all.
 */

export class WeatherSourceError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message, { cause });
    this.name = 'WeatherSourceError';
  }
}

export function weatherSourceLabel(fetchedAt = new Date()): string {
  return `Open-Meteo ERA5 archive, fetched ${fetchedAt.toISOString().slice(0, 10)}`;
}

export type WeatherWindow = {
  latitude: number;
  longitude: number;
  startDate: string;
  endDate: string;
};

export async function fetchObservedWeather(
  window: WeatherWindow,
  options: { timeoutMs?: number } = {},
): Promise<RawWeatherResponse> {
  const env = getEnv();

  const url = new URL(env.WEATHER_API_URL);
  url.searchParams.set('latitude', String(window.latitude));
  url.searchParams.set('longitude', String(window.longitude));
  url.searchParams.set('start_date', window.startDate);
  url.searchParams.set('end_date', window.endDate);
  url.searchParams.set(
    'daily',
    'temperature_2m_mean,precipitation_sum,relative_humidity_2m_mean,wind_speed_10m_max',
  );
  url.searchParams.set('timezone', 'UTC');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 30_000);

  try {
    let response: Response;
    try {
      response = await fetch(url, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });
    } catch (cause) {
      throw new WeatherSourceError('Could not reach Open-Meteo', cause);
    }

    if (!response.ok) {
      throw new WeatherSourceError(`Open-Meteo returned HTTP ${response.status}`);
    }

    try {
      return (await response.json()) as RawWeatherResponse;
    } catch (cause) {
      throw new WeatherSourceError('Open-Meteo returned a body that is not JSON', cause);
    }
  } finally {
    clearTimeout(timeout);
  }
}

export type LiveWeatherData = {
  temperature_c: number | null;
  humidity_pct: number | null;
  rainfall_mm: number | null;
  wind_speed_kmh: number | null;
  weather_code: number | null;
  condition: string;
  observed_on: string;
};

export function getWeatherConditionText(code: number | null | undefined): string {
  if (code === null || code === undefined) return 'Clear';
  if (code === 0) return 'Clear sky';
  if (code === 1) return 'Mainly clear';
  if (code === 2) return 'Partly cloudy';
  if (code === 3) return 'Overcast';
  if (code === 45 || code === 48) return 'Fog';
  if (code >= 51 && code <= 55) return 'Drizzle';
  if (code >= 61 && code <= 65) return 'Rain';
  if (code >= 71 && code <= 75) return 'Snow';
  if (code >= 80 && code <= 82) return 'Rain showers';
  if (code >= 95 && code <= 99) return 'Thunderstorm';
  return 'Clear';
}

/**
 * Fetches real-time current weather from Open-Meteo's live forecast endpoint.
 */
export async function fetchLiveWeather(
  latitude: number,
  longitude: number,
  options: { timeoutMs?: number } = {},
): Promise<LiveWeatherData> {
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', String(latitude));
  url.searchParams.set('longitude', String(longitude));
  url.searchParams.set(
    'current',
    'temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m',
  );
  url.searchParams.set('timezone', 'auto');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 10_000);

  try {
    let response: Response;
    try {
      response = await fetch(url, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });
    } catch (cause) {
      throw new WeatherSourceError('Could not reach Open-Meteo live endpoint', cause);
    }

    if (!response.ok) {
      throw new WeatherSourceError(`Open-Meteo live endpoint returned HTTP ${response.status}`);
    }

    const data = (await response.json()) as {
      current?: {
        time?: string;
        temperature_2m?: number;
        relative_humidity_2m?: number;
        precipitation?: number;
        weather_code?: number;
        wind_speed_10m?: number;
      };
    };

    const cur = data.current;
    const weatherCode = cur?.weather_code ?? null;
    const nowIso = new Date().toISOString().slice(0, 10);

    return {
      temperature_c: cur?.temperature_2m !== undefined ? cur.temperature_2m : null,
      humidity_pct: cur?.relative_humidity_2m !== undefined ? cur.relative_humidity_2m : null,
      rainfall_mm: cur?.precipitation !== undefined ? cur.precipitation : null,
      wind_speed_kmh: cur?.wind_speed_10m !== undefined ? cur.wind_speed_10m : null,
      weather_code: weatherCode,
      condition: getWeatherConditionText(weatherCode),
      observed_on: cur?.time ? cur.time.slice(0, 10) : nowIso,
    };
  } finally {
    clearTimeout(timeout);
  }
}
