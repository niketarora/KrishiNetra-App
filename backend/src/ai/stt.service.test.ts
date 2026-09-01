import { describe, expect, it } from '@jest/globals';

import { detectLanguageFromText, parseTranscript, toProviderLanguage } from './stt.service.js';

describe('toProviderLanguage', () => {
  it('widens specific Indic language codes to provider variants', () => {
    expect(toProviderLanguage('hi')).toBe('hi-IN');
    expect(toProviderLanguage('mr')).toBe('mr-IN');
    expect(toProviderLanguage('ta')).toBe('ta-IN');
    expect(toProviderLanguage('te')).toBe('te-IN');
    expect(toProviderLanguage('bn')).toBe('bn-IN');
    expect(toProviderLanguage('gu')).toBe('gu-IN');
  });

  it('accepts a full tag for Indic languages', () => {
    expect(toProviderLanguage('hi-IN')).toBe('hi-IN');
    expect(toProviderLanguage('te-IN')).toBe('te-IN');
  });

  it('asks the provider to auto-detect language for English or unmapped codes so Indian languages are not forced to English', () => {
    expect(toProviderLanguage('en')).toBe('unknown');
    expect(toProviderLanguage('en-IN')).toBe('unknown');
    expect(toProviderLanguage('unknown')).toBe('unknown');
    expect(toProviderLanguage('xyz')).toBe('unknown');
    expect(toProviderLanguage(undefined)).toBe('unknown');
  });
});

describe('detectLanguageFromText', () => {
  it('detects Devanagari script as hi-IN', () => {
    expect(detectLanguageFromText('मेरा खेत कितना बड़ा है')).toBe('hi-IN');
    expect(detectLanguageFromText('गहू पिकावर रोग पडला आहे')).toBe('hi-IN');
  });

  it('detects Telugu script as te-IN', () => {
    expect(detectLanguageFromText('నా పొలం వాతావరణం ఎలా ఉంది')).toBe('te-IN');
  });

  it('detects Tamil script as ta-IN', () => {
    expect(detectLanguageFromText('என் பண்ணை வானிலை எப்படி உள்ளது')).toBe('ta-IN');
  });

  it('detects Punjabi Gurmukhi script as pa-IN', () => {
    expect(detectLanguageFromText('ਮੇਰਾ ਖੇਤ ਕਿੰਨਾ ਵੱਡਾ ਹੈ')).toBe('pa-IN');
  });

  it('returns null for Latin / English text', () => {
    expect(detectLanguageFromText('how big is my field')).toBeNull();
  });
});

describe('parseTranscript', () => {
  it('reads the documented response shape', () => {
    expect(
      parseTranscript({ transcript: 'मेरा खेत कितना बड़ा है', language_code: 'hi-IN' }),
    ).toEqual({ text: 'मेरा खेत कितना बड़ा है', language: 'hi-IN' });
  });

  it('tolerates alternate field names', () => {
    expect(parseTranscript({ text: 'hello', language: 'en-IN' })).toEqual({
      text: 'hello',
      language: 'en-IN',
    });
  });

  it('infers language from script if provider returned unknown or missing', () => {
    expect(parseTranscript({ transcript: 'मेरा खेत कितना बड़ा है' })).toEqual({
      text: 'मेरा खेत कितना बड़ा है',
      language: 'hi-IN',
    });
  });

  it('returns null for silence rather than an empty question', () => {
    // An empty transcript must not become a request. Answering "" would have
    // the avatar reply to something the farmer never said.
    expect(parseTranscript({ transcript: '   ' })).toBeNull();
    expect(parseTranscript({ transcript: '' })).toBeNull();
  });

  it('returns null when the response has no transcript at all', () => {
    expect(parseTranscript({ request_id: 'abc' })).toBeNull();
    expect(parseTranscript({})).toBeNull();
    expect(parseTranscript(null)).toBeNull();
    expect(parseTranscript('not an object')).toBeNull();
  });

  it('reports a missing language as null for English text rather than assuming', () => {
    expect(parseTranscript({ transcript: 'hello' })?.language).toBeNull();
  });
});
