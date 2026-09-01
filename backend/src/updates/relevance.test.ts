import { describe, expect, it } from '@jest/globals';

import { distanceBand, haversineKm, scoreUpdate } from './relevance.js';
import type { KrishiUpdate } from './types.js';

const FARM = { district: 'Gorakhpur', state: 'Uttar Pradesh', cropName: 'Wheat', farmLat: 26.7606, farmLng: 83.3732 };

function baseUpdate(overrides: Partial<KrishiUpdate> = {}): KrishiUpdate {
  return {
    id: 'u1',
    title: 'Some article',
    category: 'agriculture',
    source: { name: 'example.com', type: 'reported' },
    sourceUrl: 'https://example.com/a',
    publishedAt: new Date().toISOString(),
    relevance: { score: 0, reasons: [] },
    ...overrides,
  };
}

describe('haversineKm', () => {
  it('is zero for the same point', () => {
    expect(haversineKm({ lat: 26.76, lng: 83.37 }, { lat: 26.76, lng: 83.37 })).toBeCloseTo(0, 5);
  });

  it('matches a known distance (Delhi to Mumbai, ~1150km great-circle)', () => {
    const delhi = { lat: 28.6139, lng: 77.209 };
    const mumbai = { lat: 19.076, lng: 72.8777 };
    const km = haversineKm(delhi, mumbai);
    expect(km).toBeGreaterThan(1100);
    expect(km).toBeLessThan(1200);
  });
});

describe('distanceBand', () => {
  it('bands the prototype thresholds from the product brief', () => {
    expect(distanceBand(50)).toBe('very');
    expect(distanceBand(100)).toBe('very');
    expect(distanceBand(150)).toBe('regional');
    expect(distanceBand(400)).toBe('weak');
    expect(distanceBand(900)).toBe('far');
  });
});

describe('scoreUpdate — location', () => {
  it('scores highest for a real nearby coordinate and reports the real distance', () => {
    const update = baseUpdate({ location: { latitude: 26.8, longitude: 83.4 } });
    const relevance = scoreUpdate(update, FARM);

    expect(relevance.distanceKm).toBeDefined();
    expect(relevance.distanceKm).toBeLessThan(20);
    expect(relevance.reasons.some((r) => r.includes('km from your farm'))).toBe(true);
  });

  it('never invents a distance for an update with no coordinates', () => {
    const update = baseUpdate({ location: { district: 'Gorakhpur' } });
    const relevance = scoreUpdate(update, FARM);

    expect(relevance.distanceKm).toBeUndefined();
  });

  it('rewards a same-district text match without a coordinate', () => {
    const update = baseUpdate({ location: { district: 'Gorakhpur' } });
    const relevance = scoreUpdate(update, FARM);

    expect(relevance.reasons).toContain('Relevant to Gorakhpur');
    expect(relevance.score).toBeGreaterThan(0);
  });

  it('scores a same-state match lower than a same-district match', () => {
    const districtUpdate = scoreUpdate(baseUpdate({ location: { district: 'Gorakhpur' } }), FARM);
    const stateUpdate = scoreUpdate(baseUpdate({ location: { state: 'Uttar Pradesh' } }), FARM);

    expect(stateUpdate.score).toBeLessThan(districtUpdate.score);
  });

  it('gives national policy some relevance without any nearby coordinates', () => {
    const update = baseUpdate({ location: { country: 'India' }, category: 'government' });
    const relevance = scoreUpdate(update, FARM);

    expect(relevance.reasons).toContain('National agriculture update');
    expect(relevance.score).toBeGreaterThan(0);
  });

  it('gives an unrelated location no location credit', () => {
    const update = baseUpdate({ location: { district: 'Alwar', state: 'Rajasthan', country: 'India' } });
    const relevance = scoreUpdate(update, FARM);

    expect(relevance.reasons.some((r) => r.startsWith('Relevant to') || r.startsWith('Regional news'))).toBe(false);
  });
});

