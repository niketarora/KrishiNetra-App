import { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, layout } from '@/theme';

import { Icon } from './Icon';
import { Text } from './Text';

type Props = {
  title: string;
  onBack?: () => void;
  right?: ReactNode;
};

/**
 * design.md §2: a plain 56dp row — back arrow plus the screen name, no app-bar
 * surface, no border, background matching the screen.
 */
export function ScreenHeader({ title, onBack, right }: Props) {
  const { t } = useTranslation();

  return (
    <View style={styles.header}>
      {onBack ? (
        <Pressable
          onPress={onBack}
          hitSlop={12}
          style={styles.back}
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
        >
          <Icon name="back" size={22} color={colors.text.primary} strokeWidth={2} />
        </Pressable>
      ) : null}

      <Text variant="title" style={styles.title} numberOfLines={1}>
        {title}
      </Text>

      {right ? <View>{right}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    height: layout.headerHeight,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: layout.screenPadding,
  },
  back: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -6,
  },
  title: { flex: 1 },
});
