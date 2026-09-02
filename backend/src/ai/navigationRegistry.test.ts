import { describe, expect, it } from '@jest/globals';

import {
  DESTINATIONS,
  destinationCatalogue,
  findDestination,
  matchDestinationLocally,
  type GuideAction,
} from './navigationRegistry.js';

/**
 * The registry is what stops the model steering the app somewhere that does not
 * exist, so these tests treat it as a contract rather than as data: every
 * destination must be reachable, every action must be one the app implements,
 * and the destinations with nothing real behind them must say so.
 */

const ACTIONS: GuideAction[] = [
  'NAVIGATE',
  'SELECT',
  'SCROLL',
  'HIGHLIGHT',
  'OPEN',
  'BACK',
  'POINT',
];

describe('the destination table', () => {
  it('gives every destination a unique id', () => {
    const ids = DESTINATIONS.map((destination) => destination.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gives every destination at least one step', () => {
    for (const destination of DESTINATIONS) {
      expect(destination.steps.length).toBeGreaterThan(0);
    }
  });

  it('only uses actions the app knows how to perform', () => {
    for (const destination of DESTINATIONS) {
      for (const step of destination.steps) {
        expect(ACTIONS).toContain(step.action);
        expect(step.target.trim()).not.toBe('');
      }
    }
  });

  it('starts every destination by going somewhere', () => {
    // A HIGHLIGHT as the first step would spotlight whatever screen the farmer
    // happened to be on, which is worse than not guiding at all.
    for (const destination of DESTINATIONS) {
      expect(destination.steps[0]?.action).toBe('NAVIGATE');
    }
  });

  it('speaks through i18n keys, never English prose', () => {
    for (const destination of DESTINATIONS) {
      expect(destination.messageKey).toMatch(/^avatar\.guide\./);
      if (destination.caveatKey) expect(destination.caveatKey).toMatch(/^avatar\.guide\.caveat\./);
    }
  });
});

describe('destinations with real data and caveats', () => {
  it('warns about the irrigation schedule instead of implying one exists', () => {
    const irrigation = findDestination('irrigation_schedule');

    expect(irrigation).not.toBeNull();
    // It points at the calendar, which is real, and says the schedule is not.
    expect(irrigation?.steps[0]).toEqual({ action: 'NAVIGATE', target: 'Calendar' });
    expect(irrigation?.caveatKey).toBe('avatar.guide.caveat.irrigation');
  });

  it('routes sell-or-wait directly to the recommendation card', () => {
    const sellOrWait = findDestination('sell_or_wait');
    expect(sellOrWait).not.toBeNull();
    expect(sellOrWait?.steps).toEqual([
      { action: 'NAVIGATE', target: 'Market' },
      { action: 'SCROLL', target: 'recommendation-card' },
      { action: 'HIGHLIGHT', target: 'recommendation-card' },
    ]);
  });

  it('routes verified buyers to the buyers list', () => {
    const buyers = findDestination('buyers');
    expect(buyers).not.toBeNull();
    expect(buyers?.steps).toEqual([
      { action: 'NAVIGATE', target: 'Market' },
      { action: 'SCROLL', target: 'buyers-list' },
      { action: 'HIGHLIGHT', target: 'buyers-list' },
    ]);
  });
});

describe('findDestination', () => {
  it('finds a known id, case- and space-insensitively', () => {
    expect(findDestination('market_price')?.id).toBe('market_price');
    expect(findDestination('  MARKET_PRICE ')?.id).toBe('market_price');
  });

  it('returns null for an id the model invented', () => {
    expect(findDestination('irrigation_dashboard')).toBeNull();
    expect(findDestination('')).toBeNull();
    expect(findDestination(null)).toBeNull();
    expect(findDestination(undefined)).toBeNull();
  });
});

describe('destinationCatalogue', () => {
  it('offers exactly the destinations that can be resolved', () => {
    const offered = destinationCatalogue()
      .split('\n')
      .map((line) => line.split(':')[0]);

    expect(offered).toHaveLength(DESTINATIONS.length);
    for (const id of offered) expect(findDestination(id)).not.toBeNull();
  });
});

describe('matchDestinationLocally', () => {
  it('resolves common phrasings without the model', () => {
    expect(matchDestinationLocally('what is the mandi price today')?.id).toBe('market_price');
    expect(matchDestinationLocally('show me the weather')?.id).toBe('weather');
    expect(matchDestinationLocally('I want to add land')?.id).toBe('register_land');
    expect(matchDestinationLocally('locate the marketplace')?.id).toBe('market_price');
  });

  it('works in Hindi and Hinglish as well as English', () => {
    expect(matchDestinationLocally('आज मंडी भाव क्या है')?.id).toBe('market_price');
    expect(matchDestinationLocally('मौसम कैसा है')?.id).toBe('weather');
    expect(matchDestinationLocally('मेरे ऐप में मार्केट किधर है बताओ')?.id).toBe('market_price');
    expect(matchDestinationLocally('mere app me market kidhar ha bato')?.id).toBe('market_price');
    expect(matchDestinationLocally('mandi kahan hai')?.id).toBe('market_price');
    expect(matchDestinationLocally('who will buy my crop')?.id).toBe('buyers');
    expect(matchDestinationLocally('खरीदार दिखाओ')?.id).toBe('buyers');
    expect(matchDestinationLocally('crop quality grading')?.id).toBe('quality_grading');
  });

  it('ignores punctuation and casing', () => {
    expect(matchDestinationLocally('MSP?')?.id).toBe('msp');
    expect(matchDestinationLocally('...Mandi  Price!!')?.id).toBe('market_price');
  });

  it('prefers the longer alias when two could match', () => {
    // "price trend" contains no shorter alias, but a naive scan that stopped at
    // the first hit could land on market_price and spotlight the wrong card.
    expect(matchDestinationLocally('show me the price trend')?.id).toBe('price_trend');
  });

  it('routes the irrigation question to the calendar', () => {
    expect(matchDestinationLocally('where can I see my irrigation schedule')?.id).toBe(
      'irrigation_schedule',
    );
  });

  it('returns null when nothing matches, rather than guessing', () => {
    expect(matchDestinationLocally('my tomato leaves are turning yellow')).toBeNull();
    expect(matchDestinationLocally('   ')).toBeNull();
  });

  it('does not swallow a research question that happens to contain an alias', () => {
    expect(
      matchDestinationLocally('what are the latest solar irrigation subsidies in Maharashtra'),
    ).toBeNull();
    expect(matchDestinationLocally('is there a new scheme for drip irrigation this year')).toBeNull();
    expect(matchDestinationLocally('what is the mandi price in Indore compared to Bhopal')).toBeNull();
  });

  it('still matches the same request phrased as navigation', () => {
    expect(matchDestinationLocally('show me the irrigation schedule')?.id).toBe(
      'irrigation_schedule',
    );
    expect(matchDestinationLocally('how is the weather this week')?.id).toBe('weather');
    expect(matchDestinationLocally('मौसम कैसा है')?.id).toBe('weather');
  });
});
