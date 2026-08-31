import { describe, expect, it } from '@jest/globals';

import { parseRouterOutput } from './router.service.js';

/**
 * The router's parser decides which pipeline a farmer's question goes down, so
 * the thing it must never do is guess. A payload it cannot read returns null
 * and the caller falls back deliberately; it does not quietly become one of
 * the three intents.
 */

describe('parseRouterOutput', () => {
  it('reads a well-formed navigation classification', () => {
    expect(
      parseRouterOutput({ intent: 'APP_NAVIGATION', target: 'market_price', entities: {} }),
    ).toEqual({ intent: 'APP_NAVIGATION', target: 'market_price', entities: {} });
  });

  it('reads the expert and research intents', () => {
    expect(parseRouterOutput({ intent: 'FARMING_EXPERT', target: null })?.intent).toBe(
      'FARMING_EXPERT',
    );
    expect(parseRouterOutput({ intent: 'DEEP_RESEARCH', target: null })?.intent).toBe(
      'DEEP_RESEARCH',
    );
  });

  it('normalises the target so a lookup can find it', () => {
    expect(parseRouterOutput({ intent: 'APP_NAVIGATION', target: '  Market_Price ' })?.target).toBe(
      'market_price',
    );
  });

  it('treats an absent, blank or stringified-null target as no target', () => {
    expect(parseRouterOutput({ intent: 'FARMING_EXPERT' })?.target).toBeNull();
    expect(parseRouterOutput({ intent: 'FARMING_EXPERT', target: '   ' })?.target).toBeNull();
    // Schema-constrained models sometimes emit the word rather than the value.
    expect(parseRouterOutput({ intent: 'FARMING_EXPERT', target: 'null' })?.target).toBeNull();
  });

  it('keeps scalar entities and drops everything else', () => {
    const result = parseRouterOutput({
      intent: 'APP_NAVIGATION',
      target: 'land_detail',
      entities: {
        landName: '  North field ',
        crop: 'wheat',
        area: 4,
        organic: true,
        blank: '   ',
        nested: { a: 1 },
        list: ['a'],
        missing: null,
      },
    });

    expect(result?.entities).toEqual({
      landName: 'North field',
      crop: 'wheat',
      area: '4',
      organic: 'true',
    });
  });

  it('rejects an intent it does not recognise', () => {
    expect(parseRouterOutput({ intent: 'SMALL_TALK', target: null })).toBeNull();
    expect(parseRouterOutput({ intent: '', target: null })).toBeNull();
  });

  it('accepts a lower-cased intent, because models are inconsistent about it', () => {
    expect(parseRouterOutput({ intent: 'app_navigation', target: 'weather' })?.intent).toBe(
      'APP_NAVIGATION',
    );
  });

  it('rejects anything that is not an object with an intent', () => {
    expect(parseRouterOutput(null)).toBeNull();
    expect(parseRouterOutput(undefined)).toBeNull();
    expect(parseRouterOutput('APP_NAVIGATION')).toBeNull();
    expect(parseRouterOutput(42)).toBeNull();
    expect(parseRouterOutput({})).toBeNull();
    expect(parseRouterOutput({ target: 'weather' })).toBeNull();
  });
});
