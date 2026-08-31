import { useCallback, useEffect, useRef } from 'react';
import type { ScrollView, View } from 'react-native';

import { useOptionalGuide } from './GuideContext';
import { isHighlightTarget } from './targets';

/**
 * Makes one element on a screen reachable by the guide.
 *
 * Screens stay otherwise untouched: nothing renders differently, nothing
 * re-renders when a highlight fires, and a screen mounted outside the guide
 * (in a test, say) behaves exactly as it did before.
 *
 *     const weather = useGuideTarget('weather-card', scrollRef);
 *     <GuideTarget id="weather-card" ...>
 *
 * The ref goes on a host view, not a custom component — measurement needs a
 * real native node. `GuideTarget` wraps that up, and is what screens normally
 * use; this hook is the escape hatch for a component that already owns a View.
 */
export function useGuideTarget(
  id: string,
  scroll?: React.RefObject<ScrollView | null>,
): (view: View | null) => void {
  const guide = useOptionalGuide();
  const registered = useRef(false);

  const setView = useCallback(
    (view: View | null) => {
      if (!guide) return;

      // An id the target table does not know is a mistake worth catching at the
      // screen rather than silently never matching a step.
      if (__DEV__ && !isHighlightTarget(id)) {
        console.warn(`[guide] "${id}" is not in HIGHLIGHT_TARGETS — the guide cannot reach it.`);
      }

      if (view) {
        guide.register(id, { view, scroll: scroll?.current ?? null });
        registered.current = true;
      } else if (registered.current) {
        guide.unregister(id);
        registered.current = false;
      }
    },
    [guide, id, scroll],
  );

  // The ref callback fires on mount and unmount, but a screen can be unmounted
  // without it firing (fast refresh, a navigator dropping the whole tree), so
  // the registry is cleaned up here as well.
  useEffect(() => {
    return () => {
      if (registered.current) guide?.unregister(id);
      registered.current = false;
    };
  }, [guide, id]);

  return setView;
}
