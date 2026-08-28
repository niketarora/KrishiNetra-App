import { ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AvatarFab } from '@/components/avatar/AvatarFab';
import { BoundaryThumbnail } from '@/components/farm/BoundaryThumbnail';
import {
  Badge,
  Card,
  EmptyState,
  SampleBadge,
  SampleBanner,
  Screen,
  ScreenHeader,
  Text,
} from '@/components/ui';
import { useFarm } from '@/features/farm/FarmContext';
import { isDemoMode, SAMPLE } from '@/features/demo/demoMode';
import { useHomeInsights } from '@/screens/home/useHomeInsights';
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
  const { weather } = useHomeInsights(farm?.id ?? null);

  const points = farm ? fromGeoJSON(farm.boundary) : [];

  // Weather is the one row with a real source: Phase 2.5 ingests observed
  // readings per district. Crop health and growth stage need satellite
  // analysis, which is Phase 3, so they keep their dashes rather than being
  // inferred from the weather sitting next to them.
  const weatherValue =
    weather?.temperature_c !== null && weather?.temperature_c !== undefined
      ? t('field.weatherObserved', {
          temp: Math.round(weather.temperature_c),
          rain: weather.rainfall_mm === null ? 0 : Math.round(weather.rainfall_mm),
        })
      : null;

  const demo = isDemoMode();

  const rows: {
    key: string;
    label: string;
    value: string | null;
    note?: string;
    sample?: boolean;
  }[] = [
    {
      key: 'cropHealth',
      label: t('field.cropHealth'),
      value: demo ? t(SAMPLE.cropHealth.valueKey) : null,
      note: demo ? t(SAMPLE.cropHealth.noteKey) : t('field.analysisNote'),
      sample: demo,
    },
    {
      key: 'growthStage',
      label: t('field.growthStage'),
      value: demo ? t(SAMPLE.growthStage.valueKey) : null,
      note: demo ? t(SAMPLE.growthStage.noteKey) : undefined,
      sample: demo,
    },
    {
      key: 'weatherRisk',
      label: t('field.weatherRisk'),
      value: weatherValue,
      note: weatherValue
        ? t('home.weatherObserved', { date: formatShortDate(weather!.observed_on) })
        : t('field.weatherNone'),
    },
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

        {demo ? <SampleBanner /> : null}

        {rows.map((row) => (
          <Card key={row.key} style={row.sample ? styles.sampleCard : undefined}>
            <View style={styles.rowHeader}>
              <Text variant="caption">{row.label}</Text>
              <View style={styles.rowValue}>
                {row.sample ? <SampleBadge testID={`sample-badge-${row.key}`} /> : null}
                <Text
                  variant="cardTitle"
                  color={
                    row.sample
                      ? colors.demo.fg
                      : row.value
                        ? colors.text.primary
                        : colors.text.muted
                  }
                >
                  {row.value ?? t('common.notAvailable')}
                </Text>
              </View>
            </View>
            {row.note ? (
              <Text variant="micro" style={styles.rowNote}>
                {row.note}
              </Text>
            ) : null}
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

/** "21 Aug" — enough to see how fresh a reading is. */
function formatShortDate(iso: string): string {
  const date = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', timeZone: 'UTC' });
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
  rowNote: { marginTop: 6 },
  rowValue: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sampleCard: { borderColor: colors.demo.border },
  rowHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
});
