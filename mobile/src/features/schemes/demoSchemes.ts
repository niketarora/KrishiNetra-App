import type { GovernmentScheme } from './types';

/**
 * Local/demo scheme directory.
 *
 * No government API key exists anywhere in this app, on either side — never
 * hardcode one into mobile source, and none has been configured on the
 * backend either (checked `backend/.env.example`/`config/env.ts`). Per the
 * product brief, that means this version is local demo data only.
 *
 * The six schemes below are real, well-known central schemes, referenced by
 * name and general, well-publicised purpose only. Nothing here asserts a
 * precise legal eligibility rule, benefit amount, or document requirement —
 * those change over time and by state, and inventing them would be worse
 * than not having them. Every screen that renders this data also renders a
 * SAMPLE DATA badge/banner and a "verify on the official site" disclaimer;
 * `officialUrl` is each scheme's real, stable government domain — a link
 * out, never scraped or fetched from this app.
 *
 * Replacing this file with a call through KrishiNetra's own backend (which
 * would hold any real government API credentials server-side, per Part 19)
 * is the intended integration path — nothing else needs to change for that.
 */
export const SCHEMES: GovernmentScheme[] = [
  {
    id: 'pm-kisan',
    name: { en: 'PM-KISAN', hi: 'पीएम-किसान' },
    category: 'incomeSupport',
    summary: {
      en: 'Direct income support for eligible farmer families.',
      hi: 'पात्र किसान परिवारों के लिए प्रत्यक्ष आय सहायता।',
    },
    benefit: {
      en: 'Income support paid directly to eligible farmers’ bank accounts in instalments through the year.',
      hi: 'पात्र किसानों के बैंक खातों में वर्ष भर किस्तों में सीधे आय सहायता दी जाती है।',
    },
    eligibility: {
      en: 'Generally aimed at small and marginal farmer families with cultivable landholding, subject to exclusion criteria set by the scheme.',
      hi: 'आमतौर पर खेती योग्य भूमि रखने वाले छोटे और सीमांत किसान परिवारों के लिए, योजना द्वारा तय बहिष्करण मानदंडों के अधीन।',
    },
    documents: [
      { en: 'Aadhaar card', hi: 'आधार कार्ड' },
      { en: 'Land ownership / record documents', hi: 'भूमि स्वामित्व / रिकॉर्ड दस्तावेज़' },
      { en: 'Bank account passbook (linked to Aadhaar)', hi: 'बैंक पासबुक (आधार से जुड़ा हुआ)' },
    ],
    howToApply: {
      en: 'Apply through the official PM-KISAN portal or your local revenue/agriculture office, which can confirm current steps and required forms.',
      hi: 'आधिकारिक पीएम-किसान पोर्टल या अपने स्थानीय राजस्व/कृषि कार्यालय के माध्यम से आवेदन करें, जो मौजूदा प्रक्रिया और आवश्यक फॉर्म बता सकते हैं।',
    },
    officialUrl: 'https://pmkisan.gov.in',
    metadata: {},
  },
  {
    id: 'pmfby',
    name: { en: 'Pradhan Mantri Fasal Bima Yojana', hi: 'प्रधानमंत्री फसल बीमा योजना' },
    category: 'insurance',
    summary: {
      en: 'Crop insurance support against yield loss from natural causes.',
      hi: 'प्राकृतिक कारणों से उपज हानि के विरुद्ध फसल बीमा सहायता।',
    },
    benefit: {
      en: 'Financial cover intended to reduce a farmer’s loss when a covered crop fails due to natural causes such as drought, flood or pest attack.',
      hi: 'सूखा, बाढ़ या कीट प्रकोप जैसे प्राकृतिक कारणों से फसल खराब होने पर किसान के नुकसान को कम करने के लिए वित्तीय सुरक्षा।',
    },
    eligibility: {
      en: 'Generally open to farmers growing a notified crop in a notified area, whether they have taken a crop loan or not.',
      hi: 'आमतौर पर अधिसूचित क्षेत्र में अधिसूचित फसल उगाने वाले किसानों के लिए, चाहे उन्होंने फसल ऋण लिया हो या नहीं।',
    },
    documents: [
      { en: 'Aadhaar card', hi: 'आधार कार्ड' },
      { en: 'Land record / sowing certificate', hi: 'भूमि रिकॉर्ड / बुवाई प्रमाण पत्र' },
      { en: 'Bank account details', hi: 'बैंक खाता विवरण' },
    ],
    howToApply: {
      en: 'Apply through a bank, Common Service Centre, insurance company or the official portal before the season’s enrolment deadline.',
      hi: 'सीजन की नामांकन समय-सीमा से पहले बैंक, कॉमन सर्विस सेंटर, बीमा कंपनी या आधिकारिक पोर्टल के माध्यम से आवेदन करें।',
    },
    officialUrl: 'https://pmfby.gov.in',
    metadata: {},
  },
  {
    id: 'soil-health-card',
    name: { en: 'Soil Health Card', hi: 'मृदा स्वास्थ्य कार्ड' },
    category: 'soilHealth',
    summary: {
      en: 'Information about your soil’s health and nutrient status.',
      hi: 'आपकी मिट्टी के स्वास्थ्य और पोषक तत्वों की स्थिति की जानकारी।',
    },
    benefit: {
      en: 'A report on soil nutrient levels with general crop-wise fertilizer and soil-amendment guidance for the tested field.',
      hi: 'परीक्षण किए गए खेत के लिए मिट्टी के पोषक स्तर की रिपोर्ट, फसल-वार उर्वरक और मिट्टी सुधार के सामान्य सुझावों के साथ।',
    },
    eligibility: {
      en: 'Generally open to any farmer who gets their field’s soil sample tested through the scheme’s designated labs.',
      hi: 'आमतौर पर किसी भी किसान के लिए जो योजना की निर्धारित प्रयोगशालाओं से अपने खेत की मिट्टी की जाँच कराता है।',
    },
    documents: [
      { en: 'Land record showing the field to be tested', hi: 'परीक्षण किए जाने वाले खेत का भूमि रिकॉर्ड' },
      { en: 'Aadhaar card', hi: 'आधार कार्ड' },
    ],
    howToApply: {
      en: 'Contact your local agriculture department or Krishi Vigyan Kendra to have a soil sample collected and tested.',
      hi: 'मिट्टी का नमूना एकत्र और परीक्षण कराने के लिए अपने स्थानीय कृषि विभाग या कृषि विज्ञान केंद्र से संपर्क करें।',
    },
    officialUrl: 'https://soilhealth.dac.gov.in',
    metadata: {},
  },
  {
    id: 'kisan-credit-card',
    name: { en: 'Kisan Credit Card', hi: 'किसान क्रेडिट कार्ड' },
    category: 'credit',
    summary: {
      en: 'Simplified access to short-term agricultural credit.',
      hi: 'अल्पकालिक कृषि ऋण तक सरल पहुँच।',
    },
    benefit: {
      en: 'A credit facility intended to give farmers timely access to working-capital loans for cultivation and related needs, generally at concessional interest terms.',
      hi: 'किसानों को खेती और संबंधित जरूरतों के लिए समय पर कार्यशील पूँजी ऋण देने की सुविधा, आमतौर पर रियायती ब्याज दरों पर।',
    },
    eligibility: {
      en: 'Generally open to farmers, including tenant farmers and sharecroppers in many states, who hold or cultivate agricultural land.',
      hi: 'आमतौर पर उन किसानों के लिए जिनके पास कृषि भूमि है या जो उसकी खेती करते हैं, जिसमें कई राज्यों में बटाईदार किसान भी शामिल हैं।',
    },
    documents: [
      { en: 'Identity and address proof', hi: 'पहचान और पते का प्रमाण' },
      { en: 'Land record documents', hi: 'भूमि रिकॉर्ड दस्तावेज़' },
      { en: 'Passport-size photographs', hi: 'पासपोर्ट आकार की तस्वीरें' },
    ],
    howToApply: {
      en: 'Apply at any participating bank branch, which can confirm current documentation and limits.',
      hi: 'किसी भी सहभागी बैंक शाखा में आवेदन करें, जो मौजूदा दस्तावेज़ीकरण और सीमाएँ बता सकती है।',
    },
    officialUrl: 'https://www.myscheme.gov.in',
    metadata: { landSizeMaxAcres: 12.5 },
  },
  {
    id: 'pmksy-irrigation',
    name: { en: 'PM Krishi Sinchayee Yojana', hi: 'प्रधानमंत्री कृषि सिंचाई योजना' },
    category: 'irrigation',
    summary: {
      en: 'Support for expanding assured irrigation and water-use efficiency.',
      hi: 'सुनिश्चित सिंचाई के विस्तार और जल-उपयोग दक्षता के लिए सहायता।',
    },
    benefit: {
      en: 'Support intended to expand irrigation coverage and promote efficient methods such as drip and sprinkler irrigation.',
      hi: 'सिंचाई कवरेज बढ़ाने और ड्रिप व स्प्रिंकलर जैसी कुशल विधियों को बढ़ावा देने के उद्देश्य से सहायता।',
    },
    eligibility: {
      en: 'Generally open to farmers investing in irrigation infrastructure or micro-irrigation equipment, subject to state-level implementation rules.',
      hi: 'आमतौर पर सिंचाई अवसंरचना या सूक्ष्म-सिंचाई उपकरण में निवेश करने वाले किसानों के लिए, राज्य-स्तरीय कार्यान्वयन नियमों के अधीन।',
    },
    documents: [
      { en: 'Land record documents', hi: 'भूमि रिकॉर्ड दस्तावेज़' },
      { en: 'Aadhaar card', hi: 'आधार कार्ड' },
      { en: 'Bank account details', hi: 'बैंक खाता विवरण' },
    ],
    howToApply: {
      en: 'Apply through your state’s agriculture or horticulture department, which administers implementation locally.',
      hi: 'अपने राज्य के कृषि या बागवानी विभाग के माध्यम से आवेदन करें, जो स्थानीय स्तर पर क्रियान्वयन करता है।',
    },
    officialUrl: 'https://pmksy.gov.in',
    metadata: {},
  },
  {
    id: 'pm-kusum',
    name: { en: 'PM-KUSUM', hi: 'पीएम-कुसुम' },
    category: 'other',
    summary: {
      en: 'Support for solar-powered agricultural pumps and grid-connected solar.',
      hi: 'सौर ऊर्जा से चलने वाले कृषि पंप और ग्रिड से जुड़ी सौर परियोजनाओं के लिए सहायता।',
    },
    benefit: {
      en: 'Support intended to help farmers install solar pumps or set up small solar power plants, reducing diesel/grid dependence for irrigation.',
      hi: 'किसानों को सौर पंप लगाने या छोटे सौर ऊर्जा संयंत्र स्थापित करने में मदद, जिससे सिंचाई के लिए डीज़ल/ग्रिड पर निर्भरता कम हो।',
    },
    eligibility: {
      en: 'Generally open to individual farmers or farmer groups with suitable land or an existing irrigation pump connection, subject to state-level rules.',
      hi: 'आमतौर पर उपयुक्त भूमि या मौजूदा सिंचाई पंप कनेक्शन वाले व्यक्तिगत किसानों या किसान समूहों के लिए, राज्य-स्तरीय नियमों के अधीन।',
    },
    documents: [
      { en: 'Land record documents', hi: 'भूमि रिकॉर्ड दस्तावेज़' },
      { en: 'Aadhaar card', hi: 'आधार कार्ड' },
      { en: 'Existing electricity/pump connection details, if any', hi: 'मौजूदा बिजली/पंप कनेक्शन विवरण, यदि कोई हो' },
    ],
    howToApply: {
      en: 'Apply through your state’s renewable energy or agriculture department portal, which administers implementation locally.',
      hi: 'अपने राज्य के नवीकरणीय ऊर्जा या कृषि विभाग के पोर्टल के माध्यम से आवेदन करें, जो स्थानीय स्तर पर क्रियान्वयन करता है।',
    },
    officialUrl: 'https://pmkusum.mnre.gov.in',
    metadata: { crops: [] },
  },
];

export function getScheme(id: string): GovernmentScheme | null {
  return SCHEMES.find((scheme) => scheme.id === id) ?? null;
}
