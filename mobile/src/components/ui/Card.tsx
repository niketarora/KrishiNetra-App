import { ReactNode } from 'react';
import { Pressable, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import { colors, layout } from '@/theme';

type Props = {
  children: ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  /** Tinted variants for advisory and market cards. */
  tone?: 'surface' | 'accent' | 'success';
  accessibilityLabel?: string;
  testID?: string;
};

/**
 * design.md §3.3: white surface, hairline border, 14dp padding.
 * Square corners and no elevation — flat separation keeps rendering cheap on
 * low-end devices and legible in bright outdoor light.
 */
export function Card({ children, onPress, style, tone = 'surface', accessibilityLabel, testID }: Props) {
  const toneStyle =
    tone === 'accent' ? styles.accent : tone === 'success' ? styles.success : styles.surface;

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
  },
  surface: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  accent: {
    backgroundColor: colors.accentBg,
  },
  success: {
    backgroundColor: colors.successBg,
    borderWidth: 1,
    borderColor: colors.successBorder,
  },
  pressed: { opacity: 0.75 },
});
