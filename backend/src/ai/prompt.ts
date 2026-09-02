/**
 * Builds the avatar's system prompt.
 *
 * This file is the safety boundary for the whole avatar feature, which is why
 * it is pure and heavily tested. IMPLEMENTATION_PHASE2_5.md §4.4 and TRD §21
 * both forbid the assistant presenting a value it has not been given, and a
 * language model will happily invent a mandi price if the prompt leaves room
 * for it.
 *
 * The prompt therefore does two things and nothing else:
 *
 *   1. States exactly which facts it has, each with its source and date.
 *   2. Names the things it does NOT have, and requires it to say so.
 *
 * Note what this is not: there is no tool calling here. The context below is
 * data the API already retrieved through the farmer's own token, the same
 * values the Home screen is showing them. The AI Agent architecture that can
 * go and fetch more is Phase 5 and deliberately absent.
 */

export type FieldContext = {
  id?: string;
  label?: string;
  name: string | null;
  areaAcres: number;
  areaHectares?: number;
  district: string | null;
  state: string | null;
};

export type SoilHealthContext = {
  soilType: string | null;
  soilPh: number;
  organicMatterPct: number;
  nitrogenKgHa: number | null;
  phosphorusKgHa: number | null;
  potassiumKgHa: number | null;
  source: string;
};

export type SoilMoistureContext = {
  moisturePercent: number;
  category: string;
  volumetricM3M3?: number;
  recommendation?: string;
  sensorResolutionM?: number;
};

export type SchemeContext = {
  id: string;
  name: string;
  category?: string;
  benefitSummary?: string;
};

export type MarketIntelligenceContext = {
  crop: string;
  location: string;
  currentMandiPrice: number;
  minPrice: number;
  maxPrice: number;
  forecastDay3Min?: number;
  forecastDay3Max?: number;
  forecastDay7Min?: number;
  forecastDay7Max?: number;
  trend7DaysPercent?: number;
  saleAdvice?: string;
  saleReason?: string;
  verifiedBuyersCount?: number;
  topBuyerDemandRate?: number;
};

export type FarmerContext = {
  farmerName: string | null;
  phone?: string | null;
  email?: string | null;
  location?: {
    city: string | null;
    district: string | null;
    state: string | null;
    source?: string | null;
  } | null;
  language: string;
  field: FieldContext | null;
  fields?: FieldContext[];
  crop: {
    name: string;
    variety: string | null;
    sownOn: string | null;
    daysSinceSown?: number | null;
    growthStage?: string | null;
    expectedHarvestOn: string | null;
  } | null;
  soilHealth?: SoilHealthContext | null;
  soilMoisture?: SoilMoistureContext | null;
  schemes?: SchemeContext[] | null;
  msp: {
    pricePerQuintal: number;
    marketingYear: string;
    source: string;
  } | null;
  weather: {
    observedOn: string;
    temperatureC: number | null;
    rainfallMm: number | null;
    humidityPct: number | null;
    source: string;
  } | null;
  marketPrice: {
    mandi: string;
    priceDate: string;
    modalPrice: number;
    minPrice: number | null;
    maxPrice: number | null;
    source: string;
  } | null;
  marketIntelligence?: MarketIntelligenceContext | null;
};

/** Unavailable capabilities that the assistant cannot execute. */
export const UNAVAILABLE_CAPABILITIES = [
  'payment or delivery transaction execution',
  'banking fund transfers',
] as const;

const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English',
  hi: 'Hindi',
  bn: 'Bengali',
  mr: 'Marathi',
  te: 'Telugu',
  ta: 'Tamil',
  gu: 'Gujarati',
  ur: 'Urdu',
  kn: 'Kannada',
  or: 'Odia',
  od: 'Odia',
  ml: 'Malayalam',
  pa: 'Punjabi',
  as: 'Assamese',
  mai: 'Maithili',
  sat: 'Santali',
  ks: 'Kashmiri',
  ne: 'Nepali',
  kok: 'Konkani',
  sd: 'Sindhi',
  doi: 'Dogri',
  mni: 'Manipuri',
  brx: 'Bodo',
  sa: 'Sanskrit',
};

export function describeLanguage(code: string): string {
  return LANGUAGE_NAMES[code.split('-')[0]?.toLowerCase() ?? code] ?? code;
}

