import type { AgriUpdate } from './types';

/**
 * Local/demo Krishi Updates feed.
 *
 * No news API key or scraping lives in this app — mobile code must never
 * hold one (Part 19), and uncontrolled scraping from the client is exactly
 * what the product brief rules out. Every entry below is a short, originally
 * written illustration, not a copy of any real article, and `source` always
 * self-identifies as the demo feed rather than naming a real outlet, so
 * nothing here can be mistaken for real reporting. `sourceUrl` is only set
 * when there's a real, stable official page to point to; it's left unset
 * rather than invented for entries with none.
 *
 * A real version would read this shape from KrishiNetra's own backend,
 * which would aggregate official/verified sources server-side — nothing
 * downstream of `AgriUpdate` needs to change for that.
 */
export const UPDATES: AgriUpdate[] = [
  {
    id: 'update-drought-resistant-wheat',
    title: {
      en: 'New drought-resistant wheat variety announced',
      hi: 'सूखा-प्रतिरोधी गेहूँ की नई किस्म की घोषणा',
    },
    category: 'agriculture',
    summary: {
      en: 'Learn how the new variety may help farmers in water-stressed areas.',
      hi: 'जानें कैसे यह नई किस्म पानी की कमी वाले क्षेत्रों के किसानों की मदद कर सकती है।',
    },
    body: {
      en: 'Agricultural research institutions periodically release wheat varieties bred for better performance under water stress. Farmers in low-rainfall or irrigation-scarce areas may benefit from asking their local Krishi Vigyan Kendra whether such a variety suits their district and soil type before the next sowing season.',
      hi: 'कृषि अनुसंधान संस्थान समय-समय पर गेहूँ की ऐसी किस्में जारी करते हैं जो पानी की कमी में बेहतर प्रदर्शन करती हैं। कम वर्षा या सिंचाई की कमी वाले क्षेत्रों के किसान अगली बुवाई से पहले अपने स्थानीय कृषि विज्ञान केंद्र से पूछ सकते हैं कि क्या ऐसी किस्म उनके जिले और मिट्टी के प्रकार के लिए उपयुक्त है।',
    },
    publishedDaysAgo: 2,
    source: 'KrishiNetra demo feed',
    relatedTopic: 'Wheat cultivation',
  },
  {
    id: 'update-monsoon-advisory',
    title: {
      en: 'Monsoon advisory for farmers',
      hi: 'किसानों के लिए मानसून सलाह',
    },
    category: 'weather',
    summary: {
      en: 'Important precautions for crop protection during heavy rain.',
      hi: 'भारी बारिश के दौरान फसल सुरक्षा के लिए महत्वपूर्ण सावधानियाँ।',
    },
    body: {
      en: 'During periods of heavy or erratic rainfall, checking field drainage, avoiding fresh fertilizer application right before expected rain, and delaying harvest of nearly-ready crops until conditions clear are commonly advised precautions. Always follow your regional weather department’s specific forecast and advisories for your district.',
      hi: 'भारी या अनियमित बारिश के दौरान, खेत की जल निकासी जाँचना, अपेक्षित बारिश से ठीक पहले नया उर्वरक न डालना, और लगभग तैयार फसल की कटाई मौसम साफ होने तक टालना आमतौर पर सुझाई जाने वाली सावधानियाँ हैं। हमेशा अपने क्षेत्र के मौसम विभाग के जिला-विशिष्ट पूर्वानुमान और सलाह का पालन करें।',
    },
    publishedDaysAgo: 1,
    source: 'KrishiNetra demo feed',
    relatedTopic: 'Weather advisory',
  },
  {
    id: 'update-soil-testing-initiative',
    title: {
      en: 'New soil testing initiative',
      hi: 'नई मिट्टी परीक्षण पहल',
    },
    category: 'government',
    summary: {
      en: 'Expanded access to soil testing may help more farmers plan fertilizer use.',
      hi: 'मिट्टी परीक्षण तक बढ़ी हुई पहुँच अधिक किसानों को उर्वरक उपयोग की योजना बनाने में मदद कर सकती है।',
    },
    body: {
      en: 'Government soil-testing programmes, such as the Soil Health Card scheme, periodically expand the number of labs and mobile testing units available to farmers. A current soil report is one of the most useful inputs for deciding how much fertilizer a field actually needs, rather than applying a fixed amount by habit.',
      hi: 'मृदा स्वास्थ्य कार्ड जैसी सरकारी मिट्टी-परीक्षण योजनाएँ समय-समय पर किसानों के लिए उपलब्ध प्रयोगशालाओं और मोबाइल परीक्षण इकाइयों की संख्या बढ़ाती हैं। एक ताज़ा मिट्टी रिपोर्ट यह तय करने के सबसे उपयोगी साधनों में से एक है कि खेत को वास्तव में कितने उर्वरक की जरूरत है, बजाय आदतन एक तय मात्रा डालने के।',
    },
    publishedDaysAgo: 3,
    source: 'KrishiNetra demo feed',
    sourceUrl: 'https://soilhealth.dac.gov.in',
    relatedTopic: 'Soil health',
  },
  {
    id: 'update-msp-revision',
    title: {
      en: 'MSP revision announced for the Rabi season',
      hi: 'रबी सीजन के लिए एमएसपी संशोधन की घोषणा',
    },
    category: 'market',
    summary: {
      en: 'Support prices are reviewed each season — here’s what to check.',
      hi: 'हर सीजन समर्थन मूल्यों की समीक्षा होती है — यहाँ जानें क्या देखें।',
    },
    body: {
      en: 'Minimum Support Prices are typically reviewed and announced ahead of each sowing season for notified crops. Checking the current MSP for your crop against your own field’s support-price tile on KrishiNetra’s Home screen — sourced from the government’s published rate — is a quick way to see where you stand.',
      hi: 'न्यूनतम समर्थन मूल्य आमतौर पर हर बुवाई सीजन से पहले अधिसूचित फसलों के लिए समीक्षा कर घोषित किए जाते हैं। अपनी फसल के मौजूदा एमएसपी की तुलना कृषिनेत्र के होम स्क्रीन पर मौजूद समर्थन मूल्य टाइल से करना — जो सरकार द्वारा प्रकाशित दर पर आधारित है — अपनी स्थिति जल्दी जानने का एक तरीका है।',
    },
    publishedDaysAgo: 5,
    source: 'KrishiNetra demo feed',
    relatedTopic: 'Market prices',
  },
  {
    id: 'update-farmer-helpline',
    title: {
      en: 'New farmer helpline launched',
      hi: 'नई किसान हेल्पलाइन शुरू',
    },
    category: 'technology',
    summary: {
      en: 'A phone helpline can be a useful backup when you’re unsure who to ask.',
      hi: 'जब समझ न आए कि किससे पूछें, तब फोन हेल्पलाइन एक उपयोगी सहारा हो सकती है।',
    },
    body: {
      en: 'Several states and central schemes run farmer helplines for crop advisory, scheme queries and grievance redressal. Saving your state agriculture department’s helpline number alongside your local Krishi Vigyan Kendra’s contact is a simple, low-tech backup for questions this app can’t yet answer.',
      hi: 'कई राज्य और केंद्रीय योजनाएँ फसल सलाह, योजना संबंधी सवालों और शिकायत निवारण के लिए किसान हेल्पलाइन चलाती हैं। अपने राज्य कृषि विभाग की हेल्पलाइन नंबर को स्थानीय कृषि विज्ञान केंद्र के संपर्क के साथ सहेजना, उन सवालों के लिए एक सरल सहारा है जिनका जवाब यह ऐप अभी नहीं दे सकता।',
    },
    publishedDaysAgo: 6,
    source: 'KrishiNetra demo feed',
    relatedTopic: 'Farmer support',
  },
];

export function getUpdate(id: string): AgriUpdate | null {
  return UPDATES.find((update) => update.id === id) ?? null;
}
