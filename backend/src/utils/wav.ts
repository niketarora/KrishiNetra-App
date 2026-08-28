/**
 * Just enough WAV handling to join what the speech provider hands back.
 *
 * Sarvam splits anything longer than a sentence or two into several separate
 * WAV files rather than one. Concatenating those byte-for-byte produces a file
 * whose header claims the length of the first chunk alone — most players stop
 * there, so the farmer would hear the first clause of an answer and nothing
 * else. Joining them properly means reading each chunk's PCM out of its `data`
 * section and writing one new header over the total.
 *
 * This is deliberately narrow: 16-bit PCM, which is what the provider returns.
 * Anything else is rejected rather than guessed at.
 */

const RIFF = 0x52494646; // 'RIFF'
const WAVE = 0x57415645; // 'WAVE'
const HEADER_BYTES = 44;

export type WavFormat = {
  channels: number;
  sampleRate: number;
  bitsPerSample: number;
};

export type ParsedWav = WavFormat & {
  /** The raw PCM samples, without any header. */
  data: Buffer;
};

export class WavError extends Error {}

/**
 * Read one WAV file.
 *
 * The chunks after `fmt ` are walked rather than assumed: a 44-byte header is
 * the common case, not a guarantee, and a provider that starts emitting a
 * `LIST` chunk would otherwise have its metadata played as audio.
 */
export function parseWav(buffer: Buffer): ParsedWav {
  if (buffer.length < 12 || buffer.readUInt32BE(0) !== RIFF || buffer.readUInt32BE(8) !== WAVE) {
    throw new WavError('Not a RIFF/WAVE file.');
  }

  let format: WavFormat | null = null;
  let data: Buffer | null = null;
  let offset = 12;

  while (offset + 8 <= buffer.length) {
    const id = buffer.toString('ascii', offset, offset + 4);
    const size = buffer.readUInt32LE(offset + 4);
    const body = offset + 8;

    if (id === 'fmt ') {
      if (size < 16) throw new WavError('Truncated fmt chunk.');

      const encoding = buffer.readUInt16LE(body);
      if (encoding !== 1) throw new WavError(`Expected PCM audio, got encoding ${encoding}.`);

      format = {
        channels: buffer.readUInt16LE(body + 2),
        sampleRate: buffer.readUInt32LE(body + 4),
        bitsPerSample: buffer.readUInt16LE(body + 14),
      };
    } else if (id === 'data') {
      // A chunk size longer than the buffer means a truncated download; take
      // what actually arrived rather than reading past the end.
      data = buffer.subarray(body, Math.min(body + size, buffer.length));
    }

    // Chunks are word-aligned: an odd size is followed by a pad byte.
    offset = body + size + (size % 2);
  }

  if (!format) throw new WavError('No fmt chunk.');
  if (!data) throw new WavError('No data chunk.');
  if (format.bitsPerSample !== 16) {
    throw new WavError(`Expected 16-bit audio, got ${format.bitsPerSample}-bit.`);
  }

  return { ...format, data };
}

/** Writes a canonical 44-byte header for `pcm`. */
export function encodeWav(pcm: Buffer, format: WavFormat): Buffer {
  const header = Buffer.alloc(HEADER_BYTES);
  const blockAlign = (format.channels * format.bitsPerSample) / 8;

  header.write('RIFF', 0, 'ascii');
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVE', 8, 'ascii');
  header.write('fmt ', 12, 'ascii');
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(format.channels, 22);
  header.writeUInt32LE(format.sampleRate, 24);
  header.writeUInt32LE(format.sampleRate * blockAlign, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(format.bitsPerSample, 34);
  header.write('data', 36, 'ascii');
  header.writeUInt32LE(pcm.length, 40);

  return Buffer.concat([header, pcm]);
}

/**
 * Join several WAV files into one.
 *
 * Every chunk must share a format. Splicing 8 kHz audio onto 22 kHz audio
 * would play the second half at the wrong pitch, which is worse than an error
 * the farmer can retry past.
 */
export function concatWav(files: Buffer[]): Buffer {
  if (files.length === 0) throw new WavError('Nothing to join.');

  const parsed = files.map(parseWav);
  const [first] = parsed;
  if (!first) throw new WavError('Nothing to join.');

  for (const chunk of parsed) {
    if (
      chunk.channels !== first.channels ||
      chunk.sampleRate !== first.sampleRate ||
      chunk.bitsPerSample !== first.bitsPerSample
    ) {
      throw new WavError('Audio chunks do not share a format.');
    }
  }

  return encodeWav(
    Buffer.concat(parsed.map((chunk) => chunk.data)),
    { channels: first.channels, sampleRate: first.sampleRate, bitsPerSample: first.bitsPerSample },
  );
}