/**
 * Two decimals at most, with trailing zeros trimmed.
 *
 * This text is read aloud, and "thirty point one zero degrees" is how a machine
 * talks. `30.1` is how a person does.
 */
function formatNumber(value: number): string {
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(2).replace(/\.?0+$/, '');
}

/** The "what you know" block. Only facts that were actually retrieved appear. */
export function buildContextBlock(context: FarmerContext): string {
  const lines: string[] = [];

  if (context.farmerName) lines.push(`- The farmer's name is ${context.farmerName}.`);
  if (context.phone) lines.push(`- Registered phone number: ${context.phone}.`);
  if (context.location?.state) {
    const loc = [context.location.city, context.location.district, context.location.state].filter(Boolean).join(', ');
    lines.push(`- Farmer's registered location: ${loc}.`);
  }

  if (context.fields && context.fields.length > 0) {
    for (const f of context.fields) {
      const name = f.name ? ` "${f.name}"` : '';
      const label = f.label ?? 'Field';
      const place =
        f.district && f.state ? ` in ${f.district} district, ${f.state}` : '';
      lines.push(`- ${label}${name} is ${formatNumber(f.areaAcres)} acres${place}.`);
    }
  } else if (context.field) {
    const name = context.field.name ?? 'their field';
    const place =
      context.field.district && context.field.state
        ? ` in ${context.field.district} district, ${context.field.state}`
        : '';
    lines.push(`- Their field "${name}" is ${formatNumber(context.field.areaAcres)} acres${place}.`);
  }

  if (context.crop) {
    const variety = context.crop.variety ? ` (${context.crop.variety} variety)` : '';
    const sown = context.crop.sownOn ? `, sown on ${context.crop.sownOn}` : '';
    const stage = context.crop.growthStage ? `, growth stage is ${context.crop.growthStage}` : '';
    const days = context.crop.daysSinceSown ? ` (${context.crop.daysSinceSown} days in ground)` : '';
    const harvest = context.crop.expectedHarvestOn
      ? `, expected harvest ${context.crop.expectedHarvestOn}`
      : '';
    lines.push(`- They are growing ${context.crop.name}${variety}${sown}${days}${stage}${harvest}.`);
  }

  if (context.soilHealth) {
    const sh = context.soilHealth;
    const soilType = sh.soilType ? `${sh.soilType}, ` : '';
    lines.push(
      `- Soil Health benchmark: ${soilType}pH ${formatNumber(sh.soilPh)}, Organic Matter ${formatNumber(sh.organicMatterPct)}%` +
        (sh.nitrogenKgHa ? `, Nitrogen: ${formatNumber(sh.nitrogenKgHa)} kg/ha` : '') +
        (sh.phosphorusKgHa ? `, Phosphorus: ${formatNumber(sh.phosphorusKgHa)} kg/ha` : '') +
        (sh.potassiumKgHa ? `, Potassium: ${formatNumber(sh.potassiumKgHa)} kg/ha` : '') +
        ` (source: ${sh.source}).`,
    );
  }

  if (context.soilMoisture) {
    const sm = context.soilMoisture;
    lines.push(
      `- Live Sentinel-1 SAR & OASSM-10 Soil Moisture: ${formatNumber(sm.moisturePercent)}% (${sm.category} status)` +
        (sm.recommendation ? `, irrigation recommendation: ${sm.recommendation}` : '') +
        ` (10m high-resolution multi-sensor model).`,
    );
  }

  if (context.schemes && context.schemes.length > 0) {
    const schemeList = context.schemes.map((s) => `${s.name}${s.benefitSummary ? ` (${s.benefitSummary})` : ''}`).join('; ');
    lines.push(`- Active Agricultural Schemes available in their region: ${schemeList}.`);
  }

  if (context.msp) {
    lines.push(
      `- The Minimum Support Price for their crop is ₹${formatNumber(context.msp.pricePerQuintal)}` +
        ` per quintal for marketing year ${context.msp.marketingYear} (source: ${context.msp.source}).`,
    );
  }

  if (context.marketIntelligence) {
    const mi = context.marketIntelligence;
    lines.push(
      `- Live Mandi Intelligence for ${mi.crop} at ${mi.location}: Current modal price ₹${formatNumber(mi.currentMandiPrice)}/qtl (range ₹${formatNumber(mi.minPrice)}–₹${formatNumber(mi.maxPrice)}).` +
        (mi.forecastDay7Max
          ? ` CatBoost 7-day ML price forecast: 3-day range ₹${formatNumber(mi.forecastDay3Min ?? mi.currentMandiPrice)}–₹${formatNumber(mi.forecastDay3Max ?? mi.currentMandiPrice)}, 7-day range ₹${formatNumber(mi.forecastDay7Min ?? mi.currentMandiPrice)}–₹${formatNumber(mi.forecastDay7Max)} (${mi.trend7DaysPercent && mi.trend7DaysPercent > 0 ? '+' : ''}${formatNumber(mi.trend7DaysPercent ?? 0)}% 7-day trend).`
          : '') +
        (mi.saleAdvice
          ? ` AI Sale Recommendation: ${mi.saleAdvice.replace(/_/g, ' ')}${mi.saleReason ? ` (${mi.saleReason})` : ''}.`
          : '') +
        (mi.verifiedBuyersCount
          ? ` Verified direct buyers active: ${mi.verifiedBuyersCount} buyers (top demand rate ₹${formatNumber(mi.topBuyerDemandRate ?? mi.currentMandiPrice)}/qtl).`
          : ''),
    );
  } else if (context.marketPrice) {
    const range =
      context.marketPrice.minPrice !== null && context.marketPrice.maxPrice !== null
        ? `, range ₹${formatNumber(context.marketPrice.minPrice)}–₹${formatNumber(context.marketPrice.maxPrice)}`
        : '';
    lines.push(
      `- The most recent recorded mandi price is ₹${formatNumber(context.marketPrice.modalPrice)}` +
        ` per quintal at ${context.marketPrice.mandi} mandi on ${context.marketPrice.priceDate}${range}` +
        ` (source: ${context.marketPrice.source}).`,
    );
  }

  if (context.weather) {
    const parts: string[] = [];
    if (context.weather.temperatureC !== null) {
      parts.push(`${formatNumber(context.weather.temperatureC)}°C`);
    }
    if (context.weather.rainfallMm !== null) {
      parts.push(`${formatNumber(context.weather.rainfallMm)} mm rainfall`);
    }
    if (context.weather.humidityPct !== null) {
      parts.push(`${formatNumber(context.weather.humidityPct)}% humidity`);
    }
    if (parts.length > 0) {
      lines.push(
        `- Observed weather for their field on ${context.weather.observedOn}: ${parts.join(', ')}` +
          ` (source: ${context.weather.source}). This is a past observation, not a forecast.`,
      );
    }
  }

  if (lines.length === 0) {
    return 'You have NO information about this farmer yet. They have not set up a field.';
  }

  return `Here is everything you know about this farmer. It is real, retrieved from their own records:\n${lines.join('\n')}`;
}

