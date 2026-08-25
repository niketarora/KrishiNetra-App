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
  testID?: string;
};

/**
 * design.md §3.3 — the 2-column grid tile on Home (Growth stage, Weather).
 * In Phase 1 both tiles render `muted` with an em dash, because no analysis
 * service is connected yet and inventing a value would mislead the farmer.
 */
export function StatusCard({ icon, label, value, note, muted = false, testID }: Props) {
  return (
    <Card style={styles.card} testID={testID}>
      <Icon name={icon} size={20} color={colors.text.secondary} />
      <Text variant="caption" style={styles.label}>
        {label}
      </Text>
      <View style={styles.valueRow}>
        <Text variant="cardTitle" color={muted ? colors.text.muted : colors.text.primary}>
          {value}
        </Text>
      </View>
      {note ? (
        <Text variant="micro" style={styles.note}>
          {note}
        </Text>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1 },
  label: { marginTop: 10 },
  valueRow: { marginTop: 2 },
  note: { marginTop: 2 },
});
