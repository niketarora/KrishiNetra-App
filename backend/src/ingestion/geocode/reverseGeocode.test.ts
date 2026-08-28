import { describe, expect, it } from '@jest/globals';

import { districtFromAddress, stateFromAddress } from './reverseGeocode.js';

/**
 * Reading a district out of a Nominatim address.
 *
 * The name has to match what `mandis.district` and `weather.district` already
 * store, because a near-miss ("Alwar District" vs "Alwar") silently produces a
 * farm whose weather never resolves.
 */

describe('districtFromAddress', () => {
  it('prefers state_district, which is what Nominatim uses in India', () => {
    expect(districtFromAddress({ state_district: 'Alwar', county: 'Something Else' })).toBe('Alwar');
  });

  it('falls back to county when there is no state_district', () => {
    expect(districtFromAddress({ county: 'Kota' })).toBe('Kota');
  });

  it('strips a trailing "District" so the name matches the reference tables', () => {
    expect(districtFromAddress({ state_district: 'Alwar District' })).toBe('Alwar');
    expect(districtFromAddress({ state_district: 'Bharatpur district' })).toBe('Bharatpur');
  });

  it('returns null rather than a guess when the address has no district', () => {
    expect(districtFromAddress({ state: 'Rajasthan' })).toBeNull();
    expect(districtFromAddress({})).toBeNull();
    expect(districtFromAddress(undefined)).toBeNull();
  });

  it('treats a blank district as absent', () => {
    expect(districtFromAddress({ state_district: '   ' })).toBeNull();
  });
});

describe('stateFromAddress', () => {
  it('reads the state', () => {
    expect(stateFromAddress({ state: 'Rajasthan' })).toBe('Rajasthan');
  });

  it('returns null when absent or blank', () => {
    expect(stateFromAddress({})).toBeNull();
    expect(stateFromAddress({ state: '' })).toBeNull();
    expect(stateFromAddress(undefined)).toBeNull();
  });
});