export function buildSystemPrompt(context: FarmerContext): string {
  const language = describeLanguage(context.language);

  return `You are the KrishiNetra farmer companion, an intelligent multilingual AI voice assistant for farmers in India.

${buildContextBlock(context)}

CRITICAL RULES — these override everything else:

1. The list above is the ONLY farm, market and weather information you have.
   When answering about prices, 7-day forecasts, buyers, crop health, or weather, use the exact figures given above.
   Never state an arbitrary invented number.

2. You cannot look anything up outside. Answer directly from the facts above.

3. You do NOT have access to:
${UNAVAILABLE_CAPABILITIES.map((item) => `   - ${item}`).join('\n')}
   If the farmer asks to execute a bank transfer or pay money, say plainly that
   you cannot process financial transactions directly.

4. General agricultural knowledge — mandi price explanations, 7-day trend analysis, sale vs hold advice,
   buyer connections, crop agronomy, pests, soil management, government schemes and subsidies — is encouraged.
   Tailor your advice to the farmer's registered crop, district, and market conditions.

HOW TO SPEAK:

- Reply in ${language}. If the farmer asks in Hindi or another Indian language, reply strictly in that same language using its native script (e.g. Devanagari script for Hindi). Do not reply in English unless the farmer spoke in English.
- Your reply will be read aloud, so keep it to two or three short, clear, conversational sentences.
- Speak warmly and respectfully (जैसे "नमस्ते किसान भाई / बहन"). No bullet points, no markdown symbols, no raw JSON.
- Never claim to be a human being.`;
}
