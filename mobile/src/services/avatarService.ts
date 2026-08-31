import { FileSystemUploadType, uploadAsync } from 'expo-file-system/legacy';

import { apiFetch, getApiBaseUrl } from './api';
import { DataError, toApiError } from './errors';
import { getAccessToken } from './supabase';

/**
 * The avatar's three calls: turn a recording into text, turn a conversation
 * into a reply, and turn that reply into speech.
 *
 * Both go through our own backend. The app never holds a speech or model
 * provider key, and never learns which provider answered — that is what lets
 * Phase 5 swap the whole thing out without touching the UI.
 */

export type ChatTurn = {
  role: 'user' | 'model';
  text: string;
};

export type Transcription = {
  text: string;
  language: string | null;
};

export type ChatReply = {
  text: string;
  model: string;
};

export type Speech = {
  /** A complete WAV file, base64-encoded. */
  audio: string;
  mimeType: string;
  sampleRate: number;
};

/**
 * React Native's upload reads the file through its native networking layer,
 * which needs a URI with a scheme. A bare path — `/data/user/0/.../rec.m4a` —
 * fails with a generic "Network request failed", which looks exactly like a
 * dead connection and sends you off checking the wifi.
 *
 * expo-audio normally returns a `file://` URI, but the type says only
 * `string`, so this normalises rather than trusts.
 */
export function toUploadUri(uri: string): string {
  if (/^[a-z][a-z0-9+.-]*:/i.test(uri)) return uri;
  return `file://${uri.startsWith('/') ? '' : '/'}${uri}`;
}

/** The file part React Native's uploader expects. Not a Blob. */
export type AudioPart = { uri: string; name: string; type: string };

/**
 * Describe the recording for the uploader.
 *
 * `audio/mp4` rather than `audio/m4a`: Android records AAC in an MP4
 * container, `audio/m4a` is not a registered media type, and some HTTP stacks
 * refuse to attach a part whose type they cannot classify.
 */
export function buildAudioPart(uri: string): AudioPart {
  return { uri: toUploadUri(uri), name: 'speech.m4a', type: 'audio/mp4' };
}

/**
 * Is the backend reachable at all?
 *
 * Used only after an upload has already failed, to tell three very different
 * problems apart. `/health` needs no token and touches no database, so it
 * answers fast or not at all.
 */
async function backendIsReachable(): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4000);

  try {
    const response = await fetch(`${getApiBaseUrl()}/health`, { signal: controller.signal });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Turn a thrown fetch into an honest message.
 *
 * Reporting every transport failure as "no internet connection" is wrong often
 * enough to matter: the phone may be online while the server is down, or both
 * may be fine and the recording itself failed to attach. Each of those needs a
 * different thing from the person holding the phone.
 */
async function describeUploadFailure(cause: unknown): Promise<DataError> {
  const name = (cause as { name?: string } | null)?.name;

  if (name === 'AbortError') {
    return new DataError('avatar.errors.timeout', cause);
  }

  // The real reason never reaches the farmer, but a developer watching Metro
  // should not have to guess at it.
  console.warn('[avatar] transcribe upload failed:', cause);

  if (await backendIsReachable()) {
    // The server answered /health, so the network is fine and the request
    // itself is what broke — almost always the audio file.
    return new DataError('avatar.errors.upload', cause);
  }

  return new DataError('avatar.errors.unreachable', cause);
}

/**
 * Uploads the recording as multipart.
 *
 * `apiFetch` is JSON-only, so this is the one place in the app that builds its
 * own request. It still carries the same bearer token and unwraps the same
 * envelope, and it still throws a `DataError` carrying a translation key.
 */
export async function transcribe(
  uri: string,
  language: string | undefined,
  options: { timeoutMs?: number } = {},
): Promise<Transcription> {
  const token = await getAccessToken();
  if (!token) throw new DataError('auth.errors.generic');

  const uploadUri = toUploadUri(uri);
  let uploadResponse: { status: number; body: string };

  try {
    if (typeof uploadAsync === 'function') {
      uploadResponse = await uploadAsync(
        `${getApiBaseUrl()}/api/v1/ai/transcribe`,
        uploadUri,
        {
          fieldName: 'audio',
          httpMethod: 'POST',
          uploadType: FileSystemUploadType?.MULTIPART ?? 1,
          mimeType: 'audio/mp4',
          parameters: language ? { language } : undefined,
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
          },
        },
      );
    } else {
      const form = new FormData();
      form.append('audio', buildAudioPart(uri) as unknown as Blob);
      if (language) form.append('language', language);

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 30_000);
      try {
        const response = await fetch(`${getApiBaseUrl()}/api/v1/ai/transcribe`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
          body: form,
          signal: controller.signal,
        });
        uploadResponse = { status: response.status, body: await response.text() };
      } finally {
        clearTimeout(timeout);
      }
    }
  } catch (cause) {
    throw await describeUploadFailure(cause);
  }

  let envelope: { success: boolean; data?: Transcription; error?: { code: string } };
  try {
    envelope = JSON.parse(uploadResponse.body);
  } catch (cause) {
    throw new DataError('avatar.errors.transcribe', cause);
  }

  if (uploadResponse.status >= 400 || !envelope.success || !envelope.data) {
    throw toApiError(envelope.error?.code, 'avatar.errors.transcribe');
  }

  return envelope.data;
}

export async function chat(messages: ChatTurn[], language?: string): Promise<ChatReply> {
  return apiFetch<ChatReply>('/api/v1/ai/chat', {
    method: 'POST',
    body: language ? { messages, language } : { messages },
    fallbackKey: 'avatar.errors.reply',
  });
}

/**
 * Ask the backend to read an answer aloud.
 *
 * Synthesis returns a whole audio file rather than a sentence of JSON, so it
 * gets a longer deadline than the rest of the API — but still a bounded one.
 * A farmer waiting on a voice that is never coming should get the answer they
 * can already see on screen instead.
 */
export async function speak(text: string, language?: string): Promise<Speech> {
  return apiFetch<Speech>('/api/v1/ai/speak', {
    method: 'POST',
    body: language ? { text, language } : { text },
    fallbackKey: 'avatar.errors.voice',
    timeoutMs: 30_000,
  });
}
