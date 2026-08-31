import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * Whether the farmer has asked the system to reduce motion.
 *
 * The guide leans on animation to be understood — a spotlight that pulses, an
 * avatar that slides in — and all of it has to degrade to a still frame for
 * anyone who finds that motion unpleasant or disorienting. Reading the setting
 * in one place keeps that from being remembered case by case.
 */
export function useReduceMotion(): boolean {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let active = true;

    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (active) setReduceMotion(enabled);
    });

    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);

    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  return reduceMotion;
}
