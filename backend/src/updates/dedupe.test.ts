import { describe, expect, it } from '@jest/globals';

import { dedupeUpdates } from './dedupe.js';
import type { KrishiUpdate } from './types.js';

function update(overrides: Partial<KrishiUpdate>): KrishiUpdate {
  return {
    id: overrides.id ?? 'u1',
    title: overrides.title ?? 'A title',
    category: 'agriculture',
    source: { name: 'example.com', type: 'reported' },
    sourceUrl: overrides.sourceUrl ?? 'https://example.com/a',
    publishedAt: new Date().toISOString(),
    relevance: { score: 0, reasons: [] },
    ...overrides,
  };
}

describe('dedupeUpdates', () => {
  it('keeps distinct updates', () => {
    const result = dedupeUpdates([
      update({ id: 'a', sourceUrl: 'https://a.com/1', title: 'Flood in Gorakhpur' }),
      update({ id: 'b', sourceUrl: 'https://b.com/2', title: 'Wheat MSP raised' }),
    ]);

    expect(result).toHaveLength(2);
  });

  it('drops an exact-URL duplicate, keeping the first', () => {
    const result = dedupeUpdates([
      update({ id: 'a', sourceUrl: 'https://example.com/story' }),
      update({ id: 'b', sourceUrl: 'https://example.com/story' }),
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe('a');
  });

  it('treats a trailing slash and case difference as the same URL', () => {
    const result = dedupeUpdates([
      update({ id: 'a', sourceUrl: 'https://Example.com/Story' }),
      update({ id: 'b', sourceUrl: 'https://example.com/Story/' }),
    ]);

    expect(result).toHaveLength(1);
  });

  it('drops a syndicated duplicate with a different URL but the same normalized title', () => {
    const result = dedupeUpdates([
      update({ id: 'a', sourceUrl: 'https://siteA.com/story-1', title: 'Wheat MSP raised by Rs 150' }),
      update({ id: 'b', sourceUrl: 'https://siteB.com/story-2', title: 'Wheat MSP raised by Rs 150' }),
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe('a');
  });

  it('ignores punctuation/case when comparing titles', () => {
    const result = dedupeUpdates([
      update({ id: 'a', sourceUrl: 'https://siteA.com/1', title: 'Flood Warning: Gorakhpur District' }),
      update({ id: 'b', sourceUrl: 'https://siteB.com/2', title: 'flood warning gorakhpur district' }),
    ]);

    expect(result).toHaveLength(1);
  });

  it('does not merge two genuinely different stories that happen to share a domain', () => {
    const result = dedupeUpdates([
      update({ id: 'a', sourceUrl: 'https://siteA.com/story-1', title: 'Flood in Gorakhpur' }),
      update({ id: 'b', sourceUrl: 'https://siteA.com/story-2', title: 'Wheat MSP raised' }),
    ]);

    expect(result).toHaveLength(2);
  });
});
