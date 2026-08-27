import { describe, expect, it } from '@jest/globals';

import { concatWav, encodeWav, parseWav, WavError } from './wav.js';

/** A WAV carrying `samples` as 16-bit mono PCM. */
function wav(samples: number[], sampleRate = 16_000, channels = 1): Buffer {
  const pcm = Buffer.alloc(samples.length * 2);
  samples.forEach((sample, index) => pcm.writeInt16LE(sample, index * 2));
  return encodeWav(pcm, { channels, sampleRate, bitsPerSample: 16 });
}

describe('parseWav', () => {
  it('reads back what encodeWav wrote', () => {
    const parsed = parseWav(wav([1, -1, 32_767, -32_768]));

    expect(parsed.channels).toBe(1);
    expect(parsed.sampleRate).toBe(16_000);
    expect(parsed.bitsPerSample).toBe(16);
    expect(parsed.data.length).toBe(8);
  });

  it('walks past a chunk it does not care about', () => {
    // A provider that starts emitting LIST metadata must not have it played as
    // audio, which is what assuming a 44-byte header would do.
    const base = wav([100, 200]);
    const list = Buffer.alloc(8 + 4);
    list.write('LIST', 0, 'ascii');
    list.writeUInt32LE(4, 4);
    list.write('INFO', 8, 'ascii');

    const withList = Buffer.concat([base.subarray(0, 36), list, base.subarray(36)]);
    withList.writeUInt32LE(withList.length - 8, 4);

    const parsed = parseWav(withList);
    expect(parsed.data.length).toBe(4);
    expect(parsed.data.readInt16LE(0)).toBe(100);
  });

  it('rejects anything that is not a 16-bit PCM WAVE', () => {
    expect(() => parseWav(Buffer.from('not audio at all'))).toThrow(WavError);
    expect(() => parseWav(Buffer.alloc(4))).toThrow(WavError);
  });

  it('stops at the end of a truncated download rather than reading past it', () => {
    const full = wav([1, 2, 3, 4, 5, 6]);
    // The header still claims 12 bytes of PCM; only 6 arrived.
    const truncated = full.subarray(0, full.length - 6);

    expect(parseWav(truncated).data.length).toBe(6);
  });
});

describe('concatWav', () => {
  it('joins chunks into one playable file', () => {
    // The point of the whole module: a byte-for-byte concatenation would leave
    // a header claiming only the first chunk, and the farmer would hear the
    // first clause of the answer and nothing more.
    const joined = concatWav([wav([1, 2]), wav([3, 4]), wav([5, 6])]);
    const parsed = parseWav(joined);

    expect(parsed.data.length).toBe(12);
    expect(joined.readUInt32LE(40)).toBe(12);
    expect(joined.length).toBe(44 + 12);
    expect([0, 1, 2, 3, 4, 5].map((i) => parsed.data.readInt16LE(i * 2))).toEqual([
      1, 2, 3, 4, 5, 6,
    ]);
  });

  it('returns a single chunk unchanged in content', () => {
    expect(parseWav(concatWav([wav([7, 8])])).data.length).toBe(4);
  });

  it('refuses to splice mismatched formats', () => {
    // Playing 8 kHz audio at 16 kHz would render the second half of the answer
    // at the wrong pitch — worse than an error the farmer can retry past.
    expect(() => concatWav([wav([1], 16_000), wav([2], 8_000)])).toThrow(WavError);
    expect(() => concatWav([wav([1], 16_000, 1), wav([2], 16_000, 2)])).toThrow(WavError);
  });

  it('refuses an empty list', () => {
    expect(() => concatWav([])).toThrow(WavError);
  });
});
