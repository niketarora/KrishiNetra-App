import { useCallback, useEffect, useRef } from 'react';
import type { View } from 'react-native';

import { useOptionalOnboardingTour } from './OnboardingTourContext';

/**
 * Attaches any screen element as a target for the onboarding product tour.
 * Safely no-ops if tour is not active or unmounted.
 * Guarantees a stable ref callback across re-renders to prevent ref loops.
 */
export function useTourTarget(
  id: string,
  radius: number = 12,
): (view: View | null) => void {
  const tour = useOptionalOnboardingTour();
  const tourRef = useRef(tour);
  tourRef.current = tour;
  const registered = useRef(false);

  const setView = useCallback(
    (view: View | null) => {
      const currentTour = tourRef.current;
      if (!currentTour) return;

      if (view) {
        currentTour.registerTarget(id, view, radius);
        registered.current = true;
      } else if (registered.current) {
        currentTour.unregisterTarget(id);
        registered.current = false;
      }
    },
    [id, radius],
  );

  useEffect(() => {
    return () => {
      if (registered.current) {
        tourRef.current?.unregisterTarget(id);
        registered.current = false;
      }
    };
  }, [id]);

  return setView;
}
