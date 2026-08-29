import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, radius } from '@/theme';

import { Icon } from './Icon';
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
 * The screen-level notice that a whole feed/list is demo content (Updates,
 * Schemes, Alerts, Calendar, Krishi Memory).
 *
 * This is deliberately calmer than `SampleBadge`: it uses the same
 * informational blue the app already uses for "here's a helpful note" accents
 * elsewhere, styled as a polished notice rather than a jarring developer
 * alert — but it never hides or softens the actual words, which still say
 * plainly that the content below is not real. `SampleBadge` (above) stays in
 * the off-palette violet on purpose: its job is flagging one fabricated
 * number sitting among real ones, which needs to look foreign at a glance in
 * a way a whole-screen notice does not.
 */
export function SampleBanner({ testID }: { testID?: string }) {
  const { t } = useTranslation();

  return (
    <View style={styles.banner} testID={testID ?? 'sample-banner'}>
      <Icon name="help" size={18} color={colors.accent} strokeWidth={1.8} />
      <View style={styles.bannerBody}>
        <Text variant="microMedium" color={colors.accent}>
          {t('demo.bannerTitle')}
        </Text>
        <Text variant="micro" color={colors.text.secondary} style={styles.bannerText}>
          {t('demo.bannerBody')}
        </Text>
      </View>
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
    borderRadius: radius.sm,
  },
  label: { letterSpacing: 0.6 },
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 12,
    backgroundColor: colors.accentBg,
    borderWidth: 1,
    borderColor: colors.accentBorder,
    borderRadius: radius.md,
  },
  bannerBody: { flex: 1, gap: 2 },
  bannerText: {},
});
