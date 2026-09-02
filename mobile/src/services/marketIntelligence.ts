import { apiFetch } from './api';

export type CropPriceAnalysis = {
  crop: string;
  crop_confidence: number;
  quality_grade: 'A' | 'B' | 'C' | 'FAQ';
  quality_score: number;
  visible_damage_percentage: number;
  uniformity_score: number;
  color_score: number;
  disease_or_damage: string;
  confidence: number;
  mode: string;
  disclosure: string;
};

export type MandiMarketIntelligence = {
  crop: string;
  location: string;
  date: string;
  current_mandi_price: number;
  min_price: number;
  max_price: number;
  average_price: number;
  arrival_volume: number;
  trend_7_days: number;
  historical_prices: Array<{ date: string; modal_price: number }>;
  mode: string;
  disclosure: string;
};

export type QualityPriceExplanation = {
  base_price: number;
  total_adjustment: number;
  adjusted_price: number;
  fair_price_min: number;
  fair_price_max: number;
  adjustments: Array<{
    label: string;
    amount: number;
    type: 'base' | 'adjustment';
    reason?: string;
  }>;
};

export type PricePrediction = {
  current_fair_price_min: number;
  current_fair_price_max: number;
  predicted_3_day_price_min: number;
  predicted_3_day_price_max: number;
  predicted_7_day_price_min: number;
  predicted_7_day_price_max: number;
  confidence: number;
  mode: string;
  disclosure: string;
};

export type SaleRecommendation = {
  recommendation: 'SELL_NOW' | 'WAIT' | 'STORE' | 'COMPARE_BUYERS';
  recommended_wait_days: number;
  current_expected_revenue: number;
  future_expected_revenue: number;
  storage_cost: number;
  expected_quality_deterioration: number;
  market_risk: number;
  additional_expected_profit: number;
  reason: string;
  confidence: number;
};

export type BuyerMatch = {
  id: string;
  name: string;
  buyer_type: string;
  crop: string;
  required_quantity: number;
  minimum_grade: string;
  offered_price: number;
  distance_km: number;
  pickup_available: boolean;
  payment_time_hours: number;
  reliability_score: number;
  verified: boolean;
  match_score: number;
  net_realisation: {
    gross_offered_price: number;
    transport_cost_per_quintal: number;
    mandi_charges_per_quintal: number;
    handling_per_quintal: number;
    net_realisation_per_quintal: number;
    total_net_revenue: number;
  };
  data_status: string;
};

export type MarketIntelligenceData = {
  crop_analysis: CropPriceAnalysis;
  market_intelligence: MandiMarketIntelligence;
  quality_price_explanation: QualityPriceExplanation;
  price_prediction: PricePrediction;
  sale_recommendation: SaleRecommendation;
  buyer_matches: BuyerMatch[];
  best_buyer: BuyerMatch | null;
  result_dashboard: {
    crop: string;
    grade: string;
    quality_score: number;
    current_mandi_average: number;
    ai_fair_price: string;
    predicted_after_5_days: string;
    recommendation: string;
    expected_additional_income: number;
    confidence: number;
  };
  messages: {
    title: string;
    recommendation_label: string;
    explanation: string;
  };
  data_disclosure: Record<string, string>;
};

export type AnalyseCropPriceParams = {
  crop: string;
  quantity: number;
  location: string;
  moisture?: number;
  harvestDate?: string;
  imageName?: string;
  imageMimeType?: string;
  locale?: 'en' | 'hi';
};

export async function analyseMarketIntelligence(
  params: AnalyseCropPriceParams
): Promise<MarketIntelligenceData> {
  return apiFetch<MarketIntelligenceData>('/api/v1/market-intelligence/analyse', {
    method: 'POST',
    body: params,
    fallbackKey: 'market.loadError',
  });
}
