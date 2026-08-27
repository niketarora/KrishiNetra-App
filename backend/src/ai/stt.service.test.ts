import { describe, expect, it } from '@jest/globals';

import { parseTranscript, toProviderLanguage } from './stt.service.js';

describe('toProviderLanguage', () => {
  it('widens the app language codes to the Indian variants', () => {
    expect(toProviderLanguage('hi')).toBe('hi-IN');
    expect(toProviderLanguage('en')).toBe('en-IN');
  });

  it('accepts a full tag', () => {
    expect(toProviderLanguage('hi-IN')).toBe('hi-IN');
  });

  it('asks the provider to detect anything else', () => {
    // A farmer using the app in English may still speak Marathi. Forcing en-IN
    // would transcribe it as nonsense and then answer the nonsense.
    expect(toProviderLanguage('mr')).toBe('unknown');
    expect(toProviderLanguage(undefined)).toBe('unknown');
  });
});

describe('parseTranscript', () => {
  it('reads the documented response shape', () => {
    expect(
      parseTranscript({ transcript: 'मेरा खेत कितना बड़ा है', language_code: 'hi-IN' }),
    ).toEqual({ text: 'मेरा खेत कितना बड़ा है', language: 'hi-IN' });
  });

  it('tolerates the alternate field names', () => {
    expect(parseTranscript({ text: 'hello', language: 'en-IN' })).toEqual({
      text: 'hello',
      language: 'en-IN',
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

  it('reports a missing language as null rather than assuming English', () => {
    expect(parseTranscript({ transcript: 'hello' })?.language).toBeNull();
  });
});
