import { describe, expect, it } from '@jest/globals';
import { MandiDatabaseService } from './mandiDatabase.service.js';
import { CropQualityService } from './cropQuality.service.js';
import { PriceForecastingService } from './priceForecasting.service.js';
import { SaleAdvisoryService } from './saleAdvisory.service.js';
import { BuyerMatchingService } from './buyerMatching.service.js';
import { MarketIntelligenceService } from './marketIntelligence.service.js';

describe('Crop Price Intelligence Services', () => {
  describe('MandiDatabaseService', () => {
    const service = new MandiDatabaseService();

    it('returns market snapshot for wheat in Kota', () => {
      const result = service.getMarketSnapshot({ crop: 'Wheat', location: 'Kota' });
      expect(result).toBeDefined();
      expect(result.crop).toBeDefined();
      expect(result.current_mandi_price).toBeGreaterThan(0);
      expect(result.average_price).toBeGreaterThan(0);
      expect(typeof result.trend_7_days).toBe('number');
      expect(Array.isArray(result.historical_prices)).toBe(true);
    });

    it('returns fallback mock snapshot for unknown crop', () => {
      const result = service.mockSnapshot({ crop: 'Dragonfruit', location: 'Jaipur' });
      expect(result.current_mandi_price).toBe(2500);
      expect(result.mode).toBe('MOCK_MARKET_FALLBACK');
    });
  });

  describe('CropQualityService', () => {
    const service = new CropQualityService();

    it('computes Grade A for low moisture harvest', () => {
      const result = service.assessQuality({ crop: 'Mustard', moisture: 9.5 });
      expect(result.quality_grade).toBe('A');
      expect(result.quality_score).toBeGreaterThanOrEqual(85);
      expect(result.visible_damage_percentage).toBeLessThanOrEqual(3);
    });

    it('applies moisture and damage deductions', () => {
      const quality = service.assessQuality({ crop: 'Mustard', moisture: 15 });
      expect(quality.quality_grade).toBe('C');

      const explanation = service.explainPriceAdjustments({
        basePrice: 5500,
        quality,
        moisture: 15,
      });

      expect(explanation.adjusted_price).toBeLessThan(5500);
      expect(explanation.adjustments.length).toBeGreaterThan(3);
    });
  });

  describe('PriceForecastingService', () => {
    const service = new PriceForecastingService();

    it('forecasts 3-day and 7-day fair price ranges', () => {
      const result = service.predict({
        crop: 'Gram',
        quality_grade: 'A',
        quality_score: 88,
        location: 'Kota',
        quantity: 50,
        current_mandi_price: 5600,
        quality_adjusted_price: 5700,
        trend_7_days: 3.5,
      });

      expect(result.current_fair_price_min).toBeLessThan(result.current_fair_price_max);
      expect(result.predicted_3_day_price_min).toBeDefined();
      expect(result.predicted_7_day_price_min).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0.5);
    });
  });

  describe('SaleAdvisoryService', () => {
    const service = new SaleAdvisoryService();

    it('recommends WAIT when projected price increase exceeds storage costs', () => {
      const result = service.evaluate({
        quantity: 100,
        currentRange: { min: 5000, max: 5100 },
        futureRange: { min: 5500, max: 5600 },
        waitDays: 5,
      });

      expect(result.recommendation).toBe('WAIT');
      expect(result.additional_expected_profit).toBeGreaterThan(500);
      expect(result.recommended_wait_days).toBe(5);
    });

    it('recommends SELL_NOW when future price drops or gains do not cover storage', () => {
      const result = service.evaluate({
        quantity: 100,
        currentRange: { min: 5200, max: 5300 },
        futureRange: { min: 5100, max: 5200 },
        waitDays: 5,
      });

      expect(result.recommendation).toBe('SELL_NOW');
      expect(result.recommended_wait_days).toBe(0);
    });
  });

  describe('BuyerMatchingService', () => {
    const service = new BuyerMatchingService();

    it('ranks buyers by net realization after transport and storage', () => {
      const matches = service.match({
        crop: 'Wheat',
        qualityGrade: 'A',
        quantity: 40,
        location: 'Kota',
        baseMandiPrice: 2450,
      });

      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0]!.net_realisation.net_realisation_per_quintal).toBeGreaterThan(0);
      expect(matches[0]!.match_score).toBeGreaterThan(50);
      if (matches.length > 1 && matches[0] && matches[1]) {
        expect(matches[0].net_realisation.net_realisation_per_quintal).toBeGreaterThanOrEqual(
          matches[1].net_realisation.net_realisation_per_quintal
        );
      }
    });
  });

  describe('MarketIntelligenceService (Full Orchestration)', () => {
    const orchestrator = new MarketIntelligenceService();

    it('produces unified intelligence response in English', async () => {
      const response = await orchestrator.analyse({
        crop: 'Mustard',
        quantity: 60,
        location: 'Kota',
        moisture: 9.8,
        locale: 'en',
      });

      expect(response.crop_analysis.crop).toBe('Mustard');
      expect(response.market_intelligence.current_mandi_price).toBeGreaterThan(0);
      expect(response.price_prediction.current_fair_price_min).toBeGreaterThan(0);
      expect(response.sale_recommendation.recommendation).toBeDefined();
      expect(response.result_dashboard.ai_fair_price).toContain('₹');
      expect(response.messages.title).toContain('Mustard');
    });

    it('produces localized responses in Hindi', async () => {
      const response = await orchestrator.analyse({
        crop: 'Wheat',
        quantity: 50,
        location: 'Jaipur',
        moisture: 10,
        locale: 'hi',
      });

      expect(response.messages.title).toContain('मूल्य और बाज़ार विश्लेषण');
      expect(response.messages.recommendation_label).toBeDefined();
    });
  });
});
