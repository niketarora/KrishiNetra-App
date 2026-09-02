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

export class SaleAdvisoryService {
  public evaluate({
    quantity,
    currentRange,
    futureRange,
    waitDays = 5,
    confidence = 0.72,
  }: {
    quantity: number;
    currentRange: { min: number; max: number };
    futureRange: { min: number; max: number };
    waitDays?: number;
    confidence?: number;
  }): SaleRecommendation {
    const qty = Math.max(1, Number(quantity));
    const currentMid = (Number(currentRange.min) + Number(currentRange.max)) / 2;
    const futureMid = (Number(futureRange.min) + Number(futureRange.max)) / 2;

    const currentRevenue = currentMid * qty;

    // Cost parameters
    const storageCostPerQuintalPerDay = 1.5;
    const qualityDeteriorationRatePerDay = 0.003;
    const marketRiskRate = 0.015;

    const storageCost = storageCostPerQuintalPerDay * waitDays * qty;
    const qualityDeterioration = futureMid * qualityDeteriorationRatePerDay * waitDays * qty;
    const marketRisk = futureMid * marketRiskRate * qty;

    const futureRevenue = futureMid * qty - storageCost - qualityDeterioration - marketRisk;
    const additionalProfit = futureRevenue - currentRevenue;

    let recommendation: SaleRecommendation['recommendation'] = 'SELL_NOW';
    let reason = 'Selling now or comparing spot buyers yields the highest immediate net return without storage decay.';

    if (additionalProfit >= 500) {
      recommendation = 'WAIT';
      reason = `Prices are projected to gain ₹${Math.round(additionalProfit).toLocaleString('en-IN')} net after covering ${waitDays} days of storage and market risk.`;
    } else if (confidence < 0.62) {
      recommendation = 'COMPARE_BUYERS';
      reason = 'Market volatility is elevated. Direct comparison of verified local buyers is recommended.';
    }

    return {
      recommendation,
      recommended_wait_days: recommendation === 'WAIT' ? waitDays : 0,
      current_expected_revenue: Math.round(currentRevenue),
      future_expected_revenue: Math.round(futureRevenue),
      storage_cost: Math.round(storageCost),
      expected_quality_deterioration: Math.round(qualityDeterioration),
      market_risk: Math.round(marketRisk),
      additional_expected_profit: Math.round(additionalProfit),
      reason,
      confidence,
    };
  }
}
