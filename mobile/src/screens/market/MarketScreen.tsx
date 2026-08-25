import { ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AvatarFab } from '@/components/avatar/AvatarFab';
import { Card, EmptyState, Screen, ScreenHeader, Text } from '@/components/ui';
import { colors, layout } from '@/theme';

/**
 * design.md §4.10, in its empty state.
 *
 * The price card keeps its designed two-column shape so the screen reads as
 * the real thing once Phase 2 connects mandi data and Phase 3 connects the
 * price-prediction and selling-recommendation models. Until then it shows
 * dashes: TRD §23 is explicit that a failed or absent prediction must never be
 * replaced by a fabricated one.
 */
export function MarketScreen() {
  const { t } = useTranslation();

  return (
    <Screen>
      <ScreenHeader title={t('market.title')} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Card>
          <View style={styles.priceRow}>
            <View style={styles.priceCell}>
              <Text variant="caption">{t('market.currentPrice')}</Text>
              <Text variant="cardTitle" color={colors.text.muted} style={styles.value}>
                {t('common.notAvailable')}
              </Text>
              <Text variant="micro">{t('market.perQuintal')}</Text>
            </View>
            <View style={styles.priceCell}>
              <Text variant="caption">{t('market.msp')}</Text>
              <Text variant="cardTitle" color={colors.text.muted} style={styles.value}>
                {t('common.notAvailable')}
              </Text>
            </View>
          </View>

          <View style={styles.divider} />

          <Text variant="caption">{t('market.sevenDayTrend')}</Text>
          <View style={styles.trendSlot}>
            <Text variant="micro">{t('common.comingSoon')}</Text>
          </View>
        </Card>

        <Card tone="accent">
          <Text variant="bodyMedium" color={colors.accent}>
            {t('market.recommendation')}
          </Text>
          <Text variant="caption" style={styles.recommendationBody}>
            {t('market.emptyBody')}
          </Text>
        </Card>

        <EmptyState icon="market" title={t('market.emptyTitle')} testID="market-empty" />
      </ScrollView>

      <AvatarFab />
    </Screen>
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
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 14 },
  trendSlot: { height: 40, justifyContent: 'center' },
  recommendationBody: { marginTop: 8 },
});
