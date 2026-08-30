import { describe, expect, it } from '@jest/globals';

import {
  buildContextBlock,
  buildSystemPrompt,
  UNAVAILABLE_CAPABILITIES,
  type FarmerContext,
} from './prompt.js';

/**
 * The prompt is the only thing standing between a language model and a farmer
 * acting on an invented mandi price, so it is tested like a safety control
 * rather than like copy.
 */

function context(overrides: Partial<FarmerContext> = {}): FarmerContext {
  return {
    farmerName: 'Ramesh Kumar Meena',
    language: 'hi',
    field: { name: 'North Field', areaAcres: 2.5, district: 'Alwar', state: 'Rajasthan' },
    crop: {
      name: 'Wheat',
      variety: 'Sharbati',
      sownOn: '2026-11-15',
      expectedHarvestOn: '2027-04-05',
    },
    msp: {
      pricePerQuintal: 2425,
      marketingYear: '2025-26',
      source: 'Government of India MSP, RMS 2025-26 (CACP/CCEA)',
    },
    weather: {
      observedOn: '2026-08-21',
      temperatureC: 30.1,
      rainfallMm: 12.5,
      humidityPct: 62,
      source: 'Open-Meteo ERA5 archive',
    },
    marketPrice: {
      mandi: 'RJ-ALWAR',
      priceDate: '2026-08-20',
      modalPrice: 2500,
      minPrice: 2400,
      maxPrice: 2600,
      source: 'data.gov.in AGMARKNET',
    },
    ...overrides,
  };
}

describe('buildContextBlock', () => {
  it('states each fact with its source', () => {
    const block = buildContextBlock(context());

    expect(block).toContain('North Field');
    expect(block).toContain('2.5 acres');
    expect(block).toContain('Alwar district, Rajasthan');
    expect(block).toContain('Wheat');
    expect(block).toContain('₹2425');
    expect(block).toContain('CACP/CCEA');
  });

  it('formats multiple lands when present', () => {
    const block = buildContextBlock(
      context({
        fields: [
          { label: 'Land 1', name: 'North Field', areaAcres: 2.5, district: 'Alwar', state: 'Rajasthan' },
          { label: 'Land 2', name: 'South Plot', areaAcres: 1.8, district: 'Alwar', state: 'Rajasthan' },
        ],
      }),
    );

    expect(block).toContain('Land 1 "North Field" is 2.5 acres in Alwar district, Rajasthan.');
    expect(block).toContain('Land 2 "South Plot" is 1.8 acres in Alwar district, Rajasthan.');
  });

  it('marks a mandi price as a past observation, not today and not a forecast', () => {
    const block = buildContextBlock(context());

    expect(block).toMatch(/past observation, not today's rate and not a forecast/);
    expect(block).toContain('2026-08-20');
  });

  it('marks weather as observed rather than forecast', () => {
    const block = buildContextBlock(context());

    expect(block).toMatch(/past observation, not a forecast/);
  });

  it('omits a fact entirely when it is unknown', () => {
    const block = buildContextBlock(context({ msp: null, marketPrice: null, weather: null }));

    // The absent facts leave no trace for the model to pattern-match against.
    expect(block).not.toContain('Minimum Support Price');
    expect(block).not.toContain('mandi price');
    expect(block).not.toContain('Observed weather');
    expect(block).toContain('North Field');
  });

  it('says plainly when it knows nothing at all', () => {
    const block = buildContextBlock({
      farmerName: null,
      language: 'en',
      field: null,
      crop: null,
      msp: null,
      weather: null,
      marketPrice: null,
    });

    expect(block).toMatch(/NO information about this farmer/);
  });

  it('leaves a weather row out when it carries no measurements', () => {
    const block = buildContextBlock(
      context({
        weather: {
          observedOn: '2026-08-21',
          temperatureC: null,
          rainfallMm: null,
          humidityPct: null,
          source: 'Open-Meteo',
        },
      }),
    );

    expect(block).not.toContain('Observed weather');
  });
});

describe('buildSystemPrompt', () => {
  it('forbids stating a value that is not in the context', () => {
    const prompt = buildSystemPrompt(context());

    expect(prompt).toMatch(/Never state a price, temperature, rainfall figure/);
    expect(prompt).toMatch(/do not estimate one/i);
  });

  it('tells the model it has no tools and cannot look anything up', () => {
    // Without this the model reasons "I should check the latest price" and
    // then narrates a plausible one.
    expect(buildSystemPrompt(context())).toMatch(/cannot look anything up/i);
  });

  it('names every capability V1 does not have', () => {
    const prompt = buildSystemPrompt(context());

    for (const capability of UNAVAILABLE_CAPABILITIES) {
      expect(prompt).toContain(capability);
    }
  });

  it('requires it to say the service is not connected for those', () => {
    const prompt = buildSystemPrompt(context());

    // This is the regression that matters most: if this instruction is ever
    // dropped, the avatar starts guessing at sell/wait advice.
    expect(prompt).toMatch(/not connected yet/);
    expect(prompt).toMatch(/do not guess/i);
  });

  it('requires a figure to be attributed and dated', () => {
    expect(buildSystemPrompt(context())).toMatch(/say where it came from and when/);
  });

  it('still allows general agricultural knowledge', () => {
    // Refusing everything would make the assistant useless. The line is drawn
    // at attaching a number to THIS farmer's field.
    expect(buildSystemPrompt(context())).toMatch(/General agricultural knowledge/);
  });

  it('asks for the farmer’s language by name', () => {
    expect(buildSystemPrompt(context({ language: 'hi' }))).toContain('Reply in Hindi');
    expect(buildSystemPrompt(context({ language: 'en' }))).toContain('Reply in English');
  });

  it('keeps replies short enough to be spoken', () => {
    expect(buildSystemPrompt(context())).toMatch(/two or three short sentences/);
  });

  it('forbids claiming to be human', () => {
    expect(buildSystemPrompt(context())).toMatch(/Never claim to be a human being/);
  });

  it('carries the rules even when it knows nothing about the farmer', () => {
    const prompt = buildSystemPrompt({
      farmerName: null,
      language: 'en',
      field: null,
      crop: null,
      msp: null,
      weather: null,
      marketPrice: null,
    });

    expect(prompt).toMatch(/not connected yet/);
    expect(prompt).toMatch(/cannot look anything up/i);
  });
});
