import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AvatarFab } from '@/components/avatar/AvatarFab';
import { BoundaryThumbnail } from '@/components/farm/BoundaryThumbnail';
import {
  Badge,
  Banner,
  Button,
  Card,
  Icon,
  Screen,
  Skeleton,
  StatusCard,
  Text,
} from '@/components/ui';
import { useAuth } from '@/features/auth/AuthContext';
import { useAvatar } from '@/features/avatar/AvatarContext';
import { isDemoMode, SAMPLE } from '@/features/demo/demoMode';
import { useFarm } from '@/features/farm/FarmContext';
import type { CurrentCrop } from '@/services/agronomy';
import { colors, layout } from '@/theme';
import { firstName, greetingKey, initials } from '@/utils/format';
import { fromGeoJSON } from '@/utils/geo';

import { useHomeInsights } from './useHomeInsights';

/** Show the crop in the farmer's own language when the catalogue has it. */
function cropName(current: CurrentCrop, language: string): string {
  if (language.startsWith('hi') && current.crop.name_hi) return current.crop.name_hi;
  return current.crop.name_en;
}

/** "21 Aug" — enough to see how fresh a reading is without a full date. */
function formatShortDate(iso: string): string {
  const date = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return iso;

  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
}

type Props = {
  onOpenProfile: () => void;
  onOpenAnalysis: () => void;
  onOpenMarket: () => void;
  onEditBoundary: () => void;
  onOpenLearning: () => void;
  onOpenCalendar: () => void;
  onOpenSchemes: () => void;
  onOpenUpdates: () => void;
  onOpenVisualAssistant: () => void;
};

/**
 * The farmer's daily screen, built to the prototype's Home layout.
 *
 * What is real in Phase 1: the greeting, the field name, the saved area, and a
 * thumbnail drawn from the farmer's own boundary. What is not: crop health,
 * growth stage, weather and mandi prices, none of which have a data source
 * yet. Those tiles render their real layout with an em dash and a plain
 * "coming later" note rather than a plausible sample number — a farmer must
 * never make a selling decision on a value the app invented.
 */
