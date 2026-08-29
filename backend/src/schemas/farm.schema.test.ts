import { describe, expect, it } from '@jest/globals';

import { boundarySchema, createFarmSchema } from './farm.schema.js';

const closedRing = [
  [75.787, 26.912],
  [75.788, 26.912],
  [75.788, 26.913],
  [75.787, 26.912],
];

const validBody = {
  name: 'North field',
  boundary: { type: 'Polygon', coordinates: [closedRing] },
  area_sq_meters: 11_000,
  area_acres: 2.7181,
  area_hectares: 1.1,
  centroid_lat: 26.9123,
  centroid_lng: 75.7876,
};

describe('boundarySchema', () => {
  it('accepts a closed polygon ring', () => {
    expect(boundarySchema.safeParse(validBody.boundary).success).toBe(true);
  });

  it('rejects a geometry that is not a Polygon', () => {
    const result = boundarySchema.safeParse({ type: 'LineString', coordinates: [closedRing] });
    expect(result.success).toBe(false);
  });

  it('rejects a ring with fewer than four positions', () => {
    const result = boundarySchema.safeParse({
      type: 'Polygon',
      coordinates: [closedRing.slice(0, 3)],
    });
    expect(result.success).toBe(false);
  });

  it('rejects an unclosed ring', () => {
    const open = [
      [75.787, 26.912],
      [75.788, 26.912],
      [75.788, 26.913],
      [75.787, 26.913],
    ];
    const result = boundarySchema.safeParse({ type: 'Polygon', coordinates: [open] });

    expect(result.success).toBe(false);
    expect(JSON.stringify(result)).toMatch(/closed/i);
  });

  it('rejects out-of-range coordinates', () => {
    const result = boundarySchema.safeParse({
      type: 'Polygon',
      coordinates: [[[200, 26.912], [75.788, 26.912], [75.788, 26.913], [200, 26.912]]],
    });
    expect(result.success).toBe(false);
  });

  it('rejects a polygon with holes', () => {
    const result = boundarySchema.safeParse({
      type: 'Polygon',
      coordinates: [closedRing, closedRing],
    });
    expect(result.success).toBe(false);
  });
});

describe('createFarmSchema', () => {
  it('accepts a well-formed body', () => {
    expect(createFarmSchema.safeParse(validBody).success).toBe(true);
  });

  it('refuses a user_id sent in the body', () => {
    // Ownership comes from the verified token. A client that tries to set it
    // gets a 400 rather than having the field silently dropped.
    const result = createFarmSchema.safeParse({
      ...validBody,
      user_id: '00000000-0000-0000-0000-000000000000',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a non-positive area', () => {
    expect(createFarmSchema.safeParse({ ...validBody, area_sq_meters: 0 }).success).toBe(false);
  });

  it('allows a field with no name', () => {
    const { name: _name, ...withoutName } = validBody;
    expect(createFarmSchema.safeParse({ ...withoutName, name: null }).success).toBe(true);
  });

  it('accepts omitted, valid number, or null location_accuracy, but rejects negative or string', () => {
    expect(createFarmSchema.safeParse(validBody).success).toBe(true);
    expect(createFarmSchema.safeParse({ ...validBody, location_accuracy: 12.5 }).success).toBe(true);
    expect(createFarmSchema.safeParse({ ...validBody, location_accuracy: null }).success).toBe(true);
    expect(createFarmSchema.safeParse({ ...validBody, location_accuracy: -5 }).success).toBe(false);
    expect(createFarmSchema.safeParse({ ...validBody, location_accuracy: '12' }).success).toBe(false);
  });
});
