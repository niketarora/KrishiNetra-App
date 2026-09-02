/**
 * Every place in the app the guide is allowed to take a farmer, and the exact
 * steps to get there.
 *
 * This is the reason the model never emits UI commands. The router classifies
 * a request and names a destination id; the steps come from here. Three things
 * follow from that split:
 *
 *   - The model cannot invent a route. An id it makes up simply misses the
 *     lookup, and the request falls through to the expert path instead of the
 *     app driving itself somewhere that does not exist.
 *   - Navigation costs no generation. A matched destination is a table lookup,
 *     so the common case — "where do I see X" — never waits on a second model
 *     call (§9 of the brief: cache static app navigation information).
 *   - Routes stay honest. Everything here is a route that exists today in
 *     `mobile/src/navigation/types.ts`. Where a destination has no real data
 *     behind it yet, it carries a `caveatKey` and says so out loud rather than
 *     implying the feature is finished.
 *
 * Pure data and pure functions — no I/O, no env, no provider. Kept in lockstep
 * with `mobile/src/features/guide/targets.ts`, which is what actually resolves
 * these targets on the device.
 */

/** What the app's Navigation Controller knows how to do. */
export type GuideAction =
  | 'NAVIGATE'
  | 'SELECT'
  | 'SCROLL'
  | 'HIGHLIGHT'
  | 'OPEN'
  | 'BACK'
  | 'POINT';

export type GuideStep = {
  action: GuideAction;
  /** A route name for NAVIGATE/OPEN, a registered element id for the rest. */
  target: string;
  params?: Record<string, string | number>;
};

export type Destination = {
  id: string;
  /** One line, shown to the router so it can pick between destinations. */
  summary: string;
  /**
   * Spoken words the farmer might use for this. Matched locally before the
   * model is consulted at all, in the app's two primary languages.
   */
  aliases: readonly string[];
  steps: readonly GuideStep[];
  /** i18n key for what the avatar says — never English prose, see §12. */
  messageKey: string;
  /**
   * Set where the destination exists but the data behind it does not. The app
   * speaks this instead of `messageKey`, so the farmer is told plainly that a
   * feature is not connected rather than being shown an empty screen and left
   * to conclude it is broken.
   */
  caveatKey?: string;
};

