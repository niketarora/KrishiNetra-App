import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';

import { useGuide } from '@/features/guide/GuideContext';
import { assist, type AssistantResponse } from '@/services/assistantService';
import { transcribe } from '@/services/avatarService';
import { DataError } from '@/services/errors';

import {
  avatarReducer,
  initialAvatarState,
  type AvatarMachineState,
  type QuestionKey,
} from './avatarMachine';
import { questionText } from './questions';
import { useSpeechPlayer } from './useSpeechPlayer';
import { useVoiceRecorder, VoiceRecorderError } from './useVoiceRecorder';

type AvatarContextValue = AvatarMachineState & {
  /** True while the mic is being offered — the avatar is waiting to be spoken to. */
  isListeningMode: boolean;
  open: () => void;
  close: () => void;
  /** Tap a suggested question — sends it as if the farmer had spoken it. */
  ask: (question: QuestionKey) => void;
  /** The mic button; its meaning depends on the current state. */
  pressMic: () => void;
  /** What went wrong, as a translation key, while in the error state. */
  errorKey: string | null;
};

const AvatarContext = createContext<AvatarContextValue | null>(null);

/**
 * Drives the avatar state machine.
 *
 * The loop the farmer experiences:
 *
 *     hold mic -> record -> transcribe -> route -> guide + speak
 *
 * The last step is the one that changed with this redesign. A reply used to be
 * a sentence to read out; it is now a decision about what should happen, and
 * three things start the moment it lands:
 *
 *   1. the guide runs the navigation steps,
 *   2. the avatar peeks with the message,
 *   3. speech synthesis begins.
 *
 * Explicitly in that order, and explicitly not chained. Waiting for audio
 * before moving would put a second of dead screen between the farmer asking and
 * anything happening, for no gain — and a voice that fails would then take the
 * guidance down with it. As it stands, a TTS failure costs the farmer the
 * narration and nothing else.
 */
