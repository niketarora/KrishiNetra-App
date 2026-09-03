import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  Badge,
  type BadgeTone,
  Banner,
  Card,
  EmptyState,
  Icon,
  IconBadge,
  type IconBadgeTone,
  SampleBanner,
  Screen,
  ScreenHeader,
  Skeleton,
  Text,
  type IconName,
} from '@/components/ui';
import { UPDATES } from '@/features/updates/demoUpdates';
import type { AgriUpdate, KrishiUpdate, KrishiUpdateCategory, UpdateCategory } from '@/features/updates/types';
import { localize } from '@/utils/localizedText';
import { colors, layout } from '@/theme';

import { useUpdatesData } from './useUpdatesData';

type Props = {
  onBack: () => void;
  onOpenUpdate: (updateId: string) => void;
};

const CATEGORY_ICONS: Record<KrishiUpdateCategory, IconName> = {
  risk: 'alert',
  agriculture: 'plant',
  government: 'help',
  market: 'market',
  technology: 'flask',
};

const CATEGORY_TONES: Record<KrishiUpdateCategory, IconBadgeTone> = {
  risk: 'danger',
  agriculture: 'primary',
  government: 'harvest',
  market: 'primary',
  technology: 'accent',
};

/** The demo feed's own five-category enum — separate type from the real feed's, see `features/updates/types.ts`. */
const DEMO_CATEGORY_ICONS: Record<UpdateCategory, IconName> = {
  agriculture: 'plant',
  weather: 'sun',
  government: 'help',
  market: 'market',
  technology: 'flask',
};
const DEMO_CATEGORY_TONES: Record<UpdateCategory, IconBadgeTone> = {
  agriculture: 'primary',
  weather: 'accent',
  government: 'harvest',
  market: 'primary',
  technology: 'accent',
};

function relativeDate(iso: string, t: (key: string, opts?: Record<string, unknown>) => string): string {
  const published = new Date(iso).getTime();
  if (Number.isNaN(published)) return '';

  const daysAgo = Math.max(0, Math.floor((Date.now() - published) / (24 * 3600 * 1000)));
  if (daysAgo <= 0) return t('updates.today');
  if (daysAgo === 1) return t('updates.yesterday');
  return t('updates.daysAgo', { count: daysAgo });
}

function relativeDemoDate(daysAgo: number, t: (key: string, opts?: Record<string, unknown>) => string): string {
  if (daysAgo <= 0) return t('updates.today');
  if (daysAgo === 1) return t('updates.yesterday');
  return t('updates.daysAgo', { count: daysAgo });
}

/**
 * "Official Alert" / "Government Update" / "Regional News" / "National
 * News" — the visual line between an authority speaking (NDMA SACHET, PIB)
 * and ordinary news coverage (GDELT, Google News RSS fallback). Never
 * "Verified": that word is reserved for a claim this app is not making
 * about an arbitrary news article.
 *
 * Regional vs. national is read off `update.location` — the backend
 * (`gdelt.provider.ts`/`google-news.provider.ts`) only ever sets
 * `location.district`/`.state` for a result its *regional* query produced
 * AND whose own title actually names that district/state (see those files'
 * header comments), so a story with neither is genuinely national-scope,
 * never mislabelled "Regional" just because it happened to surface from a
 * national/agritech query.
 */
function sourceBadge(update: KrishiUpdate, t: (key: string) => string): { label: string; tone: BadgeTone } {
  if (update.source.type === 'official') {
    return update.category === 'risk'
      ? { label: t('updates.officialAlert'), tone: 'danger' }
      : { label: t('updates.governmentUpdate'), tone: 'success' };
  }
  const isRegional = Boolean(update.location?.district || update.location?.state);
  return isRegional
    ? { label: t('updates.regionalNews'), tone: 'neutral' }
    : { label: t('updates.nationalNews'), tone: 'neutral' };
}

/**
 * Krishi Updates — a location-and-crop-aware feed for one field, not a
 * generic news reader. `useUpdatesData` loads every registered field, the
 * real backend feed for whichever is selected, and falls back to the local
 * demo feed (clearly labelled, never silently) only when the real feed
 * fails and `EXPO_PUBLIC_DEMO_MODE` is on.
 */
