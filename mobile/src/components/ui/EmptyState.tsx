import { StyleSheet, View } from 'react-native';

import { colors, layout } from '@/theme';

import { Button } from './Button';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';

type Props = {
  icon: IconName;
  title: string;
  body?: string;
  actionLabel?: string;
  onAction?: () => void;
  testID?: string;
};

/**
 * The honest state for a feature that has no data yet.
 *
 * Phase 1 leans on this heavily: field analysis, market intelligence and
 * history all render their real layout in this state rather than showing
 * plausible-looking sample numbers. IMPLEMENTATION.md rule 13 — mock data must
 * never be presented as real.
 */
export function EmptyState({ icon, title, body, actionLabel, onAction, testID }: Props) {
  return (
    <View style={styles.wrapper} testID={testID}>
      <Icon name={icon} size={32} color={colors.text.muted} strokeWidth={1.6} />
      <Text variant="body" color={colors.text.secondary} center style={styles.title}>
        {title}
      </Text>
      {body ? (
        <Text variant="caption" center style={styles.body}>
          {body}
        </Text>
      ) : null}
      {actionLabel && onAction ? (
        <Button
          label={actionLabel}
          onPress={onAction}
          variant="secondary"
          style={styles.action}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    paddingHorizontal: layout.screenPadding + 24,
    paddingVertical: 48,
    gap: 14,
  },
  title: {},
  body: {},
  action: { marginTop: 6, maxWidth: 260 },
});
