import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import { colors, radius } from '@/theme';

import { Text } from './Text';

export type BadgeTone =
  | 'success'
  | 'warning'
  | 'danger'
  | 'accent'
  | 'neutral'
  | 'sample'
  | 'tech'
  | 'scheme'
  | 'orange';

type Props = {
  label: string;
  tone?: BadgeTone;
  style?: StyleProp<ViewStyle>;
};

const TONES: Record<BadgeTone, { bg: string; fg: string }> = {
  success: { bg: colors.badges.schemeBg, fg: colors.badges.schemeFg },
  warning: { bg: colors.badges.mediumPriorityBg, fg: colors.badges.mediumPriorityFg },
  danger: { bg: colors.badges.highPriorityBg, fg: colors.badges.highPriorityFg },
  accent: { bg: colors.badges.radarBg, fg: colors.badges.radarFg },
  neutral: { bg: colors.neutralBg, fg: colors.text.secondary },
  sample: { bg: colors.badges.sampleBg, fg: colors.badges.sampleFg },
  tech: { bg: colors.badges.radarBg, fg: colors.badges.radarFg },
  scheme: { bg: colors.badges.schemeBg, fg: colors.badges.schemeFg },
  orange: { bg: '#FFEDD5', fg: '#C2410C' },
};

/** Refined badge pill matching KrishiNetra 2.0 specifications */
export function Badge({ label, tone = 'neutral', style }: Props) {
  const { bg, fg } = TONES[tone] || TONES.neutral;

  return (
    <View style={[styles.badge, { backgroundColor: bg }, style]}>
      <Text variant="microMedium" color={fg} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    maxWidth: '100%',
  },
});
