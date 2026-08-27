import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';

import { useFarm } from '@/features/farm/FarmContext';

import {
  avatarReducer,
  initialAvatarState,
  type AvatarMachineState,
  type QuestionKey,
} from './avatarMachine';
import { DEMO_TIMINGS, resolveAnswer } from './demoScript';

type AvatarContextValue = AvatarMachineState & {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  /** Tap a suggested question — runs the full listen → think → speak loop. */
  ask: (question: QuestionKey) => void;
  /** The mic button; its meaning depends on the current state. */
  pressMic: () => void;
  /** Dev-only hook so the error state is reachable without breaking a mic. */
  simulateError: () => void;
};

const AvatarContext = createContext<AvatarContextValue | null>(null);

/**
 * Drives the avatar state machine.
 *
 * Phase 1 drives it with timers over a scripted exchange. Phase 5 replaces
 * this provider's internals with speech-to-text, an LLM agent and
 * text-to-speech — the machine, the components and this context's shape all
 * stay as they are.
 */
export function AvatarProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const { farm } = useFarm();

  const [machine, dispatch] = useReducer(avatarReducer, initialAvatarState);
  const [isOpen, setIsOpen] = useState(false);

  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  /** Latest farm without re-creating callbacks on every farm refresh. */
  const farmRef = useRef(farm);
  farmRef.current = farm;

  const runScriptedAnswer = useCallback(
    (question: QuestionKey) => {
      const { answer, source } = resolveAnswer(t, question, farmRef.current);
      dispatch({ type: 'RESOLVE', answer, source });
    },
    [t],
  );

  const ask = useCallback(
    (question: QuestionKey) => {
      clearTimers();
      dispatch({ type: 'START_LISTENING', question });

      timers.current.push(
        setTimeout(() => {
          dispatch({ type: 'STOP_LISTENING' });
          timers.current.push(
            setTimeout(() => runScriptedAnswer(question), DEMO_TIMINGS.thinkingMs),
          );
        }, DEMO_TIMINGS.listeningMs),
      );
    },
    [clearTimers, runScriptedAnswer],
  );

  const pressMic = useCallback(() => {
    if (machine.state === 'listening') {
      // "I'm done" — stop early and go straight to thinking.
      clearTimers();
      dispatch({ type: 'STOP_LISTENING' });
      const question = machine.question ?? 'area';
      timers.current.push(setTimeout(() => runScriptedAnswer(question), DEMO_TIMINGS.thinkingMs));
      return;
    }

    if (machine.state === 'thinking') return;

    ask(machine.question ?? 'area');
  }, [ask, clearTimers, machine.question, machine.state, runScriptedAnswer]);

  const open = useCallback(() => setIsOpen(true), []);

  const close = useCallback(() => {
    clearTimers();
    dispatch({ type: 'RESET' });
    setIsOpen(false);
  }, [clearTimers]);

  const simulateError = useCallback(() => {
    clearTimers();
    dispatch({ type: 'FAIL' });
  }, [clearTimers]);

  const value = useMemo<AvatarContextValue>(
    () => ({ ...machine, isOpen, open, close, ask, pressMic, simulateError }),
    [machine, isOpen, open, close, ask, pressMic, simulateError],
  );

  return <AvatarContext.Provider value={value}>{children}</AvatarContext.Provider>;
}

export function useAvatar(): AvatarContextValue {
  const context = useContext(AvatarContext);
  if (!context) throw new Error('useAvatar must be used inside an AvatarProvider.');
  return context;
}
