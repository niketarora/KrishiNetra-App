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
                {`${Number(farm.area_acres).toFixed(2)} ${t('onboarding.acres')} · ${Number(
                  farm.area_hectares,
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

        {/* --- Multi-Sensor SAR Radar & Optical Parameter Breakdown --- */}
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
                Sentinel-1 SAR Radar, Sentinel-2 Optical & ICAR Soil Telemetry
              </Text>

              <View style={styles.featureGrid}>
                {features.vv != null ? (
                  <View style={styles.featureItem}>
                    <Text variant="micro" color={colors.text.muted}>SAR VV Backscatter</Text>
                    <Text variant="bodyMedium">{`${features.vv.toFixed(1)} dB`}</Text>
                  </View>
                ) : null}
                {features.vh != null ? (
                  <View style={styles.featureItem}>
                    <Text variant="micro" color={colors.text.muted}>SAR VH Backscatter</Text>
                    <Text variant="bodyMedium">{`${features.vh.toFixed(1)} dB`}</Text>
                  </View>
                ) : null}
                {features.twi_proxy != null ? (
                  <View style={styles.featureItem}>
                    <Text variant="micro" color={colors.text.muted}>Topographic Wetness (TWI)</Text>
                    <Text variant="bodyMedium">{features.twi_proxy.toFixed(1)}</Text>
                  </View>
                ) : null}
                {features.soil_texture ? (
                  <View style={styles.featureItem}>
                    <Text variant="micro" color={colors.text.muted}>Soil Texture (USDA)</Text>
                    <Text variant="bodyMedium">{features.soil_texture.toUpperCase()}</Text>
                  </View>
                ) : null}
                <View style={styles.featureItem}>
                  <Text variant="micro" color={colors.text.muted}>{t('field.features.cropType')}</Text>
                  <Text variant="bodyMedium">{features.crop_type.toUpperCase()}</Text>
                </View>
                <View style={styles.featureItem}>
                  <Text variant="micro" color={colors.text.muted}>{t('field.features.growthStage')}</Text>
                  <Text variant="bodyMedium">{`Stage ${features.crop_growth_stage ?? 2}`}</Text>
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
                  <Text variant="bodyMedium">{(features.dsm ?? features.elevation ?? 350).toFixed(0)} m</Text>
                </View>
                <View style={styles.featureItem}>
                  <Text variant="micro" color={colors.text.muted}>{t('field.features.spatialRes')}</Text>
                  <Text variant="bodyMedium">{`${features.spatial_resolution ?? 10} m`}</Text>
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
