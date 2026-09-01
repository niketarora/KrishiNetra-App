import { describe, expect, it } from '@jest/globals';

import { isAgricultureHeadline, isAgritechHeadline, isSchemeArticle } from './filters.js';

describe('isAgricultureHeadline', () => {
  it('rejects a bare "farmer" mention riding along with a sports story', () => {
    expect(isAgricultureHeadline("Farmer's son becomes kabaddi captain for state team")).toBe(false);
  });

  it('rejects a hospital story that only happens to mention an agriculture minister', () => {
    expect(isAgricultureHeadline('Agriculture minister hospitalized after brief illness')).toBe(false);
  });

  it('rejects a political story that only mentions an agriculture minister', () => {
    expect(isAgricultureHeadline('Agriculture minister criticized during lok sabha election campaign')).toBe(false);
  });

  it('accepts an actual mandi-price article', () => {
    expect(isAgricultureHeadline('Fatehnagar mandi reports rising crop prices this week')).toBe(true);
  });

  it('accepts a relevant irrigation article', () => {
    expect(isAgricultureHeadline('New irrigation canal to benefit thousands of farmers ahead of sowing')).toBe(true);
  });

  it('does not false-positive on the short acronym "AI" hiding inside an unrelated word', () => {
    // "Air India" contains "ai" as a substring of "Air" — must never be treated as an AI/tech signal.
    expect(isAgricultureHeadline('Air India expands cargo routes for exporters')).toBe(false);
  });

  it('rejects a headline with no agriculture signal at all', () => {
    expect(isAgricultureHeadline('Stock market rallies on strong earnings season')).toBe(false);
  });
});

describe('isSchemeArticle', () => {
  it('flags an obvious "how to apply" scheme-discovery headline', () => {
    expect(isSchemeArticle('PM-KISAN Yojana: eligibility and how to apply online')).toBe(true);
  });

  it('flags a registration/documents-required headline', () => {
    expect(isSchemeArticle('Registration for scheme now open — documents required for beneficiaries')).toBe(true);
  });

  it('does not flag a legitimate policy article mentioning subsidy/MSP/procurement alone', () => {
    expect(isSchemeArticle('Government raises fertilizer subsidy and MSP for wheat procurement')).toBe(false);
  });

  it('does not flag an ordinary agriculture headline', () => {
    expect(isSchemeArticle('Fatehnagar mandi reports rising crop prices this week')).toBe(false);
  });
});

describe('isAgritechHeadline', () => {
  it('classifies a drone-in-agriculture headline as agritech', () => {
    expect(isAgritechHeadline('New agricultural drone spraying platform launched for farmers')).toBe(true);
  });

  it('classifies an AI-crop-disease headline as agritech', () => {
    expect(isAgritechHeadline('Artificial intelligence model predicts crop disease early for wheat farmers')).toBe(true);
  });

  it('rejects an unrelated AI/drone story with no agriculture context', () => {
    expect(isAgritechHeadline('New AI chip startup unveils drone for delivery logistics')).toBe(false);
  });

  it('rejects an ordinary agriculture headline with no technology term', () => {
    expect(isAgritechHeadline('Irrigation canal repair completed ahead of sowing season for farmers')).toBe(false);
  });

  it('does not match "AI" inside an unrelated word like "captain"', () => {
    expect(isAgritechHeadline("Farmer's son becomes kabaddi captain for state team")).toBe(false);
  });
});
