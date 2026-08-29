import type { AlertEvent } from './types';

/**
 * Local/demo Alert & Communication History feed.
 *
 * Every entry below is a short, originally written illustration of what a
 * future alert engine + communication provider would produce — not a copy of
 * any real advisory or scheme notice — and every `location` is the farmer's
 * demo Pratapgarh, Rajasthan placeholder (0005_farmer_identity.sql), never a
 * real farmer's address. No real SMS or phone call was ever sent for any of
 * these; `channels` records only what a demo provider *would* have reported
 * (see `communicationProvider.ts`), and every screen that renders this data
 * carries a "demo communication" notice alongside it (IMPLEMENTATION.md rule
 * against presenting mock data as real).
 *
 * A real version would read this shape from KrishiNetra's own backend, fed by
 * a real alert engine and a real communication provider (Exotel or similar) —
 * nothing downstream of `AlertEvent` needs to change for that swap.
 */
export const ALERTS: AlertEvent[] = [
  {
    id: 'alert-rainfall-warning',
    category: 'weather',
    priority: 'high',
    title: {
      en: 'Heavy Rainfall Warning',
      hi: 'भारी वर्षा की चेतावनी',
    },
    body: {
      en: 'Heavy rainfall is expected in your region over the next 24 hours. Check field drainage and delay any fertilizer application until conditions clear.',
      hi: 'अगले 24 घंटों में आपके क्षेत्र में भारी वर्षा की संभावना है। खेत की जल निकासी जाँचें और मौसम साफ होने तक उर्वरक डालना टालें।',
    },
    location: 'Pratapgarh, Rajasthan',
    channels: { sms: 'sent', voice: 'initiated' },
    occurredDaysAgo: 1,
    occurredHour: 18,
    occurredMinute: 42,
  },
  {
    id: 'alert-severe-weather',
    category: 'disaster',
    priority: 'high',
    title: {
      en: 'Severe Weather Warning',
      hi: 'गंभीर मौसम चेतावनी',
    },
    body: {
      en: 'A severe weather system has been flagged for your area. Take precautionary measures — secure loose equipment and avoid open fields until it passes.',
      hi: 'आपके क्षेत्र के लिए एक गंभीर मौसम प्रणाली की चेतावनी दी गई है। सावधानी बरतें — खुले उपकरण सुरक्षित करें और इसके गुजरने तक खुले खेतों से बचें।',
    },
    location: 'Pratapgarh, Rajasthan',
    channels: { sms: 'sent', voice: 'initiated' },
    occurredDaysAgo: 2,
    occurredHour: 17,
    occurredMinute: 15,
  },
  {
    id: 'alert-pm-kisan-update',
    category: 'government',
    priority: 'medium',
    title: {
      en: 'PM-KISAN Update',
      hi: 'पीएम-किसान अपडेट',
    },
    body: {
      en: 'A government income-support scheme update may be applicable to your profile. Check the official portal to confirm your eligibility and installment status.',
      hi: 'एक सरकारी आय-सहायता योजना अपडेट आपकी प्रोफ़ाइल पर लागू हो सकता है। अपनी पात्रता और किस्त की स्थिति जानने के लिए आधिकारिक पोर्टल देखें।',
    },
    location: 'Pratapgarh, Rajasthan',
    channels: { sms: 'sent' },
    occurredDaysAgo: 1,
    occurredHour: 10,
    occurredMinute: 20,
  },
  {
    id: 'alert-heatwave-advisory',
    category: 'weather',
    priority: 'medium',
    title: {
      en: 'Heatwave Advisory',
      hi: 'लू (हीटवेव) सलाह',
    },
    body: {
      en: 'Above-normal temperatures are expected this week. Irrigate during early morning or evening hours and watch young crops for heat stress.',
      hi: 'इस सप्ताह सामान्य से अधिक तापमान की संभावना है। सुबह या शाम के समय सिंचाई करें और नई फसलों में गर्मी के तनाव पर नज़र रखें।',
    },
    location: 'Pratapgarh, Rajasthan',
    channels: { sms: 'sent' },
    occurredDaysAgo: 4,
    occurredHour: 8,
    occurredMinute: 5,
  },
  {
    id: 'alert-crop-advisory',
    category: 'advisory',
    priority: 'info',
    title: {
      en: 'Wheat Crop Advisory',
      hi: 'गेहूँ फसल सलाह',
    },
    body: {
      en: 'For wheat nearing the tillering stage, a light irrigation followed by a nitrogen top-dressing is commonly recommended — check with your local Krishi Vigyan Kendra for timing suited to your field.',
      hi: 'कल्ले निकलने की अवस्था के करीब गेहूँ के लिए, हल्की सिंचाई के बाद नाइट्रोजन की टॉप-ड्रेसिंग की सलाह आमतौर पर दी जाती है — अपने खेत के लिए सही समय हेतु स्थानीय कृषि विज्ञान केंद्र से सलाह लें।',
    },
    location: 'Pratapgarh, Rajasthan',
    channels: { sms: 'sent', voice: 'notSent' },
    occurredDaysAgo: 6,
    occurredHour: 9,
    occurredMinute: 30,
  },
];

export function getAlert(id: string): AlertEvent | null {
  return ALERTS.find((alert) => alert.id === id) ?? null;
}