describe('scoreUpdate — crop relevance', () => {
  it('rewards a match against the farm’s registered crop', () => {
    const update = baseUpdate({ tags: ['wheat', 'procurement'] });
    const relevance = scoreUpdate(update, FARM);

    expect(relevance.reasons).toContain('Matches your registered crop: Wheat');
  });

  it('does not require a crop tag to score risk/disaster information', () => {
    const update = baseUpdate({ category: 'risk', severity: 'high', tags: ['flood'] });
    const relevance = scoreUpdate(update, { ...FARM, cropName: null });

    expect(relevance.score).toBeGreaterThan(0);
  });

  it('scores a mismatched crop lower than a matching one', () => {
    const matching = scoreUpdate(baseUpdate({ tags: ['wheat'] }), FARM);
    const other = scoreUpdate(baseUpdate({ tags: ['apple'] }), FARM);

    expect(matching.score).toBeGreaterThan(other.score);
  });
});

describe('scoreUpdate — disaster ("why this matters") reasons', () => {
  it('leads with "Official alert for your farm district." for an official district-matching risk update', () => {
    const update = baseUpdate({
      category: 'risk',
      source: { name: 'NDMA SACHET', type: 'official' },
      location: { district: 'Gorakhpur' },
    });
    const relevance = scoreUpdate(update, FARM);

    expect(relevance.reasons[0]).toBe('Official alert for your farm district.');
  });

  it('leads with "Official alert for your state." for an official state-matching risk update', () => {
    const update = baseUpdate({
      category: 'risk',
      source: { name: 'NDMA SACHET', type: 'official' },
      location: { state: 'Uttar Pradesh' },
    });
    const relevance = scoreUpdate(update, FARM);

    expect(relevance.reasons[0]).toBe('Official alert for your state.');
  });

  it('adds a deterministic operational-impact line for a known hazard tag', () => {
    const update = baseUpdate({
      category: 'risk',
      source: { name: 'NDMA SACHET', type: 'official' },
      location: { district: 'Gorakhpur' },
      tags: ['flood'],
    });
    const relevance = scoreUpdate(update, FARM);

    expect(relevance.reasons).toContain('Flooding may affect field access and standing crops.');
  });

  it('does not use the official-alert wording for a reported (non-official) risk story', () => {
    const update = baseUpdate({
      category: 'risk',
      source: { name: 'news.example.com', type: 'reported' },
      location: { district: 'Gorakhpur' },
    });
    const relevance = scoreUpdate(update, FARM);

    expect(relevance.reasons).toContain('Relevant to Gorakhpur');
    expect(relevance.reasons).not.toContain('Official alert for your farm district.');
  });
});

describe('scoreUpdate — agritech reason', () => {
  it('explains why a technology update matters, regardless of location', () => {
    const update = baseUpdate({ category: 'technology', location: { country: 'India' } });
    const relevance = scoreUpdate(update, FARM);

    expect(relevance.reasons).toContain('This update covers a new technology being used in agriculture.');
  });
});

describe('scoreUpdate — source trust', () => {
  it('scores an official source higher than a reported one, all else equal', () => {
    const official = scoreUpdate(
      baseUpdate({ source: { name: 'NDMA SACHET', type: 'official' } }),
      FARM,
    );
    const reported = scoreUpdate(
      baseUpdate({ source: { name: 'example.com', type: 'reported' } }),
      FARM,
    );

    expect(official.reasons).toContain('Official government source');
    expect(official.score).toBeGreaterThan(reported.score);
  });
});

describe('scoreUpdate — recency and severity', () => {
  it('scores a fresh article higher than a week-old one, all else equal', () => {
    const fresh = scoreUpdate(baseUpdate({ publishedAt: new Date().toISOString() }), FARM);
    const stale = scoreUpdate(
      baseUpdate({ publishedAt: new Date(Date.now() - 20 * 24 * 3600 * 1000).toISOString() }),
      FARM,
    );

    expect(fresh.score).toBeGreaterThan(stale.score);
  });

  it('scores a high-severity risk update higher than an info one, all else equal', () => {
    const high = scoreUpdate(baseUpdate({ category: 'risk', severity: 'high' }), FARM);
    const info = scoreUpdate(baseUpdate({ category: 'risk', severity: 'info' }), FARM);

    expect(high.score).toBeGreaterThan(info.score);
  });
});
