import { useCallback, useEffect, useState } from 'react';
import { AccessibilityInfo, Image, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

import { avatarColors } from '@/theme';
import type { AvatarState } from '@/features/avatar/avatarMachine';

import { Text } from '../ui/Text';

import { Avatar3D } from './Avatar3D';

// docs/images/hero_image.png, downscaled to 1080px for the bundle. This is the
// project's farmer avatar — do not swap the character without instruction.
const FARMER = require('../../../assets/avatar/farmer.jpg');

type Props = {
  state: AvatarState;
  statusLabel: string;
  /** The line the avatar is currently saying, or its idle greeting. */
  speech: string;
  source: string | null;
};

/**
 * The avatar's visual: a full-bleed photograph of the farmer with a gradient
 * scrim, a live-state pill, the spoken line as a large subtitle, and a source
 * chip on grounded answers.
 *
 * The slow "breathe" scale is what stops a still photo reading as a dead
 * screenshot — it is a 1.2% scale loop, the cheapest possible way to suggest a
 * person is present, and it is skipped entirely under reduce-motion.
 */
export function AvatarStage({ state, statusLabel, speech, source }: Props) {
  const [reduceMotion, setReduceMotion] = useState(false);
  const scale = useSharedValue(1);

  /**
   * The 3D avatar is attempted first and falls back to the photograph the
   * moment anything is missing — no model bundled, no WebGL, a crashed render
   * process. The avatar must never be a blank rectangle, so the fallback is
   * permanent for the session rather than retried.
   */
  const [show3D, setShow3D] = useState(true);
  const handle3DUnavailable = useCallback(() => setShow3D(false), []);

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

  useEffect(() => {
    if (reduceMotion) {
      cancelAnimation(scale);
      scale.value = 1;
      return;
    }
    scale.value = withRepeat(
      withTiming(1.012, { duration: 3000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
    return () => cancelAnimation(scale);
  }, [reduceMotion, scale]);

  const breathing = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <View style={styles.stage}>
      {show3D ? (
        <Avatar3D
          state={state}
          reduceMotion={reduceMotion}
          onUnavailable={handle3DUnavailable}
        />
      ) : (
        <Animated.View style={[StyleSheet.absoluteFill, breathing]}>
          <Image source={FARMER} style={styles.photo} resizeMode="cover" accessible={false} />
        </Animated.View>
      )}

      <LinearGradient
        colors={[avatarColors.scrimTop, avatarColors.scrimMid, avatarColors.scrimBottom]}
        locations={[0, 0.42, 1]}
        style={styles.scrim}
        pointerEvents="none"
      />

      <View style={styles.livePill} pointerEvents="none">
        <View style={[styles.liveDot, { backgroundColor: avatarColors.state[state] }]} />
        <Text variant="microMedium" color="#EDEEE9" style={styles.liveLabel}>
          {statusLabel}
        </Text>
      </View>

      <View style={styles.subtitleArea} pointerEvents="none">
        <Text
          variant="title"
          color="#FFFFFF"
          style={styles.subtitle}
          accessibilityLiveRegion="polite"
        >
          {speech}
        </Text>

        {source ? (
          <View style={styles.sourceChip}>
            <Text variant="microMedium" color="#FFFFFF">
              {source}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stage: { flex: 1, minHeight: 0, overflow: 'hidden', backgroundColor: avatarColors.stage },
  photo: { width: '100%', height: '100%' },
  scrim: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '58%' },
  livePill: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingVertical: 5,
    paddingHorizontal: 10,
    backgroundColor: avatarColors.pillBg,
  },
  liveDot: { width: 7, height: 7, borderRadius: 4 },
  liveLabel: { letterSpacing: 0.6 },
  subtitleArea: { position: 'absolute', left: 16, right: 16, bottom: 16 },
  subtitle: { fontSize: 20, lineHeight: 29 },
  sourceChip: {
    alignSelf: 'flex-start',
    marginTop: 10,
    paddingVertical: 4,
    paddingHorizontal: 9,
    backgroundColor: avatarColors.sourceChip,
  },
});
