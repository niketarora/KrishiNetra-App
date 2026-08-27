import { StyleSheet, View } from 'react-native';

import { colors } from '@/theme';

import { Card } from './Card';
import { Icon, type IconName } from './Icon';
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
  testID?: string;
};

/**
 * design.md §3.3 — the 2-column grid tile on Home (Growth stage, Weather).
 * In Phase 1 both tiles render `muted` with an em dash, because no analysis
 * service is connected yet and inventing a value would mislead the farmer.
 */
export function StatusCard({ icon, label, value, note, muted = false, sample = false, testID }: Props) {
  return (
    <Card style={[styles.card, sample && styles.sampleCard]} testID={testID}>
      <Icon name={icon} size={20} color={sample ? colors.demo.fg : colors.text.secondary} />
      <Text variant="caption" style={styles.label}>
        {label}
      </Text>
      <View style={styles.valueRow}>
        <Text
          variant="cardTitle"
          color={sample ? colors.demo.fg : muted ? colors.text.muted : colors.text.primary}
        >
          {value}
        </Text>
      </View>
      {note ? (
        <Text
          variant="micro"
          color={sample ? colors.demo.fg : undefined}
          style={styles.note}
        >
          {note}
        </Text>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1 },
  sampleCard: { borderColor: colors.demo.border },
  label: { marginTop: 10 },
  valueRow: { marginTop: 2 },
  note: { marginTop: 2 },
});
