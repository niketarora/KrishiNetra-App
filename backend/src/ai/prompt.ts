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
  label?: string;
  name: string | null;
  areaAcres: number;
  district: string | null;
  state: string | null;
};

export type FarmerContext = {
  farmerName: string | null;
  language: string;
  field: FieldContext | null;
  fields?: FieldContext[];
  crop: {
    name: string;
    variety: string | null;
    sownOn: string | null;
    expectedHarvestOn: string | null;
  } | null;
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
};

/** Everything V1 genuinely cannot answer. Kept as data so the test can assert it. */
export const UNAVAILABLE_CAPABILITIES = [
  'price forecasts or predictions of any kind',
  'advice on whether to sell now or wait',
  'buyers, offers, negotiations or transactions',
  'payment or delivery status',
  'net realisation or profit calculations',
  'crop health, disease diagnosis or growth stage',
] as const;

const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English',
  hi: 'Hindi',
};

function describeLanguage(code: string): string {
  return LANGUAGE_NAMES[code.split('-')[0] ?? code] ?? code;
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
    const harvest = context.crop.expectedHarvestOn
      ? `, expected harvest ${context.crop.expectedHarvestOn}`
      : '';
    lines.push(`- They are growing ${context.crop.name}${variety}${sown}${harvest}.`);
  }

  if (context.msp) {
    lines.push(
      `- The Minimum Support Price for their crop is ₹${formatNumber(context.msp.pricePerQuintal)}` +
        ` per quintal for marketing year ${context.msp.marketingYear} (source: ${context.msp.source}).`,
    );
  }

  if (context.marketPrice) {
    const range =
      context.marketPrice.minPrice !== null && context.marketPrice.maxPrice !== null
        ? `, range ₹${formatNumber(context.marketPrice.minPrice)}–₹${formatNumber(context.marketPrice.maxPrice)}`
        : '';
    lines.push(
      `- The most recent recorded mandi price is ₹${formatNumber(context.marketPrice.modalPrice)}` +
        ` per quintal at ${context.marketPrice.mandi} mandi on ${context.marketPrice.priceDate}${range}` +
        ` (source: ${context.marketPrice.source}). This is a past observation, not today's rate` +
        ` and not a forecast.`,
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

  return `You are the KrishiNetra farmer companion, a voice assistant for farmers in India.

${buildContextBlock(context)}

CRITICAL RULES — these override everything else:

1. The list above is the ONLY farm, market and weather information you have.
   Never state a price, temperature, rainfall figure, area, date or crop detail
   that does not appear there. Do not estimate one, do not recall a typical
   value, and do not reason your way to a plausible number.

2. You cannot look anything up. You have no live data feed and no tools.

3. You do NOT have access to:
${UNAVAILABLE_CAPABILITIES.map((item) => `   - ${item}`).join('\n')}
   If the farmer asks about any of these, say plainly that:
   "this service is not connected yet" and that you cannot answer it.
   Do not guess, do not offer a rule of thumb, and do not explain how they
   might work it out themselves as a substitute for the real answer.

4. When you use a figure from the list above, say where it came from and when
   it was recorded. A price from last week is not today's price.

5. General agricultural knowledge — how wheat is grown, what a mandi is, what
   MSP means, sowing seasons, common pests — is fine to share, as long as you
   do not attach a specific number to THIS farmer's field, crop or market
   unless it is in the list above.

HOW TO SPEAK:

- Reply in ${language}. If the farmer speaks another Indian language, reply in
  that language instead.
- Your reply will be read aloud, so keep it to two or three short sentences.
- Speak plainly, the way you would to a neighbour. No bullet points, no
  headings, no markdown, no emoji.
- Never claim to be a human being.`;
}
