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

function fmt(val: number | null | undefined, decimals = 1, fallback = '--'): string {
  if (val === null || val === undefined || isNaN(Number(val))) return fallback;
  return Number(val).toFixed(decimals);
}

/**
 * Field Analysis Screen — Integrates real Earth Observation & OASSM-10 Model outputs.
 * Displays 10m Multi-Sensor Sentinel-1 SAR Radar + Optical Soil Moisture,
 * physical volumetric moisture (m³/m³), SAR backscatter metrics, and crop growth stage.
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
  let daysSinceSown: number | null = null;
  if (crop?.planting?.sown_on) {
    const sown = new Date(crop.planting.sown_on);
    if (!Number.isNaN(sown.getTime())) {
      daysSinceSown = Math.max(0, Math.floor((Date.now() - sown.getTime()) / (1000 * 60 * 60 * 24)));
      if (daysSinceSown < 20) computedGrowthStage = 'Germination';
      else if (daysSinceSown < 55) computedGrowthStage = 'Tillering / Vegetative';
      else if (daysSinceSown < 90) computedGrowthStage = 'Flowering';
      else if (daysSinceSown < 120) computedGrowthStage = 'Grain Filling';
      else computedGrowthStage = 'Maturity';
    }
  }

  const volumetricDisplay = prediction?.volumetric_moisture_m3_m3 != null
    ? `${prediction.volumetric_moisture_m3_m3.toFixed(3)} m³/m³`
    : prediction?.soil_moisture_percent != null
    ? `${(prediction.soil_moisture_percent / 100).toFixed(3)} m³/m³`
    : null;

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
                {`${Number(farm.area_acres ?? 0).toFixed(2)} ${t('onboarding.acres')} · ${Number(
                  farm.area_hectares ?? 0,
                ).toFixed(2)} ${t('onboarding.hectares')}`}
              </Text>
            </View>
            <Badge
              label={prediction ? '10m Multi-Sensor Radar' : t('home.notYetAnalyzed')}
              tone={prediction ? 'accent' : 'neutral'}
            />
          </Card>
        ) : null}

        {/* --- Primary OASSM-10 Soil Moisture Output --- */}
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
                    Sentinel-1 SAR + Sentinel-2 10m Resolution
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

              {volumetricDisplay ? (
                <View style={styles.volumetricRow}>
                  <Text variant="caption" color={colors.primaryDark}>
                    Volumetric Water Content: <Text variant="bodyMedium">{volumetricDisplay}</Text>
                  </Text>
                </View>
              ) : null}

              <View style={styles.modelTagRow}>
                <Text variant="microMedium" color={colors.text.muted}>
                  {prediction ? `Model: ${prediction.model_version}` : 'Model: offline'}
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

        {/* --- Sentinel-1 SAR Microwave Radar Telemetry --- */}
        {prediction?.sar_backscatter_db || features?.vv != null ? (
          <Card style={styles.sectionCard}>
            <View style={styles.sectionTitleRow}>
              <Icon name="map" size={18} color={colors.accent} />
              <Text variant="bodyMedium" color={colors.text.primary}>
                Sentinel-1 SAR Microwave Radar Telemetry
              </Text>
            </View>
            <Text variant="micro" color={colors.text.muted} style={styles.sectionSubtitle}>
              Physical C-band radar backscatter measuring surface soil dielectric constant
            </Text>

            <View style={styles.featureGrid}>
              <View style={styles.featureItem}>
                <Text variant="micro" color={colors.text.muted}>VV Backscatter</Text>
                <Text variant="bodyMedium">{`${fmt(prediction?.sar_backscatter_db?.vv ?? features?.vv, 1)} dB`}</Text>
              </View>
              <View style={styles.featureItem}>
                <Text variant="micro" color={colors.text.muted}>VH Cross-Pol</Text>
                <Text variant="bodyMedium">{`${fmt(prediction?.sar_backscatter_db?.vh ?? features?.vh, 1)} dB`}</Text>
              </View>
              <View style={styles.featureItem}>
                <Text variant="micro" color={colors.text.muted}>Cross-Pol Ratio (VH-VV)</Text>
                <Text variant="bodyMedium">{`${fmt(prediction?.sar_backscatter_db?.vh_minus_vv ?? features?.vh_minus_vv, 1)} dB`}</Text>
              </View>
              <View style={styles.featureItem}>
                <Text variant="micro" color={colors.text.muted}>Radar Incidence Angle</Text>
                <Text variant="bodyMedium">{`${fmt(prediction?.sar_backscatter_db?.incidence_angle_deg ?? features?.angle, 1)}°`}</Text>
              </View>
              <View style={styles.featureItem}>
                <Text variant="micro" color={colors.text.muted}>Topographic Wetness (TWI)</Text>
                <Text variant="bodyMedium">{fmt(prediction?.topographic_wetness_index ?? features?.twi_proxy, 1)}</Text>
              </View>
              <View style={styles.featureItem}>
                <Text variant="micro" color={colors.text.muted}>Soil Texture (USDA)</Text>
                <Text variant="bodyMedium">{(features?.soil_texture || 'Loam').toUpperCase()}</Text>
              </View>
            </View>
          </Card>
        ) : null}

        {/* --- Multispectral Optical & Soil Telemetry Breakdown --- */}
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
                Sentinel-2 Multispectral Optical & ICAR Soil Health Card Data
              </Text>

              <View style={styles.featureGrid}>
                <View style={styles.featureItem}>
                  <Text variant="micro" color={colors.text.muted}>{t('field.features.cropType')}</Text>
                  <Text variant="bodyMedium">{(features.crop_type || 'wheat').toUpperCase()}</Text>
                </View>
                <View style={styles.featureItem}>
                  <Text variant="micro" color={colors.text.muted}>{t('field.features.growthStage')}</Text>
                  <Text variant="bodyMedium">{`Stage ${features.crop_growth_stage ?? 2}`}</Text>
                </View>
                <View style={styles.featureItem}>
                  <Text variant="micro" color={colors.text.muted}>{t('field.features.temp')}</Text>
                  <Text variant="bodyMedium">{`${fmt(features.temperature_c, 1)}°C`}</Text>
                </View>
                <View style={styles.featureItem}>
                  <Text variant="micro" color={colors.text.muted}>{t('field.features.humidity')}</Text>
                  <Text variant="bodyMedium">{`${fmt(features.humidity_percent, 0)}%`}</Text>
                </View>
                <View style={styles.featureItem}>
                  <Text variant="micro" color={colors.text.muted}>{t('field.features.rainfall')}</Text>
                  <Text variant="bodyMedium">{`${fmt(features.rainfall, 1)} mm`}</Text>
                </View>
                <View style={styles.featureItem}>
                  <Text variant="micro" color={colors.text.muted}>{t('field.features.windSpeed')}</Text>
                  <Text variant="bodyMedium">{`${fmt(features.wind_speed, 1)} km/h`}</Text>
                </View>
                <View style={styles.featureItem}>
                  <Text variant="micro" color={colors.text.muted}>{t('field.features.soilPh')}</Text>
                  <Text variant="bodyMedium">{fmt(features.soil_ph, 1)}</Text>
                </View>
                <View style={styles.featureItem}>
                  <Text variant="micro" color={colors.text.muted}>{t('field.features.organicMatter')}</Text>
                  <Text variant="bodyMedium">{`${fmt(features.organic_matter, 2)}%`}</Text>
                </View>
                <View style={styles.featureItem}>
                  <Text variant="micro" color={colors.text.muted}>{t('field.features.ndvi')}</Text>
                  <Text variant="bodyMedium">{fmt(features.ndvi, 2)}</Text>
                </View>
                <View style={styles.featureItem}>
                  <Text variant="micro" color={colors.text.muted}>{t('field.features.savi')}</Text>
                  <Text variant="bodyMedium">{fmt(features.savi, 2)}</Text>
                </View>
                <View style={styles.featureItem}>
                  <Text variant="micro" color={colors.text.muted}>{t('field.features.lai')}</Text>
                  <Text variant="bodyMedium">{fmt(features.leaf_area_index, 1)}</Text>
                </View>
                <View style={styles.featureItem}>
                  <Text variant="micro" color={colors.text.muted}>{t('field.features.elevation')}</Text>
                  <Text variant="bodyMedium">{`${fmt(features.dsm ?? features.elevation, 0)} m`}</Text>
                </View>
                <View style={styles.featureItem}>
                  <Text variant="micro" color={colors.text.muted}>{t('field.features.spatialRes')}</Text>
                  <Text variant="bodyMedium">{`${fmt(features.spatial_resolution, 0)} m`}</Text>
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
          {daysSinceSown !== null ? (
            <Text variant="micro" color={colors.text.muted}>
              {`${daysSinceSown} days since sowing`}
            </Text>
          ) : null}
          <View style={styles.divider} />
          <View style={styles.rowHeader}>
            <Text variant="caption">{t('field.activeCrop')}</Text>
            <Text variant="cardTitle" color={colors.text.primary}>
              {soilMoisture?.cropName ?? crop?.crop?.name_en ?? t('common.notAvailable')}
            </Text>
          </View>
        </Card>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: layout.screenPadding,
    gap: 16,
    paddingBottom: 40,
  },
  fieldCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
  },
  fieldBody: {
    flex: 1,
    gap: 2,
  },
  fieldMeta: {
    marginTop: 2,
  },
  mlHighlightCard: {
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: colors.successBorder,
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
  },
  headerTextGroup: {
    gap: 2,
  },
  statContainer: {
    gap: 8,
  },
  statMain: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  statNumber: {
    fontSize: 38,
    lineHeight: 44,
  },
  volumetricRow: {
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: radius.sm,
    alignSelf: 'flex-start',
  },
  modelTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  warningContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.surface,
    padding: 8,
    borderRadius: radius.sm,
  },
  warningText: {
    flex: 1,
  },
  sectionCard: {
    padding: 16,
    gap: 12,
  },
  featuresCard: {
    padding: 16,
    gap: 12,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionSubtitle: {
    marginTop: -6,
  },
  featureGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 4,
  },
  featureItem: {
    width: '47%',
    backgroundColor: colors.neutralBg,
    padding: 10,
    borderRadius: radius.md,
    gap: 4,
  },
  rowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 10,
  },
});
