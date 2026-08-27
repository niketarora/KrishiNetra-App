import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors } from '@/theme';

import { Text } from './Text';

/**
 * Marks a value as fabricated.
 *
 * This appears next to every DEMO_MODE sample value, in the off-palette violet
 * from `theme/colors.ts`. It is not decoration: it is the thing that keeps
 * sample data from being mistaken for a real reading, so it is never optional
 * and never conditional on space.
 *
 * If you find yourself wanting to hide it to make a screenshot look cleaner,
 * turn DEMO_MODE off instead.
 */
export function SampleBadge({ testID }: { testID?: string }) {
  const { t } = useTranslation();

  return (
    <View style={styles.badge} testID={testID ?? 'sample-badge'}>
      <Text variant="microMedium" color={colors.demo.fg} style={styles.label}>
        {t('demo.badge')}
      </Text>
    </View>
  );
}

/**
 * The screen-level warning that some values below are fabricated.
 *
 * A per-value badge tells you which number is fake; this tells you the screen
 * is in demo mode at all, which is what someone glancing at a projector sees.
 */
export function SampleBanner({ testID }: { testID?: string }) {
  const { t } = useTranslation();

  return (
    <View style={styles.banner} testID={testID ?? 'sample-banner'}>
      <Text variant="microMedium" color={colors.demo.fg}>
        {t('demo.bannerTitle')}
      </Text>
      <Text variant="micro" color={colors.demo.fg} style={styles.bannerBody}>
        {t('demo.bannerBody')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    paddingVertical: 2,
    paddingHorizontal: 6,
    backgroundColor: colors.demo.bg,
    borderWidth: 1,
    borderColor: colors.demo.border,
  },
  label: { letterSpacing: 0.6 },
  banner: {
    padding: 12,
    backgroundColor: colors.demo.bg,
    borderWidth: 1,
    borderColor: colors.demo.border,
    gap: 2,
  },
  bannerBody: { opacity: 0.9 },
});
