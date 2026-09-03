import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';

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
  StatePickerModal,
  Text,
} from '@/components/ui';
import { useAuth } from '@/features/auth/AuthContext';
import { useFarm } from '@/features/farm/FarmContext';
import { getCurrentCrop, type CurrentCrop } from '@/services/agronomy';
import { updateProfile } from '@/services/profiles';
import { listSchemes, type SchemeCard } from '@/services/schemes';
import { colors, fonts, layout, radius, spacing } from '@/theme';

type Props = {
  onBack: () => void;
  onOpenScheme: (schemeId: string) => void;
};

const PAGE_SIZE = 30;

export function SchemesScreen({ onBack, onOpenScheme }: Props) {
  const { t } = useTranslation();
  const { profile, refreshProfile } = useAuth();
  const { farm } = useFarm();

  const [crop, setCrop] = useState<CurrentCrop | null>(null);
  const [schemes, setSchemes] = useState<SchemeCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statePickerVisible, setStatePickerVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedState = profile?.location_state ?? farm?.state ?? null;

  useEffect(() => {
    if (!farm) {
      setCrop(null);
      return;
    }

    let cancelled = false;
    getCurrentCrop(farm.id)
      .then((result) => {
        if (!cancelled) setCrop(result);
      })
      .catch(() => {
        if (!cancelled) setCrop(null);
      });

    return () => {
      cancelled = true;
    };
  }, [farm]);

  const loadInitialSchemes = useCallback(async () => {
    if (!selectedState) {
      setSchemes([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await listSchemes({
        state: selectedState,
        cropCode: crop?.crop.code,
        limit: PAGE_SIZE,
        offset: 0,
      });
      setSchemes(data);
      setHasMore(data.length >= PAGE_SIZE);
    } catch {
      setError('schemes.loadError');
    } finally {
      setLoading(false);
    }
  }, [crop?.crop.code, selectedState]);

  useEffect(() => {
    void loadInitialSchemes();
  }, [loadInitialSchemes]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadInitialSchemes();
    setRefreshing(false);
  };

  const handleLoadMore = async () => {
    if (loading || loadingMore || !hasMore || !selectedState) return;

    setLoadingMore(true);
    try {
      const nextBatch = await listSchemes({
        state: selectedState,
        cropCode: crop?.crop.code,
        limit: PAGE_SIZE,
        offset: schemes.length,
      });
      if (nextBatch.length > 0) {
        setSchemes((prev) => [...prev, ...nextBatch]);
      }
      setHasMore(nextBatch.length >= PAGE_SIZE);
    } catch {
      // Non-fatal pagination failure
    } finally {
      setLoadingMore(false);
    }
  };

  const handleSelectState = async (stateName: string) => {
    if (profile?.id) {
      try {
        await updateProfile(profile.id, { location_state: stateName });
        await refreshProfile();
      } catch {
        // Non-fatal
      }
    }
  };

  const renderHeader = () => (
    <View style={styles.headerBlock}>
      <Text variant="caption" color={colors.text.secondary}>
        {t('schemes.intro')}
      </Text>

      {selectedState ? (
        <Pressable
          style={styles.stateSelectorPill}
          onPress={() => setStatePickerVisible(true)}
          hitSlop={8}
          accessibilityRole="button"
          testID="change-state-btn"
        >
          <View style={styles.statePillLeft}>
            <Icon name="pin" size={15} color={colors.primary} />
            <Text variant="bodyMedium" color={colors.primary} style={styles.statePillText}>
              {selectedState}
            </Text>
          </View>
          <Text variant="microMedium" color={colors.primary}>
            {t('schemes.changeState')} ▾
          </Text>
        </Pressable>
      ) : (
        <View style={styles.noStateBanner}>
          <Text variant="bodyMedium" color={colors.text.primary}>
            {t('schemes.selectStatePrompt')}
          </Text>
          <Button
            label={t('schemes.selectState')}
            onPress={() => setStatePickerVisible(true)}
            variant="secondary"
            testID="select-state-btn"
          />
        </View>
      )}
    </View>
  );

  const renderItem = ({ item }: { item: SchemeCard }) => {
    const isStateScheme = item.scheme_scope === 'STATE';
    return (
      <Card
        onPress={() => onOpenScheme(item.row_id)}
        style={styles.schemeCard}
        testID={`scheme-card-${item.row_id}`}
      >
        <IconBadge
          icon={isStateScheme ? 'field' : 'market'}
          tone={isStateScheme ? 'harvest' : 'primary'}
          size={38}
          iconSize={18}
        />
        <View style={styles.schemeBody}>
          <View style={styles.cardTopRow}>
            <Text variant="bodyMedium" numberOfLines={2} style={styles.schemeName}>
              {item.short_title?.trim() || item.name}
            </Text>
            <Badge
              label={isStateScheme ? t('schemes.stateScope') : t('schemes.centralScope')}
              tone={isStateScheme ? 'scheme' : 'neutral'}
            />
          </View>

          {item.summary ? (
            <Text variant="caption" color={colors.text.muted} numberOfLines={2} style={styles.summaryText}>
              {item.summary}
            </Text>
          ) : null}

          {item.reasonKey ? (
            <View style={styles.reasonBadge}>
              <Text variant="micro" color={colors.accent} style={styles.reasonText}>
                {t(item.reasonKey)}
              </Text>
            </View>
          ) : null}
        </View>
        <Icon name="chevron" size={18} color={colors.text.muted} />
      </Card>
    );
  };

  return (
    <Screen>
      <ScreenHeader
        title={t('schemes.title')}
        subtitle="आपके लिए उपयुक्त सरकारी योजनाएं"
        onBack={onBack}
        right={
          <View style={styles.headerIconBtn}>
            <Icon name="bell" size={20} color={colors.text.primary} />
          </View>
        }
      />

      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          {renderHeader()}
          <Skeleton height={96} />
          <Skeleton height={96} />
          <Skeleton height={96} />
        </View>
      ) : schemes.length === 0 && selectedState ? (
        <View style={styles.emptyContainer}>
          {renderHeader()}
          <EmptyState
            icon="help"
            title={t('schemes.emptyTitle')}
            body={t('schemes.emptyBody')}
            actionLabel={t('schemes.changeState')}
            onAction={() => setStatePickerVisible(true)}
            testID="empty-schemes-state"
          />
        </View>
      ) : (
        <FlatList
          data={schemes}
          keyExtractor={(item) => item.row_id}
          renderItem={renderItem}
          ListHeaderComponent={renderHeader}
          contentContainerStyle={styles.listContent}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.4}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void handleRefresh()}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.footerLoading}>
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            ) : null
          }
        />
      )}

      <StatePickerModal
        visible={statePickerVisible}
        selectedState={selectedState}
        onSelectState={(stateName) => void handleSelectState(stateName)}
        onClose={() => setStatePickerVisible(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  listContent: {
    padding: layout.screenPadding,
    gap: spacing.sm,
  },
  headerBlock: {
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  headerIconBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stateSelectorPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: colors.successBg,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.successBorder,
    marginTop: 4,
  },
  statePillLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statePillText: {
    fontFamily: fonts.semibold,
  },
  filterChipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: colors.successBg,
    borderRadius: radius.pill,
  },
  noStateBanner: {
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  loadingContainer: {
    padding: layout.screenPadding,
    gap: spacing.md,
  },
  emptyContainer: {
    padding: layout.screenPadding,
    gap: spacing.md,
  },
  schemeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 16,
  },
  schemeBody: {
    flex: 1,
    gap: 4,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  schemeName: {
    flex: 1,
    fontFamily: fonts.semibold,
    fontSize: 15,
  },
  summaryText: {
    lineHeight: 18,
  },
  reasonBadge: {
    marginTop: 4,
    alignSelf: 'flex-start',
    backgroundColor: colors.accentBg,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.sm,
  },
  reasonText: {
    fontSize: 11,
  },
  footerLoading: {
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
});
