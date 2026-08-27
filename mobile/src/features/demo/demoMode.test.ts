import { isDemoMode, sampleDate, SAMPLE, SAMPLE_HISTORY } from './demoMode';

/**
 * Guards on the flag itself.
 *
 * The risk this module carries is that fabricated values reach a real farmer,
 * so the tests that matter are the ones proving it stays off.
 */

describe('isDemoMode', () => {
  it('is off in the test environment, and therefore off by default', () => {
    // jest.setup.js does not set EXPO_PUBLIC_DEMO_MODE, so this asserts the
    // real default: absent means off.
    expect(isDemoMode()).toBe(false);
  });

  it('is read from the environment, not from a runtime toggle', () => {
    // There is deliberately no setDemoMode(). A flag that can be flipped at
    // runtime is a flag that can be flipped in production.
    const module = require('./demoMode') as Record<string, unknown>;
    expect(module.setDemoMode).toBeUndefined();
    expect(module.enableDemoMode).toBeUndefined();
  });
});

describe('SAMPLE', () => {
  it('exposes translation keys rather than English copy', () => {
    // Sample data has to be as localised as the real thing, or a Hindi demo
    // switches to English exactly where it is claiming to be an illustration.
    const keys = [
      SAMPLE.cropHealth.valueKey,
      SAMPLE.cropHealth.noteKey,
      SAMPLE.growthStage.valueKey,
      SAMPLE.growthStage.noteKey,
      SAMPLE.recommendation.verdictKey,
      SAMPLE.recommendation.bodyKey,
    ];

    for (const key of keys) {
      expect(key).toMatch(/^demo\./);
    }
  });
});

describe('SAMPLE_HISTORY', () => {
  it('dates every entry relative to today, so the timeline never goes stale', () => {
    for (const entry of SAMPLE_HISTORY) {
      expect(entry.daysAgo).toBeGreaterThan(0);
    }
  });

  it('reads oldest-first, as a season actually happened', () => {
    const offsets = SAMPLE_HISTORY.map((entry) => entry.daysAgo);
    const descending = [...offsets].sort((a, b) => b - a);

    expect(offsets).toEqual(descending);
  });

  it('uses translation keys for every string', () => {
    for (const entry of SAMPLE_HISTORY) {
      expect(entry.titleKey).toMatch(/^demo\.history\./);
      expect(entry.detailKey).toMatch(/^demo\.history\./);
    }
  });
});

describe('sampleDate', () => {
  it('counts back from the given day', () => {
    const from = new Date('2026-08-27T00:00:00Z');

    expect(sampleDate(3, from).toISOString().slice(0, 10)).toBe('2026-08-24');
    expect(sampleDate(96, from).toISOString().slice(0, 10)).toBe('2026-05-23');
  });
});
