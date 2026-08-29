import { Linking, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Badge, Button, Card, EmptyState, Screen, ScreenHeader, Text } from '@/components/ui';
import { getUpdate } from '@/features/updates/demoUpdates';
import { localize } from '@/utils/localizedText';
import { colors, layout } from '@/theme';

type Props = {
  updateId: string;
  onBack: () => void;
};

function relativeDate(daysAgo: number, t: (key: string, opts?: Record<string, unknown>) => string): string {
  if (daysAgo <= 0) return t('updates.today');
  if (daysAgo === 1) return t('updates.yesterday');
  return t('updates.daysAgo', { count: daysAgo });
}

export function UpdateDetailScreen({ updateId, onBack }: Props) {
  const { t, i18n } = useTranslation();
  const update = getUpdate(updateId);

  if (!update) {
    return (
      <Screen>
        <ScreenHeader title={t('updates.title')} onBack={onBack} />
        <EmptyState
          icon="clock"
          title={t('updates.notFoundTitle')}
          body={t('updates.notFoundBody')}
          testID="update-not-found"
        />
      </Screen>
    );
  }

  const language = i18n.language;

  return (
    <Screen>
      <ScreenHeader title={localize(update.title, language)} onBack={onBack} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.metaRow}>
          <Badge label={t(`updates.categories.${update.category}`)} tone="accent" />
          <Text variant="caption" color={colors.text.muted}>
            {relativeDate(update.publishedDaysAgo, t)} · {update.source}
          </Text>
        </View>

        <Card>
          <Text variant="body">{localize(update.summary, language)}</Text>
        </Card>

        <Card>
          <Text variant="body">{localize(update.body, language)}</Text>
        </Card>

        {update.relatedTopic ? (
          <Badge label={update.relatedTopic} tone="neutral" />
        ) : null}

        {update.sourceUrl ? (
          <Button
            label={t('updates.officialSource')}
            onPress={() => void Linking.openURL(update.sourceUrl!)}
            variant="secondary"
            testID="update-official-source"
          />
        ) : null}
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
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});
