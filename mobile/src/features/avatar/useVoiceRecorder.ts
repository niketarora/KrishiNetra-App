import { useCallback, useRef } from 'react';
import {
  AudioQuality,
  IOSOutputFormat,
  type RecordingOptions,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
} from 'expo-audio';

/**
 * Microphone capture for the avatar.
 *
 * Wraps expo-audio so `AvatarContext` deals in "start" and "stop, here is a
 * file" and never in permissions, audio modes or recorder lifecycle.
 *
 * Everything here reports failure as a translation key rather than throwing a
 * provider string at the UI, matching how `services/errors.ts` already works.
 */

/**
 * Below this, Android's MediaRecorder often cannot finalise the container and
 * leaves a zero-byte or truncated file. Uploading one fails deep in the native
 * networking layer with a bare "Network request failed", which looks exactly
 * like a dead connection — so it is caught here, where the cause is still known.
 */
const MIN_RECORDING_MS = 700;

export type RecorderError = 'permission' | 'failed' | 'tooShort';

export class VoiceRecorderError extends Error {
  readonly kind: RecorderError;

  constructor(kind: RecorderError) {
    super(kind);
    this.name = 'VoiceRecorderError';
    this.kind = kind;
  }
}

export type VoiceRecorder = {
  start: () => Promise<void>;
  /** Stops and returns the recording's file URI. */
  stop: () => Promise<string>;
  /** Abandons a recording without returning it, e.g. when the sheet closes. */
  cancel: () => Promise<void>;
};

/**
 * Recording settings, spelled out rather than taken from a preset.
 *
 * `RecordingPresets.LOW_QUALITY` cannot be used here: on Android it records
 * AMR-NB in a `.3gp` container, while its top-level `extension` still claims
 * `.m4a`. Two things then go wrong. AMR-NB only supports 8 kHz mono, so the
 * preset's 44.1 kHz stereo is not a combination MediaRecorder can honour, and
 * the upload would describe 3GP bytes as `audio/mp4` — which is what the
 * transcriber is told to expect.
 *
 * AAC in an MP4 container is what `buildAudioPart` already claims to be
 * sending. 16 kHz mono at 32 kbps is the shape speech recognition actually
 * wants, and it is a smaller upload than the preset was, so the reason for
 * choosing LOW_QUALITY in the first place still holds.
 */
const SPEECH_RECORDING: RecordingOptions = {
  extension: '.m4a',
  sampleRate: 16000,
  numberOfChannels: 1,
  bitRate: 32000,
  android: {
    outputFormat: 'mpeg4',
    audioEncoder: 'aac',
  },
  ios: {
    outputFormat: IOSOutputFormat.MPEG4AAC,
    audioQuality: AudioQuality.LOW,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  web: {
    mimeType: 'audio/webm',
    bitsPerSecond: 32000,
  },
};

export function useVoiceRecorder(): VoiceRecorder {
  const recorder = useAudioRecorder(SPEECH_RECORDING);

  const recording = useRef(false);
  const startedAt = useRef(0);

  const start = useCallback(async () => {
    const permission = await requestRecordingPermissionsAsync();
    if (!permission.granted) throw new VoiceRecorderError('permission');

    try {
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      recording.current = true;
      startedAt.current = Date.now();
    } catch (cause) {
      recording.current = false;
      throw new VoiceRecorderError('failed');
    }
  }, [recorder]);

  const stop = useCallback(async () => {
    if (!recording.current) throw new VoiceRecorderError('failed');

    const elapsed = Date.now() - startedAt.current;

    try {
      await recorder.stop();
      recording.current = false;

      const uri = recorder.uri;
      if (!uri) throw new VoiceRecorderError('failed');

      // Checked after stopping, never before: the recorder must always be shut
      // down cleanly, or the next attempt inherits a wedged session.
      if (elapsed < MIN_RECORDING_MS) throw new VoiceRecorderError('tooShort');

      // Let the speaker have the audio route back, so a future TTS reply is
      // not competing with a still-open recording session.
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false });

      return uri;
    } catch (cause) {
      recording.current = false;
      if (cause instanceof VoiceRecorderError) throw cause;
      throw new VoiceRecorderError('failed');
    }
  }, [recorder]);

  const cancel = useCallback(async () => {
    if (!recording.current) return;

    try {
      await recorder.stop();
    } catch {
      // Closing the sheet must never fail because the recorder was already
      // torn down.
    } finally {
      recording.current = false;
    }
  }, [recorder]);

  return { start, stop, cancel };
}
