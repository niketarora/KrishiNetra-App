import * as Localization from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import as from './locales/as.json';
import bn from './locales/bn.json';
import brx from './locales/brx.json';
import doi from './locales/doi.json';
import en from './locales/en.json';
import gu from './locales/gu.json';
import hi from './locales/hi.json';
import kn from './locales/kn.json';
import kok from './locales/kok.json';
import ks from './locales/ks.json';
import mai from './locales/mai.json';
import ml from './locales/ml.json';
import mni from './locales/mni.json';
import mr from './locales/mr.json';
import ne from './locales/ne.json';
import or from './locales/or.json';
import pa from './locales/pa.json';
import sa from './locales/sa.json';
import sat from './locales/sat.json';
import sd from './locales/sd.json';
import ta from './locales/ta.json';
import te from './locales/te.json';
import ur from './locales/ur.json';

/**
 * All 22 official scheduled languages of India + English.
 */
export const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English', englishLabel: 'English', script: 'latin', isRTL: false },
  { code: 'hi', label: 'हिन्दी', englishLabel: 'Hindi', script: 'devanagari', isRTL: false },
  { code: 'bn', label: 'বাংলা', englishLabel: 'Bengali', script: 'bengali', isRTL: false },
  { code: 'mr', label: 'मराठी', englishLabel: 'Marathi', script: 'devanagari', isRTL: false },
  { code: 'te', label: 'తెలుగు', englishLabel: 'Telugu', script: 'telugu', isRTL: false },
  { code: 'ta', label: 'தமிழ்', englishLabel: 'Tamil', script: 'tamil', isRTL: false },
  { code: 'gu', label: 'ગુજરાતી', englishLabel: 'Gujarati', script: 'gujarati', isRTL: false },
  { code: 'ur', label: 'اردو', englishLabel: 'Urdu', script: 'arabic', isRTL: true },
  { code: 'kn', label: 'ಕನ್ನಡ', englishLabel: 'Kannada', script: 'kannada', isRTL: false },
  { code: 'or', label: 'ଓଡ଼ିଆ', englishLabel: 'Odia', script: 'odia', isRTL: false },
  { code: 'ml', label: 'മലയാളം', englishLabel: 'Malayalam', script: 'malayalam', isRTL: false },
  { code: 'pa', label: 'ਪੰਜਾਬੀ', englishLabel: 'Punjabi', script: 'gurmukhi', isRTL: false },
  { code: 'as', label: 'অসমীয়া', englishLabel: 'Assamese', script: 'bengali', isRTL: false },
  { code: 'mai', label: 'मैथिली', englishLabel: 'Maithili', script: 'devanagari', isRTL: false },
  { code: 'sat', label: 'ᱥᱟᱱᱛᱟᱲᱤ', englishLabel: 'Santali', script: 'olchiki', isRTL: false },
  { code: 'ks', label: 'کٲشُر', englishLabel: 'Kashmiri', script: 'arabic', isRTL: true },
  { code: 'ne', label: 'नेपाली', englishLabel: 'Nepali', script: 'devanagari', isRTL: false },
  { code: 'kok', label: 'कोंकणी', englishLabel: 'Konkani', script: 'devanagari', isRTL: false },
  { code: 'sd', label: 'سنڌي', englishLabel: 'Sindhi', script: 'arabic', isRTL: true },
  { code: 'doi', label: 'डोगरी', englishLabel: 'Dogri', script: 'devanagari', isRTL: false },
  { code: 'mni', label: 'মৈতৈলোন্', englishLabel: 'Manipuri', script: 'bengali', isRTL: false },
  { code: 'brx', label: 'बड़ो', englishLabel: 'Bodo', script: 'devanagari', isRTL: false },
  { code: 'sa', label: 'संस्कृतम्', englishLabel: 'Sanskrit', script: 'devanagari', isRTL: false },
] as const;

export type LanguageCode = (typeof SUPPORTED_LANGUAGES)[number]['code'];

export const DEFAULT_LANGUAGE: LanguageCode = 'en';

export function isSupportedLanguage(code: string | null | undefined): code is LanguageCode {
  return SUPPORTED_LANGUAGES.some((l) => l.code === code);
}

/** The device language, when we support it. */
export function deviceLanguage(): LanguageCode {
  const tag = Localization.getLocales()[0]?.languageCode;
  return isSupportedLanguage(tag) ? tag : DEFAULT_LANGUAGE;
}

void i18n.use(initReactI18next).init({
  resources: {
    as: { translation: as },
    bn: { translation: bn },
    brx: { translation: brx },
    doi: { translation: doi },
    en: { translation: en },
    gu: { translation: gu },
    hi: { translation: hi },
    kn: { translation: kn },
    kok: { translation: kok },
    ks: { translation: ks },
    mai: { translation: mai },
    ml: { translation: ml },
    mni: { translation: mni },
    mr: { translation: mr },
    ne: { translation: ne },
    or: { translation: or },
    pa: { translation: pa },
    sa: { translation: sa },
    sat: { translation: sat },
    sd: { translation: sd },
    ta: { translation: ta },
    te: { translation: te },
    ur: { translation: ur },
  },
  lng: deviceLanguage(),
  fallbackLng: DEFAULT_LANGUAGE,
  interpolation: { escapeValue: false },
  returnNull: false,
});

export default i18n;
