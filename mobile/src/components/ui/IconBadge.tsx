import { StyleSheet, View } from 'react-native';

import { colors, radius } from '@/theme';

import { Icon, type IconName } from './Icon';

export type IconBadgeTone = 'primary' | 'accent' | 'warning' | 'danger' | 'harvest' | 'neutral' | 'demo';

type Props = {
  icon: IconName;
  tone?: IconBadgeTone;
  size?: number;
  iconSize?: number;
};

const TONES: Record<IconBadgeTone, { bg: string; fg: string }> = {
  primary: { bg: colors.successBg, fg: colors.primaryDark },
  accent: { bg: colors.accentBg, fg: colors.accent },
  warning: { bg: colors.warningBg, fg: colors.warning },
  danger: { bg: colors.dangerBg, fg: colors.danger },
  harvest: { bg: colors.harvestBg, fg: colors.harvest },
  neutral: { bg: colors.neutralBg, fg: colors.text.secondary },
  // Off-palette on purpose — flags a fabricated/demo value, same convention
  // as `SampleBadge`. See that component's file comment.
  demo: { bg: colors.demo.bg, fg: colors.demo.fg },
};

/**
 * An icon centred in a small tinted circle — the "icon in a soft container"
 * treatment used across list rows (Updates, Schemes, Academy, Calendar,
 * Alerts, Profile) so a row's subject reads as a purposeful, tappable thing
 * rather than a bare glyph floating in a plain white rectangle.
 */
export function IconBadge({ icon, tone = 'primary', size = 36, iconSize = 18 }: Props) {
  const { bg, fg } = TONES[tone];

  return (
    <View style={[styles.badge, { width: size, height: size, borderRadius: size / 2, backgroundColor: bg }]}>
      <Icon name={icon} size={iconSize} color={fg} />
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
  },
});
