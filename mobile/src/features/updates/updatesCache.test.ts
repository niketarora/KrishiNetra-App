import type { KrishiUpdate } from './types';
import { cacheUpdates, getCachedUpdate } from './updatesCache';

function update(overrides: Partial<KrishiUpdate> = {}): KrishiUpdate {
  return {
    id: 'u1',
    title: 'A title',
    category: 'agriculture',
    source: { name: 'example.com', type: 'reported' },
    sourceUrl: 'https://example.com/a',
    publishedAt: new Date().toISOString(),
    relevance: { score: 0, reasons: [] },
    ...overrides,
  };
}

describe('updatesCache', () => {
  it('returns null for an id that was never cached', () => {
    expect(getCachedUpdate('never-seen')).toBeNull();
  });

  it('returns a cached update by id', () => {
    cacheUpdates([update({ id: 'cache-test-1', title: 'Cached story' })]);

    expect(getCachedUpdate('cache-test-1')?.title).toBe('Cached story');
  });

  it('overwrites a stale entry with the latest fetch for the same id', () => {
    cacheUpdates([update({ id: 'cache-test-2', title: 'Old title' })]);
    cacheUpdates([update({ id: 'cache-test-2', title: 'New title' })]);

    expect(getCachedUpdate('cache-test-2')?.title).toBe('New title');
  });
});
