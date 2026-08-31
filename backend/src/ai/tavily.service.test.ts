import { describe, expect, it } from '@jest/globals';

import { parseTavilyResult } from './tavily.service.js';

describe('parseTavilyResult', () => {
  it('reads the answer and its sources', () => {
    expect(
      parseTavilyResult({
        answer: 'The subsidy covers 60% of the pump cost.',
        results: [
          { title: 'PM-KUSUM scheme', url: 'https://example.gov.in/kusum', content: '…' },
          { title: 'State portal', url: 'https://example.gov.in/state' },
        ],
      }),
    ).toEqual({
      answer: 'The subsidy covers 60% of the pump cost.',
      sources: [
        { title: 'PM-KUSUM scheme', url: 'https://example.gov.in/kusum' },
        { title: 'State portal', url: 'https://example.gov.in/state' },
      ],
    });
  });

  it('keeps an answer that came back with no sources', () => {
    // Uncited is weaker, but it is still an answer. Discarding it would leave
    // the farmer with silence instead.
    expect(parseTavilyResult({ answer: 'Yes.', results: [] })).toEqual({
      answer: 'Yes.',
      sources: [],
    });
    expect(parseTavilyResult({ answer: 'Yes.' })?.sources).toEqual([]);
  });

  it('drops a result with no URL, because it cannot be checked', () => {
    const result = parseTavilyResult({
      answer: 'Something.',
      results: [{ title: 'No link here' }, { title: 'Real', url: 'https://example.gov.in' }, null],
    });

    expect(result?.sources).toEqual([{ title: 'Real', url: 'https://example.gov.in' }]);
  });

  it('falls back to the URL when a result has no title', () => {
    expect(
      parseTavilyResult({ answer: 'x', results: [{ url: 'https://example.gov.in/a' }] })?.sources,
    ).toEqual([{ title: 'https://example.gov.in/a', url: 'https://example.gov.in/a' }]);
  });

  it('returns null when there is no usable answer', () => {
    // The caller reports the service as unhelpful; it must not speak an empty
    // string at the farmer as though it had replied.
    expect(parseTavilyResult({ answer: '   ', results: [] })).toBeNull();
    expect(parseTavilyResult({ results: [] })).toBeNull();
    expect(parseTavilyResult({})).toBeNull();
    expect(parseTavilyResult(null)).toBeNull();
    expect(parseTavilyResult('an answer')).toBeNull();
  });
});
