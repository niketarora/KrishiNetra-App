import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AreaCard } from '@/components/farm/AreaCard';
import { BoundaryThumbnail } from '@/components/farm/BoundaryThumbnail';
import { Badge, Button, Card, EmptyState, Screen, ScreenHeader, Skeleton, Text } from '@/components/ui';
import { useFarm } from '@/features/farm/FarmContext';
import { getCurrentCrop, type CurrentCrop } from '@/services/agronomy';
import { colors, layout } from '@/theme';
import { fromGeoJSON } from '@/utils/geo';

type Props = {
  onBack: () => void;
  onRegisterLand: () => void;
  onEditBoundary: () => void;
};

/** Show the crop in the farmer's own language when the catalogue has it. */
function cropName(current: CurrentCrop, language: string): string {
  if (language.startsWith('hi') && current.crop.name_hi) return current.crop.name_hi;
  return current.crop.name_en;
}

/**
 * Profile → My Farm. The one destination for both states: a farmer with no
 * registered land sees why and how to start; a farmer who already has a field
 * sees its summary and a way to manage it.
 *
 * Farm registration is optional and reached only from here — never from
 * signup — so this screen, not the app shell, is what decides what a farmer
 * with no farm on record sees.
 */
export function MyFarmScreen({ onBack, onRegisterLand, onEditBoundary }: Props) {
  const { t, i18n } = useTranslation();
  const { farm, loading } = useFarm();

  const [crop, setCrop] = useState<CurrentCrop | null>(null);
  const [cropLoading, setCropLoading] = useState(false);

  useEffect(() => {
    if (!farm) {
      setCrop(null);
      return;
    }

    let cancelled = false;
    setCropLoading(true);

    getCurrentCrop(farm.id)
      .then((result) => {
        if (!cancelled) setCrop(result);
      })
      .catch(() => {
        // The crop line is a bonus on this summary, not its purpose — a failed
        // lookup just leaves it off rather than blocking the farm summary.
        if (!cancelled) setCrop(null);
      })
      .finally(() => {
        if (!cancelled) setCropLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [farm]);

  const points = farm ? fromGeoJSON(farm.boundary) : [];
  const area = farm
    ? { squareMeters: farm.area_sq_meters, acres: farm.area_acres, hectares: farm.area_hectares }
    : null;

  return (
    <Screen>
      <ScreenHeader title={t('myFarm.title')} onBack={onBack} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {loading ? (
          <Skeleton height={160} />
        ) : farm ? (
          <>
            <Card style={styles.summaryCard} testID="my-farm-summary">
              <View style={styles.summaryHeader}>
                <BoundaryThumbnail points={points} size={72} />
                <View style={styles.summaryBody}>
                  <Text variant="cardTitle" numberOfLines={1}>
                    {farm.name?.trim() || t('home.unnamedField')}
                  </Text>
                  {farm.district ? (
                    <Text variant="caption" color={colors.text.muted}>
                      {farm.state ? `${farm.district}, ${farm.state}` : farm.district}
                    </Text>
                  ) : null}
                  <Badge label={t('home.notYetAnalyzed')} tone="neutral" />
                </View>
              </View>

              {area ? <AreaCard area={area} /> : null}

              <View style={styles.cropRow}>
                <Text variant="caption">{t('home.crop')}</Text>
                <Text
                  variant="bodyMedium"
                  color={crop ? colors.text.primary : colors.text.muted}
                >
                  {cropLoading
                    ? t('common.loading')
                    : crop
                      ? cropName(crop, i18n.language)
                      : t('home.cropNone')}
                </Text>
              </View>
            </Card>

            <Button
              label={t('myFarm.editBoundary')}
              onPress={onEditBoundary}
              variant="secondary"
              icon="map"
              testID="my-farm-edit-boundary"
            />
          </>
        ) : (
          <EmptyState
            icon="field"
            title={t('myFarm.emptyTitle')}
            body={t('myFarm.emptyBody')}
            actionLabel={t('myFarm.registerCta')}
            onAction={onRegisterLand}
            testID="my-farm-empty"
          />
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: layout.screenPadding,
    paddingTop: 8,
    paddingBottom: 32,
    gap: layout.cardGap,
  },
  summaryCard: { gap: 12 },
  summaryHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  summaryBody: { flex: 1, minWidth: 0, gap: 4 },
  cropRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
