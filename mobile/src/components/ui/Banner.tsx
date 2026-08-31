import { Pressable, StyleSheet, View } from 'react-native';

import { colors, layout } from '@/theme';

import { Icon, type IconName } from './Icon';
import { Text } from './Text';

export type BannerTone = 'warning' | 'danger' | 'neutral' | 'info';

type Props = {
  title: string;
  detail?: string;
  tone?: BannerTone;
  icon?: IconName;
  onDismiss?: () => void;
  dismissLabel?: string;
};

const TONES: Record<BannerTone, { bg: string; fg: string; icon: IconName }> = {
  warning: { bg: colors.warningBg, fg: colors.warning, icon: 'alert' },
  danger: { bg: colors.dangerBg, fg: colors.danger, icon: 'alert' },
  neutral: { bg: colors.neutralBg, fg: colors.text.secondary, icon: 'offline' },
  info: { bg: colors.neutralBg, fg: colors.text.secondary, icon: 'offline' },
};

/**
 * design.md §3.4. Warning and danger colours are reserved for conditions that
 * need the farmer's attention — they never appear decoratively. A banner is
 * only rendered when its condition is live; there is no "no alerts" state.
 */
export function Banner({ title, detail, tone = 'warning', icon, onDismiss, dismissLabel }: Props) {
  const config = TONES[tone] ?? TONES.warning;

  return (
    <View style={[styles.banner, { backgroundColor: config.bg }]} accessibilityRole="alert">
      <Icon name={icon ?? config.icon} size={20} color={config.fg} strokeWidth={2} />
      <View style={styles.body}>
        <Text variant="bodyMedium" color={config.fg}>
          {title}
        </Text>
        {detail ? (
          <Text variant="caption" style={styles.detail}>
            {detail}
          </Text>
        ) : null}
      </View>
      {onDismiss ? (
        <Pressable
          onPress={onDismiss}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={dismissLabel}
        >
          <Icon name="close" size={18} color={config.fg} strokeWidth={2} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: layout.cardPadding,
  },
  body: { flex: 1 },
  detail: { marginTop: 2 },
});
