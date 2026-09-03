import {
  type AudioPlayer,
  AudioModule,
  createAudioPlayer,
  setAudioModeAsync,
  requestRecordingPermissionsAsync,
  type AudioStreamBuffer,
} from 'expo-audio';
import { File, Paths } from 'expo-file-system';

/**
 * Creates a standard 44-byte WAV header for specified sample rate, 16-bit mono Linear PCM.
 * Allows playing raw Gemini Live PCM chunks directly via expo-audio.
 */
export function createWavHeader(
  pcmByteLength: number,
  sampleRate = 24000,
  numChannels = 1,
  bitsPerSample = 16,
): Uint8Array {
  const header = new Uint8Array(44);
  const view = new DataView(header.buffer);
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const byteRate = sampleRate * blockAlign;

  // "RIFF"
  header[0] = 0x52; header[1] = 0x49; header[2] = 0x46; header[3] = 0x46;
  view.setUint32(4, 36 + pcmByteLength, true);
  // "WAVE"
  header[8] = 0x57; header[9] = 0x41; header[10] = 0x56; header[11] = 0x45;
  // "fmt "
  header[12] = 0x66; header[13] = 0x6d; header[14] = 0x74; header[15] = 0x20;
  view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
  view.setUint16(20, 1, true); // AudioFormat (1 for PCM)
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  // "data"
  header[36] = 0x64; header[37] = 0x61; header[38] = 0x74; header[39] = 0x61;
  view.setUint32(40, pcmByteLength, true);

  return header;
}

/**
 * Converts a base64 string to Uint8Array.
 */
export function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Converts an ArrayBuffer to a base64 string.
 */
export function arrayBufferToBase64(buffer: ArrayBuffer | ArrayBufferLike): string {
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  let binary = '';
  const chunkSize = 8192;
  for (let i = 0; i < len; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, len));
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }
  return btoa(binary);
}

export class LiveAudioController {
  private activePlayer: AudioPlayer | null = null;
  private queue: string[] = [];
  private isPlaying = false;
  private fileIndex = 0;
  private playTimeout: NodeJS.Timeout | null = null;

  // Real-time microphone streaming
  private audioStream: any = null;
  private streamSubscription: { remove: () => void } | null = null;
  private isRecording = false;

  constructor() {
    void setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true, shouldRouteThroughEarpiece: false });
  }

  public async requestPermissions(): Promise<boolean> {
    try {
      const perm = await requestRecordingPermissionsAsync();
      return perm.granted;
    } catch {
      return false;
    }
  }

  /**
   * Starts capturing 16kHz 16-bit Linear PCM audio from microphone in real-time
   * and continuously streams base64 chunks to the Gemini Live session.
   */
  public async startRecording(onAudioChunk: (base64Chunk: string) => void): Promise<boolean> {
    if (this.isRecording) return true;

    const hasPermission = await this.requestPermissions();
    if (!hasPermission) {
      console.warn('[LiveAudioController] Microphone permission not granted');
      return false;
    }

    try {
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true, shouldRouteThroughEarpiece: false });

      if (AudioModule && AudioModule.AudioStream) {
        this.audioStream = new AudioModule.AudioStream({
          sampleRate: 16000,
          channels: 1,
          encoding: 'int16',
        });

        this.streamSubscription = this.audioStream.addListener(
          'audioStreamBuffer',
          (buffer: AudioStreamBuffer) => {
            if (buffer?.data && this.isRecording) {
              const base64Chunk = arrayBufferToBase64(buffer.data);
              if (base64Chunk) {
                onAudioChunk(base64Chunk);
              }
            }
          },
        );

        await this.audioStream.start();
        this.isRecording = true;
        return true;
      } else {
        console.warn('[LiveAudioController] Native AudioStream not available on this platform/environment');
        this.isRecording = true;
        return true;
      }
    } catch (err) {
      console.error('[LiveAudioController] Failed to start native audio stream:', err);
      this.isRecording = false;
      return false;
    }
  }

  /**
   * Stops real-time microphone capture.
   */
  public stopRecording() {
    this.isRecording = false;
    if (this.streamSubscription) {
      try {
        this.streamSubscription.remove();
      } catch {
        // Ignored
      }
      this.streamSubscription = null;
    }

    if (this.audioStream) {
      try {
        this.audioStream.stop();
      } catch {
        // Ignored
      }
      this.audioStream = null;
    }
  }

  /**
   * Enqueues a base64 24kHz PCM chunk received from Gemini Live and plays it.
   */
  public enqueueAudioChunk(base64Pcm: string) {
    if (!base64Pcm) return;
    this.queue.push(base64Pcm);
    if (!this.isPlaying) {
      void this.playNext();
    }
  }

  private async playNext(): Promise<void> {
    if (this.queue.length === 0) {
      this.isPlaying = false;
      return;
    }

    this.isPlaying = true;
    
    // Batch available chunks to create continuous smooth audio
    const chunksToPlay: string[] = [this.queue.shift()!];
    while (this.queue.length > 0 && chunksToPlay.length < 8) {
      chunksToPlay.push(this.queue.shift()!);
    }

    try {
      const byteArrays = chunksToPlay.map((c) => base64ToUint8Array(c)).filter((b) => b.length > 0);
      const totalPcmLength = byteArrays.reduce((sum, b) => sum + b.length, 0);

      if (totalPcmLength === 0) {
        void this.playNext();
        return;
      }

      const pcmBytes = new Uint8Array(totalPcmLength);
      let offset = 0;
      for (const ba of byteArrays) {
        pcmBytes.set(ba, offset);
        offset += ba.length;
      }

      const wavHeader = createWavHeader(pcmBytes.length, 24000, 1, 16);
      const combined = new Uint8Array(wavHeader.length + pcmBytes.length);
      combined.set(wavHeader, 0);
      combined.set(pcmBytes, wavHeader.length);

      this.fileIndex = (this.fileIndex + 1) % 5;
      const file = new File(Paths.cache, `live-stream-${this.fileIndex}.wav`);
      await file.write(combined);

      if (this.activePlayer) {
        try {
          this.activePlayer.remove();
        } catch {
          // Ignored
        }
        this.activePlayer = null;
      }

      if (this.playTimeout) {
        clearTimeout(this.playTimeout);
        this.playTimeout = null;
      }

      const player = createAudioPlayer(file);
      this.activePlayer = player;
      player.play();

      // Estimate playback duration from combined chunk size (24000 samples/sec * 2 bytes/sample)
      const durationMs = Math.max(150, Math.round((pcmBytes.length / (24000 * 2)) * 1000));
      this.playTimeout = setTimeout(() => {
        if (this.activePlayer === player) {
          void this.playNext();
        }
      }, durationMs);
    } catch (err) {
      console.warn('[LiveAudioController] Playback chunk error:', err);
      void this.playNext();
    }
  }

  /**
   * Interrupts current playback immediately on user barge-in.
   */
  public stopPlayback() {
    this.queue = [];
    this.isPlaying = false;

    if (this.playTimeout) {
      clearTimeout(this.playTimeout);
      this.playTimeout = null;
    }

    if (this.activePlayer) {
      try {
        this.activePlayer.remove();
      } catch {
        // Ignored
      }
      this.activePlayer = null;
    }
  }

  public destroy() {
    this.stopRecording();
    this.stopPlayback();
  }
}
