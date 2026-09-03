import { StyleSheet, View } from 'react-native';

import { colors } from '@/theme';

import { Card } from './Card';
import { type IconName } from './Icon';
import { IconBadge } from './IconBadge';
import { Text } from './Text';

type Props = {
  icon: IconName;
  label: string;
  value: string;
  note?: string;
  /** Dims the value when it is a placeholder rather than a real reading. */
  muted?: boolean;
  /**
   * Marks the value as fabricated DEMO_MODE sample data: off-palette colour
   * plus a badge, so it cannot be read as a real measurement.
   */
  sample?: boolean;
  onPress?: () => void;
  testID?: string;
};

/**
 * design.md §3.3 — the 2-column grid tile on Home (Growth stage, Weather).
 * In Phase 1 both tiles render `muted` with an em dash, because no analysis
 * service is connected yet and inventing a value would mislead the farmer.
 */
export function StatusCard({ icon, label, value, note, muted = false, sample = false, onPress, testID }: Props) {
  return (
    <Card style={[styles.card, sample && styles.sampleCard]} onPress={onPress} testID={testID}>
      <View style={styles.topRow}>
        <IconBadge icon={icon} tone={sample ? 'demo' : muted ? 'neutral' : 'primary'} size={36} iconSize={18} />
      </View>
      <Text variant="caption" color={colors.text.secondary} style={styles.label}>
        {label}
      </Text>
      <View style={styles.valueRow}>
        <Text
          variant="stat"
          color={sample ? colors.demo.fg : muted ? colors.text.muted : colors.text.primary}
          style={styles.valueText}
          numberOfLines={1}
        >
          {value}
        </Text>
      </View>
      {note ? (
        <Text
          variant="micro"
          color={sample ? colors.demo.fg : colors.text.muted}
          style={styles.note}
          numberOfLines={1}
        >
          {note}
        </Text>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    padding: 14,
    gap: 4,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  sampleCard: { borderColor: colors.demo.border },
  label: { fontSize: 13 },
  valueRow: { marginTop: 2 },
  valueText: { fontSize: 20, lineHeight: 26 },
  note: { marginTop: 2 },
});
