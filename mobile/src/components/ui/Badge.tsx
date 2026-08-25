import { StyleSheet, View } from 'react-native';

import { colors } from '@/theme';

import { Text } from './Text';

export type BadgeTone = 'success' | 'warning' | 'danger' | 'accent' | 'neutral';

type Props = {
  label: string;
  tone?: BadgeTone;
};

const TONES: Record<BadgeTone, { bg: string; fg: string }> = {
  success: { bg: colors.successBg, fg: colors.primaryDark },
  warning: { bg: colors.warningBg, fg: colors.warning },
  danger: { bg: colors.dangerBg, fg: colors.danger },
  accent: { bg: colors.accentBg, fg: colors.accent },
  neutral: { bg: colors.neutralBg, fg: colors.text.secondary },
};

/** design.md §3.6 — a small tinted pill carrying a status word. */
export function Badge({ label, tone = 'neutral' }: Props) {
  const { bg, fg } = TONES[tone];

  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text variant="microMedium" color={fg} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    alignSelf: 'flex-start',
  },
});
