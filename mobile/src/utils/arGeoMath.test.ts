import {
  directionHintFor,
  gpsQualityFromAccuracy,
  haversineDistanceMeters,
  headingQualityFromAccuracy,
  initialBearingDegrees,
  relativeBearingDegrees,
  roundDistanceForDisplay,
} from './arGeoMath';

describe('haversineDistanceMeters', () => {
  it('is zero for the same point', () => {
    expect(haversineDistanceMeters({ latitude: 26.76, longitude: 83.37 }, { latitude: 26.76, longitude: 83.37 })).toBeCloseTo(0, 3);
  });

  it('matches a known short distance (~28m due north)', () => {
    // ~0.00025 degrees latitude ≈ 28m at this latitude.
    const a = { latitude: 26.7600, longitude: 83.3700 };
    const b = { latitude: 26.76025, longitude: 83.3700 };
    const distance = haversineDistanceMeters(a, b);
    expect(distance).toBeGreaterThan(25);
    expect(distance).toBeLessThan(31);
  });
});

describe('initialBearingDegrees', () => {
  it('is ~0° (north) when the target is due north', () => {
    const bearing = initialBearingDegrees({ latitude: 26.76, longitude: 83.37 }, { latitude: 26.77, longitude: 83.37 });
    expect(bearing).toBeCloseTo(0, 0);
  });

  it('is ~90° (east) when the target is due east', () => {
    const bearing = initialBearingDegrees({ latitude: 26.76, longitude: 83.37 }, { latitude: 26.76, longitude: 83.38 });
    expect(bearing).toBeCloseTo(90, 0);
  });

  it('is ~180° (south) when the target is due south', () => {
    const bearing = initialBearingDegrees({ latitude: 26.76, longitude: 83.37 }, { latitude: 26.75, longitude: 83.37 });
    expect(bearing).toBeCloseTo(180, 0);
  });
});

describe('relativeBearingDegrees', () => {
  it('is 0 when facing directly at the target', () => {
    expect(relativeBearingDegrees(90, 90)).toBe(0);
  });

  it('is positive (right) when the target is clockwise of heading', () => {
    expect(relativeBearingDegrees(100, 90)).toBe(10);
  });

  it('is negative (left) when the target is counter-clockwise of heading', () => {
    expect(relativeBearingDegrees(80, 90)).toBe(-10);
  });

  it('wraps correctly across the 0/360 boundary', () => {
    expect(relativeBearingDegrees(10, 350)).toBe(20);
  });
});

describe('directionHintFor', () => {
  it('is "ahead" near 0°', () => {
    expect(directionHintFor(5)).toBe('ahead');
    expect(directionHintFor(-5)).toBe('ahead');
  });

  it('is "right" for a positive relative bearing outside the ahead cone', () => {
    expect(directionHintFor(60)).toBe('right');
  });

  it('is "left" for a negative relative bearing outside the ahead cone', () => {
    expect(directionHintFor(-60)).toBe('left');
  });

  it('is "behind" near ±180°', () => {
    expect(directionHintFor(170)).toBe('behind');
    expect(directionHintFor(-170)).toBe('behind');
  });
});

describe('gpsQualityFromAccuracy', () => {
  it('buckets tight accuracy as good', () => {
    expect(gpsQualityFromAccuracy(5)).toBe('good');
  });
  it('buckets moderate accuracy as fair', () => {
    expect(gpsQualityFromAccuracy(15)).toBe('fair');
  });
  it('buckets loose accuracy as poor', () => {
    expect(gpsQualityFromAccuracy(50)).toBe('poor');
  });
  it('is unknown when accuracy is missing', () => {
    expect(gpsQualityFromAccuracy(null)).toBe('unknown');
  });
});

describe('headingQualityFromAccuracy', () => {
  it('maps expo-location\'s 3/2/1/0 scale to good/fair/poor/unavailable', () => {
    expect(headingQualityFromAccuracy(3)).toBe('good');
    expect(headingQualityFromAccuracy(2)).toBe('fair');
    expect(headingQualityFromAccuracy(1)).toBe('poor');
    expect(headingQualityFromAccuracy(0)).toBe('unavailable');
  });
  it('is unavailable when accuracy is missing entirely', () => {
    expect(headingQualityFromAccuracy(null)).toBe('unavailable');
  });
});

describe('roundDistanceForDisplay — never claims more precision than GPS actually has', () => {
  it('rounds to the nearest meter only with a tight GPS fix', () => {
    expect(roundDistanceForDisplay(24.3, 3)).toBe(24);
  });

  it('rounds to the nearest 5m with a moderate GPS fix', () => {
    expect(roundDistanceForDisplay(24.3, 8)).toBe(25);
  });

  it('rounds to the nearest 10m with a poor/unknown GPS fix — no false "24.3m" precision', () => {
    expect(roundDistanceForDisplay(24.3, 15)).toBe(20);
    expect(roundDistanceForDisplay(24.3, null)).toBe(20);
  });
});
