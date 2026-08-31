import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ScrollView, View } from 'react-native';

import { useFarm } from '@/features/farm/FarmContext';
import { goBack, navigateToStackRoute, navigateToTab } from '@/navigation/navigationRef';

import {
  isHighlightTarget,
  isSelectTarget,
  resolveNavigationTarget,
} from './targets';

/**
 * The Navigation Controller — the App Control layer.
 *
 * The AI decides WHAT should happen; this decides HOW, and it is the only thing
 * in the app that moves the farmer on the AI's behalf. That separation is the
 * whole safety story: a model that emits a target this file does not recognise
 * changes nothing, because there is no path from a step to the UI that does not
 * pass through the lookups in `targets.ts`.
 *
 * Steps run one at a time with a beat between them. Each one may cause a screen
 * to mount, and the next step usually needs to measure something on it — so the
 * pause is not cosmetic, it is what makes the measurement land on the right
 * screen. It is also what makes the guidance readable: an instant jump through
 * four screens teaches the farmer nothing, which defeats the point of guiding
 * them rather than answering them.
 */

export type GuideAction =
  | 'NAVIGATE'
  | 'SELECT'
  | 'SCROLL'
  | 'HIGHLIGHT'
  | 'OPEN'
  | 'BACK'
  | 'POINT';

export type GuideStep = {
  action: GuideAction;
  target: string;
  params?: Record<string, string | number>;
};

export type HighlightRect = { x: number; y: number; width: number; height: number };

/** What a screen hands over when it registers a highlightable element. */
export type GuideNode = {
  view: View | null;
  /** The ScrollView the element sits in, when it needs scrolling into view. */
  scroll?: ScrollView | null;
};

type GuideContextValue = {
  /** The element being spotlighted right now, in window coordinates. */
  highlight: { target: string; rect: HighlightRect } | null;
  /** True while a sequence of steps is being performed. */
  running: boolean;
  register: (id: string, node: GuideNode) => void;
  unregister: (id: string) => void;
  /** Perform a sequence. Resolves when the last step has been attempted. */
  run: (steps: GuideStep[], entities?: Record<string, string>) => Promise<void>;
  /** Abandon anything in flight and clear the spotlight. */
  cancel: () => void;
};

const GuideContext = createContext<GuideContextValue | null>(null);

/**
 * How long to let a screen settle before the next step touches it. Long enough
 * for a native-stack push to finish its slide, short enough that a four-step
 * guide does not feel like waiting.
 */
const SETTLE_MS = 420;

/** How long a spotlight stays up before fading on its own. */
const HIGHLIGHT_MS = 6_000;

/** Leaves the spotlit element clear of the header once scrolled to. */
const SCROLL_PADDING = 90;

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function measureInWindow(view: View): Promise<HighlightRect | null> {
  return new Promise((resolve) => {
    // measureInWindow never invokes its callback if the view has been detached,
    // so the guide would hang here waiting on a screen the farmer left.
    const bail = setTimeout(() => resolve(null), 400);

    view.measureInWindow((x, y, width, height) => {
      clearTimeout(bail);
      resolve(width > 0 && height > 0 ? { x, y, width, height } : null);
    });
  });
}

