import { Linking, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Badge, Button, Card, EmptyState, Screen, ScreenHeader, Text } from '@/components/ui';
import { getUpdate } from '@/features/updates/demoUpdates';
import { getCachedUpdate } from '@/features/updates/updatesCache';
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

function relativeIsoDate(iso: string, t: (key: string, opts?: Record<string, unknown>) => string): string {
  const published = new Date(iso).getTime();
  if (Number.isNaN(published)) return '';
  const daysAgo = Math.max(0, Math.floor((Date.now() - published) / (24 * 3600 * 1000)));
  return relativeDate(daysAgo, t);
}

/**
 * Reached by id from `UpdatesScreen` (`UpdateDetail: { updateId: string }`).
 * Real updates are not enumerable the way the static demo array is, so this
 * checks `updatesCache` (populated by the feed the farmer just scrolled)
 * first, falling back to the local demo array only for a demo-mode id — see
 * `features/updates/updatesCache.ts`'s file comment for why the navigation
 * param shape did not need to change for this.
 */
export function UpdateDetailScreen({ updateId, onBack }: Props) {
  const { t, i18n } = useTranslation();

  const realUpdate = getCachedUpdate(updateId);
  if (realUpdate) {
    const isOfficial = realUpdate.source.type === 'official';

    return (
      <Screen>
        <ScreenHeader title={realUpdate.title} onBack={onBack} />

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.metaRow}>
            <Badge label={t(`updates.categories.${realUpdate.category}`)} tone="accent" />
            <Badge
              label={isOfficial ? t('updates.officialSourceBadge') : t('updates.regionalNews')}
              tone={isOfficial ? 'success' : 'neutral'}
            />
          </View>
          <Text variant="caption" color={colors.text.muted}>
            {realUpdate.source.name} · {relativeIsoDate(realUpdate.publishedAt, t)}
          </Text>

          {realUpdate.summary ? (
            <Card>
              <Text variant="body">{realUpdate.summary}</Text>
            </Card>
          ) : null}

          {realUpdate.relevance.reasons.length > 0 ? (
            <Card tone="accent">
              <Text variant="bodyMedium" color={colors.accent}>
                {t('updates.whyRelevant')}
              </Text>
              {realUpdate.relevance.reasons.map((reason) => (
                <Text key={reason} variant="caption" style={styles.reasonLine}>
                  {reason}
                </Text>
              ))}
            </Card>
          ) : null}

          <Button
            label={t('updates.readSource')}
            onPress={() => void Linking.openURL(realUpdate.sourceUrl)}
            variant="secondary"
            testID="update-official-source"
          />
        </ScrollView>
      </Screen>
    );
  }

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
  reasonLine: { marginTop: 4 },
});
