import { ScrollView, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AvatarFab } from '@/components/avatar/AvatarFab';
import { EmptyState, Screen, ScreenHeader } from '@/components/ui';
import { layout } from '@/theme';

/**
 * design.md §4.11 in its empty state — which is also its correct state for a
 * brand-new field, so this screen is complete rather than stubbed. The
 * timeline rows appear once analyses start being recorded in a later phase.
 */
export function HistoryScreen() {
  const { t } = useTranslation();

  return (
    <Screen>
      <ScreenHeader title={t('history.title')} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <EmptyState icon="clock" title={t('history.emptyTitle')} testID="history-empty" />
      </ScrollView>

      <AvatarFab />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: layout.screenPadding, paddingBottom: 96, paddingTop: 40 },
});