export function GuideProvider({ children }: { children: ReactNode }) {
  const { lands, selectLand } = useFarm();

  const nodes = useRef(new Map<string, GuideNode>());
  const [highlight, setHighlight] = useState<GuideContextValue['highlight']>(null);
  const [running, setRunning] = useState(false);

  /**
   * Identifies the run in flight, the same way AvatarContext identifies an
   * exchange. A farmer who asks something else mid-guide must not have the
   * abandoned run keep navigating underneath the new one.
   */
  const runId = useRef(0);
  const highlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const register = useCallback((id: string, node: GuideNode) => {
    nodes.current.set(id, node);
  }, []);

  const unregister = useCallback((id: string) => {
    nodes.current.delete(id);
  }, []);

  const clearHighlight = useCallback(() => {
    if (highlightTimer.current) clearTimeout(highlightTimer.current);
    highlightTimer.current = null;
    setHighlight(null);
  }, []);

  const cancel = useCallback(() => {
    runId.current += 1;
    clearHighlight();
    setRunning(false);
  }, [clearHighlight]);

  /** Bring a registered element into view. A miss is a no-op, not a failure. */
  const scrollTo = useCallback(async (id: string) => {
    const node = nodes.current.get(id);
    if (!node?.view || !node.scroll) return;

    // measureLayout against the scroll view's own content node gives the offset
    // inside the scrollable area, which is what scrollTo wants. Measuring in
    // window coordinates instead would give a screen position, and scrolling to
    // that would land somewhere arbitrary.
    const inner = (node.scroll as unknown as { getInnerViewNode?: () => number }).getInnerViewNode?.();
    if (inner === undefined || inner === null) return;

    await new Promise<void>((resolve) => {
      const bail = setTimeout(resolve, 400);

      node.view!.measureLayout(
        inner,
        (_x, y) => {
          clearTimeout(bail);
          node.scroll?.scrollTo({ y: Math.max(0, y - SCROLL_PADDING), animated: true });
          resolve();
        },
        () => {
          clearTimeout(bail);
          resolve();
        },
      );
    });

    // Let the scroll animation land before anything measures the element.
    await wait(320);
  }, []);

  const spotlight = useCallback(
    async (id: string) => {
      const node = nodes.current.get(id);
      if (!node?.view) return;

      const rect = await measureInWindow(node.view);
      if (!rect) return;

      if (highlightTimer.current) clearTimeout(highlightTimer.current);
      setHighlight({ target: id, rect });
      highlightTimer.current = setTimeout(() => setHighlight(null), HIGHLIGHT_MS);
    },
    [],
  );

  /** Choose the land the farmer named, if they named one that exists. */
  const selectNamedLand = useCallback(
    (name: string | undefined) => {
      if (!name || lands.length === 0) return;

      const wanted = name.trim().toLowerCase();
      const match = lands.find((land) => land.name?.trim().toLowerCase() === wanted);

      // No fuzzy matching on purpose. Switching the farmer's selected land is a
      // change to their working state, and doing it on a near-miss is worse
      // than leaving the land they already had selected.
      if (match) selectLand(match.id);
    },
    [lands, selectLand],
  );

  const perform = useCallback(
    async (step: GuideStep, entities: Record<string, string>) => {
      switch (step.action) {
        // OPEN and NAVIGATE are the same motion here. The distinction the AI
        // draws — going to a section versus opening a thing — is about intent,
        // and the app reaches both the same way.
        case 'NAVIGATE':
        case 'OPEN': {
          const destination = resolveNavigationTarget(step.target);
          if (!destination) return;

          if (destination.kind === 'tab') navigateToTab(destination.route);
          else navigateToStackRoute(destination.route);

          await wait(SETTLE_MS);
          return;
        }

        case 'SELECT': {
          if (!isSelectTarget(step.target)) return;
          selectNamedLand(entities.landName);
          await wait(120);
          return;
        }

        case 'SCROLL': {
          if (!isHighlightTarget(step.target)) return;
          await scrollTo(step.target);
          return;
        }

        // POINT differs from HIGHLIGHT only in what the avatar does with the
        // result — it leans toward the element instead of just ringing it — so
        // both resolve to the same measurement.
        case 'HIGHLIGHT':
        case 'POINT': {
          if (!isHighlightTarget(step.target)) return;
          await spotlight(step.target);
          return;
        }

        case 'BACK': {
          goBack();
          await wait(SETTLE_MS);
          return;
        }

        default:
          return;
      }
    },
    [scrollTo, selectNamedLand, spotlight],
  );

  const run = useCallback(
    async (steps: GuideStep[], entities: Record<string, string> = {}) => {
      runId.current += 1;
      const id = runId.current;

      clearHighlight();
      setRunning(true);

      try {
        for (const step of steps) {
          // Checked before every step, not just at the end: a cancelled run
          // must stop where it is rather than finishing the journey silently.
          if (runId.current !== id) return;
          await perform(step, entities);
        }
      } finally {
        if (runId.current === id) setRunning(false);
      }
    },
    [clearHighlight, perform],
  );

  const value = useMemo<GuideContextValue>(
    () => ({ highlight, running, register, unregister, run, cancel }),
    [highlight, running, register, unregister, run, cancel],
  );

  return <GuideContext.Provider value={value}>{children}</GuideContext.Provider>;
}

export function useGuide(): GuideContextValue {
  const context = useContext(GuideContext);
  if (!context) throw new Error('useGuide must be used inside a GuideProvider.');
  return context;
}

/**
 * The same hook, for screens that only register themselves.
 *
 * Returns null outside a provider rather than throwing, so a screen rendered in
 * a unit test does not need the whole guide stack mounted around it.
 */
export function useOptionalGuide(): GuideContextValue | null {
  return useContext(GuideContext);
}
