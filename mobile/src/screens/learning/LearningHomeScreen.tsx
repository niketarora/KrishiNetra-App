import { ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Badge, Card, EmptyState, Icon, Screen, ScreenHeader, Skeleton, Text } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthContext';
import { localize, TUTORIALS, TUTORIAL_CATEGORIES, type Tutorial } from '@/features/learning/tutorials';
import { useLearningProgress } from '@/features/learning/useLearningProgress';
import { colors, layout } from '@/theme';

type Props = {
  onBack: () => void;
  onOpenTutorial: (tutorialId: string) => void;
};

/**
 * Krishi Academy home — Feature #14, v1.
 *
 * Content is entirely local and static (see `features/learning/tutorials.ts`)
 * and category/tutorial collapse 1:1 for this version, so each card carries
 * both its category and its tutorial in one row. Personalisation (recommending
 * by crop, season, region) is deliberately not implemented here — see the
 * `metadata` field on `Tutorial`, which exists only so a later phase can add
 * it without changing this screen's data shape.
 *
 * This screen never calls a navigation hook directly — like every other
 * screen in the app, it only takes navigation callbacks as props, which is
 * what lets it render in a test with no `NavigationContainer`. Refreshing
 * progress after a tutorial is completed and the farmer comes back is instead
 * handled by remounting this screen on focus, in `MainNavigator.tsx`.
 */
export function LearningHomeScreen({ onBack, onOpenTutorial }: Props) {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { loading, completedCount, isComplete } = useLearningProgress(user?.id ?? null);

  const total = TUTORIALS.length;

  const categoryLabel = (tutorial: Tutorial) => {
    const category = TUTORIAL_CATEGORIES.find((c) => c.id === tutorial.categoryId);
    return category ? localize(category.label, i18n.language) : '';
  };

  const categoryIcon = (tutorial: Tutorial) =>
    TUTORIAL_CATEGORIES.find((c) => c.id === tutorial.categoryId)?.icon ?? 'book';

  const progressRatio = total > 0 ? completedCount / total : 0;

  return (
    <Screen>
      <ScreenHeader title={t('learning.title')} onBack={onBack} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text variant="caption">{t('learning.intro')}</Text>

        {loading ? (
          <Skeleton height={80} />
        ) : total > 0 ? (
          <View style={styles.progressBlock} testID="learning-progress">
            <Text variant="bodyMedium">
              {t('learning.progress', { completed: completedCount, total })}
            </Text>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${Math.round(progressRatio * 100)}%` }]} />
            </View>
          </View>
        ) : null}

        {loading ? null : total === 0 ? (
          <EmptyState
            icon="book"
            title={t('learning.emptyTitle')}
            body={t('learning.emptyBody')}
            testID="learning-empty"
          />
        ) : (
          TUTORIALS.map((tutorial) => {
            const complete = isComplete(tutorial.id);
            return (
              <Card
                key={tutorial.id}
                onPress={() => onOpenTutorial(tutorial.id)}
                style={styles.tutorialCard}
                testID={`tutorial-card-${tutorial.id}`}
              >
                <Icon name={categoryIcon(tutorial)} size={20} color={colors.text.secondary} />
                <View style={styles.tutorialBody}>
                  <Text variant="caption">{categoryLabel(tutorial)}</Text>
                  <Text variant="cardTitle" numberOfLines={2}>
                    {localize(tutorial.title, i18n.language)}
                  </Text>
                </View>
                {complete ? <Badge label={t('learning.completed')} tone="success" /> : null}
                <Icon name="chevron" size={18} color={colors.text.muted} />
              </Card>
            );
          })
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
  progressBlock: { gap: 6 },
  progressTrack: {
    height: 6,
    backgroundColor: colors.neutralBg,
    overflow: 'hidden',
  },
  progressFill: {
    height: 6,
    backgroundColor: colors.primary,
  },
  tutorialCard: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  tutorialBody: { flex: 1, minWidth: 0, gap: 2 },
});
