import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Card, EmptyState, Icon, IconBadge, SampleBanner, Screen, ScreenHeader, Text, type IconName } from '@/components/ui';
import { matchSchemes } from '@/features/schemes/matching';
import { SCHEMES } from '@/features/schemes/demoSchemes';
import type { GovernmentScheme, SchemeCategory } from '@/features/schemes/types';
import { localize } from '@/utils/localizedText';
import { useFarm } from '@/features/farm/FarmContext';
import { getCurrentCrop, type CurrentCrop } from '@/services/agronomy';
import { colors, layout } from '@/theme';

type Props = {
  onBack: () => void;
  onOpenScheme: (schemeId: string) => void;
};

const CATEGORY_ICONS: Record<SchemeCategory, IconName> = {
  incomeSupport: 'market',
  insurance: 'alert',
  soilHealth: 'field',
  credit: 'check',
  irrigation: 'droplet',
  other: 'help',
};

/**
 * Government Schemes — local demo directory (see
 * `features/schemes/demoSchemes.ts`). Schemes are shown regardless of
 * whether a farm is registered — they're public information — but the
 * personalised "may be relevant" framing only applies once there's a real
 * farm to match against, via `matchSchemes`.
 */
export function SchemesScreen({ onBack, onOpenScheme }: Props) {
  const { t, i18n } = useTranslation();
  const { farm } = useFarm();
  const [crop, setCrop] = useState<CurrentCrop | null>(null);

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

  const eligibility = matchSchemes(SCHEMES, farm, crop?.crop.code ?? null);
  const recommended = farm
    ? SCHEMES.filter((scheme) =>
        eligibility.find((e) => e.schemeId === scheme.id)?.status === 'mayBeEligible',
      )
    : [];
  const others = farm ? SCHEMES.filter((scheme) => !recommended.includes(scheme)) : SCHEMES;

  const renderScheme = (scheme: GovernmentScheme, showReason = false) => {
    const reasonKey = eligibility.find((e) => e.schemeId === scheme.id)?.reasonKey;
    return (
      <Card
        key={scheme.id}
        onPress={() => onOpenScheme(scheme.id)}
        style={styles.schemeCard}
        testID={`scheme-card-${scheme.id}`}
      >
        <IconBadge icon={CATEGORY_ICONS[scheme.category]} tone="harvest" />
        <View style={styles.schemeBody}>
          <Text variant="bodyMedium">{localize(scheme.name, i18n.language)}</Text>
          <Text variant="caption" color={colors.text.muted}>
            {localize(scheme.summary, i18n.language)}
          </Text>
          {showReason && reasonKey ? (
            <Text variant="micro" color={colors.accent}>
              {t(reasonKey)}
            </Text>
          ) : null}
        </View>
        <Icon name="chevron" size={18} color={colors.text.muted} />
      </Card>
    );
  };

  return (
    <Screen>
      <ScreenHeader title={t('schemes.title')} onBack={onBack} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text variant="caption">{t('schemes.intro')}</Text>
        <SampleBanner />

        {SCHEMES.length === 0 ? (
          <EmptyState icon="help" title={t('schemes.emptyTitle')} testID="schemes-empty" />
        ) : (
          <>
            {farm ? (
              <Text variant="bodyMedium" style={styles.matchSummary}>
                {t('schemes.matchSummary', { count: recommended.length })}
              </Text>
            ) : (
              <Text variant="caption" color={colors.text.muted} style={styles.matchSummary}>
                {t('schemes.noFarmHint')}
              </Text>
            )}

            {recommended.length > 0 ? (
              <View style={styles.section}>
                <View style={styles.sectionHeadingRow}>
                  <Icon name="check" size={16} color={colors.primary} strokeWidth={2.2} />
                  <Text variant="cardTitle">{t('schemes.recommended')}</Text>
                </View>
                {recommended.map((scheme) => renderScheme(scheme, true))}
              </View>
            ) : null}

            <View style={styles.section}>
              <Text variant="cardTitle">{t('schemes.otherSchemes')}</Text>
              {others.map((scheme) => renderScheme(scheme))}
            </View>
          </>
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
  matchSummary: { marginTop: 2 },
  section: { gap: layout.cardGap },
  sectionHeadingRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  schemeCard: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  schemeBody: { flex: 1, minWidth: 0, gap: 2 },
});
