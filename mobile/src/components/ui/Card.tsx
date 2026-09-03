import { ReactNode } from 'react';
import { Pressable, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import { colors, layout, radius } from '@/theme';

type Props = {
  children: ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  /** Tinted variants for advisory, market and highlighted farm-context cards. */
  tone?: 'surface' | 'accent' | 'success' | 'harvest';
  accessibilityLabel?: string;
  testID?: string;
};

/**
 * design.md §3.3, refined: 12dp rounded surface, hairline border, 14dp
 * padding, and a very light elevation so cards read as grouped, intentional
 * surfaces rather than flat rectangles — still restrained (no heavy shadow),
 * and still cheap to render on a low-end device.
 */
export function Card({ children, onPress, style, tone = 'surface', accessibilityLabel, testID }: Props) {
  const toneStyle =
    tone === 'accent'
      ? styles.accent
      : tone === 'success'
        ? styles.success
        : tone === 'harvest'
          ? styles.harvest
          : styles.surface;

  if (!onPress) {
    return (
      <View style={[styles.base, toneStyle, style]} testID={testID}>
        {children}
      </View>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      style={({ pressed }) => [styles.base, toneStyle, pressed && styles.pressed, style]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    padding: layout.cardPadding,
    borderRadius: radius.md,
    elevation: 2,
    shadowColor: '#1C251D',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  surface: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  accent: {
    backgroundColor: colors.accentBg,
    borderWidth: 1,
    borderColor: colors.accentBorder,
  },
  success: {
    backgroundColor: colors.successBg,
    borderWidth: 1,
    borderColor: colors.successBorder,
  },
  harvest: {
    backgroundColor: colors.harvestBg,
    borderWidth: 1,
    borderColor: colors.harvestBorder,
  },
  pressed: { opacity: 0.75 },
});