export const DESTINATIONS: readonly Destination[] = [
  // --- Market & Mandi Intelligence ----------------------------------------
  {
    id: 'market_price',
    summary: "today's live mandi price, market rates for the crop, and mandi screen",
    aliases: [
      'mandi price', 'market price', 'crop price', 'rate', 'bhav', 'mandi bhav',
      'mandi rate', 'market rate', 'market', 'marketplace', 'mandi', 'bazaar', 'bazar',
      'mandi kidhar', 'market kidhar', 'market kahan', 'mandi kahan', 'locate market',
      'open market', 'show market', 'मंडी भाव', 'भाव', 'दाम', 'दर', 'मंडी', 'मार्केट',
      'बाजार', 'बाज़ार', 'मंडी रेट', 'मार्केट रेट', 'मंडी किधर', 'मार्केट किधर', 'मंडी कहाँ',
    ],
    steps: [
      { action: 'NAVIGATE', target: 'Market' },
      { action: 'HIGHLIGHT', target: 'price-card' },
    ],
    messageKey: 'avatar.guide.market_price',
  },
  {
    id: 'price_trend',
    summary: 'the 7-day CatBoost price forecast and price history trend chart',
    aliases: [
      'price trend', 'price history', 'last week price', '7 day forecast', '7 day trend',
      'price forecast', 'future price', 'price graph', 'forecast', 'trend',
      'अगले सात दिन का भाव', 'सात दिन का भाव', 'भाव का रुझान', 'भाव का ग्राफ', 'आगामी भाव', 'भाव अनुमान',
    ],
    steps: [
      { action: 'NAVIGATE', target: 'Market' },
      { action: 'SCROLL', target: 'price-trend' },
      { action: 'HIGHLIGHT', target: 'price-trend' },
    ],
    messageKey: 'avatar.guide.price_trend',
  },
  {
    id: 'sell_or_wait',
    summary: 'whether to sell the crop now or wait based on net realisation and forecast',
    aliases: [
      'sell or wait', 'should i sell', 'sell now', 'when to sell', 'best time to sell',
      'sale recommendation', 'sale advice', 'kab bechu', 'bechu ya ruku', 'bechna chahiye',
      'कब बेचें', 'बेचूं या रुकूं', 'बेचना चाहिए', 'बिक्री सलाह', 'कब बेचना है',
    ],
    steps: [
      { action: 'NAVIGATE', target: 'Market' },
      { action: 'SCROLL', target: 'recommendation-card' },
      { action: 'HIGHLIGHT', target: 'recommendation-card' },
    ],
    messageKey: 'avatar.guide.sell_or_wait',
  },
  {
    id: 'buyers',
    summary: 'verified direct buyers and demand offers for the crop',
    aliases: [
      'buyers', 'buyer', 'verified buyers', 'direct buyers', 'who will buy', 'crop buyers',
      'khariddar', 'kharidar', 'vyapari', 'traders', 'demand', 'buyer list',
      'खरीदार', 'व्यापारी', 'खरीददार', 'फसल खरीदार', 'व्यापारी सूची', 'कौन खरीदेगा',
    ],
    steps: [
      { action: 'NAVIGATE', target: 'Market' },
      { action: 'SCROLL', target: 'buyers-list' },
      { action: 'HIGHLIGHT', target: 'buyers-list' },
    ],
    messageKey: 'avatar.guide.buyers',
  },
  {
    id: 'quality_grading',
    summary: 'crop quality grading, moisture testing, and MSP benchmarking',
    aliases: [
      'quality', 'crop quality', 'grading', 'quality check', 'moisture assay', 'moisture check',
      'grade', 'msp benchmark', 'quality grade', 'क्वालिटी', 'गुणवत्ता', 'ग्रेडिंग', 'नमी जांच', 'ग्रेड',
    ],
    steps: [
      { action: 'NAVIGATE', target: 'Market' },
      { action: 'SCROLL', target: 'quality-grade-card' },
      { action: 'HIGHLIGHT', target: 'quality-grade-card' },
    ],
    messageKey: 'avatar.guide.quality_grading',
  },

  // --- Home dashboard -----------------------------------------------------
  {
    id: 'weather',
    summary: 'the latest weather observation for the farmer’s field',
    aliases: [
      'weather', 'rain', 'temperature', 'forecast', 'weather forecast', 'mausam', 'barish',
      'तापमान', 'मौसम', 'बारिश', 'मौसम कैसा है', 'बारिश होगी क्या',
    ],
    steps: [
      { action: 'NAVIGATE', target: 'Home' },
      { action: 'SCROLL', target: 'weather-card' },
      { action: 'HIGHLIGHT', target: 'weather-card' },
    ],
    messageKey: 'avatar.guide.weather',
  },
  {
    id: 'crop_status',
    summary: 'which crop is sown on the selected land and when',
    aliases: ['my crop', 'crop status', 'what did i sow', 'fasal', 'meri fasal', 'फसल', 'मेरी फसल', 'बोई गई फसल'],
    steps: [
      { action: 'NAVIGATE', target: 'Home' },
      { action: 'SCROLL', target: 'crop-card' },
      { action: 'HIGHLIGHT', target: 'crop-card' },
    ],
    messageKey: 'avatar.guide.crop_status',
  },
  {
    id: 'msp',
    summary: 'the published minimum support price for the crop',
    aliases: ['msp', 'minimum support price', 'support price', 'sarkari rate', 'एमएसपी', 'न्यूनतम समर्थन मूल्य', 'सरकारी भाव'],
    steps: [
      { action: 'NAVIGATE', target: 'Home' },
      { action: 'SCROLL', target: 'msp-card' },
      { action: 'HIGHLIGHT', target: 'msp-card' },
    ],
    messageKey: 'avatar.guide.msp',
  },
  {
    id: 'field_analysis',
    summary: 'satellite analysis of the field — crop health, growth stage, weather risk, and live ML factors',
    aliases: [
      'field analysis', 'crop health', 'satellite', 'growth stage', 'features', '14 inputs',
      'model factors', 'vegetation', 'ndvi', 'khet ka vishleshan', 'fasal health',
      'खेत का विश्लेषण', 'फसल स्वास्थ्य', 'उपग्रह',
    ],
    steps: [
      { action: 'NAVIGATE', target: 'Field' },
      { action: 'SCROLL', target: 'ml-features-card' },
      { action: 'HIGHLIGHT', target: 'ml-features-card' },
    ],
    messageKey: 'avatar.guide.field_analysis',
  },

  // --- Land ---------------------------------------------------------------
  {
    id: 'my_lands',
    summary: 'the list of all registered lands, where one can be selected',
    aliases: ['my lands', 'my farm', 'my fields', 'all lands', 'mere khet', 'meri zameen', 'मेरी जमीन', 'मेरे खेत', 'खेत सूची'],
    steps: [{ action: 'NAVIGATE', target: 'MyLands' }],
    messageKey: 'avatar.guide.my_lands',
  },
  {
    id: 'land_detail',
    summary: 'the summary of one particular land — boundary, area, current crop',
    aliases: ['land detail', 'this land', 'field detail', 'farm info', 'khet ka byora', 'खेत का ब्यौरा', 'जमीन का विवरण'],
    steps: [
      { action: 'NAVIGATE', target: 'MyLands' },
      { action: 'SELECT', target: 'land' },
      { action: 'NAVIGATE', target: 'MyFarm' },
    ],
    messageKey: 'avatar.guide.land_detail',
  },
  {
    id: 'register_land',
    summary: 'registering a new land by walking or drawing its boundary',
    aliases: ['register land', 'add land', 'new field', 'map my field', 'add farm', 'naya khet', 'zameen jode', 'जमीन जोड़ें', 'नया खेत', 'खेत नापें'],
    steps: [{ action: 'NAVIGATE', target: 'RegisterLandMethod' }],
    messageKey: 'avatar.guide.register_land',
  },
  {
    id: 'edit_boundary',
    summary: 'changing the boundary of an already-registered land',
    aliases: ['edit boundary', 'change boundary', 'fix my field', 'seema badle', 'boundary badle', 'सीमा बदलें', 'खेत की सीमा'],
    steps: [
      { action: 'NAVIGATE', target: 'MyFarm' },
      { action: 'HIGHLIGHT', target: 'my-farm-edit-boundary' },
    ],
    messageKey: 'avatar.guide.edit_boundary',
  },
  {
    id: 'soil_moisture',
    summary: 'the estimated soil moisture for the field',
    aliases: [
      'soil moisture', 'how wet is my soil', 'moisture', 'moisture level', 'soil hydration',
      'soil status', 'mitti ki nami', 'nami', 'mitti me pani', 'मिट्टी की नमी', 'नमी', 'खेत में पानी',
    ],
    steps: [
      { action: 'NAVIGATE', target: 'Field' },
      { action: 'SCROLL', target: 'soil-moisture-card' },
      { action: 'HIGHLIGHT', target: 'soil-moisture-card' },
    ],
    messageKey: 'avatar.guide.soil_moisture',
  },

  // --- Calendar -----------------------------------------------------------
  {
    id: 'calendar',
    summary: 'the smart farm calendar of upcoming farm activities',
    aliases: ['calendar', 'schedule', 'what should i do', 'karyakram', 'activities', 'कैलेंडर', 'कार्यक्रम', 'फार्म कैलेंडर'],
    steps: [{ action: 'NAVIGATE', target: 'Calendar' }],
    messageKey: 'avatar.guide.calendar',
  },
  {
    id: 'irrigation_schedule',
    summary: 'when to irrigate — watering schedule and reminders',
    aliases: ['irrigation', 'watering', 'when to water', 'irrigation schedule', 'sinchai', 'pani kab de', 'सिंचाई', 'पानी कब दें', 'सिंचाई का समय'],
    steps: [
      { action: 'NAVIGATE', target: 'Calendar' },
      { action: 'HIGHLIGHT', target: 'calendar-events' },
    ],
    messageKey: 'avatar.guide.calendar',
    caveatKey: 'avatar.guide.caveat.irrigation',
  },

  // --- Information --------------------------------------------------------
  {
    id: 'schemes',
    summary: 'the directory of government agricultural schemes and subsidies',
    aliases: ['schemes', 'subsidy', 'government scheme', 'yojana', 'sarkari yojana', 'subsidies', 'योजना', 'सरकारी योजना', 'सब्सिडी', 'सरकारी मदद'],
    steps: [{ action: 'NAVIGATE', target: 'Schemes' }],
    messageKey: 'avatar.guide.schemes',
  },
  {
    id: 'updates',
    summary: 'the agricultural news and updates feed',
    aliases: ['news', 'updates', 'what is happening', 'samachar', 'khabar', 'taza khabar', 'समाचार', 'खबर', 'कृषि समाचार'],
    steps: [{ action: 'NAVIGATE', target: 'Updates' }],
    messageKey: 'avatar.guide.updates',
  },
  {
    id: 'alerts',
    summary: 'past alerts and messages sent to the farmer',
    aliases: ['alerts', 'notifications', 'messages', 'warnings', 'chetavni', 'suchna', 'चेतावनी', 'सूचना', 'संदेश', 'नोटिफिकेशन'],
    steps: [{ action: 'NAVIGATE', target: 'Alerts' }],
    messageKey: 'avatar.guide.alerts',
  },
  {
    id: 'learning',
    summary: 'Krishi Academy — video tutorials on farming techniques',
    aliases: ['learn', 'tutorial', 'academy', 'how to video', 'teach me', 'sikho', 'video', 'सीखें', 'वीडियो', 'ट्यूटोरियल', 'कृषि अकादमी'],
    steps: [{ action: 'NAVIGATE', target: 'Learning' }],
    messageKey: 'avatar.guide.learning',
  },
  {
    id: 'visual_assistant',
    summary: 'pointing the camera at a plant to have it looked at',
    aliases: ['camera', 'photo', 'scan my plant', 'take a picture', 'pudha scan', 'photo lo', 'कैमरा', 'फोटो', 'पौधे की फोटो', 'स्कैन'],
    steps: [{ action: 'NAVIGATE', target: 'VisualAssistant' }],
    messageKey: 'avatar.guide.visual_assistant',
  },
  {
    id: 'history',
    summary: 'the farm overview and past activity timeline',
    aliases: ['history', 'past activity', 'timeline', 'purana record', 'itahas', 'इतिहास', 'पिछला', 'पिछली गतिविधियां'],
    steps: [{ action: 'NAVIGATE', target: 'History' }],
    messageKey: 'avatar.guide.history',
  },
  {
    id: 'profile',
    summary: 'the farmer’s own profile, language and notification settings',
    aliases: ['profile', 'my account', 'settings', 'change language', 'bhasha badle', 'khata', 'प्रोफाइल', 'भाषा बदलें', 'मेरी प्रोफाइल', 'सेटिंग्स'],
    steps: [{ action: 'NAVIGATE', target: 'Profile' }],
    messageKey: 'avatar.guide.profile',
  },
] as const;

