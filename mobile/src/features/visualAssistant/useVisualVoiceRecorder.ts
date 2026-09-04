import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AudioQuality,
  IOSOutputFormat,
  type RecordingOptions,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
} from 'expo-audio';
import { File } from 'expo-file-system';

const SPEECH_RECORDING_CONFIG: RecordingOptions = {
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

export type VisualVoiceRecorder = {
  isRecording: boolean;
  recordSeconds: number;
  startRecording: () => Promise<boolean>;
  stopAndGetBase64: () => Promise<string | null>;
  cancelRecording: () => Promise<void>;
};

/**
 * High-performance speech recorder hook tailored for Visual Assistant voice queries.
 * Records audio in 16kHz mono, converting cleanly to base64 for Sarvam STT ingestion.
 */
export function useVisualVoiceRecorder(): VisualVoiceRecorder {
  const recorder = useAudioRecorder(SPEECH_RECORDING_CONFIG);
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);

  const recordingRef = useRef(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      clearTimer();
      if (recordingRef.current) {
        try {
          void recorder.stop();
        } catch {
          // Ignored on unmount
        }
      }
    };
  }, [clearTimer, recorder]);

  const startRecording = useCallback(async (): Promise<boolean> => {
    if (recordingRef.current) return true;

    try {
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        return false;
      }

      await setAudioModeAsync({
        playsInSilentMode: true,
        allowsRecording: true,
        shouldRouteThroughEarpiece: false,
      });

      await recorder.prepareToRecordAsync();
      recorder.record();

      recordingRef.current = true;
      setIsRecording(true);
      setRecordSeconds(0);

      clearTimer();
      timerRef.current = setInterval(() => {
        setRecordSeconds((prev) => prev + 1);
      }, 1000);

      return true;
    } catch (err) {
      console.warn('[useVisualVoiceRecorder] Failed to start voice recording:', err);
      recordingRef.current = false;
      setIsRecording(false);
      clearTimer();
      return false;
    }
  }, [clearTimer, recorder]);

  const stopAndGetBase64 = useCallback(async (): Promise<string | null> => {
    if (!recordingRef.current) return null;

    clearTimer();
    recordingRef.current = false;
    setIsRecording(false);

    try {
      await recorder.stop();

      // Reset audio mode to playback so speaker is ready for Sarvam TTS audio
      await setAudioModeAsync({
        playsInSilentMode: true,
        allowsRecording: false,
        shouldRouteThroughEarpiece: false,
      });

      const uri = recorder.uri;
      if (!uri) return null;

      try {
        const file = new File(uri);
        if (typeof (file as any).base64 === 'function') {
          const base64Content = await (file as any).base64();
          if (base64Content) return base64Content;
        }
      } catch (fileErr) {
        console.warn('[useVisualVoiceRecorder] File base64 read error:', fileErr);
      }

      return null;
    } catch (err) {
      console.warn('[useVisualVoiceRecorder] Failed to stop voice recording:', err);
      return null;
    }
  }, [clearTimer, recorder]);

  const cancelRecording = useCallback(async (): Promise<void> => {
    clearTimer();
    recordingRef.current = false;
    setIsRecording(false);
    setRecordSeconds(0);

    try {
      await recorder.stop();
      await setAudioModeAsync({
        playsInSilentMode: true,
        allowsRecording: false,
        shouldRouteThroughEarpiece: false,
      });
    } catch {
      // Ignored
    }
  }, [clearTimer, recorder]);

  return {
    isRecording,
    recordSeconds,
    startRecording,
    stopAndGetBase64,
    cancelRecording,
  };
}