export function UpdatesScreen({ onBack, onOpenUpdate }: Props) {
  const { t, i18n } = useTranslation();
  const { farms, selectedFarmId, selectFarm, updates, loading, errorKey, demoFallback, refresh } = useUpdatesData();
  const [refreshing, setRefreshing] = useState(false);

  const selectedFarm = farms.find((farm) => farm.id === selectedFarmId) ?? null;

  const handleRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  const renderFarmSelector = () => {
    if (farms.length <= 1) return null;

    return (
      <View style={styles.farmSelector} testID="updates-farm-selector">
        {farms.map((farm, index) => {
          const selected = farm.id === selectedFarmId;
          const label = farm.name?.trim() || t('updates.unnamedField', { number: index + 1 });
          return (
            <Pressable
              key={farm.id}
              onPress={() => selectFarm(farm.id)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              testID={`updates-farm-option-${farm.id}`}
              style={[styles.farmChip, selected && styles.farmChipSelected]}
            >
              <Text variant="bodyMedium" color={selected ? colors.primaryDark : colors.text.primary}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    );
  };

  const renderFarmContext = () => {
    if (!selectedFarm) return null;

    const locationLine = [selectedFarm.district, selectedFarm.state].filter(Boolean).join(', ');

    return (
      <Card tone="accent" style={styles.contextCard} testID="updates-farm-context">
        <Text variant="bodyMedium" color={colors.accent}>
          {selectedFarm.name?.trim() || t('updates.unnamedField', { number: 1 })}
        </Text>
        <Text variant="caption">{locationLine || t('updates.locationUnknown')}</Text>
      </Card>
    );
  };

  const renderUpdate = (update: KrishiUpdate) => {
    const badge = sourceBadge(update, t);
    const reason = update.relevance.reasons[0];

    return (
      <Card
        key={update.id}
        onPress={() => onOpenUpdate(update.id)}
        style={styles.updateCard}
        testID={`update-card-${update.id}`}
      >
        <View style={styles.updateHeader}>
          <IconBadge icon={CATEGORY_ICONS[update.category]} tone={CATEGORY_TONES[update.category]} size={32} iconSize={16} />
          <View style={styles.updateHeaderBody}>
            <Text variant="bodyMedium" numberOfLines={2}>
              {update.title}
            </Text>
            <View style={styles.metaRow}>
              <Badge label={badge.label} tone={badge.tone} />
              <Text variant="caption" color={colors.text.muted}>
                {update.source.name} · {relativeDate(update.publishedAt, t)}
              </Text>
            </View>
          </View>
        </View>

        {update.summary ? (
          <Text variant="caption" color={colors.text.secondary} style={styles.summary} numberOfLines={2}>
            {update.summary}
          </Text>
        ) : null}

        {reason ? (
          <View style={styles.whyRow}>
            <Icon name="help" size={14} color={colors.primaryDark} strokeWidth={2} />
            <Text variant="micro" color={colors.primaryDark} style={styles.whyText}>
              {reason}
            </Text>
          </View>
        ) : null}
      </Card>
    );
  };

  const renderDemoUpdate = (update: AgriUpdate) => (
    <Card
      key={update.id}
      onPress={() => onOpenUpdate(update.id)}
      style={styles.updateCard}
      testID={`update-card-${update.id}`}
    >
      <View style={styles.updateHeader}>
        <IconBadge icon={DEMO_CATEGORY_ICONS[update.category]} tone={DEMO_CATEGORY_TONES[update.category]} size={32} iconSize={16} />
        <View style={styles.updateHeaderBody}>
          <Text variant="bodyMedium" numberOfLines={2}>{localize(update.title, i18n.language)}</Text>
          <Text variant="caption" color={colors.text.muted}>
            {t(`updates.categories.${update.category}`)} · {relativeDemoDate(update.publishedDaysAgo, t)}
          </Text>
        </View>
      </View>
      <Text variant="caption" color={colors.text.secondary} style={styles.summary}>
        {localize(update.summary, i18n.language)}
      </Text>
    </Card>
  );

  return (
    <Screen>
      <ScreenHeader
        title={t('updates.title')}
        subtitle="आपके खेत से जुड़ी महत्वपूर्ण जानकारी"
        onBack={onBack}
        right={
          <Pressable hitSlop={8} style={styles.headerIconBtn} accessibilityRole="button" accessibilityLabel="Alerts">
            <Icon name="bell" size={20} color={colors.text.primary} />
          </Pressable>
        }
      />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {demoFallback ? (
          <SampleBanner />
        ) : null}

        {errorKey && !demoFallback ? (
          <Banner title={t(errorKey)} tone="danger" icon="offline" />
        ) : null}

        {renderFarmSelector()}
        {renderFarmContext()}

        {loading ? (
          <View style={styles.skeletonList} testID="updates-loading">
            <Skeleton height={110} />
            <Skeleton height={110} />
            <Skeleton height={110} />
          </View>
        ) : demoFallback ? (
          (UPDATES as AgriUpdate[]).length === 0 ? (
            <EmptyState
              icon="plant"
              title={t('updates.emptyTitle')}
              body={t('updates.emptyBody')}
              testID="updates-empty"
            />
          ) : (
            <View style={styles.updatesList}>
              {(UPDATES as AgriUpdate[]).map(renderDemoUpdate)}
            </View>
          )
        ) : updates.length === 0 && !errorKey ? (
          <EmptyState
            icon="plant"
            title={t('updates.emptyTitle')}
            body={t('updates.emptyBody')}
            testID="updates-empty"
          />
        ) : (
          <View style={styles.updatesList}>
            {(updates as KrishiUpdate[]).map(renderUpdate)}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: layout.screenPadding,
    paddingTop: 8,
    paddingBottom: 110,
    gap: layout.cardGap,
  },
  headerIconBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  farmSelector: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  farmChip: {
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: 999,
  },
  farmChipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  contextCard: {
    gap: 4,
    backgroundColor: colors.successBg,
    borderColor: colors.successBorder,
    borderWidth: 1,
    padding: 14,
    borderRadius: 16,
  },
  loading: { gap: layout.cardGap },
  skeletonList: { gap: layout.cardGap },
  updatesList: { gap: layout.cardGap },
  updateCard: {
    gap: 8,
    padding: 14,
    borderRadius: 16,
  },
  updateHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  updateHeaderBody: { flex: 1, minWidth: 0, gap: 4 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 2 },
  summary: { marginTop: 2, lineHeight: 18 },
  whyRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 4 },
  whyText: { flex: 1 },
});
