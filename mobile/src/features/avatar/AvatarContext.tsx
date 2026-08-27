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

import { chat, transcribe, type ChatTurn } from '@/services/avatarService';
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
  isOpen: boolean;
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

/** How many turns of history to send. The API caps this at 20. */
const MAX_HISTORY = 12;

/**
 * Drives the avatar state machine.
 *
 * Phase 1 drove it from timers over a scripted exchange. Phase 2.5 replaced
 * that driver with the real loop:
 *
 *     hold mic -> record -> transcribe -> ask the model -> speak the reply
 *
 * `avatarMachine.ts` was not touched. It is the same pure reducer, receiving
 * the same five events from a different source — which is exactly what Phase 1
 * built it for.
 *
 * What still is not here, by design (§9 of the phase document): no tool
 * calling, no text-to-speech, no agent. The reply is displayed, not spoken.
 */
export function AvatarProvider({ children }: { children: ReactNode }) {
  const { i18n } = useTranslation();
  const recorder = useVoiceRecorder();
  const speech = useSpeechPlayer();

  const [machine, dispatch] = useReducer(avatarReducer, initialAvatarState);
  const [isOpen, setIsOpen] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  /** The conversation so far, so the model can follow a train of thought. */
  const history = useRef<ChatTurn[]>([]);

  /**
   * Identifies the exchange in flight. A farmer who interrupts starts a new
   * one, and the abandoned reply must not speak over them when it lands.
   */
  const exchange = useRef(0);

  const fail = useCallback((key: string) => {
    setErrorKey(key);
    dispatch({ type: 'FAIL' });
  }, []);

  /** Send one farmer utterance and speak whatever comes back. */
  const answer = useCallback(
    async (spoken: string, turn: number) => {
      const turns = [...history.current, { role: 'user' as const, text: spoken }].slice(-MAX_HISTORY);

      let reply: string;
      try {
        const response = await chat(turns, i18n.language);
        if (exchange.current !== turn) return;

        reply = response.text;
        history.current = [...turns, { role: 'model' as const, text: reply }].slice(-MAX_HISTORY);

        // The source chip names the assistant, never a data source. The model
        // is relaying facts it was given, and saying "From your field record"
        // here would attribute its wording to the database.
        dispatch({ type: 'RESOLVE', answer: reply, source: 'avatar.sources.assistant' });
      } catch (error) {
        if (exchange.current !== turn) return;
        fail(error instanceof DataError ? error.translationKey : 'avatar.errors.reply');
        return;
      }

      // The answer is on screen from here on. Losing the voice must not lose
      // the reply with it — a farmer who can read the sentence has still been
      // answered, so a synthesis failure ends the turn quietly rather than
      // replacing a good answer with an error.
      try {
        await speech.play(reply, i18n.language);
      } catch (error) {
        console.warn('[avatar] could not speak the reply:', error);
      }

      if (exchange.current !== turn) return;
      dispatch({ type: 'DONE' });
    },
    [fail, i18n.language, speech],
  );

  const beginListening = useCallback(
    async (question?: QuestionKey) => {
      exchange.current += 1;
      setErrorKey(null);

      // Cutting in is allowed: the farmer pressing the mic mid-answer wants to
      // ask something else, not to talk over the last one.
      speech.stop();

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
    [fail, recorder, speech],
  );

  const finishListening = useCallback(async () => {
    const turn = exchange.current;
    dispatch({ type: 'STOP_LISTENING' });

    let spoken: string;
    try {
      const uri = await recorder.stop();
      const transcription = await transcribe(uri, i18n.language);
      if (exchange.current !== turn) return;

      spoken = transcription.text;
    } catch (error) {
      if (exchange.current !== turn) return;

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

    await answer(spoken, turn);
  }, [answer, i18n.language, recorder]);

  /**
   * A suggestion chip. It skips recording — the farmer typed nothing and said
   * nothing — but the question itself is real and goes to the model exactly as
   * a spoken one would.
   */
  const ask = useCallback(
    (question: QuestionKey) => {
      exchange.current += 1;
      const turn = exchange.current;

      setErrorKey(null);
      speech.stop();
      dispatch({ type: 'START_LISTENING', question });
      dispatch({ type: 'STOP_LISTENING' });

      void answer(questionText(i18n.t.bind(i18n), question), turn);
    },
    [answer, i18n, speech],
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

  const open = useCallback(() => setIsOpen(true), []);

  const close = useCallback(() => {
    exchange.current += 1;
    void recorder.cancel();
    speech.stop();
    history.current = [];
    setErrorKey(null);
    dispatch({ type: 'RESET' });
    setIsOpen(false);
  }, [recorder, speech]);

  const value = useMemo<AvatarContextValue>(
    () => ({ ...machine, isOpen, errorKey, open, close, ask, pressMic }),
    [machine, isOpen, errorKey, open, close, ask, pressMic],
  );

  return <AvatarContext.Provider value={value}>{children}</AvatarContext.Provider>;
}

export function useAvatar(): AvatarContextValue {
  const context = useContext(AvatarContext);
  if (!context) throw new Error('useAvatar must be used inside an AvatarProvider.');
  return context;
}
