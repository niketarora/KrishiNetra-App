import { describe, expect, it } from '@jest/globals';

import { DEMO_FARMER, rabiSeasons } from './seedDemoFarmer.js';

/**
 * The demo data is fabricated on purpose, but the dates are derived rather than
 * hard-coded so the demo never reads as stale. That derivation is the only real
 * logic in the seeder, so it is the part worth testing.
 */
describe('rabiSeasons', () => {
  it('treats the April harvest as complete once May has started', () => {
    const { lastCompleted } = rabiSeasons(new Date('2026-08-26T00:00:00Z'));

    expect(lastCompleted.sownOn).toBe('2025-11-15');
    expect(lastCompleted.harvestOn).toBe('2026-04-05');
  });

  it('steps back a further year before the harvest has happened', () => {
    // In February the crop sown in Nov 2025 is still in the ground, so the last
    // completed season is the one before it.
    const { lastCompleted } = rabiSeasons(new Date('2026-02-10T00:00:00Z'));

    expect(lastCompleted.sownOn).toBe('2024-11-15');
    expect(lastCompleted.harvestOn).toBe('2025-04-05');
  });

  it('points the upcoming season at this November before sowing starts', () => {
    const { upcoming } = rabiSeasons(new Date('2026-08-26T00:00:00Z'));

    expect(upcoming.sownOn).toBe('2026-11-15');
    expect(upcoming.harvestOn).toBe('2027-04-05');
  });

  it('rolls the upcoming season forward once November has arrived', () => {
    const { upcoming } = rabiSeasons(new Date('2026-11-20T00:00:00Z'));

    expect(upcoming.sownOn).toBe('2027-11-15');
    expect(upcoming.harvestOn).toBe('2028-04-05');
  });

  it('always harvests after sowing, which the farm_crops check constraint requires', () => {
    for (let month = 0; month < 12; month += 1) {
      const today = new Date(Date.UTC(2026, month, 15));
      const { lastCompleted, upcoming } = rabiSeasons(today);

      expect(lastCompleted.harvestOn > lastCompleted.sownOn).toBe(true);
      expect(upcoming.harvestOn > upcoming.sownOn).toBe(true);
      // The finished season must genuinely precede the planned one.
      expect(upcoming.sownOn > lastCompleted.harvestOn).toBe(true);
    }
  });
});

describe('DEMO_FARMER', () => {
  it('uses an address that can never reach a real inbox', () => {
    // RFC 2606 reserves example.com precisely so test data cannot email anyone.
    expect(DEMO_FARMER.email.endsWith('@example.com')).toBe(true);
  });

  it('has a password that clears Supabase default policy', () => {
    expect(DEMO_FARMER.password.length).toBeGreaterThanOrEqual(8);
  });
});
