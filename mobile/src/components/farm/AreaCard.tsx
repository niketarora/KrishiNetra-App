import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors } from '@/theme';
import { formatArea } from '@/utils/format';
import type { FarmArea } from '@/utils/geo';

import { Card } from '../ui/Card';
import { Text } from '../ui/Text';

type Props = {
  area: FarmArea;
  /** Dimmed until the boundary is a valid closed polygon. */
  enabled?: boolean;
};

/**
 * design.md §4.7: acres, hectares and square metres side by side.
 *
 * All three are shown because farmers, land records and government schemes
 * each use a different unit, and a farmer should never have to convert in
 * their head to check the figure against their papers.
 */
export function AreaCard({ area, enabled = true }: Props) {
  const { t } = useTranslation();
  const values = formatArea(area);

  const cells = [
    { value: values.acres, label: t('onboarding.acres') },
    { value: values.hectares, label: t('onboarding.hectares') },
    { value: values.squareMeters, label: t('onboarding.squareMeters') },
  ];

  return (
    <Card style={[styles.card, !enabled && styles.disabled]} testID="area-card">
      {cells.map((cell) => (
        <View key={cell.label} style={styles.cell}>
          <Text variant="cardTitle" color={enabled ? colors.text.primary : colors.text.muted}>
            {cell.value}
          </Text>
          <Text variant="micro">{cell.label}</Text>
        </View>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', gap: 12 },
  disabled: { opacity: 0.45 },
  cell: { flex: 1 },
});
