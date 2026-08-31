import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import {
  Card,
  EmptyState,
  IconBadge,
  SampleBadge,
  SampleBanner,
  Screen,
  ScreenHeader,
  Skeleton,
  StatusCard,
  Text,
} from '@/components/ui';
import { isDemoMode, sampleDate, SAMPLE, SAMPLE_HISTORY } from '@/features/demo/demoMode';
import { useFarm } from '@/features/farm/FarmContext';
import { getCropHistory, type CropHistory, type CurrentCrop } from '@/services/agronomy';
import { colors, layout } from '@/theme';

type Props = {
  onRegisterLand: () => void;
};

/** Show the crop in the farmer's own language — same rule as Home/My Farm. */
function cropName(current: CurrentCrop, language: string): string {
  if (language.startsWith('hi') && current.crop.name_hi) return current.crop.name_hi;
  return current.crop.name_en;
}

/** "21 Aug" — same short-date convention used on Home/Field. */
function formatShortDate(iso: string): string {
  const date = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

/** "August 2026" — for a milestone that only needs month-level precision. */
function formatMonthYear(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

const NO_HISTORY: CropHistory = { current: null, previous: null };

/**
 * Krishi Memory — Feature #10, v1. Still the History screen (the bottom tab
 * keeps that name, `nav.history`); its header now reads "Krishi Memory"
 * because that is what this surface actually is: a long-term farm diary, not
 * just a transaction log.
 *
 * The Farm Overview block is real wherever the app already knows something
 * (registered area, current/previous crop, when the farm was registered) and
 * honestly muted where it doesn't (activities recorded, crop stage — both
 * need engines Phase 3+ will connect, so they only show a fabricated number
 * under DEMO_MODE, exactly like every other sourceless tile in the app).
 *
 * Below that, the layout and behaviour design.md originally specified are
 * unchanged: a demo timeline under DEMO_MODE, and the honest empty state
 * otherwise — this already is the chronological Krishi Memory surface, so it
 * is extended here rather than duplicated elsewhere.
 */
export function HistoryScreen({ onRegisterLand }: Props) {
  const { t, i18n } = useTranslation();
  const { farm, loading } = useFarm();
  const [cropHistory, setCropHistory] = useState<CropHistory>(NO_HISTORY);

  useEffect(() => {
    if (!farm) {
      setCropHistory(NO_HISTORY);
      return;
    }

    let cancelled = false;
    getCropHistory(farm.id)
      .then((result) => {
        if (!cancelled) setCropHistory(result);
      })
      .catch(() => {
        // The overview is a summary, not the point of the screen — a failed
        // lookup just leaves its crop tiles at "not added" rather than
        // blocking the rest of the diary.
        if (!cancelled) setCropHistory(NO_HISTORY);
      });

    return () => {
      cancelled = true;
    };
  }, [farm]);

  const demo = isDemoMode();

  return (
    <Screen>
      <ScreenHeader title={t('history.title')} />

      <ScrollView
        contentContainerStyle={[styles.content, farm && styles.contentWithFarm]}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <Skeleton height={160} />
        ) : !farm ? (
          <EmptyState
            icon="field"
            title={t('history.noFarmTitle')}
            body={t('history.noFarmBody')}
            actionLabel={t('myFarm.registerCta')}
            onAction={onRegisterLand}
            testID="history-no-farm"
          />
        ) : (
          <>
            <View style={styles.overview} testID="farm-overview">
              <Text variant="cardTitle">{t('history.overviewTitle')}</Text>

              <View style={styles.grid}>
                <StatusCard
                  icon="map"
                  label={t('history.registeredArea')}
                  value={`${Number(farm.area_acres).toFixed(2)} ${t('onboarding.acres')}`}
                  testID="overview-area"
                />
                <StatusCard
                  icon="plant"
                  label={t('home.crop')}
                  value={cropHistory.current ? cropName(cropHistory.current, i18n.language) : t('home.cropNone')}
                  note={
                    cropHistory.current?.planting.sown_on
                      ? t('history.sownOn', { date: formatShortDate(cropHistory.current.planting.sown_on) })
                      : undefined
                  }
                  muted={!cropHistory.current}
                  testID="overview-current-crop"
                />
              </View>

              <View style={styles.grid}>
                <StatusCard
                  icon="history"
                  label={t('history.previousCrop')}
                  value={cropHistory.previous ? cropName(cropHistory.previous, i18n.language) : t('history.previousCropNone')}
                  muted={!cropHistory.previous}
                  testID="overview-previous-crop"
                />
                <StatusCard
                  icon="check"
                  label={t('history.activitiesRecorded')}
                  value={demo ? String(SAMPLE_HISTORY.length) : t('common.notAvailable')}
                  note={demo ? t('demo.badge') : t('common.comingSoon')}
                  muted={!demo}
                  sample={demo}
                  testID="overview-activities"
                />
              </View>

              <View style={styles.grid}>
                <StatusCard
                  icon="plant"
                  label={t('history.currentCropStage')}
                  value={demo ? t(SAMPLE.growthStage.valueKey) : t('common.notAvailable')}
                  note={demo ? t('demo.badge') : t('common.comingSoon')}
                  muted={!demo}
                  sample={demo}
                  testID="overview-stage"
                />
              </View>

              <Text variant="caption" color={colors.text.muted}>
                {t('history.farmRegistered', { date: formatMonthYear(farm.created_at) })}
              </Text>
            </View>

            {demo ? (
              <>
                <SampleBanner />

                {SAMPLE_HISTORY.map((entry, index) => (
                  <View key={entry.id} style={styles.timelineRow}>
                    <View style={styles.timelineRail}>
                      <IconBadge icon={entry.icon} tone="demo" size={32} iconSize={16} />
                      {index < SAMPLE_HISTORY.length - 1 ? <View style={styles.timelineLine} /> : null}
                    </View>

                    <Card style={styles.entry}>
                      <View style={styles.entryHeader}>
                        <Text variant="bodyMedium" color={colors.demo.fg} style={styles.entryTitle}>
                          {t(entry.titleKey)}
                        </Text>
                        <SampleBadge testID={`sample-badge-${entry.id}`} />
                      </View>

                      <Text variant="caption" color={colors.demo.fg}>
                        {t(entry.detailKey)}
                      </Text>
                      <Text variant="micro" color={colors.demo.fg} style={styles.entryDate}>
                        {sampleDate(entry.daysAgo).toLocaleDateString(undefined, {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </Text>
                    </Card>
                  </View>
                ))}
              </>
            ) : (
              <EmptyState icon="clock" title={t('history.emptyTitle')} testID="history-empty" />
            )}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: layout.screenPadding, paddingBottom: 96, paddingTop: 40 },
  contentWithFarm: { paddingTop: 16, gap: layout.cardGap },
  overview: { gap: layout.cardGap },
  grid: { flexDirection: 'row', gap: layout.cardGap },
  timelineRow: { flexDirection: 'row', gap: 10 },
  timelineRail: { alignItems: 'center', width: 32 },
  timelineLine: { flex: 1, minHeight: 8, width: 2, marginTop: 4, backgroundColor: colors.demo.border },
  entry: { flex: 1, borderColor: colors.demo.border, marginBottom: 4 },
  entryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  entryTitle: { flex: 1 },
  entryDate: { marginTop: 6 },
});