export function AvatarProvider({ children }: { children: ReactNode }) {
  const { i18n, t } = useTranslation();
  const recorder = useVoiceRecorder();
  const speech = useSpeechPlayer();
  const guide = useGuide();

  const [machine, dispatch] = useReducer(avatarReducer, initialAvatarState);
  const [isListeningMode, setIsListeningMode] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  /**
   * Identifies the exchange in flight. A farmer who interrupts starts a new
   * one, and the abandoned exchange must not speak over them — or, now, keep
   * navigating underneath them — when it lands.
   */
  const exchange = useRef(0);

  const fail = useCallback((key: string) => {
    setErrorKey(key);
    dispatch({ type: 'FAIL' });
  }, []);

  /**
   * A localised response carries i18n keys rather than text, so app guidance
   * reads correctly in every locale without a translation round trip on the
   * request path. Prose from the expert or research branches passes straight
   * through — translating it here would be re-writing the model's answer.
   */
  const spokenText = useCallback(
    (response: AssistantResponse): string =>
      response.localised ? t(response.speech) : response.speech,
    [t],
  );

  /** Route one farmer utterance, then move the app and speak the answer. */
  const respond = useCallback(
    async (spoken: string, turn: number) => {
      let response: AssistantResponse;
      try {
        response = await assist(spoken, i18n.language);
        if (exchange.current !== turn) return;

        dispatch({ type: 'RESOLVE', response });
      } catch (error) {
        if (exchange.current !== turn) return;
        fail(error instanceof DataError ? error.translationKey : 'avatar.errors.reply');
        return;
      }

      // The app starts moving now, not after the voice arrives.
      if (response.type === 'APP_GUIDE' && response.navigation.length > 0) {
        dispatch({ type: 'GUIDE_STARTED' });
        void guide.run(response.navigation);
      }

      // The answer is on screen from here on. Losing the voice must not lose
      // the reply with it — a farmer who can read the sentence has still been
      // answered, so a synthesis failure ends the turn quietly rather than
      // replacing a good answer with an error.
      try {
        await speech.play(spokenText(response), i18n.language);
      } catch (error) {
        console.warn('[avatar] could not speak the reply:', error);
      }

      if (exchange.current !== turn) return;
      dispatch({ type: 'DONE' });
    },
    [fail, guide, i18n.language, speech, spokenText],
  );

  const beginListening = useCallback(
    async (question?: QuestionKey) => {
      exchange.current += 1;
      setErrorKey(null);

      // Cutting in is allowed: the farmer pressing the mic mid-answer wants to
      // ask something else, not to talk over the last one. The guide is
      // cancelled for the same reason — an abandoned run must not carry on
      // navigating while a new question is being asked.
      speech.stop();
      guide.cancel();

      // Enter `listening` before awaiting the recorder, for two reasons. The
      // farmer gets feedback on the tap rather than after a permission round
      // trip — and, less obviously, the machine ignores FAIL while idle (it was
      // written when failure could only happen mid-conversation), so a denied
      // microphone would otherwise leave the avatar sitting silently in idle.
      dispatch(question ? { type: 'START_LISTENING', question } : { type: 'START_LISTENING' });

      try {
        await recorder.start();
      } catch (error) {
        fail(
          error instanceof VoiceRecorderError && error.kind === 'permission'
            ? 'avatar.errors.micPermission'
            : 'avatar.errors.mic',
        );
      }
    },
    [fail, guide, recorder, speech],
  );

  const finishListening = useCallback(async () => {
    const turn = exchange.current;

    let spoken: string;
    try {
      const uri = await recorder.stop();
      const transcription = await transcribe(uri, i18n.language);
      if (exchange.current !== turn) return;

      spoken = transcription.text;
      dispatch({ type: 'STOP_LISTENING', transcript: spoken });
    } catch (error) {
      if (exchange.current !== turn) return;

      // Move out of `listening` before failing, or FAIL lands on a state the
      // reducer still thinks is recording.
      dispatch({ type: 'STOP_LISTENING' });

      // Every failure here names itself, and none of them invents a question
      // on the farmer's behalf. A recorder problem and a service problem need
      // different words: one means "hold the button a moment longer", the
      // other means "try again".
      if (error instanceof VoiceRecorderError) {
        fail(error.kind === 'tooShort' ? 'avatar.errors.tooShort' : 'avatar.errors.mic');
        return;
      }

      fail(error instanceof DataError ? error.translationKey : 'avatar.errors.mic');
      return;
    }

    await respond(spoken, turn);
  }, [fail, i18n.language, recorder, respond]);

  /**
   * A suggestion chip. It skips recording — the farmer typed nothing and said
   * nothing — but the question itself is real and is routed exactly as a spoken
   * one would be.
   */
  const ask = useCallback(
    (question: QuestionKey) => {
      exchange.current += 1;
      const turn = exchange.current;

      setErrorKey(null);
      speech.stop();
      guide.cancel();

      const spoken = questionText(i18n.t.bind(i18n), question);
      dispatch({ type: 'START_LISTENING', question });
      dispatch({ type: 'STOP_LISTENING', transcript: spoken });

      void respond(spoken, turn);
    },
    [guide, i18n, respond, speech],
  );

  const pressMic = useCallback(() => {
    if (machine.state === 'listening') {
      void finishListening();
      return;
    }

    // Thinking is the one state the button does nothing in: the farmer's
    // question is already in flight.
    if (machine.state === 'thinking') return;

    void beginListening();
  }, [beginListening, finishListening, machine.state]);

  /**
   * Opening no longer means "show a screen" — there is no screen. It arms the
   * mic and starts listening straight away, because a farmer who tapped the
   * microphone has already said what they wanted to do.
   */
  const open = useCallback(() => {
    setIsListeningMode(true);
    void beginListening();
  }, [beginListening]);

  const close = useCallback(() => {
    exchange.current += 1;
    void recorder.cancel();
    speech.stop();
    guide.cancel();
    setErrorKey(null);
    dispatch({ type: 'RESET' });
    setIsListeningMode(false);
  }, [guide, recorder, speech]);

  const value = useMemo<AvatarContextValue>(
    () => ({ ...machine, isListeningMode, errorKey, open, close, ask, pressMic }),
    [machine, isListeningMode, errorKey, open, close, ask, pressMic],
  );

  return <AvatarContext.Provider value={value}>{children}</AvatarContext.Provider>;
}

export function useAvatar(): AvatarContextValue {
  const context = useContext(AvatarContext);
  if (!context) throw new Error('useAvatar must be used inside an AvatarProvider.');
  return context;
}
