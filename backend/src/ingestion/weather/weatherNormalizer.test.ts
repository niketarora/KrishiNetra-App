import { describe, expect, it } from '@jest/globals';

import { normalizeWeatherResponse } from './weatherNormalizer.js';

const TODAY = new Date('2026-08-27T00:00:00Z');

function daily(overrides: Record<string, unknown> = {}) {
  return {
    daily: {
      time: ['2026-08-20', '2026-08-21'],
      temperature_2m_mean: [31.4, 30.1],
      precipitation_sum: [0, 12.5],
      relative_humidity_2m_mean: [48, 62],
      ...overrides,
    },
  };
}

describe('normalizeWeatherResponse', () => {
  it('normalises a well-formed provider response', () => {
    const { rows, skipped } = normalizeWeatherResponse(daily(), { today: TODAY });

    expect(skipped).toEqual([]);
    expect(rows).toEqual([
      { observed_on: '2026-08-20', temperature_c: 31.4, rainfall_mm: 0, humidity_pct: 48 },
      { observed_on: '2026-08-21', temperature_c: 30.1, rainfall_mm: 12.5, humidity_pct: 62 },
    ]);
  });

  it('preserves each observation date', () => {
    const { rows } = normalizeWeatherResponse(daily(), { today: TODAY });

    expect(rows.map((row) => row.observed_on)).toEqual(['2026-08-20', '2026-08-21']);
  });

  it('keeps a genuine zero rainfall, which is a real measurement', () => {
    const { rows } = normalizeWeatherResponse(daily(), { today: TODAY });

    // Zero is data: it means a dry day was recorded. Only *absent* is null.
    expect(rows[0]?.rainfall_mm).toBe(0);
  });

  it('discards negative rainfall rather than clamping it to zero', () => {
    // Clamping would assert a dry day the provider never reported.
    const { rows, skipped } = normalizeWeatherResponse(
      daily({ precipitation_sum: [-3, 12.5] }),
      { today: TODAY },
    );

    expect(rows[0]?.rainfall_mm).toBeNull();
    expect(skipped).toContainEqual({ reason: 'negative rainfall discarded', count: 1 });
  });

  it('discards humidity outside 0-100', () => {
    const { rows, skipped } = normalizeWeatherResponse(
      daily({ relative_humidity_2m_mean: [140, 62] }),
      { today: TODAY },
    );

    expect(rows[0]?.humidity_pct).toBeNull();
    expect(skipped).toContainEqual({ reason: 'humidity outside 0-100 discarded', count: 1 });
  });

  it('leaves a measurement null when the provider omitted the series', () => {
    const { rows } = normalizeWeatherResponse(
      daily({ relative_humidity_2m_mean: undefined }),
      { today: TODAY },
    );

    expect(rows[0]?.humidity_pct).toBeNull();
    expect(rows[0]?.temperature_c).toBe(31.4);
  });

  it('refuses to write a forecast into the observed table', () => {
    // The rule from §3.2. A future-dated reading is a prediction, and storing
    // it here would turn it into a recorded fact.
    const { rows, skipped } = normalizeWeatherResponse(
      daily({ time: ['2026-08-20', '2026-09-30'] }),
      { today: TODAY },
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]?.observed_on).toBe('2026-08-20');
    expect(skipped).toContainEqual({
      reason: 'forecast date rejected from observed weather',
      count: 1,
    });
  });

  it('drops a date that carries no measurements at all', () => {
    const { rows, skipped } = normalizeWeatherResponse(
      {
        daily: {
          time: ['2026-08-20'],
          temperature_2m_mean: [null],
          precipitation_sum: [null],
          relative_humidity_2m_mean: [null],
        },
      },
      { today: TODAY },
    );

    // Otherwise the API would report "weather available" and render three
    // em dashes, which reads as broken rather than honest.
    expect(rows).toEqual([]);
    expect(skipped).toContainEqual({ reason: 'no measurements for this date', count: 1 });
  });

  it('produces nothing from a malformed response instead of guessing', () => {
    const { rows, skipped } = normalizeWeatherResponse({}, { today: TODAY });

    expect(rows).toEqual([]);
    expect(skipped).toEqual([{ reason: 'response had no daily.time array', count: 1 }]);
  });
});
