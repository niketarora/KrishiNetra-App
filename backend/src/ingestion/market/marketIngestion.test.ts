import { describe, expect, it } from '@jest/globals';

import { resolveRows } from './marketIngestion.js';
import type { NormalizedMarketPrice } from './marketNormalizer.js';

/**
 * Resolving provider names to reference-table ids.
 *
 * The rule under test is "map, don't create": ingestion attaches observations
 * to mandis and crops that already exist, and reports anything it cannot place
 * instead of inventing a reference row for it.
 */

const LOOKUPS = {
  mandis: new Map([
    ['alwar', 'mandi-alwar'],
    ['alwar|alwar', 'mandi-alwar'],
    ['kota', 'mandi-kota'],
    ['kota|kota', 'mandi-kota'],
  ]),
  crops: new Map([
    ['wheat', 'crop-wheat'],
    ['gehun', 'crop-wheat'],
  ]),
};

const SOURCE = 'data.gov.in AGMARKNET, fetched 2026-08-27';

function normalized(overrides: Partial<NormalizedMarketPrice> = {}): NormalizedMarketPrice {
  return {
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
    arrivals_tonnes: null,
    ...overrides,
  };
}

describe('resolveRows', () => {
  it('resolves a known mandi and crop to their ids', () => {
    const { resolved, skipped } = resolveRows([normalized()], LOOKUPS, SOURCE);

    expect(skipped).toEqual([]);
    expect(resolved).toHaveLength(1);
    expect(resolved[0]).toMatchObject({
      mandi_id: 'mandi-alwar',
      crop_id: 'crop-wheat',
      price_date: '2026-08-20',
      modal_price: 2500,
    });
  });

  it('stores the source on every row', () => {
    const { resolved } = resolveRows([normalized()], LOOKUPS, SOURCE);

    expect(resolved[0]?.source).toBe(SOURCE);
  });

  it('skips a mandi that is not in the reference data', () => {
    const { resolved, skipped } = resolveRows(
      [normalized({ mandiName: 'Nowhere', district: 'Nowhere' })],
      LOOKUPS,
      SOURCE,
    );

    expect(resolved).toEqual([]);
    expect(skipped[0]?.reason).toMatch(/mandi not in reference data/);
  });

  it('skips a crop that is not in the catalogue', () => {
    const { resolved, skipped } = resolveRows(
      [normalized({ cropName: 'Dragonfruit' })],
      LOOKUPS,
      SOURCE,
    );

    expect(resolved).toEqual([]);
    expect(skipped[0]?.reason).toMatch(/crop not in catalogue/);
  });

  it('prefers a district-qualified match when two mandis share a name', () => {
    const lookups = {
      mandis: new Map([
        ['bassi', 'mandi-jaipur-bassi'],
        ['jaipur|bassi', 'mandi-jaipur-bassi'],
        ['kota|bassi', 'mandi-kota-bassi'],
      ]),
      crops: LOOKUPS.crops,
    };

    const { resolved } = resolveRows(
      [normalized({ mandiName: 'Bassi', district: 'Kota' })],
      lookups,
      SOURCE,
    );

    expect(resolved[0]?.mandi_id).toBe('mandi-kota-bassi');
  });

  it('tallies repeated skip reasons rather than listing each row', () => {
    const { skipped } = resolveRows(
      [
        normalized({ cropName: 'Dragonfruit' }),
        normalized({ cropName: 'Dragonfruit' }),
      ],
      LOOKUPS,
      SOURCE,
    );

    expect(skipped).toHaveLength(1);
    expect(skipped[0]?.count).toBe(2);
  });

  it('carries a null arrivals through unchanged', () => {
    const { resolved } = resolveRows([normalized()], LOOKUPS, SOURCE);

    expect(resolved[0]?.arrivals_tonnes).toBeNull();
  });
});
