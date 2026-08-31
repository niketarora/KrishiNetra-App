import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { useGuide } from '@/features/guide/GuideContext';
import { colors, radius } from '@/theme';
import { useReduceMotion } from '@/utils/useReduceMotion';

/**
 * The ring the guide draws around whatever it just took the farmer to.
 *
 * Deliberately a ring and not a dimming mask with a hole in it. A mask says
 * "nothing else matters"; a ring says "this one". The farmer is meant to keep
 * using the screen — they may well want to tap the very card being pointed at —
 * so nothing here is allowed to intercept a touch, and `pointerEvents="none"`
 * is what guarantees it.
 *
 * Rendered outside NavigationContainer, so it survives every navigation the
 * guide performs and never has to be re-mounted per screen.
 */

/** How far outside the element the ring sits, so it frames rather than covers. */
const INSET = 6;

export function Spotlight() {
  const { highlight } = useGuide();
  const reduceMotion = useReduceMotion();

  const pulse = useSharedValue(0);

  useEffect(() => {
    if (!highlight || reduceMotion) {
      cancelAnimation(pulse);
      // Still visible, just not moving: reduce-motion removes the pulse, not
      // the guidance.
      pulse.value = reduceMotion && highlight ? 1 : 0;
      return;
    }

    pulse.value = 0;
    pulse.value = withRepeat(
      withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );

    return () => cancelAnimation(pulse);
  }, [highlight, pulse, reduceMotion]);

  const ring = useAnimatedStyle(() => ({
    opacity: 0.55 + pulse.value * 0.45,
    transform: [{ scale: 1 + pulse.value * 0.012 }],
  }));

  if (!highlight) return null;

  const { rect } = highlight;

  return (
    <Animated.View
      pointerEvents="none"
      accessible={false}
      // The bubble already says what is being pointed at, and the spotlight is
      // decoration on top of that — announcing it too would say it twice.
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.ring,
        {
          left: rect.x - INSET,
          top: rect.y - INSET,
          width: rect.width + INSET * 2,
          height: rect.height + INSET * 2,
        },
        ring,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  ring: {
    position: 'absolute',
    borderWidth: 3,
    borderColor: colors.primary,
    borderRadius: radius.md + INSET,
    // No fill. The ring sits on top of the card it is framing, so anything but
    // a transparent centre would hide the very thing the farmer was brought
    // here to read.
    backgroundColor: 'transparent',
    // Android draws absolutely-positioned siblings in mount order; the lift
    // keeps the ring above the screen content it is framing.
    elevation: 12,
    shadowColor: colors.primary,
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
});
