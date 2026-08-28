import type { IconName } from '@/components/ui';

/**
 * Feature #14, v1: local/static tutorial content.
 *
 * Bilingual text lives directly on the data, the same way the crop catalogue
 * already carries `name_en`/`name_hi` on one record rather than as i18n keys
 * (see `services/agronomy.ts`, `cropName()` in `HomeScreen.tsx`) — this is
 * content, not UI chrome, so it does not belong in `i18n/locales/*.json`.
 * This file is exactly what a future CMS/backend/AI-generated-content source
 * would replace; nothing else reads anything but the shapes below.
 */
export type LocalizedText = { en: string; hi: string };

export type TutorialCategoryId =
  | 'soilPreparation'
  | 'sowing'
  | 'irrigation'
  | 'fertilizerBasics'
  | 'pestPrevention'
  | 'cropCare'
  | 'harvesting'
  | 'governmentSchemes';

export type TutorialCategory = {
  id: TutorialCategoryId;
  icon: IconName;
  label: LocalizedText;
};

export type Tutorial = {
  id: string;
  categoryId: TutorialCategoryId;
  title: LocalizedText;
  /** "Why it matters". */
  why: LocalizedText;
  steps: LocalizedText[];
  tips: LocalizedText[];
  /** Not every tutorial needs one — rendered only when present. */
  commonMistake?: LocalizedText;
  /**
   * Lightweight, unused-for-now metadata. No screen filters or recommends by
   * this in v1 — it exists only so a later phase can add "recommended for
   * your wheat crop" style filtering without changing this shape.
   */
  metadata: {
    crops?: string[];
    seasons?: ('kharif' | 'rabi' | 'zaid')[];
    growthStages?: string[];
    regions?: string[];
  };
};

/** Picks the farmer's language the same way `cropName()` picks a crop name. */
export function localize(text: LocalizedText, language: string): string {
  return language.startsWith('hi') ? text.hi : text.en;
}

export const TUTORIAL_CATEGORIES: TutorialCategory[] = [
  { id: 'soilPreparation', icon: 'field', label: { en: 'Soil Preparation', hi: 'मिट्टी की तैयारी' } },
  { id: 'sowing', icon: 'plant', label: { en: 'Sowing', hi: 'बुवाई' } },
  { id: 'irrigation', icon: 'droplet', label: { en: 'Irrigation', hi: 'सिंचाई' } },
  { id: 'fertilizerBasics', icon: 'plant', label: { en: 'Fertilizer Basics', hi: 'उर्वरक की मूल बातें' } },
  { id: 'pestPrevention', icon: 'alert', label: { en: 'Pest Prevention', hi: 'कीट रोकथाम' } },
  { id: 'cropCare', icon: 'plant', label: { en: 'Crop Care', hi: 'फसल की देखभाल' } },
  { id: 'harvesting', icon: 'field', label: { en: 'Harvesting', hi: 'कटाई' } },
  { id: 'governmentSchemes', icon: 'help', label: { en: 'Government Schemes', hi: 'सरकारी योजनाएँ' } },
];

