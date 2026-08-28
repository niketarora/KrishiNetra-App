import { describe, expect, it } from '@jest/globals';

import { MAX_SPEAK_CHARS, parseAudioChunks, toSpeechLanguage, trimForSpeech } from './tts.service.js';

describe('toSpeechLanguage', () => {
  it('widens the app language codes to the Indian variants', () => {
    expect(toSpeechLanguage('hi')).toBe('hi-IN');
    expect(toSpeechLanguage('en')).toBe('en-IN');
    expect(toSpeechLanguage('hi-IN')).toBe('hi-IN');
  });

  it('falls back to English rather than guessing', () => {
    // Unlike transcription there is no `unknown` here — the provider has to be
    // told which voice to read in. An English sentence in the Hindi voice is
    // understandable; Devanagari read by the English voice is not.
    expect(toSpeechLanguage('mr')).toBe('en-IN');
    expect(toSpeechLanguage(undefined)).toBe('en-IN');
  });
});

describe('trimForSpeech', () => {
  it('leaves an ordinary answer alone', () => {
    const answer = 'Your field is 2.5 acres. The wheat is ready in April.';
    expect(trimForSpeech(answer)).toBe(answer);
  });

  it('trims a runaway answer at a sentence boundary', () => {
    const sentence = 'Your wheat is doing well and the weather has been kind this week. ';
    const trimmed = trimForSpeech(sentence.repeat(40));

    expect(trimmed.length).toBeLessThanOrEqual(MAX_SPEAK_CHARS);
    // Stopping mid-word sounds like a fault; stopping at a full stop sounds
    // like an ending.
    expect(trimmed.endsWith('.')).toBe(true);
  });

  it('honours a Devanagari full stop too', () => {
    const trimmed = trimForSpeech('आपका खेत ढाई एकड़ का है। '.repeat(80));

    expect(trimmed.length).toBeLessThanOrEqual(MAX_SPEAK_CHARS);
    expect(trimmed.endsWith('।')).toBe(true);
  });

  it('takes the hard cut when no sentence break is near the limit', () => {
    // One enormous sentence: honouring an early break would throw away most of
    // the answer to gain a tidier ending.
    const trimmed = trimForSpeech('a'.repeat(MAX_SPEAK_CHARS * 2));
    expect(trimmed.length).toBe(MAX_SPEAK_CHARS);
  });
});

describe('parseAudioChunks', () => {
  it('reads the documented response shape', () => {
    expect(parseAudioChunks({ request_id: 'x', audios: ['AAA', 'BBB'] })).toEqual(['AAA', 'BBB']);
  });

  it('returns null when there is no audio to play', () => {
    expect(parseAudioChunks({ audios: [] })).toBeNull();
    expect(parseAudioChunks({ request_id: 'x' })).toBeNull();
    expect(parseAudioChunks(null)).toBeNull();
    expect(parseAudioChunks('not an object')).toBeNull();
  });

  it('rejects a partially empty batch rather than dropping a chunk silently', () => {
    // A missing chunk in the middle would cut a sentence out of the answer
    // without anything looking wrong.
    expect(parseAudioChunks({ audios: ['AAA', ''] })).toBeNull();
    expect(parseAudioChunks({ audios: ['AAA', 42] })).toBeNull();
  });
});
