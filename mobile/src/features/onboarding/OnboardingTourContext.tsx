import * as SecureStore from 'expo-secure-store';
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { View } from 'react-native';

import { useAuth } from '@/features/auth/AuthContext';
import { useFarm } from '@/features/farm/FarmContext';
import { navigateToStackRoute, navigateToTab, navigationRef } from '@/navigation/navigationRef';
import { supabase } from '@/services/supabase';

export type TourStep = 1 | 2 | 3 | 4 | 5 | 6;

export type TourTargetRect = {
  x: number;
  y: number;
  width: number;
  height: number;
  radius?: number;
};

type RegisteredTarget = {
  view: View;
  radius?: number;
};

type OnboardingTourContextValue = {
  step: TourStep;
  isActive: boolean;
  isLandRegistered: boolean;
  targetRect: TourTargetRect | null;
  registerTarget: (id: string, view: View, radius?: number) => void;
  unregisterTarget: (id: string) => void;
  nextStep: () => void;
  markLandRegistered: () => void;
  skipTour: () => Promise<void>;
  finishTour: () => Promise<void>;
  resetTour: () => Promise<void>;
};

const OnboardingTourContext = createContext<OnboardingTourContextValue | null>(null);

const TARGET_BY_STEP: Record<TourStep, string> = {
  1: 'tour-profile-avatar',
  2: 'tour-my-farm',
  3: 'tour-mylands-register',
  4: 'tour-register-map',
  5: 'tour-field-analysis',
  6: 'tour-market',
};

const STORAGE_PREFIX = 'krishinetra.onboarding.';

