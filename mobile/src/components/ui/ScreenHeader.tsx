import { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, fonts, layout } from '@/theme';

import { Icon } from './Icon';
import { Text } from './Text';

type Props = {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  onMenu?: () => void;
  right?: ReactNode;
  titleColor?: string;
};

/**
 * Clean agricultural header row matching KrishiNetra 2.0 reference design:
 * Hamburger/Back icon, bold green title, optional subtitle, and right action icon.
 */
export function ScreenHeader({
  title,
  subtitle,
  onBack,
  onMenu,
  right,
  titleColor = colors.primary,
}: Props) {
  const { t } = useTranslation();

  return (
    <View style={[styles.header, subtitle ? styles.headerWithSubtitle : null]}>
      <View style={styles.leftRow}>
        {onBack ? (
          <Pressable
            onPress={onBack}
            hitSlop={12}
            style={styles.actionBtn}
            accessibilityRole="button"
            accessibilityLabel={t('common.back')}
          >
            <Icon name="back" size={22} color={colors.text.primary} strokeWidth={2} />
          </Pressable>
        ) : onMenu ? (
          <Pressable
            onPress={onMenu}
            hitSlop={12}
            style={styles.actionBtn}
            accessibilityRole="button"
            accessibilityLabel="Menu"
          >
            <Icon name="menu" size={22} color={colors.text.primary} strokeWidth={2} />
          </Pressable>
        ) : null}

        <View style={styles.titleContainer}>
          <Text
            variant="title"
            style={[styles.title, { color: titleColor }]}
            numberOfLines={subtitle ? 1 : 2}
          >
            {title}
          </Text>
          {subtitle ? (
            <Text variant="micro" color={colors.text.secondary} numberOfLines={1} style={styles.subtitle}>
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>

      {right ? <View style={styles.right}>{right}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    minHeight: layout.headerHeight,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: layout.screenPadding,
    paddingTop: 8,
    paddingBottom: 8,
    backgroundColor: colors.bg,
  },
  headerWithSubtitle: {
    paddingBottom: 10,
  },
  leftRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  actionBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -4,
  },
  titleContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    fontFamily: fonts.semibold,
    fontSize: 19,
    lineHeight: 24,
  },
  subtitle: {
    marginTop: 2,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 8,
  },
});
