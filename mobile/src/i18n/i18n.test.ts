import { SUPPORTED_LANGUAGES, isSupportedLanguage } from './index';
import en from './locales/en.json';

// Helper to extract all key paths from an object (e.g. ['common.continue', 'auth.loginTitle'])
function getLeafKeyPaths(obj: Record<string, unknown>, prefix = ''): string[] {
  let keys: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    const fullPath = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
      keys = keys.concat(getLeafKeyPaths(v as Record<string, unknown>, fullPath));
    } else {
      keys.push(fullPath);
    }
  }
  return keys;
}

describe('i18n System', () => {
  const expectedKeys = getLeafKeyPaths(en);

  it('supports all 22 official Indian languages plus English (23 total)', () => {
    expect(SUPPORTED_LANGUAGES.length).toBe(23);
    const codes = SUPPORTED_LANGUAGES.map((l) => l.code);
    expect(codes).toContain('hi');
    expect(codes).toContain('en');
    expect(codes).toContain('bn');
    expect(codes).toContain('mr');
    expect(codes).toContain('te');
    expect(codes).toContain('ta');
    expect(codes).toContain('gu');
    expect(codes).toContain('ur');
    expect(codes).toContain('kn');
    expect(codes).toContain('or');
    expect(codes).toContain('ml');
    expect(codes).toContain('pa');
    expect(codes).toContain('as');
    expect(codes).toContain('mai');
    expect(codes).toContain('sat');
    expect(codes).toContain('ks');
    expect(codes).toContain('ne');
    expect(codes).toContain('kok');
    expect(codes).toContain('sd');
    expect(codes).toContain('doi');
    expect(codes).toContain('mni');
    expect(codes).toContain('brx');
    expect(codes).toContain('sa');
  });

  it('correctly validates supported language codes', () => {
    expect(isSupportedLanguage('en')).toBe(true);
    expect(isSupportedLanguage('hi')).toBe(true);
    expect(isSupportedLanguage('ta')).toBe(true);
    expect(isSupportedLanguage('bn')).toBe(true);
    expect(isSupportedLanguage('invalid_code')).toBe(false);
    expect(isSupportedLanguage(null)).toBe(false);
  });

  SUPPORTED_LANGUAGES.forEach(({ code, label }) => {
    it(`locale file "${code}.json" (${label}) has 100% key parity with en.json`, () => {
      const locale = require(`./locales/${code}.json`);
      const localeKeys = new Set(getLeafKeyPaths(locale));

      const missingKeys = expectedKeys.filter((k) => !localeKeys.has(k));
      expect(missingKeys).toEqual([]);
    });
  });
});
