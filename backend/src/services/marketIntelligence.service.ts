import { MandiDatabaseService, type MandiSnapshot } from './mandiDatabase.service.js';
import { CropQualityService, type CropVisionAnalysis, type QualityPriceExplanation } from './cropQuality.service.js';
import { PriceForecastingService, type PricePredictionResult } from './priceForecasting.service.js';
import { SaleAdvisoryService, type SaleRecommendation } from './saleAdvisory.service.js';
import { BuyerMatchingService, type BuyerMatch } from './buyerMatching.service.js';

export type MarketIntelligenceRequest = {
  crop: string;
  quantity: number;
  location: string;
  moisture?: number;
  harvestDate?: string;
  imageName?: string;
  imageMimeType?: string;
  locale?: 'en' | 'hi';
};

export type MarketIntelligenceResponse = {
  crop_analysis: CropVisionAnalysis;
  market_intelligence: MandiSnapshot;
  quality_price_explanation: QualityPriceExplanation;
  price_prediction: PricePredictionResult;
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

export class MarketIntelligenceService {
  private mandiDb: MandiDatabaseService;
  private cropQuality: CropQualityService;
  private forecaster: PriceForecastingService;
  private saleAdvisory: SaleAdvisoryService;
  private buyerMatcher: BuyerMatchingService;

  constructor() {
    this.mandiDb = new MandiDatabaseService();
    this.cropQuality = new CropQualityService();
    this.forecaster = new PriceForecastingService();
    this.saleAdvisory = new SaleAdvisoryService();
    this.buyerMatcher = new BuyerMatchingService();
  }

  public async analyse(request: MarketIntelligenceRequest): Promise<MarketIntelligenceResponse> {
    const crop = request.crop || 'Wheat';
    const quantity = Math.max(1, Number(request.quantity ?? 30));
    const location = request.location || 'Kota';
    const moisture = request.moisture !== undefined ? Number(request.moisture) : 10.5;
    const locale = request.locale === 'hi' ? 'hi' : 'en';

    // 1. Mandi Market Lookup from 1.11M Cleaned SQLite Records
    const marketSnapshot = this.mandiDb.getMarketSnapshot({ crop, location });

    // 2. Crop Quality Assessment
    const cropAnalysis = this.cropQuality.assessQuality({
      imageName: request.imageName,
      crop,
      moisture,
    });

    // 3. Quality Price Adjustments
    const qualityExplanation = this.cropQuality.explainPriceAdjustments({
      basePrice: marketSnapshot.current_mandi_price,
      quality: cropAnalysis,
      moisture,
    });

    // 4. Price & 7-Day Trend Forecasting
    const prediction = this.forecaster.predict({
      crop,
      quality_grade: cropAnalysis.quality_grade,
      quality_score: cropAnalysis.quality_score,
      location,
      quantity,
      moisture,
      current_mandi_price: marketSnapshot.current_mandi_price,
      quality_adjusted_price: qualityExplanation.adjusted_price,
      trend_7_days: marketSnapshot.trend_7_days,
      buyer_demand_score: 0.75,
      arrival_volume: marketSnapshot.arrival_volume,
    });

    // 5. Sell vs Wait Decision Advisory
    const recommendation = this.saleAdvisory.evaluate({
      quantity,
      currentRange: {
        min: prediction.current_fair_price_min,
        max: prediction.current_fair_price_max,
      },
      futureRange: {
        min: prediction.predicted_7_day_price_min,
        max: prediction.predicted_7_day_price_max,
      },
      waitDays: 5,
      confidence: prediction.confidence,
    });

    // 6. Buyer Marketplace Matching & Net Realization
    const buyerMatches = this.buyerMatcher.match({
      crop,
      qualityGrade: cropAnalysis.quality_grade,
      quantity,
      location,
      baseMandiPrice: marketSnapshot.current_mandi_price,
    });

    const bestBuyer = buyerMatches.length > 0 && buyerMatches[0] ? buyerMatches[0] : null;

    // 7. Localized farmer messaging
    const messages = this.generateMessages(locale, {
      crop,
      grade: cropAnalysis.quality_grade,
      marketPrice: marketSnapshot.current_mandi_price,
      fairMin: prediction.current_fair_price_min,
      fairMax: prediction.current_fair_price_max,
      recommendation: recommendation.recommendation,
      waitDays: recommendation.recommended_wait_days,
      profit: recommendation.additional_expected_profit,
      bestBuyerName: bestBuyer?.name,
      bestBuyerNet: bestBuyer?.net_realisation.net_realisation_per_quintal,
    });

    return {
      crop_analysis: cropAnalysis,
      market_intelligence: marketSnapshot,
      quality_price_explanation: qualityExplanation,
      price_prediction: prediction,
      sale_recommendation: recommendation,
      buyer_matches: buyerMatches,
      best_buyer: bestBuyer,
      result_dashboard: {
        crop,
        grade: cropAnalysis.quality_grade,
        quality_score: cropAnalysis.quality_score,
        current_mandi_average: marketSnapshot.average_price,
        ai_fair_price: `₹${prediction.current_fair_price_min} - ₹${prediction.current_fair_price_max}`,
        predicted_after_5_days: `₹${prediction.predicted_7_day_price_min} - ₹${prediction.predicted_7_day_price_max}`,
        recommendation: recommendation.recommendation,
        expected_additional_income: recommendation.additional_expected_profit,
        confidence: prediction.confidence,
      },
      messages,
      data_disclosure: {
        image_analysis: cropAnalysis.mode,
        market_data: marketSnapshot.mode,
        price_prediction: prediction.mode,
        buyers: 'VERIFIED_BUYER_NETWORK',
      },
    };
  }

  private generateMessages(
    locale: 'en' | 'hi',
    data: {
      crop: string;
      grade: string;
      marketPrice: number;
      fairMin: number;
      fairMax: number;
      recommendation: string;
      waitDays: number;
      profit: number;
      bestBuyerName?: string;
      bestBuyerNet?: number;
    }
  ): { title: string; recommendation_label: string; explanation: string } {
    if (locale === 'hi') {
      const recLabels: Record<string, string> = {
        WAIT: `${data.waitDays} दिन प्रतीक्षा करें`,
        STORE: 'भंडारण करें',
        SELL_NOW: 'अभी बेचें',
        COMPARE_BUYERS: 'खरीदारों की तुलना करें',
      };

      const explanation =
        data.recommendation === 'WAIT'
          ? `${data.crop} (ग्रेड ${data.grade}) का उचित मूल्य ₹${data.fairMin}–₹${data.fairMax}/क्विंटल है। 7-दिवसीय रुझान के अनुसार 5 दिनों में प्रति क्विंटल लगभग ₹${data.profit > 0 ? Math.round(data.profit / 10) : 150} अतिरिक्त लाभ मिलने की संभावना है।${
              data.bestBuyerName ? ` शीर्ष खरीदार: ${data.bestBuyerName} (नेट ₹${data.bestBuyerNet}/क्विंटल)।` : ''
            }`
          : `${data.crop} (ग्रेड ${data.grade}) का वर्तमान भाव ₹${data.marketPrice}/क्विंटल है। वर्तमान दर पर बेचना या सीधे सत्यापित खरीदारों को देना सबसे लाभदायक विकल्प है।${
              data.bestBuyerName ? ` शीर्ष खरीदार: ${data.bestBuyerName} (नेट ₹${data.bestBuyerNet}/क्विंटल)।` : ''
            }`;

      return {
        title: `${data.crop} मूल्य और बाज़ार विश्लेषण`,
        recommendation_label: recLabels[data.recommendation] || 'बाज़ार विश्लेषण',
        explanation,
      };
    }

    const recLabels: Record<string, string> = {
      WAIT: `Hold for ${data.waitDays} days`,
      STORE: 'Store in warehouse',
      SELL_NOW: 'Sell now at current mandi',
      COMPARE_BUYERS: 'Compare verified buyers',
    };

    const explanation =
      data.recommendation === 'WAIT'
        ? `Your ${data.crop} (Grade ${data.grade}) has a fair value range of ₹${data.fairMin}–₹${data.fairMax}/quintal. 7-day trend analysis indicates strong upward momentum yielding an estimated extra net profit of ₹${data.profit.toLocaleString('en-IN')} after storage deduction.${
            data.bestBuyerName ? ` Best direct buyer match: ${data.bestBuyerName} offering ₹${data.bestBuyerNet}/qtl net.` : ''
          }`
        : `Your ${data.crop} (Grade ${data.grade}) is trading near local average ₹${data.marketPrice}/quintal. Selling now avoids holding risks and quality decay.${
            data.bestBuyerName ? ` Best direct buyer match: ${data.bestBuyerName} offering ₹${data.bestBuyerNet}/qtl net.` : ''
          }`;

    return {
      title: `${data.crop} Market Price Intelligence`,
      recommendation_label: recLabels[data.recommendation] || 'Market Advisory',
      explanation,
    };
  }
}
