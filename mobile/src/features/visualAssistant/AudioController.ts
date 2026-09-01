import { type AudioPlayer, createAudioPlayer, setAudioModeAsync, requestRecordingPermissionsAsync } from 'expo-audio';
import { File, Paths } from 'expo-file-system';

/**
 * Creates a standard 44-byte WAV header for 24,000 Hz, 16-bit mono Linear PCM.
 * Allows playing raw Gemini Live PCM chunks directly via expo-audio.
 */
function createWavHeader(pcmByteLength: number, sampleRate = 24000, numChannels = 1, bitsPerSample = 16): Uint8Array {
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
function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export class LiveAudioController {
  private activePlayer: AudioPlayer | null = null;
  private queue: string[] = [];
  private isPlaying = false;
  private fileIndex = 0;

  constructor() {
    void setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
  }

  public async requestPermissions(): Promise<boolean> {
    const perm = await requestRecordingPermissionsAsync();
    return perm.granted;
  }

  /**
   * Enqueues a base64 24kHz PCM chunk received from Gemini Live and plays it.
   */
  public enqueueAudioChunk(base64Pcm: string) {
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
    const chunk = this.queue.shift();
    if (!chunk) return;

    try {
      const pcmBytes = base64ToUint8Array(chunk);
      const wavHeader = createWavHeader(pcmBytes.length, 24000, 1, 16);

      const combined = new Uint8Array(wavHeader.length + pcmBytes.length);
      combined.set(wavHeader, 0);
      combined.set(pcmBytes, wavHeader.length);

      this.fileIndex = (this.fileIndex + 1) % 5;
      const file = new File(Paths.cache, `live-stream-${this.fileIndex}.wav`);
      await file.write(combined);

      this.stopPlayback();

      const player = createAudioPlayer(file);
      this.activePlayer = player;
      player.play();

      // Estimate playback duration from chunk size
      const durationMs = Math.max(100, Math.round((pcmBytes.length / (24000 * 2)) * 1000));
      setTimeout(() => {
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
    this.stopPlayback();
  }
}
