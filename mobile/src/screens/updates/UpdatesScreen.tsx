import { ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import {
  Card,
  EmptyState,
  IconBadge,
  type IconBadgeTone,
  SampleBanner,
  Screen,
  ScreenHeader,
  Text,
  type IconName,
} from '@/components/ui';
import { UPDATES } from '@/features/updates/demoUpdates';
import type { AgriUpdate, UpdateCategory } from '@/features/updates/types';
import { localize } from '@/utils/localizedText';
import { colors, layout } from '@/theme';

type Props = {
  onBack: () => void;
  onOpenUpdate: (updateId: string) => void;
};

const CATEGORY_ICONS: Record<UpdateCategory, IconName> = {
  agriculture: 'plant',
  weather: 'sun',
  government: 'help',
  market: 'market',
  technology: 'flask',
};

/** Restrained — three tones shared across five categories, not a rainbow. */
const CATEGORY_TONES: Record<UpdateCategory, IconBadgeTone> = {
  agriculture: 'primary',
  weather: 'accent',
  government: 'harvest',
  market: 'primary',
  technology: 'accent',
};

function relativeDate(daysAgo: number, t: (key: string, opts?: Record<string, unknown>) => string): string {
  if (daysAgo <= 0) return t('updates.today');
  if (daysAgo === 1) return t('updates.yesterday');
  return t('updates.daysAgo', { count: daysAgo });
}

/**
 * Krishi Updates — local demo feed (see `features/updates/demoUpdates.ts`).
 * A real version aggregates verified sources server-side; this screen only
 * ever reads the `AgriUpdate` shape, so nothing here changes when that
 * happens.
 */
export function UpdatesScreen({ onBack, onOpenUpdate }: Props) {
  const { t, i18n } = useTranslation();

  const renderUpdate = (update: AgriUpdate) => (
    <Card
      key={update.id}
      onPress={() => onOpenUpdate(update.id)}
      style={styles.updateCard}
      testID={`update-card-${update.id}`}
    >
      <View style={styles.updateHeader}>
        <IconBadge icon={CATEGORY_ICONS[update.category]} tone={CATEGORY_TONES[update.category]} size={32} iconSize={16} />
        <View style={styles.updateHeaderBody}>
          <Text variant="bodyMedium" numberOfLines={2}>{localize(update.title, i18n.language)}</Text>
          <Text variant="caption" color={colors.text.muted}>
            {t(`updates.categories.${update.category}`)} · {relativeDate(update.publishedDaysAgo, t)}
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
      <ScreenHeader title={t('updates.title')} onBack={onBack} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text variant="caption">{t('updates.intro')}</Text>
        <SampleBanner />

        {UPDATES.length === 0 ? (
          <EmptyState icon="clock" title={t('updates.emptyTitle')} testID="updates-empty" />
        ) : (
          UPDATES.map(renderUpdate)
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
  updateCard: { gap: 6 },
  updateHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  updateHeaderBody: { flex: 1, minWidth: 0, gap: 2 },
  summary: { marginTop: 2 },
});
