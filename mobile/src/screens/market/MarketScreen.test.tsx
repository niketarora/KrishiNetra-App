import React from 'react';
import { screen } from '@testing-library/react-native';
import { renderWithProviders } from '@/test-utils';
import { MarketScreen } from './MarketScreen';

const mockFarm = {
  id: 'farm-1',
  name: 'North plot',
  district: 'Kota',
};

jest.mock('@/features/farm/FarmContext', () => ({
  useFarm: () => ({ farm: mockFarm }),
}));

jest.mock('@/services/marketIntelligence', () => ({
  analyseMarketIntelligence: jest.fn().mockResolvedValue({
    crop_analysis: {
      crop: 'Mustard',
      crop_confidence: 0.94,
      quality_grade: 'A',
      quality_score: 88,
      visible_damage_percentage: 2.1,
      uniformity_score: 86,
      color_score: 84,
      disease_or_damage: 'Clean harvest',
      confidence: 0.88,
      mode: 'IMAGE_METADATA_ASSESSMENT',
      disclosure: 'Quality evaluated against Agmarknet standards.',
    },
    market_intelligence: {
      crop: 'Mustard',
      location: 'Kota',
      date: '2026-09-01',
      current_mandi_price: 5950,
      min_price: 5700,
      max_price: 6100,
      average_price: 5900,
      arrival_volume: 1200,
      trend_7_days: 3.2,
      historical_prices: [
        { date: '2026-08-26', modal_price: 5800 },
        { date: '2026-08-27', modal_price: 5850 },
        { date: '2026-08-28', modal_price: 5900 },
        { date: '2026-08-29', modal_price: 5920 },
        { date: '2026-08-30', modal_price: 5950 },
      ],
      mode: 'REAL_DATABASE_EXACT_LOCATION',
      disclosure: 'Agmarknet database records.',
    },
    quality_price_explanation: {
      base_price: 5950,
      total_adjustment: 100,
      adjusted_price: 6050,
      fair_price_min: 6015,
      fair_price_max: 6085,
      adjustments: [
        { label: 'Base mandi price', amount: 5950, type: 'base' },
        { label: 'Grade A bonus', amount: 70, type: 'adjustment' },
        { label: 'High visual quality', amount: 30, type: 'adjustment' },
      ],
    },
    price_prediction: {
      current_fair_price_min: 6015,
      current_fair_price_max: 6085,
      predicted_3_day_price_min: 6090,
      predicted_3_day_price_max: 6160,
      predicted_7_day_price_min: 6180,
      predicted_7_day_price_max: 6250,
      confidence: 0.82,
      mode: 'CATBOOST_HISTORICAL_ENSEMBLE',
      disclosure: 'CatBoost price trajectory.',
    },
    sale_recommendation: {
      recommendation: 'WAIT',
      recommended_wait_days: 5,
      current_expected_revenue: 302500,
      future_expected_revenue: 309750,
      storage_cost: 375,
      expected_quality_deterioration: 932,
      market_risk: 4661,
      additional_expected_profit: 7250,
      reason: 'Prices are projected to gain ₹7,250 net after covering 5 days of storage.',
      confidence: 0.82,
    },
    buyer_matches: [
      {
        id: 'B-001',
        name: 'Kota Agro Processing Mills',
        buyer_type: 'Oil Mill',
        crop: 'Mustard',
        required_quantity: 150,
        minimum_grade: 'Grade A',
        offered_price: 6200,
        distance_km: 25,
        pickup_available: true,
        payment_time_hours: 12,
        reliability_score: 92,
        verified: true,
        match_score: 95,
        net_realisation: {
          gross_offered_price: 6200,
          transport_cost_per_quintal: 0,
          mandi_charges_per_quintal: 124,
          handling_per_quintal: 8,
          net_realisation_per_quintal: 6068,
          total_net_revenue: 303400,
        },
        data_status: 'VERIFIED_BUYER_NETWORK',
      },
    ],
    best_buyer: {
      id: 'B-001',
      name: 'Kota Agro Processing Mills',
      buyer_type: 'Oil Mill',
      crop: 'Mustard',
      required_quantity: 150,
      minimum_grade: 'Grade A',
      offered_price: 6200,
      distance_km: 25,
      pickup_available: true,
      payment_time_hours: 12,
      reliability_score: 92,
      verified: true,
      match_score: 95,
      net_realisation: {
        gross_offered_price: 6200,
        transport_cost_per_quintal: 0,
        mandi_charges_per_quintal: 124,
        handling_per_quintal: 8,
        net_realisation_per_quintal: 6068,
        total_net_revenue: 303400,
      },
      data_status: 'VERIFIED_BUYER_NETWORK',
    },
    result_dashboard: {
      crop: 'Mustard',
      grade: 'A',
      quality_score: 88,
      current_mandi_average: 5900,
      ai_fair_price: '₹6,015 - ₹6,085',
      predicted_after_5_days: '₹6,180 - ₹6,250',
      recommendation: 'WAIT',
      expected_additional_income: 7250,
      confidence: 0.82,
    },
    messages: {
      title: 'Mustard Market Price Intelligence',
      recommendation_label: 'Hold for 5 days',
      explanation: '7-day trend analysis indicates strong upward momentum yielding extra net profit.',
    },
    data_disclosure: {
      market_data: 'REAL_DATABASE_EXACT_LOCATION',
    },
  }),
}));

describe('MarketScreen', () => {
  it('renders the screen title and commodity selector chips', async () => {
    await renderWithProviders(<MarketScreen />);

    expect(screen.getByText('Marketplace & Price Intelligence')).toBeTruthy();
    expect(screen.getByText('Mustard')).toBeTruthy();
    expect(screen.getByText('Wheat')).toBeTruthy();
    expect(screen.getByText('Gram')).toBeTruthy();
  });

  it('renders the analyse button and buyer match results', async () => {
    await renderWithProviders(<MarketScreen />);

    expect(screen.getByText('Analyse Crop & Predict Trends')).toBeTruthy();
    expect(screen.getByText('Kota Agro Processing Mills')).toBeTruthy();
    expect(screen.getByText('95% Match')).toBeTruthy();
  });
});