export function OnboardingTourProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const { lands, farm } = useFarm();

  const [step, setStep] = useState<TourStep>(1);
  const [isActive, setIsActive] = useState(false);
  const [isLandRegistered, setIsLandRegistered] = useState(false);
  const isLandRegisteredRef = useRef(false);
  const [targetRect, setTargetRect] = useState<TourTargetRect | null>(null);

  useEffect(() => {
    isLandRegisteredRef.current = isLandRegistered;
  }, [isLandRegistered]);

  const targetsRef = useRef<Map<string, RegisteredTarget>>(new Map());
  const initialLandsCount = useRef<number | null>(null);
  const checkedForUserRef = useRef<string | null>(null);

  // Track initial lands count when tour starts
  useEffect(() => {
    if (initialLandsCount.current === null && lands !== undefined) {
      initialLandsCount.current = lands.length;
    }
  }, [lands]);

  // Detect when land is registered during tour or exists
  useEffect(() => {
    if (Boolean(farm) || (lands && lands.length > 0)) {
      setIsLandRegistered(true);
    } else if (initialLandsCount.current !== null && lands && lands.length > initialLandsCount.current) {
      setIsLandRegistered(true);
    }
  }, [farm, lands]);

  // Check if onboarding is completed for this user
  useEffect(() => {
    let active = true;

    if (!userId) {
      setIsActive(false);
      return;
    }

    const checkStatus = async () => {
      try {
        const local = await SecureStore.getItemAsync(`${STORAGE_PREFIX}${userId}`);
        const remote = user?.user_metadata?.onboarding_completed;
        const hasExistingLands = Boolean(farm) || (lands !== undefined && lands.length > 0);

        if (local === 'true' || remote === true) {
          if (active) {
            setIsActive(false);
          }
          return;
        }

        // An existing farmer who already has registered lands or a farm must NEVER be shown the onboarding tour
        if (hasExistingLands) {
          if (active) {
            setIsActive(false);
          }
          await SecureStore.setItemAsync(`${STORAGE_PREFIX}${userId}`, 'true');
          return;
        }

        // A new farmer logging in for the first time without registered lands
        if (active) {
          setIsActive(true);
          setStep(1);
        }
      } catch (e) {
        // Non-fatal
      }
    };

    void checkStatus();

    return () => {
      active = false;
    };
  }, [userId, user?.user_metadata?.onboarding_completed, farm, lands]);

  const measureCurrentTarget = useCallback((targetId: string) => {
    const reg = targetsRef.current.get(targetId);
    if (!reg?.view) {
      setTargetRect(null);
      return;
    }

    reg.view.measureInWindow((x, y, width, height) => {
      if (width > 0 && height > 0) {
        setTargetRect({
          x,
          y,
          width,
          height,
          radius: reg.radius ?? 12,
        });
      }
    });
  }, []);

  // Whenever step or registered targets change, measure active target
  useEffect(() => {
    if (!isActive) {
      setTargetRect(null);
      return;
    }

    const targetId = TARGET_BY_STEP[step];
    // Immediate measure attempt
    measureCurrentTarget(targetId);

    // Settle delay for animations / navigation pushes
    const t1 = setTimeout(() => measureCurrentTarget(targetId), 250);
    const t2 = setTimeout(() => measureCurrentTarget(targetId), 600);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [step, isActive, measureCurrentTarget]);

  const registerTarget = useCallback((id: string, view: View, radius?: number) => {
    targetsRef.current.set(id, { view, radius });
    if (TARGET_BY_STEP[step] === id) {
      setTimeout(() => {
        view.measureInWindow((x, y, width, height) => {
          if (width > 0 && height > 0) {
            setTargetRect({
              x,
              y,
              width,
              height,
              radius: radius ?? 12,
            });
          }
        });
      }, 100);
    }
  }, [step]);

  const unregisterTarget = useCallback((id: string) => {
    targetsRef.current.delete(id);
  }, []);

  const saveCompletion = useCallback(async () => {
    if (!userId) return;
    try {
      await SecureStore.setItemAsync(`${STORAGE_PREFIX}${userId}`, 'true');
      await SecureStore.deleteItemAsync(`krishinetra.first_time_farmer.${userId}`);
      void supabase.auth.updateUser({ data: { onboarding_completed: true, is_new_farmer: false } }).catch(() => {});
    } catch {
      // Non-fatal
    }
  }, [userId]);

  const nextStep = useCallback(() => {
    setStep((currentStep) => {
      if (currentStep === 1) {
        navigateToStackRoute('Profile');
        return 2;
      }
      if (currentStep === 2) {
        navigateToStackRoute('MyLands');
        return 3;
      }
      if (currentStep === 3) {
        navigateToStackRoute('RegisterLandMethod');
        return 4;
      }
      if (currentStep === 4) {
        // Step 5 and 6 only appear after land is registered
        if (!isLandRegisteredRef.current) {
          return 4;
        }
        navigateToTab('Field');
        return 5;
      }
      if (currentStep === 5) {
        navigateToTab('Market');
        return 6;
      }
      return currentStep;
    });
  }, []);

  const markLandRegistered = useCallback(() => {
    isLandRegisteredRef.current = true;
    setIsLandRegistered(true);
  }, []);

  const skipTour = useCallback(async () => {
    setIsActive(false);
    await saveCompletion();
  }, [saveCompletion]);

  const finishTour = useCallback(async () => {
    setIsActive(false);
    await saveCompletion();
    // Return smoothly to Home
    navigateToTab('Home');
  }, [saveCompletion]);

  const resetTour = useCallback(async () => {
    if (userId) {
      try {
        await SecureStore.deleteItemAsync(`${STORAGE_PREFIX}${userId}`);
        await SecureStore.setItemAsync(`krishinetra.first_time_farmer.${userId}`, 'true');
        void supabase.auth.updateUser({ data: { onboarding_completed: false, is_new_farmer: true } }).catch(() => {});
      } catch {
        // Non-fatal
      }
    }
    checkedForUserRef.current = userId;
    setStep(1);
    setIsActive(true);
    isLandRegisteredRef.current = false;
    setIsLandRegistered(false);
    navigateToTab('Home');
  }, [userId]);

  const value = useMemo(
    () => ({
      step,
      isActive,
      isLandRegistered,
      targetRect,
      registerTarget,
      unregisterTarget,
      nextStep,
      markLandRegistered,
      skipTour,
      finishTour,
      resetTour,
    }),
    [
      step,
      isActive,
      isLandRegistered,
      targetRect,
      registerTarget,
      unregisterTarget,
      nextStep,
      markLandRegistered,
      skipTour,
      finishTour,
      resetTour,
    ],
  );

  return (
    <OnboardingTourContext.Provider value={value}>
      {children}
    </OnboardingTourContext.Provider>
  );
}

export function useOnboardingTour() {
  const ctx = useContext(OnboardingTourContext);
  if (!ctx) {
    throw new Error('useOnboardingTour must be used within an OnboardingTourProvider');
  }
  return ctx;
}

export function useOptionalOnboardingTour() {
  return useContext(OnboardingTourContext);
}
