import { useRef, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { GuideTarget } from '@/components/guide/GuideTarget';
import {
  Banner,
  Card,
  EmptyState,
  SampleBadge,
  SampleBanner,
  Screen,
  ScreenHeader,
  Text,
} from '@/components/ui';
import { isDemoMode, SAMPLE } from '@/features/demo/demoMode';
import { useFarm } from '@/features/farm/FarmContext';
import { colors, layout } from '@/theme';

import { compareToMsp, useMarketData } from './useMarketData';

/**
 * design.md §4.10.
 *
 * Phase 2.5 connected AGMARKNET, so the current price and the MSP comparison
 * are now real recorded values, each shown with the date and mandi it came
 * from. What is still absent is what was always Phase 3: the price
 * *prediction* and the sell-or-wait recommendation.
 *
 * That distinction runs through this whole screen. Reporting what a mandi paid
 * last Tuesday is a fact. Telling a farmer to hold their crop is a forecast,
 * and TRD §23 forbids substituting a fabricated one — so that card says what it
 * needs and why, rather than filling the space with a guess.
 */
export function MarketScreen() {
  const { t, i18n } = useTranslation();
  const { farm } = useFarm();
  const { crop, prices, msp, errorKey, refresh } = useMarketData(farm?.id ?? null);

  const [refreshing, setRefreshing] = useState(false);

  /** So a SCROLL step can bring the recommendation card into view. */
  const scrollRef = useRef<ScrollView>(null);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  const latest = prices[0] ?? null;
  const mspGap = compareToMsp(latest, msp);
  const demo = isDemoMode();

  const cropName =
    crop && i18n.language.startsWith('hi') && crop.crop.name_hi
      ? crop.crop.name_hi
      : crop?.crop.name_en;

  return (
    <Screen>
      <ScreenHeader title={cropName ? `${t('market.title')} · ${cropName}` : t('market.title')} />

      <ScrollView
        ref={scrollRef}
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
        {errorKey ? <Banner title={t(errorKey)} tone="danger" icon="offline" /> : null}
        {demo ? <SampleBanner /> : null}

        <GuideTarget id="price-card" scroll={scrollRef}>
        <Card testID="price-card">
          <View style={styles.priceRow}>
            <View style={styles.priceCell}>
              <Text variant="caption">{t('market.currentPrice')}</Text>
              <Text
                variant="cardTitle"
                color={latest ? colors.text.primary : colors.text.muted}
                style={styles.value}
              >
                {latest ? `₹${Math.round(latest.modal_price)}` : t('common.notAvailable')}
              </Text>
              <Text variant="micro">{t('market.perQuintal')}</Text>
            </View>

            <View style={styles.priceCell}>
              <Text variant="caption">{t('market.msp')}</Text>
              <Text
                variant="cardTitle"
                color={msp ? colors.text.primary : colors.text.muted}
                style={styles.value}
              >
                {msp ? `₹${Math.round(msp.price_per_quintal)}` : t('common.notAvailable')}
              </Text>
              {msp ? <Text variant="micro">{msp.marketing_year}</Text> : null}
            </View>
          </View>

          {/*
            Provenance sits directly under the number it belongs to. A mandi
            price without its date is the easiest way for a farmer to act on a
            stale figure believing it is today's.
          */}
          {latest ? (
            <View style={styles.provenance}>
              <Text variant="micro">
                {t('market.observedOn', {
                  date: formatDate(latest.price_date),
                  mandi: latest.mandis?.code ?? t('market.msp'),
                })}
              </Text>

              {latest.min_price !== null && latest.max_price !== null ? (
                <Text variant="micro">
                  {t('market.priceRange', {
                    min: Math.round(latest.min_price),
                    max: Math.round(latest.max_price),
                  })}
                </Text>
              ) : null}

              {mspGap !== null ? (
                <Text variant="micro" color={mspGap >= 0 ? colors.success : colors.danger}>
                  {mspGap === 0
                    ? t('market.atMsp')
                    : mspGap > 0
                      ? t('market.aboveMsp', { amount: Math.round(mspGap) })
                      : t('market.belowMsp', { amount: Math.round(Math.abs(mspGap)) })}
                </Text>
              ) : null}
            </View>
          ) : (
            <Text variant="micro" style={styles.provenance}>
              {crop ? t('market.noPrice') : t('market.noCrop')}
            </Text>
          )}

          <View style={styles.divider} />

          <Text variant="caption">{t('market.sevenDayTrend')}</Text>
          <GuideTarget id="price-trend" scroll={scrollRef}>
          <View style={styles.trendSlot}>
            {prices.length >= 2 ? (
              <Sparkline prices={prices} />
            ) : (
              <Text variant="micro">{t('market.trendNeedsHistory')}</Text>
            )}
          </View>
          </GuideTarget>
        </Card>
        </GuideTarget>

        {/*
          The recommendation is a forecast, not a report. Without the price
          prediction model there is nothing to say, so outside demo mode this
          card states what it needs rather than guessing.
        */}
        <GuideTarget id="recommendation-card" scroll={scrollRef}>
        {demo ? (
          <Card style={styles.demoCard}>
            <View style={styles.demoHeader}>
              <Text variant="bodyMedium" color={colors.demo.fg}>
                {t('market.recommendation')}
              </Text>
              <SampleBadge testID="sample-badge-recommendation" />
            </View>
            <Text variant="cardTitle" color={colors.demo.fg} style={styles.demoVerdict}>
              {t(SAMPLE.recommendation.verdictKey)}
            </Text>
            <Text variant="caption" color={colors.demo.fg}>
              {t(SAMPLE.recommendation.bodyKey)}
            </Text>
          </Card>
        ) : (
          <Card tone="accent">
            <Text variant="bodyMedium" color={colors.accent}>
              {t('market.recommendation')}
            </Text>
            <Text variant="caption" style={styles.recommendationBody}>
              {t('market.recommendationBody')}
            </Text>
          </Card>
        )}
        </GuideTarget>

        {latest ? (
          <Text variant="micro" style={styles.sourceLine}>
            {t('market.sourceLabel', { source: latest.source })}
          </Text>
        ) : (
          <EmptyState icon="market" title={t('market.emptyTitle')} testID="market-empty" />
        )}
      </ScrollView>
    </Screen>
  );
}

/** "21 Aug" — enough to judge how fresh a price is. */
function formatDate(iso: string): string {
  const date = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

/**
 * A bar per recorded observation, oldest on the left.
 *
 * Deliberately plots only the dates that were actually recorded — it does not
 * interpolate across the gaps AGMARKNET leaves on holidays, because a smooth
 * line would imply prices nobody ever saw.
 */
function Sparkline({ prices }: { prices: { id: string; modal_price: number }[] }) {
  const series = [...prices].reverse().slice(-14);
  const values = series.map((row) => row.modal_price);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;

  return (
    <View style={styles.sparkline} testID="price-trend">
      {series.map((row) => (
        <View
          key={row.id}
          style={[styles.sparkBar, { height: 6 + ((row.modal_price - min) / span) * 26 }]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: layout.screenPadding,
    paddingBottom: 96,
    gap: layout.cardGap,
  },
  priceRow: { flexDirection: 'row', gap: 16 },
  priceCell: { flex: 1 },
  value: { marginTop: 2 },
  provenance: { marginTop: 10, gap: 2 },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 14 },
  trendSlot: { height: 40, justifyContent: 'center' },
  sparkline: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 34 },
  sparkBar: { flex: 1, backgroundColor: colors.primary, minWidth: 3 },
  recommendationBody: { marginTop: 8 },
  demoCard: { borderColor: colors.demo.border },
  demoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  demoVerdict: { marginTop: 6, marginBottom: 4 },
  sourceLine: { paddingHorizontal: 2 },
});
