import { useRef, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { BoundaryThumbnail } from '@/components/farm/BoundaryThumbnail';
import { GuideTarget } from '@/components/guide/GuideTarget';
import {
  Badge,
  Card,
  Icon,
  IconBadge,
  Screen,
  ScreenHeader,
  Text,
} from '@/components/ui';
import { useFarm } from '@/features/farm/FarmContext';
import { useHomeInsights } from '@/screens/home/useHomeInsights';
import { colors, layout, radius } from '@/theme';
import { fromGeoJSON } from '@/utils/geo';

type Props = { onBack?: () => void };

/**
 * Field Analysis Screen — Integrates real Earth Observation & ML Model outputs.
 * Displays live XGBoost Soil Moisture prediction, model metadata, safety bounds,
 * environmental parameter breakdown, and crop growth stage.
 */
export function FieldAnalysisScreen({ onBack }: Props) {
  const { t } = useTranslation();
  const { farm } = useFarm();
  const { crop, weather, soilMoisture, refresh } = useHomeInsights(farm?.id ?? null);
  const [refreshing, setRefreshing] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  const points = farm ? fromGeoJSON(farm.boundary) : [];
  const prediction = soilMoisture?.prediction;
  const features = soilMoisture?.features;

  const weatherValue =
    weather?.temperature_c !== null && weather?.temperature_c !== undefined
      ? t('field.weatherObserved', {
          temp: Math.round(weather.temperature_c),
          rain: weather.rainfall_mm === null ? 0 : Math.round(weather.rainfall_mm),
        })
      : null;

  const categoryTone = (category?: string) => {
    switch (category) {
      case 'wet':
        return 'accent' as const;
      case 'good':
        return 'success' as const;
      case 'moderate':
        return 'warning' as const;
      case 'dry':
      default:
        return 'danger' as const;
    }
  };

  // Compute growth stage name from sowing date
  let computedGrowthStage = t('common.notAvailable');
  if (crop?.planting?.sown_on) {
    const sown = new Date(crop.planting.sown_on);
    if (!Number.isNaN(sown.getTime())) {
      const days = Math.max(0, Math.floor((Date.now() - sown.getTime()) / (1000 * 60 * 60 * 24)));
      if (days < 20) computedGrowthStage = 'Germination';
      else if (days < 55) computedGrowthStage = 'Tillering / Vegetative';
      else if (days < 90) computedGrowthStage = 'Flowering';
      else if (days < 120) computedGrowthStage = 'Grain Filling';
      else computedGrowthStage = 'Maturity';
    }
  }

  return (
    <Screen>
      <ScreenHeader title={t('field.title')} onBack={onBack} />

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void handleRefresh()}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
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
            <Badge
              label={prediction ? t('field.experimentalBadge') : t('home.notYetAnalyzed')}
              tone={prediction ? 'accent' : 'neutral'}
            />
          </Card>
        ) : null}

        {/* --- Primary ML Soil Moisture Output --- */}
        <GuideTarget id="soil-moisture-card" scroll={scrollRef}>
          <Card tone="success" style={styles.mlHighlightCard} testID="soil-moisture-card">
            <View style={styles.cardHeaderRow}>
              <View style={styles.titleWithIcon}>
                <IconBadge icon="droplet" tone="primary" />
                <View style={styles.headerTextGroup}>
                  <Text variant="bodyMedium" color={colors.primaryDark}>
                    {t('field.soilMoistureTitle')}
                  </Text>
                  <Text variant="micro" color={colors.text.secondary}>
                    {t('field.soilMoistureSub')}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.statContainer}>
              <View style={styles.statMain}>
                <Text variant="stat" color={colors.primaryDark} style={styles.statNumber}>
                  {prediction ? `${prediction.soil_moisture_percent}%` : '--'}
                </Text>
                <Badge
                  label={
                    prediction
                      ? t(`field.categories.${prediction.category}`, { defaultValue: prediction.category })
                      : t('common.notAvailable')
                  }
                  tone={categoryTone(prediction?.category)}
                />
              </View>

              <View style={styles.modelTagRow}>
                <Text variant="microMedium" color={colors.text.muted}>
                  {prediction ? t('field.modelVersion', { version: prediction.model_version }) : 'Model: offline'}
                </Text>
              </View>
            </View>

            {prediction?.warning ? (
              <View style={styles.warningContainer}>
                <Icon name="alert" size={16} color={colors.warning} />
                <Text variant="micro" color={colors.text.secondary} style={styles.warningText}>
                  {prediction.warning}
                </Text>
              </View>
            ) : null}
          </Card>
        </GuideTarget>

        {/* --- Model Input Feature Parameter Breakdown --- */}
        {features ? (
          <GuideTarget id="ml-features-card" scroll={scrollRef}>
            <Card style={styles.featuresCard} testID="ml-features-card">
              <View style={styles.sectionTitleRow}>
                <Icon name="flask" size={18} color={colors.primary} />
                <Text variant="bodyMedium" color={colors.text.primary}>
                  {t('field.inputsTitle')}
                </Text>
              </View>
              <Text variant="micro" color={colors.text.muted} style={styles.sectionSubtitle}>
                {t('field.inputsSubtitle')}
              </Text>

              <View style={styles.featureGrid}>
                <View style={styles.featureItem}>
                  <Text variant="micro" color={colors.text.muted}>{t('field.features.cropType')}</Text>
                  <Text variant="bodyMedium">{features.crop_type.toUpperCase()}</Text>
                </View>
                <View style={styles.featureItem}>
                  <Text variant="micro" color={colors.text.muted}>{t('field.features.growthStage')}</Text>
                  <Text variant="bodyMedium">{`Stage ${features.crop_growth_stage}`}</Text>
                </View>
                <View style={styles.featureItem}>
                  <Text variant="micro" color={colors.text.muted}>{t('field.features.temp')}</Text>
                  <Text variant="bodyMedium">{features.temperature_c.toFixed(1)}°C</Text>
                </View>
                <View style={styles.featureItem}>
                  <Text variant="micro" color={colors.text.muted}>{t('field.features.humidity')}</Text>
                  <Text variant="bodyMedium">{features.humidity_percent.toFixed(0)}%</Text>
                </View>
                <View style={styles.featureItem}>
                  <Text variant="micro" color={colors.text.muted}>{t('field.features.rainfall')}</Text>
                  <Text variant="bodyMedium">{features.rainfall.toFixed(1)} mm</Text>
                </View>
                <View style={styles.featureItem}>
                  <Text variant="micro" color={colors.text.muted}>{t('field.features.windSpeed')}</Text>
                  <Text variant="bodyMedium">{features.wind_speed.toFixed(1)} km/h</Text>
                </View>
                <View style={styles.featureItem}>
                  <Text variant="micro" color={colors.text.muted}>{t('field.features.soilPh')}</Text>
                  <Text variant="bodyMedium">{features.soil_ph.toFixed(1)}</Text>
                </View>
                <View style={styles.featureItem}>
                  <Text variant="micro" color={colors.text.muted}>{t('field.features.organicMatter')}</Text>
                  <Text variant="bodyMedium">{features.organic_matter.toFixed(2)}%</Text>
                </View>
                <View style={styles.featureItem}>
                  <Text variant="micro" color={colors.text.muted}>{t('field.features.ndvi')}</Text>
                  <Text variant="bodyMedium">{features.ndvi.toFixed(2)}</Text>
                </View>
                <View style={styles.featureItem}>
                  <Text variant="micro" color={colors.text.muted}>{t('field.features.savi')}</Text>
                  <Text variant="bodyMedium">{features.savi.toFixed(2)}</Text>
                </View>
                <View style={styles.featureItem}>
                  <Text variant="micro" color={colors.text.muted}>{t('field.features.lai')}</Text>
                  <Text variant="bodyMedium">{features.leaf_area_index.toFixed(1)}</Text>
                </View>
                <View style={styles.featureItem}>
                  <Text variant="micro" color={colors.text.muted}>{t('field.features.elevation')}</Text>
                  <Text variant="bodyMedium">{features.elevation.toFixed(0)} m</Text>
                </View>
                <View style={styles.featureItem}>
                  <Text variant="micro" color={colors.text.muted}>{t('field.features.waterFlow')}</Text>
                  <Text variant="bodyMedium">{features.water_flow.toFixed(1)}</Text>
                </View>
                <View style={styles.featureItem}>
                  <Text variant="micro" color={colors.text.muted}>{t('field.features.spatialRes')}</Text>
                  <Text variant="bodyMedium">{features.spatial_resolution.toFixed(0)} m</Text>
                </View>
              </View>
            </Card>
          </GuideTarget>
        ) : null}

        {/* --- Agronomic & Environmental Context --- */}
        <Card>
          <View style={styles.rowHeader}>
            <Text variant="caption">{t('field.growthStage')}</Text>
            <Text variant="cardTitle" color={colors.text.primary}>
              {computedGrowthStage}
            </Text>
          </View>
          {crop?.planting?.sown_on ? (
            <Text variant="micro" style={styles.rowNote}>
              {t('history.sownOn', { date: formatShortDate(crop.planting.sown_on) })}
            </Text>
          ) : null}
        </Card>

        <Card>
          <View style={styles.rowHeader}>
            <Text variant="caption">{t('field.weatherRisk')}</Text>
            <Text variant="cardTitle" color={weatherValue ? colors.text.primary : colors.text.muted}>
              {weatherValue ?? t('common.notAvailable')}
            </Text>
          </View>
          <Text variant="micro" style={styles.rowNote}>
            {weatherValue
              ? t('home.weatherObserved', { date: formatShortDate(weather!.observed_on) })
              : t('field.weatherNone')}
          </Text>
        </Card>
      </ScrollView>
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
  mlHighlightCard: {
    padding: 16,
    gap: 12,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  headerTextGroup: {
    flex: 1,
    gap: 2,
  },
  statContainer: {
    backgroundColor: colors.surface,
    padding: 14,
    borderRadius: radius.md,
    gap: 6,
  },
  statMain: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statNumber: {
    fontSize: 32,
    fontWeight: '700',
  },
  modelTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  warningContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: colors.warningBg ?? '#FEF9C3',
    padding: 10,
    borderRadius: radius.sm,
  },
  warningText: {
    flex: 1,
    lineHeight: 16,
  },
  featuresCard: {
    padding: 16,
    gap: 8,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionSubtitle: {
    marginBottom: 6,
  },
  featureGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  featureItem: {
    width: '47%',
    backgroundColor: colors.neutralBg,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.sm,
    gap: 2,
  },
  rowHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  rowNote: { marginTop: 6 },
});
