import { ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AvatarFab } from '@/components/avatar/AvatarFab';
import { BoundaryThumbnail } from '@/components/farm/BoundaryThumbnail';
import { Badge, Card, EmptyState, Screen, ScreenHeader, Text } from '@/components/ui';
import { useFarm } from '@/features/farm/FarmContext';
import { colors, layout } from '@/theme';
import { fromGeoJSON } from '@/utils/geo';

type Props = { onBack?: () => void };

/**
 * design.md §4.9. The layout is the designed one — field card at the top, a
 * stack of full-width rows below — but every analysis row is empty, because
 * Phase 1 has no satellite or weather analysis behind it.
 *
 * The farmer's real boundary and area still render at the top, so the screen
 * is not entirely hollow: it shows what the app genuinely knows.
 */
export function FieldAnalysisScreen({ onBack }: Props) {
  const { t } = useTranslation();
  const { farm } = useFarm();

  const points = farm ? fromGeoJSON(farm.boundary) : [];

  const rows = [
    { key: 'cropHealth', label: t('field.cropHealth') },
    { key: 'growthStage', label: t('field.growthStage') },
    { key: 'weatherRisk', label: t('field.weatherRisk') },
  ];

  return (
    <Screen>
      <ScreenHeader title={t('field.title')} onBack={onBack} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {farm ? (
          <Card style={styles.fieldCard}>
            <BoundaryThumbnail points={points} size={56} />
            <View style={styles.fieldBody}>
              <Text variant="cardTitle" numberOfLines={1}>
                {farm.name?.trim() || t('home.unnamedField')}
              </Text>
              <Text variant="caption" color={colors.text.muted} style={styles.fieldMeta}>
                {`${Number(farm.area_acres).toFixed(2)} ${t('onboarding.acres')} · ${Number(
                  farm.area_hectares,
                ).toFixed(2)} ${t('onboarding.hectares')}`}
              </Text>
            </View>
            <Badge label={t('home.notYetAnalyzed')} tone="neutral" />
          </Card>
        ) : null}

        {rows.map((row) => (
          <Card key={row.key}>
            <View style={styles.rowHeader}>
              <Text variant="caption">{row.label}</Text>
              <Text variant="cardTitle" color={colors.text.muted}>
                {t('common.notAvailable')}
              </Text>
            </View>
          </Card>
        ))}

        <EmptyState
          icon="field"
          title={t('field.emptyTitle')}
          body={t('field.emptyBody')}
          testID="field-empty"
        />
      </ScrollView>

      <AvatarFab />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: layout.screenPadding,
    paddingBottom: 96,
    gap: layout.cardGap,
  },
  fieldCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  fieldBody: { flex: 1, minWidth: 0 },
  fieldMeta: { marginTop: 2 },
  rowHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
});
