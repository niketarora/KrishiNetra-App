import { buildAudioPart, toUploadUri, transcribe } from './avatarService';
import { DataError } from './errors';

jest.mock('./supabase', () => ({
  getAccessToken: jest.fn(async () => 'test-token'),
}));

jest.mock('./api', () => ({
  apiFetch: jest.fn(),
  getApiBaseUrl: () => 'http://10.0.2.2:4000',
  asNumber: (v: unknown) => Number(v),
}));

describe('toUploadUri', () => {
  it('leaves a file:// URI alone', () => {
    expect(toUploadUri('file:///data/user/0/app/cache/rec.m4a')).toBe(
      'file:///data/user/0/app/cache/rec.m4a',
    );
  });

  it('adds the scheme to a bare absolute path', () => {
    // The classic React Native upload failure: a path with no scheme throws
    // "Network request failed", which reads exactly like a dead connection.
    expect(toUploadUri('/data/user/0/app/cache/rec.m4a')).toBe(
      'file:///data/user/0/app/cache/rec.m4a',
    );
  });

  it('leaves other schemes alone', () => {
    expect(toUploadUri('content://media/audio/1')).toBe('content://media/audio/1');
    expect(toUploadUri('https://example.com/a.m4a')).toBe('https://example.com/a.m4a');
  });
});

describe('transcribe failure reporting', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('says the server is unreachable when the health check also fails', async () => {
    global.fetch = jest.fn(async () => {
      throw new TypeError('Network request failed');
    }) as unknown as typeof fetch;

    await expect(transcribe('file:///tmp/a.m4a', 'en')).rejects.toMatchObject({
      translationKey: 'avatar.errors.unreachable',
    });
  });

  it('blames the upload, not the network, when the server is clearly up', async () => {
    // The case that matters: the phone is online and the backend answers, so
    // telling the farmer to check their internet would send them to fix
    // something that is not broken.
    global.fetch = jest.fn(async (input: unknown) => {
      if (String(input).endsWith('/health')) return { ok: true } as Response;
      throw new TypeError('Network request failed');
    }) as unknown as typeof fetch;

    await expect(transcribe('file:///tmp/a.m4a', 'en')).rejects.toMatchObject({
      translationKey: 'avatar.errors.upload',
    });
  });

  it('reports a timeout as a timeout', async () => {
    global.fetch = jest.fn(async () => {
      const error = new Error('Aborted');
      error.name = 'AbortError';
      throw error;
    }) as unknown as typeof fetch;

    await expect(transcribe('file:///tmp/a.m4a', 'en')).rejects.toMatchObject({
      translationKey: 'avatar.errors.timeout',
    });
  });

  it('does not probe health for a timeout', async () => {
    const spy = jest.fn(async () => {
      const error = new Error('Aborted');
      error.name = 'AbortError';
      throw error;
    });
    global.fetch = spy as unknown as typeof fetch;

    await expect(transcribe('file:///tmp/a.m4a', 'en')).rejects.toBeInstanceOf(DataError);
    // One call: the upload. A timed-out request tells us nothing about
    // reachability, so probing would only add four more seconds of waiting.
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('does not leave the app guessing about a plain HTTP error', async () => {
    global.fetch = jest.fn(async () => ({
      ok: false,
      json: async () => ({ success: false, error: { code: 'SERVICE_NOT_CONNECTED' } }),
    })) as unknown as typeof fetch;

    // A server that answered is not a network problem, whatever it answered.
    await expect(transcribe('file:///tmp/a.m4a', 'en')).rejects.toMatchObject({
      translationKey: 'avatar.errors.transcribe',
    });
  });
});

describe('buildAudioPart', () => {
  it('declares audio/mp4, the type Android actually records', () => {
    // Android records AAC in an MP4 container. `audio/m4a` is not a registered
    // media type, and an unclassifiable part is one an HTTP stack may refuse
    // to attach at all - which surfaces as a bare "network request failed".
    expect(buildAudioPart('file:///tmp/a.m4a').type).toBe('audio/mp4');
  });

  it('normalises the uri it was given', () => {
    expect(buildAudioPart('/tmp/a.m4a').uri).toBe('file:///tmp/a.m4a');
  });

  it('always names the file, which multer needs to accept the part', () => {
    expect(buildAudioPart('file:///tmp/a.m4a').name).toBe('speech.m4a');
  });
});
