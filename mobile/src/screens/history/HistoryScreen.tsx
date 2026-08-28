import { ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AvatarFab } from '@/components/avatar/AvatarFab';
import { Card, EmptyState, SampleBadge, SampleBanner, Screen, ScreenHeader, Text } from '@/components/ui';
import { isDemoMode, sampleDate, SAMPLE_HISTORY } from '@/features/demo/demoMode';
import { colors, layout } from '@/theme';

/**
 * design.md §4.11.
 *
 * The empty state is the correct state: nothing records a history entry until
 * Phase 4 tracks lots, offers and transactions. So this screen is complete
 * rather than stubbed.
 *
 * Under DEMO_MODE it shows a sample timeline instead — every row in the
 * off-palette violet, badged, under a banner saying the entries are made up.
 * That is the whole difference between illustrating a feature and claiming it
 * exists.
 */
export function HistoryScreen() {
  const { t } = useTranslation();
  const demo = isDemoMode();

  return (
    <Screen>
      <ScreenHeader title={t('history.title')} />

      <ScrollView
        contentContainerStyle={[styles.content, demo && styles.contentDemo]}
        showsVerticalScrollIndicator={false}
      >
        {demo ? (
          <>
            <SampleBanner />

            {SAMPLE_HISTORY.map((entry) => (
              <Card key={entry.id} style={styles.entry}>
                <View style={styles.entryHeader}>
                  <Text variant="bodyMedium" color={colors.demo.fg}>
                    {t(entry.titleKey)}
                  </Text>
                  <SampleBadge testID={`sample-badge-${entry.id}`} />
                </View>

                <Text variant="caption" color={colors.demo.fg}>
                  {t(entry.detailKey)}
                </Text>
                <Text variant="micro" color={colors.demo.fg} style={styles.entryDate}>
                  {sampleDate(entry.daysAgo).toLocaleDateString(undefined, {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </Text>
              </Card>
            ))}
          </>
        ) : (
          <EmptyState icon="clock" title={t('history.emptyTitle')} testID="history-empty" />
        )}
      </ScrollView>

      <AvatarFab />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: layout.screenPadding, paddingBottom: 96, paddingTop: 40 },
  contentDemo: { paddingTop: 16, gap: layout.cardGap },
  entry: { borderColor: colors.demo.border },
  entryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 4,
  },
  entryDate: { marginTop: 6 },
});
