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
  // --- Market -------------------------------------------------------------
  {
    id: 'market_price',
    summary: "today's mandi price for the farmer's crop, and how it compares to MSP",
    aliases: ['mandi price', 'market price', 'crop price', 'rate', 'bhav', 'मंडी भाव', 'भाव', 'दाम'],
    steps: [
      { action: 'NAVIGATE', target: 'Market' },
      { action: 'HIGHLIGHT', target: 'price-card' },
    ],
    messageKey: 'avatar.guide.market_price',
  },
  {
    id: 'price_trend',
    summary: 'the last seven days of mandi prices as a trend',
    aliases: ['price trend', 'price history', 'last week price', 'भाव का रुझान'],
    steps: [
      { action: 'NAVIGATE', target: 'Market' },
      { action: 'SCROLL', target: 'price-trend' },
      { action: 'HIGHLIGHT', target: 'price-trend' },
    ],
    messageKey: 'avatar.guide.price_trend',
  },
  {
    id: 'sell_or_wait',
    summary: 'whether to sell the crop now or wait',
    aliases: ['sell or wait', 'should i sell', 'sell now', 'बेचूं या रुकूं', 'कब बेचें'],
    steps: [
      { action: 'NAVIGATE', target: 'Market' },
      { action: 'SCROLL', target: 'recommendation-card' },
      { action: 'HIGHLIGHT', target: 'recommendation-card' },
    ],
    messageKey: 'avatar.guide.sell_or_wait',
    // Phase 3 owns the prediction behind this; the card is an empty state today.
    caveatKey: 'avatar.guide.caveat.sell_or_wait',
  },

  // --- Home dashboard -----------------------------------------------------
  {
    id: 'weather',
    summary: 'the latest weather observation for the farmer’s field',
    aliases: ['weather', 'rain', 'temperature', 'forecast', 'मौसम', 'बारिश', 'तापमान'],
    steps: [
      { action: 'NAVIGATE', target: 'Home' },
      // Home is a long scroll. Bringing the card into view before spotlighting
      // it is the difference between guiding and spotlighting an empty screen.
      { action: 'SCROLL', target: 'weather-card' },
      { action: 'HIGHLIGHT', target: 'weather-card' },
    ],
    messageKey: 'avatar.guide.weather',
  },
  {
    id: 'crop_status',
    summary: 'which crop is sown on the selected land and when',
    aliases: ['my crop', 'crop status', 'what did i sow', 'फसल', 'मेरी फसल'],
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
    aliases: ['msp', 'minimum support price', 'support price', 'एमएसपी', 'न्यूनतम समर्थन मूल्य'],
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
    aliases: ['field analysis', 'crop health', 'satellite', 'growth stage', 'खेत का विश्लेषण', 'features', '14 inputs', 'model factors', 'vegetation', 'ndvi'],
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
    aliases: ['my lands', 'my farm', 'my fields', 'all lands', 'मेरी जमीन', 'मेरे खेत'],
    steps: [{ action: 'NAVIGATE', target: 'MyLands' }],
    messageKey: 'avatar.guide.my_lands',
  },
  {
    id: 'land_detail',
    summary: 'the summary of one particular land — boundary, area, current crop',
    aliases: ['land detail', 'this land', 'field detail', 'खेत का ब्यौरा'],
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
    aliases: ['register land', 'add land', 'new field', 'map my field', 'जमीन जोड़ें', 'नया खेत'],
    steps: [{ action: 'NAVIGATE', target: 'RegisterLandMethod' }],
    messageKey: 'avatar.guide.register_land',
  },
  {
    id: 'edit_boundary',
    summary: 'changing the boundary of an already-registered land',
    aliases: ['edit boundary', 'change boundary', 'fix my field', 'सीमा बदलें'],
    steps: [
      { action: 'NAVIGATE', target: 'MyFarm' },
      { action: 'HIGHLIGHT', target: 'my-farm-edit-boundary' },
    ],
    messageKey: 'avatar.guide.edit_boundary',
  },
  {
    id: 'soil_moisture',
    summary: 'the estimated soil moisture for the field',
    aliases: ['soil moisture', 'how wet is my soil', 'moisture', 'मिट्टी की नमी', 'नमी', 'moisture level', 'soil hydration', 'soil status'],
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
    aliases: ['calendar', 'schedule', 'what should i do', 'कैलेंडर', 'कार्यक्रम'],
    steps: [{ action: 'NAVIGATE', target: 'Calendar' }],
    messageKey: 'avatar.guide.calendar',
  },
  {
    id: 'irrigation_schedule',
    summary: 'when to irrigate — watering schedule and reminders',
    aliases: ['irrigation', 'watering', 'when to water', 'irrigation schedule', 'सिंचाई', 'पानी कब दें'],
    steps: [
      { action: 'NAVIGATE', target: 'Calendar' },
      { action: 'HIGHLIGHT', target: 'calendar-events' },
    ],
    messageKey: 'avatar.guide.calendar',
    // There is no irrigation schedule in this product yet — no table, no
    // service, no screen. Pointing at the calendar is the closest honest
    // answer, and the caveat is what stops it becoming a false one.
    caveatKey: 'avatar.guide.caveat.irrigation',
  },

  // --- Information --------------------------------------------------------
  {
    id: 'schemes',
    summary: 'the directory of government agricultural schemes and subsidies',
    aliases: ['schemes', 'subsidy', 'government scheme', 'yojana', 'योजना', 'सरकारी योजना'],
    steps: [{ action: 'NAVIGATE', target: 'Schemes' }],
    messageKey: 'avatar.guide.schemes',
  },
  {
    id: 'updates',
    summary: 'the agricultural news and updates feed',
    aliases: ['news', 'updates', 'what is happening', 'समाचार', 'खबर'],
    steps: [{ action: 'NAVIGATE', target: 'Updates' }],
    messageKey: 'avatar.guide.updates',
  },
  {
    id: 'alerts',
    summary: 'past alerts and messages sent to the farmer',
    aliases: ['alerts', 'notifications', 'messages', 'warnings', 'चेतावनी', 'सूचना'],
    steps: [{ action: 'NAVIGATE', target: 'Alerts' }],
    messageKey: 'avatar.guide.alerts',
  },
  {
    id: 'learning',
    summary: 'Krishi Academy — video tutorials on farming techniques',
    aliases: ['learn', 'tutorial', 'academy', 'how to video', 'teach me', 'सीखें', 'वीडियो'],
    steps: [{ action: 'NAVIGATE', target: 'Learning' }],
    messageKey: 'avatar.guide.learning',
  },
  {
    id: 'visual_assistant',
    summary: 'pointing the camera at a plant to have it looked at',
    aliases: ['camera', 'photo', 'scan my plant', 'take a picture', 'कैमरा', 'फोटो'],
    steps: [{ action: 'NAVIGATE', target: 'VisualAssistant' }],
    messageKey: 'avatar.guide.visual_assistant',
  },
  {
    id: 'history',
    summary: 'the farm overview and past activity timeline',
    aliases: ['history', 'past activity', 'timeline', 'इतिहास', 'पिछला'],
    steps: [{ action: 'NAVIGATE', target: 'History' }],
    messageKey: 'avatar.guide.history',
  },
  {
    id: 'profile',
    summary: 'the farmer’s own profile, language and notification settings',
    aliases: ['profile', 'my account', 'settings', 'change language', 'प्रोफाइल', 'भाषा बदलें'],
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
 *
 * Built from the same array the lookup uses, so a destination can never be
 * offered to the model without being resolvable, or resolvable without being
 * offered.
 */
export function destinationCatalogue(): string {
  return DESTINATIONS.map((destination) => `${destination.id}: ${destination.summary}`).join('\n');
}

/**
 * Lower-cased, punctuation-stripped, single-spaced — for alias matching.
 *
 * `\p{M}` has to be kept alongside `\p{L}`: Indic vowel signs and the virama
 * are combining marks, not letters, so dropping them shatters every Devanagari
 * word into loose consonants. Zero-width joiners go first and silently, since
 * replacing them with a space would split a word in half instead.
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
 *
 * Removing them is what lets "what is the mandi price today" match the same
 * alias as "mandi price". Note what is deliberately absent: anything that
 * signals the question is about the wider world rather than this app — a
 * "latest", a place name, a year. Those must survive, because they are the
 * evidence that this is not a navigation request at all.
 */
const FILLER = new Set([
  // English framing
  'show', 'me', 'my', 'mine', 'the', 'a', 'an', 'is', 'are', 'was', 'what',
  'where', 'when', 'which', 'can', 'could', 'i', 'see', 'view', 'look', 'open',
  'go', 'to', 'take', 'want', 'need', 'please', 'tell', 'find', 'get', 'about',
  'of', 'for', 'on', 'in', 'at', 'today', 'now', 'this', 'currently', 'much',
  'how', 'do', 'does', 'it', 'you', 'us', 'we', 'and', 'week', 'right',
  // Hindi framing
  'मुझे', 'मेरा', 'मेरी', 'मेरे', 'क्या', 'कहाँ', 'कहां', 'है', 'हैं', 'हूँ',
  'दिखाओ', 'दिखाइए', 'दिखाईये', 'बताओ', 'बताइए', 'खोलो', 'खोलिए', 'आज', 'अभी',
  'का', 'की', 'के', 'को', 'में', 'पर', 'कैसा', 'कैसी', 'कैसे', 'कितना', 'कितनी',
  'चाहिए', 'देखना', 'देखें', 'और',
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
 * The local path exists to skip a model call on "mandi bhav", not to guess at
 * a sentence. Below this, the request carries substance the alias does not
 * account for — and that leftover is usually the whole point of the question.
 */
const COVERAGE_THRESHOLD = 0.4;

/**
 * Resolve a destination without asking the model.
 *
 * This is the latency shortcut. Most navigation requests are a handful of
 * phrasings repeated endlessly ("mandi bhav", "what's the weather"), and none
 * of them need a language model to understand. A miss here is not a failure —
 * it just means the request goes to the router like any other.
 *
 * The coverage rule is what stops it overreaching. A bare substring match
 * would route "what are the latest solar irrigation subsidies in Maharashtra"
 * to the farm calendar on the strength of the word "irrigation" — swallowing a
 * research question, and answering it with a screen. Requiring the alias to
 * account for most of the request means anything with substance left over goes
 * to the router to be understood properly.
 *
 * Longest alias wins, so "price trend" is not swallowed by "price".
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