export function HomeScreen({
  onOpenProfile,
  onOpenAnalysis,
  onOpenMarket,
  onEditBoundary,
  onOpenLearning,
  onOpenCalendar,
  onOpenSchemes,
  onOpenUpdates,
  onOpenVisualAssistant,
}: Props) {
  const { t, i18n } = useTranslation();
  const { user, profile } = useAuth();
  const { farm, loading, errorKey, refresh } = useFarm();
  const { open: openAvatar } = useAvatar();
  const { crop, msp, weather, price, refresh: refreshInsights } = useHomeInsights(farm?.id ?? null);

  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refresh(), refreshInsights()]);
    setRefreshing(false);
  };

  const demo = isDemoMode();
  const name = firstName(profile?.full_name, user?.email);
  const boundaryPoints = farm ? fromGeoJSON(farm.boundary) : [];

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
        }
      >
        <View style={styles.header}>
          <View style={styles.greeting}>
            <Text variant="caption">{t(`home.greeting.${greetingKey()}`)}</Text>
            <Text variant="cardTitle">{name}</Text>
          </View>

          <Pressable
            onPress={onOpenProfile}
            style={styles.avatarChip}
            accessibilityRole="button"
            accessibilityLabel={t('profile.title')}
            testID="open-profile"
          >
            <Text variant="microMedium" color={colors.text.onPrimary}>
              {initials(profile?.full_name, user?.email)}
            </Text>
          </Pressable>
        </View>

        <View style={styles.body}>
          {errorKey ? (
            <Banner title={t(errorKey)} tone="danger" icon="offline" />
          ) : null}

          {loading && !farm ? (
            <View style={styles.loadingBlock}>
              <Skeleton height={92} />
              <View style={styles.grid}>
                <Skeleton height={92} style={styles.gridItem} />
                <Skeleton height={92} style={styles.gridItem} />
              </View>
            </View>
          ) : farm ? (
            <Card onPress={onEditBoundary} style={styles.fieldCard} testID="field-card">
              <BoundaryThumbnail points={boundaryPoints} size={64} />

              <View style={styles.fieldBody}>
                <Text variant="cardTitle" numberOfLines={1}>
                  {farm.name?.trim() || t('home.unnamedField')}
                </Text>
                <Text variant="caption" color={colors.text.muted} style={styles.fieldMeta}>
                  {`${Number(farm.area_acres).toFixed(2)} ${t('onboarding.acres')}`}
                </Text>
                <Text variant="micro" color={colors.success} style={styles.editLink}>
                  {t('home.editBoundary')}
                </Text>
              </View>

              <Badge label={t('home.notYetAnalyzed')} tone="neutral" />
            </Card>
          ) : null}

          <View style={styles.grid}>
            <StatusCard
              icon="plant"
              label={t('home.crop')}
              value={crop ? cropName(crop, i18n.language) : t('common.notAvailable')}
              note={crop?.planting.variety ?? t('home.cropNone')}
              muted={!crop}
              testID="crop-card"
            />
            <StatusCard
              icon="market"
              label={t('home.msp')}
              value={
                msp
                  ? t('home.mspPerQuintal', { price: Math.round(msp.price_per_quintal) })
                  : t('common.notAvailable')
              }
              note={
                msp ? t('home.mspYear', { year: msp.marketing_year }) : t('home.mspNone')
              }
              muted={!msp}
              testID="msp-card"
            />
          </View>

          <View style={styles.grid}>
            <StatusCard
              icon="plant"
              label={t('home.growthStage')}
              value={demo ? t(SAMPLE.growthStage.valueKey) : t('common.notAvailable')}
              note={demo ? t('demo.badge') : t('common.comingSoon')}
              muted={!demo}
              sample={demo}
              testID="growth-card"
            />
            <StatusCard
              icon="sun"
              label={t('home.weather')}
              value={
                weather?.temperature_c !== null && weather?.temperature_c !== undefined
                  ? `${Math.round(weather.temperature_c)}°C`
                  : t('common.notAvailable')
              }
              note={
                weather
                  ? t('home.weatherObserved', { date: formatShortDate(weather.observed_on) })
                  : t('home.weatherNone')
              }
              muted={weather?.temperature_c === null || weather?.temperature_c === undefined}
              testID="weather-card"
            />
          </View>

          {/*
            The prototype's advisory banner sits here. It is conditional by
            design — rendered only when a real condition needs attention — and
            in Phase 1 there is no analysis to raise one, so nothing renders.
          */}

          <Button
            label={t('home.viewFullAnalysis')}
            onPress={onOpenAnalysis}
            variant="secondary"
          />

          <Card onPress={onOpenMarket} testID="market-card">
            <Text variant="caption">{t('home.market')}</Text>
            <View style={styles.marketRow}>
              <View style={styles.marketValue}>
                <Text
                  variant="cardTitle"
                  color={price ? colors.text.primary : colors.text.muted}
                >
                  {price
                    ? `₹${Math.round(price.modal_price)}`
                    : t('common.notAvailable')}
                </Text>
                {/*
                  A price with no date invites a farmer to read a stale figure
                  as today's, so the recorded date travels with the number
                  everywhere it appears.
                */}
                <Text variant="micro" style={styles.marketNote}>
                  {price
                    ? t('home.marketObserved', {
                        date: formatShortDate(price.price_date),
                      })
                    : t('home.marketUnavailable')}
                </Text>
              </View>
              <Icon name="chevron" size={20} color={colors.text.muted} />
            </View>
          </Card>

          <Card style={styles.resourcesCard} testID="farmer-resources">
            <Text variant="caption">{t('home.farmerResources')}</Text>
            <View style={styles.resourcesGrid}>
              <Pressable
                onPress={onOpenLearning}
                style={styles.resourceTile}
                accessibilityRole="button"
                testID="resource-tile-learning"
              >
                <Icon name="book" size={20} color={colors.text.secondary} />
                <Text variant="micro" center style={styles.resourceLabel}>
                  {t('home.learning')}
                </Text>
              </Pressable>
              <Pressable
                onPress={onOpenCalendar}
                style={styles.resourceTile}
                accessibilityRole="button"
                testID="resource-tile-calendar"
              >
                <Icon name="clock" size={20} color={colors.text.secondary} />
                <Text variant="micro" center style={styles.resourceLabel}>
                  {t('home.calendar')}
                </Text>
              </Pressable>
              <Pressable
                onPress={onOpenSchemes}
                style={styles.resourceTile}
                accessibilityRole="button"
                testID="resource-tile-schemes"
              >
                <Icon name="help" size={20} color={colors.text.secondary} />
                <Text variant="micro" center style={styles.resourceLabel}>
                  {t('home.schemes')}
                </Text>
              </Pressable>
              <Pressable
                onPress={onOpenUpdates}
                style={styles.resourceTile}
                accessibilityRole="button"
                testID="resource-tile-updates"
              >
                <Icon name="field" size={20} color={colors.text.secondary} />
                <Text variant="micro" center style={styles.resourceLabel}>
                  {t('home.updates')}
                </Text>
              </Pressable>
            </View>
          </Card>

          <Card tone="success" onPress={openAvatar} style={styles.companionCard} testID="companion-card">
            <Icon name="mic" size={20} color={colors.primaryDark} />
            <View style={styles.companionBody}>
              <Text variant="bodyMedium" color={colors.primaryDark}>
                {t('home.askCompanion')}
              </Text>
              <Text variant="micro" color={colors.success} style={styles.companionSub}>
                {t('home.askCompanionSub')}
              </Text>
            </View>
          </Card>

          {/*
            Visual Assistant entry point — a standalone camera-first prototype
            (src/screens/visualAssistant/VisualAssistantScreen.tsx). Deliberately
            not routed through the avatar yet: see that screen's own doc comment.
          */}
          <Card
            tone="accent"
            onPress={onOpenVisualAssistant}
            style={styles.companionCard}
            testID="visual-assistant-card"
            accessibilityLabel={t('visualAssistant.openLabel')}
          >
            <Icon name="camera" size={20} color={colors.accent} />
            <View style={styles.companionBody}>
              <Text variant="bodyMedium" color={colors.accent}>
                {t('home.visualAssistantTitle')}
              </Text>
              <Text variant="micro" color={colors.text.secondary} style={styles.companionSub}>
                {t('home.visualAssistantSub')}
              </Text>
            </View>
            <Icon name="chevron" size={20} color={colors.accent} />
          </Card>
        </View>
      </ScrollView>

      <AvatarFab />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 96 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: layout.screenPadding,
    paddingTop: 14,
    paddingBottom: 4,
  },
  greeting: { gap: 2 },
  avatarChip: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  body: {
    paddingHorizontal: layout.screenPadding,
    paddingTop: 8,
    gap: layout.cardGap,
  },
  loadingBlock: { gap: layout.cardGap },
  fieldCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  fieldBody: { flex: 1, minWidth: 0 },
  fieldMeta: { marginTop: 2 },
  editLink: { marginTop: 6 },
  grid: { flexDirection: 'row', gap: layout.cardGap },
  gridItem: { flex: 1 },
  marketRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 6,
  },
  marketValue: { flex: 1 },
  marketNote: { marginTop: 2 },
  resourcesCard: { gap: 12 },
  resourcesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: layout.cardGap },
  resourceTile: {
    flexBasis: '47%',
    flexGrow: 1,
    alignItems: 'center',
    gap: 6,
    paddingVertical: 12,
    backgroundColor: colors.neutralBg,
  },
  resourceLabel: {},
  companionCard: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  companionBody: { flex: 1 },
  companionSub: { marginTop: 2 },
});
