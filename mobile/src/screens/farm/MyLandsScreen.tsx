import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { BoundaryThumbnail } from '@/components/farm/BoundaryThumbnail';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Icon,
  IconBadge,
  Screen,
  ScreenHeader,
  Skeleton,
  Text,
} from '@/components/ui';
import { useFarm } from '@/features/farm/FarmContext';
import { useOptionalOnboardingTour } from '@/features/onboarding/OnboardingTourContext';
import { useTourTarget } from '@/features/onboarding/useTourTarget';
import { getCurrentCrop, type CurrentCrop } from '@/services/agronomy';
import type { Farm } from '@/services/farms';
import { colors, layout, radius, spacing } from '@/theme';
import { fromGeoJSON } from '@/utils/geo';

type Props = {
  onBack: () => void;
  onOpenMyFarm: (farm: Farm) => void;
  onAddLand: () => void;
  onEditLand: (farm: Farm) => void;
};

/** Show the crop in the farmer's own language when available. */
function cropName(current: CurrentCrop, language: string): string {
  if (language.startsWith('hi') && current.crop.name_hi) return current.crop.name_hi;
  return current.crop.name_en;
}

export function MyLandsScreen({ onBack, onOpenMyFarm, onAddLand, onEditLand }: Props) {
  const { t, i18n } = useTranslation();
  const { lands, selectedLandId, selectLand, removeLand, loading } = useFarm();
  const [cropsByLandId, setCropsByLandId] = useState<Record<string, CurrentCrop | null>>({});

  const tour = useOptionalOnboardingTour();
  const registerLandTourRef = useTourTarget('tour-mylands-register', 24);

  const handleAddLand = () => {
    if (tour?.isActive && tour.step === 3) {
      tour.nextStep();
    } else {
      onAddLand();
    }
  };

  useEffect(() => {
    let cancelled = false;

    if (lands.length === 0) {
      setCropsByLandId({});
      return;
    }

    Promise.all(
      lands.map(async (land) => {
        try {
          const crop = await getCurrentCrop(land.id);
          return { id: land.id, crop };
        } catch {
          return { id: land.id, crop: null };
        }
      }),
    ).then((results) => {
      if (cancelled) return;
      const map: Record<string, CurrentCrop | null> = {};
      for (const r of results) {
        map[r.id] = r.crop;
      }
      setCropsByLandId(map);
    });

    return () => {
      cancelled = true;
    };
  }, [lands]);

  const handleSelectLand = useCallback(
    async (land: Farm) => {
      await selectLand(land.id);
      onOpenMyFarm(land);
    },
    [onOpenMyFarm, selectLand],
  );

  const confirmDelete = useCallback(
    (land: Farm, label: string) => {
      Alert.alert(
        t('myLands.deleteConfirmTitle', { name: land.name?.trim() || label }),
        t('myLands.deleteConfirmBody'),
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('common.delete'),
            style: 'destructive',
            onPress: () => {
              void removeLand(land.id);
            },
          },
        ],
      );
    },
    [removeLand, t],
  );

  return (
    <Screen>
      <ScreenHeader title={t('myLands.title')} onBack={onBack} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <Skeleton height={110} />
            <Skeleton height={110} />
          </View>
        ) : lands.length === 0 ? (
          <EmptyState
            icon="field"
            title={t('myLands.emptyTitle')}
            body={t('myLands.emptyBody')}
            actionLabel={t('myLands.addLand')}
            onAction={handleAddLand}
            actionRef={registerLandTourRef}
            testID="empty-lands-state"
          />
        ) : (
          <>
            <View style={styles.listContainer}>
              {lands.map((land, index) => {
                const isSelected = land.id === selectedLandId || (!selectedLandId && index === 0);
                const label = `${t('myLands.landLabel')} ${index + 1}`;
                const title = land.name?.trim() || label;
                const points = fromGeoJSON(land.boundary);
                const crop = cropsByLandId[land.id];
                const cropText = crop ? ` · ${cropName(crop, i18n.language)}` : '';
                const locationText =
                  land.district && land.state
                    ? `${land.district}, ${land.state}`
                    : land.district || land.state || '';

                return (
                  <Card
                    key={land.id}
                    onPress={() => void handleSelectLand(land)}
                    style={[styles.landCard, isSelected && styles.landCardSelected]}
                    testID={`land-card-${land.id}`}
                  >
                    <View style={styles.cardHeader}>
                      <BoundaryThumbnail points={points} size={64} />
                      <View style={styles.cardInfo}>
                        <View style={styles.titleRow}>
                          <Text variant="cardTitle" numberOfLines={1} style={styles.landTitle}>
                            {title}
                          </Text>
                          {isSelected ? (
                            <Badge label={t('myLands.selected')} tone="success" />
                          ) : null}
                        </View>

                        {locationText ? (
                          <Text variant="caption" color={colors.text.muted} numberOfLines={1}>
                            {locationText}
                          </Text>
                        ) : null}

                        <Text variant="bodyMedium" color={colors.primaryDark} style={styles.areaRow}>
                          {`${Number(land.area_acres).toFixed(2)} ${t('onboarding.acres')}${cropText}`}
                        </Text>
                      </View>
                      <Icon name="chevron" size={20} color={colors.text.muted} />
                    </View>

                    <View style={styles.cardActions}>
                      <Pressable
                        style={({ pressed }) => [styles.actionButton, pressed && styles.actionPressed]}
                        onPress={() => onEditLand(land)}
                        hitSlop={8}
                        accessibilityRole="button"
                        testID={`edit-land-${land.id}`}
                      >
                        <Icon name="field" size={16} color={colors.text.primary} />
                        <Text variant="microMedium">{t('common.edit')}</Text>
                      </Pressable>

                      <Pressable
                        style={({ pressed }) => [styles.actionButton, pressed && styles.actionPressed]}
                        onPress={() => confirmDelete(land, label)}
                        hitSlop={8}
                        accessibilityRole="button"
                        testID={`delete-land-${land.id}`}
                      >
                        <Icon name="alert" size={16} color={colors.danger} />
                        <Text variant="microMedium" color={colors.danger}>
                          {t('common.delete')}
                        </Text>
                      </Pressable>
                    </View>
                  </Card>
                );
              })}
            </View>

            <Button
              label={t('myLands.addAnotherLand')}
              onPress={onAddLand}
              variant="primary"
              testID="add-another-land-btn"
            />
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: layout.screenPadding,
    gap: spacing.md,
  },
  loadingContainer: {
    gap: spacing.md,
  },
  listContainer: {
    gap: spacing.md,
  },
  landCard: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  landCardSelected: {
    borderColor: colors.primary,
    borderWidth: 1.5,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  cardInfo: {
    flex: 1,
    gap: 2,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  landTitle: {
    flex: 1,
  },
  areaRow: {
    marginTop: 2,
  },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: spacing.lg,
    paddingTop: spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    marginTop: spacing.xs,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  actionPressed: {
    opacity: 0.7,
  },
});