const BY_ID = new Map(DESTINATIONS.map((destination) => [destination.id, destination]));

export function findDestination(id: string | null | undefined): Destination | null {
  if (!id) return null;
  return BY_ID.get(id.trim().toLowerCase()) ?? null;
}

/**
 * The destination list as the router sees it.
 */
export function destinationCatalogue(): string {
  return DESTINATIONS.map((destination) => `${destination.id}: ${destination.summary}`).join('\n');
}

/**
 * Lower-cased, punctuation-stripped, single-spaced — for alias matching.
 */
function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/[^\p{L}\p{N}\p{M}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Words that carry no information about *which* destination is wanted.
 * Covers English, Latin Hinglish transliterations, and Devanagari Hindi.
 */
const FILLER = new Set([
  // English framing
  'show', 'me', 'my', 'mine', 'the', 'a', 'an', 'is', 'are', 'was', 'what',
  'where', 'when', 'which', 'can', 'could', 'i', 'see', 'view', 'look', 'open',
  'go', 'to', 'take', 'want', 'need', 'please', 'tell', 'find', 'get', 'about',
  'of', 'for', 'on', 'in', 'at', 'today', 'now', 'this', 'currently', 'much',
  'how', 'do', 'does', 'it', 'you', 'us', 'we', 'and', 'week', 'right', 'locate',
  'app', 'application',

  // Latin Hinglish framing
  'mujhe', 'mujhko', 'mera', 'meri', 'mere', 'mereko', 'hum', 'humare', 'apna', 'apni', 'apne',
  'kya', 'kaha', 'kahan', 'kidhar', 'kidhr', 'kab', 'kaise', 'kaisa', 'kaisi', 'kitna', 'kitni', 'kitne',
  'kaun', 'kon', 'hai', 'hain', 'ha', 'h', 'hoon', 'ho', 'batao', 'bato', 'bata', 'bataiye', 'bataye',
  'dikhao', 'dikha', 'dikhaye', 'dikhaiye', 'kholo', 'khol', 'kholiye', 'kholna',
  'jana', 'jaana', 'jaa', 'jao', 'dekhna', 'dekho', 'dekh', 'chahiye', 'chahie', 'chahata', 'chahati',
  'bhejo', 'karo', 'kar', 'kare', 'karen', 'ka', 'ki', 'ke', 'ko', 'me', 'mein', 'par', 'pe', 'se', 'tak',
  'aur', 'bhi', 'to', 'toh', 'wala', 'wali', 'wale', 'bhai', 'ji',

  // Devanagari Hindi framing
  'मुझे', 'मुझको', 'मेरा', 'मेरी', 'मेरे', 'हम', 'हमारा', 'हमारे', 'अपना', 'अपनी', 'अपने',
  'क्या', 'कहाँ', 'कहां', 'किधर', 'कब', 'कैसे', 'कैसा', 'कैसी', 'कितना', 'कितनी', 'कितने', 'कौन',
  'है', 'हैं', 'हूँ', 'हो', 'दिखाओ', 'दिखाइए', 'दिखाईये', 'दिखा', 'बताओ', 'बताइए', 'बता',
  'खोलो', 'खोलिए', 'खोलें', 'खोलना', 'जाना', 'जाओ', 'जाएं', 'देखना', 'देखो', 'देखें', 'चाहिए',
  'चाहता', 'चाहती', 'आज', 'अभी', 'का', 'की', 'के', 'को', 'में', 'पर', 'से', 'तक', 'भी', 'तो', 'और',
  'ऐप', 'एप्लीकेशन', 'वाला', 'वाली', 'वाले', 'भाई', 'जी',
]);

function stripFiller(text: string): string {
  return normalise(text)
    .split(' ')
    .filter((word) => word && !FILLER.has(word))
    .join(' ');
}

/**
 * How much of what the farmer actually said has to be the alias.
 *
 * The local path exists to skip a model call on "mandi bhav" or "market kidhar hai",
 * not to guess at a complex sentence. Requiring the alias to account for at least 40%
 * of the stripped request means research questions (e.g. "latest subsidies in Maharashtra")
 * pass through to the router.
 */
const COVERAGE_THRESHOLD = 0.4;

/**
 * Resolve a destination without asking the model.
 */
export function matchDestinationLocally(transcript: string): Destination | null {
  const haystack = stripFiller(transcript);
  if (!haystack) return null;

  let best: { destination: Destination; length: number } | null = null;

  for (const destination of DESTINATIONS) {
    for (const alias of destination.aliases) {
      const needle = stripFiller(alias);
      if (!needle || !haystack.includes(needle)) continue;
      if (needle.length / haystack.length < COVERAGE_THRESHOLD) continue;

      if (!best || needle.length > best.length) {
        best = { destination, length: needle.length };
      }
    }
  }

  return best?.destination ?? null;
}