/** One complete, practical tutorial per category for this first version. */
export const TUTORIALS: Tutorial[] = [
  {
    id: 'soil-preparation-before-sowing',
    categoryId: 'soilPreparation',
    title: { en: 'Soil Preparation Before Sowing', hi: 'बुवाई से पहले मिट्टी की तैयारी' },
    why: {
      en: 'Well-prepared soil holds air, water and nutrients where young roots can reach them, giving seedlings a strong start.',
      hi: 'अच्छी तरह तैयार मिट्टी हवा, पानी और पोषक तत्वों को जड़ों तक पहुँचाती है, जिससे पौध को मजबूत शुरुआत मिलती है।',
    },
    steps: [
      { en: 'Clear previous crop residue where appropriate.', hi: 'जहाँ उपयुक्त हो, पिछली फसल के अवशेष हटाएँ।' },
      { en: 'Loosen the soil with ploughing or tilling.', hi: 'जुताई करके मिट्टी को ढीला करें।' },
      { en: 'Check soil moisture before working it further.', hi: 'आगे काम करने से पहले मिट्टी की नमी जाँचें।' },
      { en: 'Level the field and prepare it for sowing.', hi: 'खेत को समतल करें और बुवाई के लिए तैयार करें।' },
    ],
    tips: [
      { en: 'Avoid working very wet soil — it damages soil structure.', hi: 'बहुत गीली मिट्टी में काम करने से बचें — इससे मिट्टी की संरचना बिगड़ती है।' },
      { en: 'Follow crop-specific tillage recommendations.', hi: 'फसल के अनुसार जुताई की सिफारिशों का पालन करें।' },
    ],
    commonMistake: {
      en: 'Excessive tillage can damage soil structure and long-term fertility.',
      hi: 'अत्यधिक जुताई मिट्टी की संरचना और दीर्घकालिक उर्वरता को नुकसान पहुँचा सकती है।',
    },
    metadata: { seasons: ['kharif', 'rabi'] },
  },
  {
    id: 'sowing-seed-depth-and-spacing',
    categoryId: 'sowing',
    title: { en: 'Sowing: Seed Depth and Spacing', hi: 'बुवाई: बीज की गहराई और दूरी' },
    why: {
      en: 'Correct depth and spacing decide how well seeds germinate and how much competition plants face for light, water and nutrients.',
      hi: 'सही गहराई और दूरी तय करती है कि बीज कितनी अच्छी तरह अंकुरित होंगे और पौधों को प्रकाश, पानी व पोषक तत्वों के लिए कितनी प्रतिस्पर्धा करनी होगी।',
    },
    steps: [
      { en: 'Choose good-quality, treated seed for your crop and variety.', hi: 'अपनी फसल और किस्म के लिए अच्छी गुणवत्ता वाला, उपचारित बीज चुनें।' },
      { en: 'Sow at the recommended depth for that seed size.', hi: 'बीज के आकार के अनुसार अनुशंसित गहराई पर बुवाई करें।' },
      { en: 'Maintain even row and plant spacing.', hi: 'पंक्तियों और पौधों के बीच समान दूरी बनाए रखें।' },
      { en: 'Water lightly after sowing if the soil is dry.', hi: 'यदि मिट्टी सूखी है तो बुवाई के बाद हल्की सिंचाई करें।' },
    ],
    tips: [
      { en: 'Sowing too deep delays or prevents germination.', hi: 'बहुत गहरी बुवाई अंकुरण में देरी करती है या रोक देती है।' },
      { en: 'Crowded spacing increases disease and pest pressure later.', hi: 'भीड़भाड़ वाली दूरी बाद में रोग और कीट का दबाव बढ़ाती है।' },
    ],
    commonMistake: {
      en: 'Sowing right after heavy rain, into waterlogged soil, often rots the seed.',
      hi: 'भारी बारिश के तुरंत बाद, जलभराव वाली मिट्टी में बुवाई करने से अक्सर बीज सड़ जाता है।',
    },
    metadata: { seasons: ['kharif', 'rabi'] },
  },
  {
    id: 'irrigation-scheduling-basics',
    categoryId: 'irrigation',
    title: { en: 'Irrigation Scheduling Basics', hi: 'सिंचाई अनुसूची की मूल बातें' },
    why: {
      en: 'Watering at the right growth stages, rather than on a fixed calendar, saves water and avoids both drought stress and waterlogging.',
      hi: 'एक निश्चित समय-सारणी के बजाय सही वृद्धि चरणों पर सिंचाई करने से पानी की बचत होती है और सूखे व जलभराव दोनों से बचाव होता है।',
    },
    steps: [
      { en: 'Identify your crop’s critical water-need stages (e.g. flowering, grain-fill).', hi: 'अपनी फसल के महत्वपूर्ण जल-आवश्यकता वाले चरण पहचानें (जैसे फूल आना, दाना भरना)।' },
      { en: 'Check soil moisture before irrigating rather than by habit.', hi: 'आदतन नहीं, बल्कि सिंचाई से पहले मिट्टी की नमी जाँचें।' },
      { en: 'Irrigate early morning or evening to reduce evaporation loss.', hi: 'वाष्पीकरण से होने वाली हानि कम करने के लिए सुबह जल्दी या शाम को सिंचाई करें।' },
      { en: 'Ensure the field has proper drainage for excess water.', hi: 'अतिरिक्त पानी की निकासी के लिए खेत में उचित जल निकासी सुनिश्चित करें।' },
    ],
    tips: [
      { en: 'A handful of soil that crumbles rather than balls up usually needs water.', hi: 'यदि मुट्ठी भर मिट्टी गोला बनने के बजाय बिखर जाए, तो आमतौर पर पानी की जरूरत होती है।' },
      { en: 'Match irrigation method (flood, drip, sprinkler) to what your field and crop can use well.', hi: 'सिंचाई की विधि (बाढ़, ड्रिप, स्प्रिंकलर) को अपने खेत और फसल के अनुकूल चुनें।' },
    ],
    commonMistake: {
      en: 'Overwatering is as harmful as underwatering — it starves roots of oxygen and invites root disease.',
      hi: 'अधिक पानी देना उतना ही हानिकारक है जितना कम देना — इससे जड़ों को ऑक्सीजन नहीं मिलती और जड़ रोग का खतरा बढ़ता है।',
    },
    metadata: {},
  },
  {
    id: 'fertilizer-basics-npk',
    categoryId: 'fertilizerBasics',
    title: { en: 'Fertilizer Basics: Understanding N-P-K', hi: 'उर्वरक की मूल बातें: N-P-K को समझना' },
    why: {
      en: 'Nitrogen, Phosphorus and Potassium each do a different job for the plant — knowing which one a crop needs, and when, avoids waste and poor growth.',
      hi: 'नाइट्रोजन, फॉस्फोरस और पोटैशियम पौधे के लिए अलग-अलग काम करते हैं — किस फसल को कब किसकी जरूरत है, यह जानने से बर्बादी और कमजोर वृद्धि से बचाव होता है।',
    },
    steps: [
      { en: 'Get a soil test where possible, so you fertilize what the soil actually lacks.', hi: 'जहाँ संभव हो, मिट्टी की जाँच कराएँ ताकि आप उसी की पूर्ति करें जिसकी मिट्टी में वास्तव में कमी है।' },
      { en: 'Apply a basal dose at or before sowing.', hi: 'बुवाई के समय या उससे पहले आधार खुराक डालें।' },
      { en: 'Split top-dressing doses across key growth stages rather than one large dose.', hi: 'एक बड़ी खुराक के बजाय मुख्य वृद्धि चरणों में टॉप-ड्रेसिंग खुराक बाँटें।' },
      { en: 'Water the field after applying fertilizer so nutrients reach the root zone.', hi: 'उर्वरक डालने के बाद खेत की सिंचाई करें ताकि पोषक तत्व जड़ क्षेत्र तक पहुँचें।' },
    ],
    tips: [
      { en: 'Nitrogen mainly supports leafy growth; Phosphorus supports roots and flowering; Potassium supports overall plant strength and grain quality.', hi: 'नाइट्रोजन मुख्यतः पत्तेदार वृद्धि में मदद करता है; फॉस्फोरस जड़ों और फूल आने में; पोटैशियम पौधे की मजबूती और दाने की गुणवत्ता में।' },
      { en: 'Combine chemical fertilizer with organic manure where possible for long-term soil health.', hi: 'दीर्घकालिक मिट्टी स्वास्थ्य के लिए जहाँ संभव हो, रासायनिक उर्वरक के साथ जैविक खाद मिलाएँ।' },
    ],
    commonMistake: {
      en: 'Applying too much nitrogen late in the season can delay maturity and weaken stems.',
      hi: 'सीजन के अंत में बहुत अधिक नाइट्रोजन डालने से पकने में देरी हो सकती है और तना कमजोर हो सकता है।',
    },
    metadata: {},
  },
  {
    id: 'pest-prevention-early-signs',
    categoryId: 'pestPrevention',
    title: { en: 'Pest Prevention: Spotting Early Signs', hi: 'कीट रोकथाम: शुरुआती संकेत पहचानना' },
    why: {
      en: 'Catching pest pressure early, before it spreads across the field, means a smaller and cheaper response — often without needing heavy chemical use.',
      hi: 'खेत में फैलने से पहले कीट के दबाव को जल्दी पकड़ लेने से छोटा और सस्ता उपाय काम आता है — अक्सर भारी रासायनिक उपयोग की जरूरत ही नहीं पड़ती।',
    },
    steps: [
      { en: 'Walk the field regularly and check leaves, stems and undersides for pests or damage.', hi: 'खेत में नियमित रूप से घूमें और पत्तियों, तनों व निचली सतह पर कीट या नुकसान की जाँच करें।' },
      { en: 'Identify the pest before choosing any treatment.', hi: 'कोई भी उपचार चुनने से पहले कीट की पहचान करें।' },
      { en: 'Try mechanical or biological control first for a small, early infestation.', hi: 'शुरुआती और छोटे संक्रमण के लिए पहले यांत्रिक या जैविक नियंत्रण आजमाएँ।' },
      { en: 'Use recommended pesticide doses and timing only if needed, following label instructions.', hi: 'यदि आवश्यक हो तो ही, लेबल निर्देशों का पालन करते हुए अनुशंसित कीटनाशक मात्रा और समय का उपयोग करें।' },
    ],
    tips: [
      { en: 'Yellow or white sticky traps help spot flying pests early.', hi: 'पीले या सफेद चिपचिपे जाल उड़ने वाले कीटों को जल्दी पकड़ने में मदद करते हैं।' },
      { en: 'Healthy, well-nourished plants resist pests better than stressed ones.', hi: 'स्वस्थ और अच्छी तरह पोषित पौधे तनावग्रस्त पौधों की तुलना में कीटों का बेहतर प्रतिरोध करते हैं।' },
    ],
    commonMistake: {
      en: 'Spraying pesticide before identifying the actual pest often kills helpful insects without solving the problem.',
      hi: 'वास्तविक कीट की पहचान किए बिना कीटनाशक छिड़कने से अक्सर लाभकारी कीट भी मर जाते हैं और समस्या हल नहीं होती।',
    },
    metadata: {},
  },
  {
    id: 'crop-care-through-growth-stages',
    categoryId: 'cropCare',
    title: { en: 'Crop Care Through the Growth Stages', hi: 'वृद्धि चरणों के दौरान फसल की देखभाल' },
    why: {
      en: 'A crop needs different attention as it moves from seedling to flowering to grain-fill — matching care to the stage protects the eventual yield.',
      hi: 'फसल को पौध से फूल आने और दाना भरने तक अलग-अलग ध्यान की जरूरत होती है — चरण के अनुसार देखभाल करने से अंतिम उपज सुरक्षित रहती है।',
    },
    steps: [
      { en: 'Thin out overcrowded seedlings early, if the crop needs it.', hi: 'यदि फसल को जरूरत हो, तो शुरुआत में भीड़भाड़ वाली पौध को पतला करें।' },
      { en: 'Remove weeds regularly — they compete for water and nutrients.', hi: 'खरपतवार नियमित रूप से हटाएँ — वे पानी और पोषक तत्वों के लिए प्रतिस्पर्धा करते हैं।' },
      { en: 'Watch for stress signs (wilting, yellowing) at each stage and address the likely cause.', hi: 'प्रत्येक चरण में तनाव के संकेत (मुरझाना, पीलापन) देखें और संभावित कारण का समाधान करें।' },
      { en: 'Support tall or vine crops if they are prone to lodging or falling over.', hi: 'यदि लंबी या बेल वाली फसलें गिरने की प्रवृत्ति रखती हैं, तो उन्हें सहारा दें।' },
    ],
    tips: [
      { en: 'Keep a simple record of what you observe each week — it makes patterns easier to spot.', hi: 'हर हफ्ते जो देखें उसका एक साधारण रिकॉर्ड रखें — इससे पैटर्न पहचानना आसान होता है।' },
      { en: 'Compare growth against a neighbouring healthy patch, not just against last season.', hi: 'केवल पिछले सीजन से नहीं, बल्कि पास के स्वस्थ हिस्से से वृद्धि की तुलना करें।' },
    ],
    commonMistake: {
      en: 'Ignoring early weed growth because it looks minor lets weeds establish roots that are far harder to remove later.',
      hi: 'शुरुआती खरपतवार को मामूली समझकर नजरअंदाज करने से उसकी जड़ें जम जाती हैं, जिन्हें बाद में हटाना कहीं अधिक मुश्किल होता है।',
    },
    metadata: {},
  },
  {
    id: 'harvesting-at-the-right-time',
    categoryId: 'harvesting',
    title: { en: 'Harvesting at the Right Time', hi: 'सही समय पर कटाई' },
    why: {
      en: 'Harvesting too early or too late both reduce yield and quality — timing it well protects the value of the whole season’s work.',
      hi: 'बहुत जल्दी या बहुत देर से कटाई करने से उपज और गुणवत्ता दोनों घटती है — सही समय पर कटाई पूरे सीजन की मेहनत की कीमत सुरक्षित रखती है।',
    },
    steps: [
      { en: 'Check the crop’s maturity signs (colour change, grain hardness, moisture) rather than only the calendar date.', hi: 'केवल तारीख पर नहीं, बल्कि फसल के पकने के संकेतों (रंग बदलना, दाने की कठोरता, नमी) पर ध्यान दें।' },
      { en: 'Check the weather forecast before starting, to avoid harvesting into rain.', hi: 'बारिश में कटाई से बचने के लिए शुरू करने से पहले मौसम का पूर्वानुमान देखें।' },
      { en: 'Harvest in the recommended time of day for your crop (often morning for reduced shattering).', hi: 'अपनी फसल के लिए दिन के अनुशंसित समय पर कटाई करें (अक्सर दाना झड़ने से बचाने के लिए सुबह)।' },
      { en: 'Dry and store the produce properly right after harvest to avoid spoilage.', hi: 'खराब होने से बचाने के लिए कटाई के तुरंत बाद उपज को ठीक से सुखाएँ और भंडारित करें।' },
    ],
    tips: [
      { en: 'A small test-harvest of a patch can confirm readiness before cutting the whole field.', hi: 'पूरे खेत की कटाई से पहले एक छोटे हिस्से की परीक्षण-कटाई तैयारी की पुष्टि कर सकती है।' },
      { en: 'Clean and check harvesting tools or machinery beforehand to avoid delays.', hi: 'देरी से बचने के लिए पहले से कटाई के उपकरण या मशीनरी साफ करें और जाँच लें।' },
    ],
    commonMistake: {
      en: 'Delaying harvest past maturity to wait for a better price often loses more to shattering, pests or weather than the price gain.',
      hi: 'बेहतर कीमत के इंतजार में पकने के बाद कटाई में देरी करने से अक्सर दाना झड़ने, कीट या मौसम से कीमत के फायदे से कहीं ज्यादा नुकसान होता है।',
    },
    metadata: {},
  },
  {
    id: 'government-schemes-overview',
    categoryId: 'governmentSchemes',
    title: { en: 'Government Schemes: What to Check', hi: 'सरकारी योजनाएँ: क्या जाँचें' },
    why: {
      en: 'Central and state schemes can cover crop insurance, input subsidies and income support — knowing where to check keeps you from missing support you’re entitled to.',
      hi: 'केंद्र और राज्य की योजनाएँ फसल बीमा, इनपुट सब्सिडी और आय सहायता को कवर कर सकती हैं — कहाँ जाँचना है यह जानने से आप अपने हक की सहायता से वंचित नहीं रहते।' ,
    },
    steps: [
      { en: 'Check your eligibility on the official scheme portal or with your local agriculture office.', hi: 'आधिकारिक योजना पोर्टल पर या अपने स्थानीय कृषि कार्यालय में अपनी पात्रता जाँचें।' },
      { en: 'Keep your land records and bank account (linked to Aadhaar) up to date, as most schemes require them.', hi: 'अपने भूमि अभिलेख और बैंक खाता (आधार से जुड़ा हुआ) अद्यतन रखें, क्योंकि अधिकांश योजनाओं में इनकी आवश्यकता होती है।' },
      { en: 'Note application windows and renewal dates — many schemes are seasonal or annual.', hi: 'आवेदन की समय-सीमा और नवीनीकरण तिथियाँ नोट करें — कई योजनाएँ मौसमी या वार्षिक होती हैं।' },
      { en: 'Keep copies of every application and receipt for follow-up.', hi: 'आगे की कार्रवाई के लिए हर आवेदन और रसीद की प्रति रखें।' },
    ],
    tips: [
      { en: 'Your local Krishi Vigyan Kendra or agriculture extension officer can usually help with paperwork.', hi: 'आपका स्थानीय कृषि विज्ञान केंद्र या कृषि विस्तार अधिकारी आमतौर पर कागजी कार्रवाई में मदद कर सकता है।' },
      { en: 'Be cautious of anyone asking for payment to "guarantee" a government scheme benefit — genuine schemes don’t work that way.', hi: 'सरकारी योजना का लाभ "गारंटी" देने के नाम पर भुगतान माँगने वाले किसी भी व्यक्ति से सावधान रहें — असली योजनाएँ इस तरह काम नहीं करतीं।' },
    ],
    metadata: {},
  },
];

export function getTutorial(id: string): Tutorial | null {
  return TUTORIALS.find((tutorial) => tutorial.id === id) ?? null;
}

export function getCategory(id: TutorialCategoryId): TutorialCategory | null {
  return TUTORIAL_CATEGORIES.find((category) => category.id === id) ?? null;
}
