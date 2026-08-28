import { describe, expect, it } from '@jest/globals';

import {
  normalizeMarketRecord,
  normalizeMarketRecords,
  parseObservationDate,
  parsePrice,
} from './marketNormalizer.js';

/**
 * The checklist in IMPLEMENTATION_PHASE2_5.md §11, expressed as tests.
 *
 * The point of every case below is the same: the ingester must never turn an
 * absent or invalid provider value into a plausible number.
 */

const TODAY = new Date('2026-08-27T00:00:00Z');

/** A realistic data.gov.in AGMARKNET record. */
function record(overrides: Record<string, unknown> = {}) {
  return {
    state: 'Rajasthan',
    district: 'Alwar',
    market: 'Alwar',
    commodity: 'Wheat',
    variety: 'Dara',
    grade: 'FAQ',
    arrival_date: '20/08/2026',
    min_price: '2400',
    max_price: '2600',
    modal_price: '2500',
    ...overrides,
  };
}

describe('parsePrice', () => {
  it('reads a plain provider string', () => {
    expect(parsePrice('2500')).toBe(2500);
  });

  it('tolerates separators the provider sometimes includes', () => {
    expect(parsePrice(' 2,500 ')).toBe(2500);
    expect(parsePrice('₹2500')).toBe(2500);
  });

  it('treats a non-price as absent rather than zero', () => {
    // This is the single most important line in the file. Returning 0 here
    // would put a free wheat crop in front of a farmer.
    expect(parsePrice('NA')).toBeNull();
    expect(parsePrice('')).toBeNull();
    expect(parsePrice('-')).toBeNull();
    expect(parsePrice(undefined)).toBeNull();
    expect(parsePrice('abc')).toBeNull();
  });

  it('rejects zero and negative prices', () => {
    expect(parsePrice('0')).toBeNull();
    expect(parsePrice('-100')).toBeNull();
  });
});

describe('parseObservationDate', () => {
  it('reads the provider dd/mm/yyyy format', () => {
    expect(parseObservationDate('20/08/2026')).toBe('2026-08-20');
    expect(parseObservationDate('5/8/2026')).toBe('2026-08-05');
  });

  it('accepts ISO, which some resources use', () => {
    expect(parseObservationDate('2026-08-20')).toBe('2026-08-20');
  });

  it('does not silently misread day and month', () => {
    // 20 cannot be a month, so this can only be dd/mm — a parser that assumed
    // mm/dd would shift every Indian observation by months.
    expect(parseObservationDate('20/08/2026')).toBe('2026-08-20');
  });

  it('rejects impossible dates instead of rolling them forward', () => {
    expect(parseObservationDate('31/02/2026')).toBeNull();
  });

  it('rejects unparseable values', () => {
    expect(parseObservationDate('yesterday')).toBeNull();
    expect(parseObservationDate('')).toBeNull();
  });
});

describe('normalizeMarketRecord', () => {
  it('normalises a well-formed record', () => {
    const result = normalizeMarketRecord(record(), { today: TODAY });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value).toMatchObject({
      mandiName: 'Alwar',
      district: 'Alwar',
      state: 'Rajasthan',
      cropName: 'Wheat',
      variety: 'Dara',
      grade: 'FAQ',
      price_date: '2026-08-20',
      min_price: 2400,
      max_price: 2600,
      modal_price: 2500,
    });
  });

  it('preserves the observation date rather than stamping today', () => {
    const result = normalizeMarketRecord(record({ arrival_date: '02/03/2026' }), { today: TODAY });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.price_date).toBe('2026-03-02');
  });

  it('reads field names case-insensitively across provider versions', () => {
    const result = normalizeMarketRecord(
      { State: 'Rajasthan', District: 'Kota', Market: 'Kota', Commodity: 'Wheat',
        Arrival_Date: '20/08/2026', Modal_Price: '2500' },
      { today: TODAY },
    );

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.mandiName).toBe('Kota');
  });

  it('rejects a record with no modal price', () => {
    const result = normalizeMarketRecord(record({ modal_price: '' }), { today: TODAY });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/modal price/);
  });

  it('rejects min above modal', () => {
    const result = normalizeMarketRecord(record({ min_price: '2600', modal_price: '2500' }), {
      today: TODAY,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/min price above modal/);
  });

  it('rejects max below modal', () => {
    const result = normalizeMarketRecord(record({ max_price: '2400', modal_price: '2500' }), {
      today: TODAY,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/max price below modal/);
  });

  it('keeps a missing min or max null instead of copying the modal price', () => {
    const result = normalizeMarketRecord(record({ min_price: 'NA', max_price: '' }), {
      today: TODAY,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.min_price).toBeNull();
    expect(result.value.max_price).toBeNull();
    expect(result.value.modal_price).toBe(2500);
  });

  it('leaves arrivals null when the provider does not send them', () => {
    // The AGMARKNET daily-price resource carries no arrivals column. Guessing
    // one from anything else would be fabricated supply data.
    const result = normalizeMarketRecord(record(), { today: TODAY });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.arrivals_tonnes).toBeNull();
  });

  it('refuses an observation dated in the future', () => {
    const result = normalizeMarketRecord(record({ arrival_date: '01/12/2026' }), { today: TODAY });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/future/);
  });

  it('rejects a record missing its mandi or commodity', () => {
    expect(normalizeMarketRecord(record({ market: '' }), { today: TODAY }).ok).toBe(false);
    expect(normalizeMarketRecord(record({ commodity: '' }), { today: TODAY }).ok).toBe(false);
  });
});

describe('normalizeMarketRecords', () => {
  it('keeps the good rows and reports why the rest were dropped', () => {
    const result = normalizeMarketRecords(
      [record(), record({ modal_price: '' }), record({ modal_price: 'NA' })],
      { today: TODAY },
    );

    expect(result.rows).toHaveLength(1);
    expect(result.skipped).toEqual([
      { reason: 'missing or invalid modal price', count: 2 },
    ]);
  });

  it('produces nothing at all from an empty provider response', () => {
    // A provider outage must leave the table untouched, not partly filled.
    expect(normalizeMarketRecords([], { today: TODAY })).toEqual({ rows: [], skipped: [] });
  });
});
