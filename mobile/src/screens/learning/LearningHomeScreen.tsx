import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Badge, Card, EmptyState, Icon, IconBadge, Screen, ScreenHeader, Skeleton, Text } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthContext';
import { useFarm } from '@/features/farm/FarmContext';
import { recommendTutorials } from '@/features/learning/recommendations';
import { localize, TUTORIALS, TUTORIAL_CATEGORIES, type Tutorial } from '@/features/learning/tutorials';
import { useLearningProgress } from '@/features/learning/useLearningProgress';
import { getCurrentCrop, type CurrentCrop } from '@/services/agronomy';
import { colors, layout, radius } from '@/theme';

type Props = {
  onBack: () => void;
  onOpenTutorial: (tutorialId: string) => void;
};

/**
 * Krishi Academy home — Feature #14, v2.
 *
 * Content is entirely local and static (see `features/learning/tutorials.ts`)
 * and category/tutorial collapse 1:1 for this version, so each card carries
 * both its category and its tutorial in one row. "Recommended for you" is a
 * transparent match against the farmer's real registered crop
 * (`recommendTutorials`), not a recommendation engine — see that module's
 * file comment.
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
  const { farm } = useFarm();
  const { loading, completedCount, isComplete } = useLearningProgress(user?.id ?? null);
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

  const total = TUTORIALS.length;
  const featured = TUTORIALS.find((tutorial) => tutorial.featured) ?? null;
  const recommended = recommendTutorials(crop?.crop.code ?? null).filter(
    (tutorial) => tutorial.id !== featured?.id,
  );

  const categoryLabel = (tutorial: Tutorial) => {
    const category = TUTORIAL_CATEGORIES.find((c) => c.id === tutorial.categoryId);
    return category ? localize(category.label, i18n.language) : '';
  };

  const categoryIcon = (tutorial: Tutorial) =>
    TUTORIAL_CATEGORIES.find((c) => c.id === tutorial.categoryId)?.icon ?? 'book';

  const progressRatio = total > 0 ? completedCount / total : 0;

  const metaLine = (tutorial: Tutorial) =>
    t('learning.durationAndDifficulty', {
      duration: t('learning.durationMinutes', { count: tutorial.durationMinutes }),
      difficulty: t(`learning.difficulty.${tutorial.difficulty}`),
    });

  const renderTutorialCard = (tutorial: Tutorial, testIdPrefix = 'tutorial-card') => {
    const complete = isComplete(tutorial.id);
    return (
      <Card
        key={tutorial.id}
        onPress={() => onOpenTutorial(tutorial.id)}
        style={styles.tutorialCard}
        testID={`${testIdPrefix}-${tutorial.id}`}
      >
        <IconBadge icon={categoryIcon(tutorial)} tone="primary" />
        <View style={styles.tutorialBody}>
          <Text variant="caption">{categoryLabel(tutorial)}</Text>
          <Text variant="cardTitle" numberOfLines={2}>
            {localize(tutorial.title, i18n.language)}
          </Text>
          <View style={styles.metaRow}>
            <Text variant="micro" color={colors.text.muted}>
              {metaLine(tutorial)}
            </Text>
            {tutorial.video ? <Icon name="play" size={13} color={colors.text.muted} /> : null}
          </View>
        </View>
        {complete ? <Badge label={t('learning.completed')} tone="success" /> : null}
        <Icon name="chevron" size={18} color={colors.text.muted} />
      </Card>
    );
  };

  return (
    <Screen>
      <ScreenHeader title={t('learning.title')} onBack={onBack} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text variant="caption">{t('learning.tagline')}</Text>

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
          <>
            {featured ? (
              <View style={styles.section}>
                <Text variant="cardTitle">{t('learning.featured')}</Text>
                <Card tone="harvest" onPress={() => onOpenTutorial(featured.id)} style={styles.featuredCard} testID={`tutorial-card-${featured.id}`}>
                  <View style={styles.featuredHeader}>
                    <IconBadge icon={categoryIcon(featured)} tone="harvest" size={40} iconSize={20} />
                    {isComplete(featured.id) ? <Badge label={t('learning.completed')} tone="success" /> : null}
                  </View>
                  <Text variant="caption" color={colors.harvest}>
                    {categoryLabel(featured)}
                  </Text>
                  <Text variant="cardTitle">{localize(featured.title, i18n.language)}</Text>
                  <Text variant="caption" color={colors.text.secondary}>
                    {metaLine(featured)}
                  </Text>
                </Card>
              </View>
            ) : null}

            {recommended.length > 0 ? (
              <View style={styles.section}>
                <Text variant="cardTitle">{t('learning.recommended')}</Text>
                {recommended.map((tutorial) => renderTutorialCard(tutorial, 'recommended-card'))}
              </View>
            ) : null}

            <View style={styles.section}>
              <Text variant="cardTitle">{t('learning.categories')}</Text>
              {TUTORIALS.filter((tutorial) => tutorial.id !== featured?.id).map((tutorial) =>
                renderTutorialCard(tutorial),
              )}
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
  progressBlock: { gap: 6 },
  progressTrack: {
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.neutralBg,
    overflow: 'hidden',
  },
  progressFill: {
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  section: { gap: layout.cardGap },
  featuredCard: { gap: 4 },
  featuredHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tutorialCard: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  tutorialBody: { flex: 1, minWidth: 0, gap: 2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
});
