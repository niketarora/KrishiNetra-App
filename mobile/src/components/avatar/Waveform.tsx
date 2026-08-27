import { useEffect, useState } from 'react';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { avatarColors } from '@/theme';
import { isAudioActive, type AvatarState } from '@/features/avatar/avatarMachine';

const BAR_COUNT = 22;
const BAR_WIDTH = 3;
const BAR_GAP = 3;
const TRACK_HEIGHT = 26;
const IDLE_HEIGHT = 4;

/** Heights follow the prototype's `6 + ((i * 7) % 17)` pattern. */
const barHeight = (index: number) => 6 + ((index * 7) % 17) + 8;

function Bar({
  index,
  active,
  color,
  reduceMotion,
}: {
  index: number;
  active: boolean;
  color: string;
  reduceMotion: boolean;
}) {
  const scale = useSharedValue(0.22);

  useEffect(() => {
    if (!active || reduceMotion) {
      cancelAnimation(scale);
      scale.value = withTiming(active ? 0.7 : 0.22, { duration: 160 });
      return;
    }

    // Staggered so the bars read as a voice rather than a metronome.
    scale.value = withDelay(
      (index % 7) * 110,
      withRepeat(
        withTiming(1, { duration: 425, easing: Easing.inOut(Easing.ease) }),
        -1,
        true,
      ),
    );

    return () => cancelAnimation(scale);
  }, [active, index, reduceMotion, scale]);

  const animated = useAnimatedStyle(() => ({ transform: [{ scaleY: scale.value }] }));

  return (
    <Animated.View
      style={[
        styles.bar,
        {
          height: active ? barHeight(index) : IDLE_HEIGHT,
          backgroundColor: color,
        },
        active ? animated : null,
      ]}
    />
  );
}

/** Three pulsing dots — the prototype's "thinking" indicator. */
function ThinkingDots({ color, reduceMotion }: { color: string; reduceMotion: boolean }) {
  return (
    <View style={styles.dots}>
      {[0, 1, 2].map((i) => (
        <Dot key={i} index={i} color={color} reduceMotion={reduceMotion} />
      ))}
    </View>
  );
}

function Dot({
  index,
  color,
  reduceMotion,
}: {
  index: number;
  color: string;
  reduceMotion: boolean;
}) {
  const opacity = useSharedValue(0.25);

  useEffect(() => {
    if (reduceMotion) {
      opacity.value = 0.7;
      return;
    }
    opacity.value = withDelay(
      index * 180,
      withRepeat(withTiming(1, { duration: 550, easing: Easing.inOut(Easing.ease) }), -1, true),
    );
    return () => cancelAnimation(opacity);
  }, [index, opacity, reduceMotion]);

  const animated = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return <Animated.View style={[styles.dot, { backgroundColor: color }, animated]} />;
}

/**
 * Voice activity indicator (TRD §11). Green bars while the farmer speaks, blue
 * while the avatar answers, amber dots while it is working — the same visual
 * language the prototype uses, so state is readable at a glance without
 * reading the label.
 */
export function Waveform({ state }: { state: AvatarState }) {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (active) setReduceMotion(enabled);
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      active = false;
      sub.remove();
    };
  }, []);

  if (state === 'thinking') {
    return <ThinkingDots color={avatarColors.state.thinking} reduceMotion={reduceMotion} />;
  }

  const active = isAudioActive(state);
  const color = active ? avatarColors.state[state] : avatarColors.waveIdle;

  return (
    <View style={styles.track} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {Array.from({ length: BAR_COUNT }, (_, i) => (
        <Bar key={i} index={i} active={active} color={color} reduceMotion={reduceMotion} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: BAR_GAP,
    height: TRACK_HEIGHT,
  },
  bar: { width: BAR_WIDTH },
  dots: { flexDirection: 'row', alignItems: 'center', gap: 7, height: TRACK_HEIGHT },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
