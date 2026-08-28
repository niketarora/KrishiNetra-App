import { useCallback, useEffect, useRef } from 'react';
import { type AudioPlayer, createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { File, Paths } from 'expo-file-system';

import { speak } from '@/services/avatarService';

/**
 * Playback for the avatar's answers.
 *
 * The mirror image of `useVoiceRecorder`: that one turns the farmer into text,
 * this one turns the answer back into a voice. `AvatarContext` deals in "say
 * this sentence, tell me when you have finished" and never in files, players
 * or audio routes.
 *
 * The audio arrives base64-encoded inside the JSON envelope and is written to
 * a cache file before playing. A `data:` URI would save the write, but only
 * Android's player reliably accepts one — a file works on both.
 */

/**
 * One reusable filename rather than one per reply.
 *
 * A farmer can hold a long conversation, and a new file per answer would leave
 * every one of them in the cache until the system cleared it. Overwriting is
 * safe because only one answer is ever playing.
 */
const REPLY_FILENAME = 'avatar-reply.wav';

/**
 * How long to wait for an answer to finish before giving up on it.
 *
 * Worked out from the audio itself rather than fixed, so a long answer is not
 * cut short and a short one does not strand the avatar for a minute. The
 * backend sends 16-bit mono, so the byte count divided by twice the sample
 * rate is the length in seconds; base64 carries three bytes in every four
 * characters. The margin covers the gap between `play()` and the first sample
 * actually leaving the speaker.
 */
export function playbackDeadlineMs({
  audio,
  sampleRate,
}: {
  audio: string;
  sampleRate: number;
}): number {
  const bytes = Math.max(0, (audio.length * 3) / 4 - 44);
  const seconds = bytes / (sampleRate * 2);

  return Math.round(seconds * 1000) + 5_000;
}

export type SpeechPlayer = {
  /** Fetches, plays, and resolves when the answer has finished being spoken. */
  play: (text: string, language?: string) => Promise<void>;
  /** Cuts the current answer off — the farmer interrupted, or closed the sheet. */
  stop: () => void;
};

export function useSpeechPlayer(): SpeechPlayer {
  const player = useRef<AudioPlayer | null>(null);

  const release = useCallback(() => {
    // `remove` both stops playback and frees the native player. Calling it on
    // an already-removed player throws, so the ref is cleared first.
    const current = player.current;
    player.current = null;

    if (current) {
      try {
        current.remove();
      } catch {
        // Already torn down — nothing left to stop.
      }
    }
  }, []);

  // A player left alive after the screen goes away keeps talking to nobody.
  useEffect(() => release, [release]);

  const play = useCallback(
    async (text: string, language?: string) => {
      const speech = await speak(text, language);

      // Anything still playing belongs to a question the farmer has moved on
      // from, so it is cut off rather than queued behind.
      release();

      const file = new File(Paths.cache, REPLY_FILENAME);
      if (file.exists) file.delete();
      file.create();
      file.write(speech.audio, { encoding: 'base64' });

      // The recorder leaves the session in recording mode, where Android routes
      // playback to the earpiece at a whisper. This puts the speaker back.
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false });

      const current = createAudioPlayer(file.uri);
      player.current = current;

      await new Promise<void>((resolve) => {
        // `didJustFinish` is the normal ending. It is not a guarantee: a file
        // the player cannot decode never finishes, and without a deadline the
        // avatar would sit in `speaking` for the rest of the conversation with
        // no way back to the microphone.
        const deadline = setTimeout(resolve, playbackDeadlineMs(speech));

        const subscription = current.addListener('playbackStatusUpdate', (status) => {
          if (!status.didJustFinish) return;

          clearTimeout(deadline);
          subscription.remove();
          resolve();
        });

        current.play();
      });

      release();
    },
    [release],
  );

  return { play, stop: release };
}
