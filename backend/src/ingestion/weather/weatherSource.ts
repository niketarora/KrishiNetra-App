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
