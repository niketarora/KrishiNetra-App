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

  it('marks a mandi price with its date and source', () => {
    const block = buildContextBlock(context());

    expect(block).toContain('AGMARKNET');
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

  it('formats live market intelligence and 7-day forecast when present', () => {
    const block = buildContextBlock(
      context({
        marketIntelligence: {
          crop: 'Mustard',
          location: 'Kota',
          currentMandiPrice: 5650,
          minPrice: 5400,
          maxPrice: 5800,
          forecastDay3Min: 5700,
          forecastDay3Max: 5750,
          forecastDay7Min: 5850,
          forecastDay7Max: 5890,
          trend7DaysPercent: 4.25,
          saleAdvice: 'HOLD_FOR_TARGET',
          saleReason: 'Prices are trending upwards over the next 7 days',
          verifiedBuyersCount: 8,
          topBuyerDemandRate: 5920,
        },
      }),
    );

    expect(block).toContain('Live Mandi Intelligence for Mustard at Kota');
    expect(block).toContain('Current modal price ₹5650/qtl');
    expect(block).toContain('CatBoost 7-day ML price forecast: 3-day range ₹5700–₹5750, 7-day range ₹5850–₹5890 (+4.25% 7-day trend)');
    expect(block).toContain('AI Sale Recommendation: HOLD FOR TARGET');
    expect(block).toContain('Verified direct buyers active: 8 buyers (top demand rate ₹5920/qtl)');
  });

  it('formats soil health, satellite moisture, and schemes when present', () => {
    const block = buildContextBlock(
      context({
        phone: '+919876543210',
        location: { city: 'Pratapgarh', district: 'Pratapgarh', state: 'Rajasthan', source: 'gps' },
        soilHealth: {
          soilType: 'Alluvial Loam',
          soilPh: 7.2,
          organicMatterPct: 0.65,
          nitrogenKgHa: 240,
          phosphorusKgHa: 18,
          potassiumKgHa: 190,
          source: 'ICAR / Soil Health Card',
        },
        soilMoisture: {
          moisturePercent: 34.03,
          category: 'optimal',
          recommendation: 'optimal_monitor',
          sensorResolutionM: 10,
        },
        schemes: [
          { id: 'pm-kisan', name: 'PM-KISAN Samman Nidhi', benefitSummary: '₹6000 annual income support' },
          { id: 'pmfby', name: 'Pradhan Mantri Fasal Bima Yojana', benefitSummary: 'Comprehensive crop insurance' },
        ],
      }),
    );

    expect(block).toContain('+919876543210');
    expect(block).toContain('Pratapgarh, Rajasthan');
    expect(block).toContain('Soil Health benchmark: Alluvial Loam, pH 7.2, Organic Matter 0.65%');
    expect(block).toContain('Nitrogen: 240 kg/ha');
    expect(block).toContain('Live Sentinel-1 SAR & OASSM-10 Soil Moisture: 34.03% (optimal status)');
    expect(block).toContain('PM-KISAN Samman Nidhi (₹6000 annual income support)');
  });
});

describe('buildSystemPrompt', () => {
  it('forbids stating a value that is not in the context', () => {
    const prompt = buildSystemPrompt(context());

    expect(prompt).toMatch(/Never state an arbitrary invented number/i);
  });

  it('tells the model it has no tools and cannot look anything up outside', () => {
    expect(buildSystemPrompt(context())).toMatch(/cannot look anything up/i);
  });

  it('names unavailable capabilities', () => {
    const prompt = buildSystemPrompt(context());

    for (const capability of UNAVAILABLE_CAPABILITIES) {
      expect(prompt).toContain(capability);
    }
  });

  it('still allows general agricultural knowledge and mandi explanations', () => {
    expect(buildSystemPrompt(context())).toMatch(/General agricultural knowledge/);
  });

  it('asks for the farmer’s language by name', () => {
    expect(buildSystemPrompt(context({ language: 'hi' }))).toContain('Reply in Hindi');
    expect(buildSystemPrompt(context({ language: 'en' }))).toContain('Reply in English');
  });

  it('keeps replies short enough to be spoken', () => {
    expect(buildSystemPrompt(context())).toMatch(/two or three short/i);
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

    expect(prompt).toMatch(/cannot look anything up/i);
  });
});
