import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { BoundaryThumbnail } from '@/components/farm/BoundaryThumbnail';
import { GuideTarget } from '@/components/guide/GuideTarget';
import {
  Badge,
  Banner,
  Button,
  Card,
  Icon,
  IconBadge,
  Screen,
  Skeleton,
  StatusCard,
  Text,
  type IconBadgeTone,
  type IconName,
} from '@/components/ui';
import { useAuth } from '@/features/auth/AuthContext';
import { useAvatar } from '@/features/avatar/AvatarContext';
import { useFarm } from '@/features/farm/FarmContext';
import type { CurrentCrop } from '@/services/agronomy';
import { getCurrentFieldFix } from '@/services/location';
import { colors, layout, radius } from '@/theme';
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

type ResourceTile = {
  key: string;
  icon: IconName;
  tone: IconBadgeTone;
  labelKey: string;
  testID: string;
  onPress: () => void;
};

type Props = {
  onOpenProfile: () => void;
  onOpenAnalysis: () => void;
  onOpenMarket: () => void;
  onEditBoundary: () => void;
  onOpenRegisterCrop?: () => void;
  onOpenLearning: () => void;
  onOpenCalendar: () => void;
  onOpenSchemes: () => void;
  onOpenUpdates: () => void;
  onOpenAlerts: () => void;
  onOpenVisualAssistant: () => void;
  onOpenArMoisture: () => void;
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
  onOpenRegisterCrop,
  onOpenLearning,
  onOpenCalendar,
  onOpenSchemes,
  onOpenUpdates,
  onOpenAlerts,
  onOpenVisualAssistant,
  onOpenArMoisture,
}: Props) {
  const { t, i18n } = useTranslation();
  const { profile } = useAuth();
  const { farm, lands, selectedLandId, selectLand, loading, errorKey, refresh } = useFarm();
  const { open: openAvatar } = useAvatar();

  const [deviceLocation, setDeviceLocation] = useState<{ latitude: number; longitude: number } | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const fix = await getCurrentFieldFix(4000);
        if (active && fix.state === 'ok') {
          setDeviceLocation({ latitude: fix.latitude, longitude: fix.longitude });
        }
      } catch {
        // non-blocking fallback
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const effectiveLocation = useMemo(() => {
    if (
      farm?.centroid_lat !== null &&
      farm?.centroid_lat !== undefined &&
      farm?.centroid_lng !== null &&
      farm?.centroid_lng !== undefined
    ) {
      return { latitude: farm.centroid_lat, longitude: farm.centroid_lng };
    }
    if (deviceLocation) return deviceLocation;
    if (
      profile?.location_latitude !== null &&
      profile?.location_latitude !== undefined &&
      profile?.location_longitude !== null &&
      profile?.location_longitude !== undefined
    ) {
      return { latitude: profile.location_latitude, longitude: profile.location_longitude };
    }
    return null;
  }, [farm, deviceLocation, profile]);

  const { crop, msp, weather, price, soilMoisture, refresh: refreshInsights } = useHomeInsights(
    farm?.id ?? null,
    effectiveLocation,
  );

  const [refreshing, setRefreshing] = useState(false);

  // Handed to every GuideTarget on this screen so a SCROLL step can bring a
  // card into view before the guide spotlights it. Home is long enough that
  // most of what the farmer asks about starts below the fold.
  const scrollRef = useRef<ScrollView>(null);

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refresh(), refreshInsights()]);
    setRefreshing(false);
  };

  const name = firstName(profile?.full_name, profile?.email, profile?.phone);
  const boundaryPoints = farm ? fromGeoJSON(farm.boundary) : [];

  const resourceTiles: ResourceTile[] = [
    { key: 'learning', icon: 'book', tone: 'primary', labelKey: 'home.learning', testID: 'resource-tile-learning', onPress: onOpenLearning },
    { key: 'calendar', icon: 'clock', tone: 'accent', labelKey: 'home.calendar', testID: 'resource-tile-calendar', onPress: onOpenCalendar },
    { key: 'schemes', icon: 'help', tone: 'harvest', labelKey: 'home.schemes', testID: 'resource-tile-schemes', onPress: onOpenSchemes },
    { key: 'updates', icon: 'field', tone: 'primary', labelKey: 'home.updates', testID: 'resource-tile-updates', onPress: onOpenUpdates },
    { key: 'alerts', icon: 'bell', tone: 'warning', labelKey: 'home.alerts', testID: 'resource-tile-alerts', onPress: onOpenAlerts },
  ];

  return (
    <Screen>
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
        <View style={styles.header}>
          <View style={styles.greeting}>
            <Text variant="caption">{t(`home.greeting.${greetingKey()}`)}</Text>
            <Text variant="cardTitle">{name}</Text>
          </View>

          <Pressable
            onPress={onOpenProfile}
            style={styles.avatarChip}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t('profile.title')}
            testID="open-profile"
          >
            <Text variant="microMedium" color={colors.text.onPrimary}>
              {initials(profile?.full_name, profile?.email, profile?.phone)}
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
            <>
              {lands && lands.length > 1 ? (
                <View style={styles.landSelectorContainer}>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.landPillsScroll}
                  >
                    {lands.map((l, index) => {
                      const isSelected = l.id === (selectedLandId || lands[0]?.id);
                      const label = l.name?.trim() || `${t('myLands.landLabel')} ${index + 1}`;
                      return (
                        <Pressable
                          key={l.id}
                          onPress={() => void selectLand(l.id)}
                          style={[styles.landPill, isSelected && styles.landPillActive]}
                          testID={`home-land-pill-${l.id}`}
                        >
                          <Text
                            variant="microMedium"
                            color={isSelected ? colors.text.onPrimary : colors.text.secondary}
                          >
                            {label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                </View>
              ) : null}

              {/*
                The farm-context card is the single most important thing on
                Home, so it gets the soft agricultural-green surface reserved
                for "important context" rather than the plain white every
                other card uses — same data and same action as before.
              */}
              <GuideTarget id="field-card" scroll={scrollRef}>
              <Card onPress={onEditBoundary} tone="success" style={styles.fieldCard} testID="field-card">
                <View style={styles.fieldThumbnail}>
                  <BoundaryThumbnail points={boundaryPoints} size={64} />
                </View>

                <View style={styles.fieldBody}>
                  <Text variant="cardTitle" numberOfLines={1}>
                    {farm.name?.trim() || t('home.unnamedField')}
                  </Text>
                  <Text variant="stat" color={colors.primaryDark} style={styles.fieldArea}>
                    {`${Number(farm.area_acres).toFixed(2)} ${t('onboarding.acres')}`}
                  </Text>
                  <View style={styles.fieldFooter}>
                    <Badge label={t('home.notYetAnalyzed')} tone="neutral" />
                    <View style={styles.editLinkRow}>
                      <Text variant="microMedium" color={colors.primaryDark}>
                        {t('home.editBoundary')}
                      </Text>
                      <Icon name="chevron" size={14} color={colors.primaryDark} />
                    </View>
                  </View>
                </View>
              </Card>
              </GuideTarget>
            </>
          ) : null}

          <Text variant="caption" color={colors.text.muted} style={styles.sectionHeading}>
            {t('home.farmStatus')}
          </Text>

          <View style={styles.grid}>
            {/*
              The grid tiles are flex children, so each wrapper has to carry the
              flex itself or the tile it wraps collapses to its content width.
            */}
            <GuideTarget id="crop-card" scroll={scrollRef} style={styles.gridItem}>
            <StatusCard
              icon="sprout"
              label={t('home.crop')}
              value={crop ? cropName(crop, i18n.language) : t('common.notAvailable')}
              note={crop ? (crop.planting.variety || undefined) : t('home.cropNone')}
              muted={!crop}
              onPress={onOpenRegisterCrop}
              testID="crop-card"
            />
            </GuideTarget>
            <GuideTarget id="msp-card" scroll={scrollRef} style={styles.gridItem}>
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
              onPress={onOpenRegisterCrop}
              testID="msp-card"
            />
            </GuideTarget>
          </View>

          <View style={styles.grid}>
            <GuideTarget id="moisture-card" scroll={scrollRef} style={styles.gridItem}>
            <StatusCard
              icon="droplet"
              label={t('home.soilMoisture')}
              value={
                soilMoisture?.prediction
                  ? `${soilMoisture.prediction.soil_moisture_percent}%`
                  : t('common.notAvailable')
              }
              note={
                soilMoisture?.prediction
                  ? `${t(`field.categories.${soilMoisture.prediction.category}`, { defaultValue: soilMoisture.prediction.category })} · ML`
                  : t('common.comingSoon')
              }
              muted={!soilMoisture?.prediction}
              onPress={onOpenAnalysis}
              testID="moisture-card"
            />
            </GuideTarget>
            <GuideTarget id="weather-card" scroll={scrollRef} style={styles.gridItem}>
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
                  ? (weather.condition || (weather.humidity_pct !== null && weather.humidity_pct !== undefined ? `${weather.humidity_pct}% humidity` : t('home.weatherLive', { defaultValue: 'Real-time' })))
                  : t('home.weatherNone')
              }
              muted={weather?.temperature_c === null || weather?.temperature_c === undefined}
              testID="weather-card"
            />
            </GuideTarget>
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

          <GuideTarget id="market-card" scroll={scrollRef}>
          <Pressable
            onPress={onOpenMarket}
            testID="market-card"
            accessibilityRole="button"
            accessibilityLabel={`${t('home.marketTitle')}, ${t('home.marketSub')}`}
            style={({ pressed }) => [
              styles.marketCardWrapper,
              pressed && styles.marketCardPressed,
            ]}
          >
            {/* Header: Icon, Titles & AI LIVE status badge */}
            <View style={styles.marketCardHeader}>
              <View style={styles.marketCardHeaderLeft}>
                <IconBadge icon="market" tone="accent" size={38} iconSize={20} />
                <View style={styles.marketCardHeaderText}>
                  <Text variant="cardTitle" color={colors.text.primary}>
                    {t('home.marketTitle')}
                  </Text>
                  <Text variant="micro" color={colors.text.secondary} numberOfLines={1}>
                    {t('home.marketSub')}
                  </Text>
                </View>
              </View>

              <View style={styles.aiLiveBadge}>
                <View style={styles.aiLiveDot} />
                <Text variant="microMedium" color={colors.success}>
                  {t('home.marketAiBadge')}
                </Text>
              </View>
            </View>

            {/* Price / Intelligence Hero Row */}
            <View style={styles.marketBodySection}>
              {price ? (
                <View style={styles.marketPriceBanner}>
                  <View style={styles.marketPriceLeft}>
                    <Text variant="stat" color={colors.text.primary}>
                      ₹{Math.round(price.modal_price)}
                    </Text>
                    <Text variant="micro" color={colors.text.secondary} style={styles.marketNote}>
                      {t('home.marketObserved', {
                        date: formatShortDate(price.price_date),
                      })}
                    </Text>
                  </View>
                  <View style={styles.marketTrendPill}>
                    <Text variant="microMedium" color={colors.success}>
                      {t('home.marketTrendUp')}
                    </Text>
                  </View>
                </View>
              ) : (
                <View style={styles.marketPromoBanner}>
                  <View style={styles.marketPromoLeft}>
                    <Text variant="bodyMedium" color={colors.primaryDark}>
                      {t('home.marketUnavailable')}
                    </Text>
                    <Text variant="micro" color={colors.text.secondary} style={styles.marketPromoPrompt}>
                      {t('home.marketExplorePrompt')}
                    </Text>
                  </View>
                  <View style={styles.marketPreviewChip}>
                    <Text variant="microMedium" color={colors.accent}>
                      {t('home.marketBuyersCount')}
                    </Text>
                  </View>
                </View>
              )}
            </View>

            {/* Feature Highlights: 7-Day Forecast · Direct Buyers · Quality & MSP */}
            <View style={styles.marketFeaturePills}>
              <View style={styles.featurePill}>
                <Icon name="sprout" size={13} color={colors.primary} />
                <Text variant="micro" color={colors.text.primary}>
                  {t('home.marketFeatureForecast')}
                </Text>
              </View>
              <View style={styles.featurePill}>
                <Icon name="check" size={13} color={colors.accent} />
                <Text variant="micro" color={colors.text.primary}>
                  {t('home.marketFeatureBuyers')}
                </Text>
              </View>
              <View style={styles.featurePill}>
                <Icon name="flask" size={13} color={colors.harvest} />
                <Text variant="micro" color={colors.text.primary}>
                  {t('home.marketFeatureGrading')}
                </Text>
              </View>
            </View>

            {/* Bottom Interactive CTA Bar */}
            <View style={styles.marketFooter}>
              <Text variant="microMedium" color={colors.primary}>
                {t('home.marketExploreCta')}
              </Text>
              <View style={styles.marketChevronCircle}>
                <Icon name="chevron" size={14} color={colors.surface} />
              </View>
            </View>
          </Pressable>
          </GuideTarget>

          <Text variant="cardTitle" style={styles.sectionHeading}>
            {t('home.farmerResources')}
          </Text>
          <GuideTarget id="farmer-resources" scroll={scrollRef}>
          <View style={styles.resourcesGrid} testID="farmer-resources">
            {resourceTiles.map((tile) => (
              <Pressable
                key={tile.key}
                onPress={tile.onPress}
                style={({ pressed }) => [styles.resourceTile, pressed && styles.resourceTilePressed]}
                accessibilityRole="button"
                testID={tile.testID}
              >
                <IconBadge icon={tile.icon} tone={tile.tone} />
                <Text variant="microMedium" color={colors.text.primary} center style={styles.resourceLabel}>
                  {t(tile.labelKey)}
                </Text>
              </Pressable>
            ))}
          </View>
          </GuideTarget>

          <Card tone="success" onPress={openAvatar} style={styles.companionCard} testID="companion-card">
            <IconBadge icon="mic" tone="primary" />
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
            <IconBadge icon="camera" tone="accent" />
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

          {/*
            AR Moisture Guidance entry point — camera + GPS/compass
            directional guidance to a demo-labelled sampling target, not a
            measured moisture zone (src/screens/ar/ARMoistureGuidanceScreen.tsx).
          */}
          <Card
            tone="harvest"
            onPress={onOpenArMoisture}
            style={styles.companionCard}
            testID="ar-moisture-card"
            accessibilityLabel={t('home.arMoistureTitle')}
          >
            <IconBadge icon="locate" tone="primary" />
            <View style={styles.companionBody}>
              <Text variant="bodyMedium" color={colors.primaryDark}>
                {t('home.arMoistureTitle')}
              </Text>
              <Text variant="micro" color={colors.text.secondary} style={styles.companionSub}>
                {t('home.arMoistureSub')}
              </Text>
            </View>
            <Icon name="chevron" size={20} color={colors.primary} />
          </Card>
        </View>
      </ScrollView>
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
    width: 36,
    height: 36,
    borderRadius: 18,
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
  landSelectorContainer: {
    marginBottom: -4,
  },
  landPillsScroll: {
    gap: 8,
  },
  landPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  landPillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  fieldCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  fieldThumbnail: { borderRadius: radius.sm, overflow: 'hidden' },
  fieldBody: { flex: 1, minWidth: 0, gap: 2 },
  fieldArea: { marginTop: 2 },
  fieldFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  editLinkRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  sectionHeading: { marginTop: 4 },
  grid: { flexDirection: 'row', gap: layout.cardGap },
  gridItem: { flex: 1 },
  marketCardWrapper: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.accentBorder,
    padding: 16,
    gap: 12,
    shadowColor: '#1E6FA8',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  marketCardPressed: {
    backgroundColor: colors.bg,
    borderColor: colors.accent,
  },
  marketCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  marketCardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  marketCardHeaderText: {
    flex: 1,
    gap: 2,
  },
  aiLiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.successBg,
    borderWidth: 1,
    borderColor: colors.successBorder,
  },
  aiLiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.success,
  },
  marketBodySection: {
    marginTop: 2,
  },
  marketPriceBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.bg,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  marketPriceLeft: {
    gap: 2,
  },
  marketTrendPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.successBg,
  },
  marketPromoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.accentBg,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.accentBorder,
  },
  marketPromoLeft: {
    flex: 1,
    gap: 2,
  },
  marketPromoPrompt: {
    marginTop: 2,
  },
  marketPreviewChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.accentBorder,
  },
  marketFeaturePills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  featurePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.neutralBg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  marketFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  marketChevronCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  marketNote: { marginTop: 2 },
  resourcesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: layout.cardGap },
  resourceTile: {
    flexBasis: '47%',
    flexGrow: 1,
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
  },
  resourceTilePressed: { backgroundColor: colors.neutralBg },
  resourceLabel: {},
  companionCard: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  companionBody: { flex: 1 },
  companionSub: { marginTop: 2 },
});
