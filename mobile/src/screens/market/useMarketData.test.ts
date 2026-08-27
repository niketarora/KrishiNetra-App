import type { MarketPrice, Msp } from '@/services/agronomy';

import { compareToMsp } from './useMarketData';

function price(modal: number): MarketPrice {
  return {
    id: 'price-1',
    price_date: '2026-08-24',
    min_price: null,
    max_price: null,
    modal_price: modal,
    arrivals_tonnes: null,
    source: 'data.gov.in AGMARKNET',
    mandis: { code: 'RJ-ALWAR' },
  };
}

const msp: Msp = {
  id: 'msp-1',
  crop_id: 'crop-wheat',
  season: 'rabi',
  marketing_year: '2025-26',
  price_per_quintal: 2425,
  effective_from: '2025-04-01',
  source: 'Government of India MSP, RMS 2025-26 (CACP/CCEA)',
};

describe('compareToMsp', () => {
  it('reports how far above the support price the mandi paid', () => {
    expect(compareToMsp(price(2500), msp)).toBe(75);
  });

  it('reports a shortfall as a negative number', () => {
    // The case that matters most to a farmer: the mandi is paying under the
    // guaranteed floor, and they should be able to see it at a glance.
    expect(compareToMsp(price(2300), msp)).toBe(-125);
  });

  it('reports exactly zero at the support price', () => {
    expect(compareToMsp(price(2425), msp)).toBe(0);
  });

  it('returns null when either side is missing', () => {
    // No comparison is possible, and a zero here would read as "level with
    // MSP" — a claim about the market that nothing supports.
    expect(compareToMsp(null, msp)).toBeNull();
    expect(compareToMsp(price(2500), null)).toBeNull();
    expect(compareToMsp(null, null)).toBeNull();
  });

  it('is arithmetic on two recorded numbers, not a prediction', () => {
    // Guards the intent: this compares what the mandi actually paid against a
    // published rate. It must never be extended into a forecast.
    const gap = compareToMsp(price(2500), msp);
    expect(gap).toBe(2500 - msp.price_per_quintal);
  });
});
