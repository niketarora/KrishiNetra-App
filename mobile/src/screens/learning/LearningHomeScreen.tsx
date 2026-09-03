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
import { colors, fonts, layout, radius } from '@/theme';

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
      <ScreenHeader
        title={t('learning.title')}
        subtitle="Learn better farming, one step at a time."
        onBack={onBack}
        right={
          <View style={styles.headerIconBtn}>
            <Icon name="bookmark" size={20} color={colors.text.primary} />
          </View>
        }
      />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text variant="caption" color={colors.text.muted}>{t('learning.tagline')}</Text>

        {loading ? (
          <Skeleton height={80} />
        ) : total > 0 ? (
          <Card style={styles.progressCard} testID="learning-progress">
            <IconBadge icon="book" tone="primary" size={40} iconSize={20} />
            <View style={styles.progressTextCol}>
              <Text variant="caption" color={colors.text.muted}>
                {t('learning.yourProgress', { defaultValue: 'Your progress' })}
              </Text>
              <Text variant="bodyMedium" style={styles.progressTitle}>
                {t('learning.progress', { completed: completedCount, total })}
              </Text>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${Math.round(progressRatio * 100)}%` }]} />
              </View>
            </View>
            <View style={styles.percentPill}>
              <Text variant="microMedium" color={colors.primaryDark}>
                {`${Math.round(progressRatio * 100)}%`}
              </Text>
            </View>
          </Card>
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
                <Card tone="success" onPress={() => onOpenTutorial(featured.id)} style={styles.featuredCard} testID={`tutorial-card-${featured.id}`}>
                  <View style={styles.featuredHeader}>
                    <Badge label={categoryLabel(featured)} tone="orange" />
                    {isComplete(featured.id) ? <Badge label={t('learning.completed')} tone="success" /> : null}
                  </View>
                  <Text variant="cardTitle" style={styles.featuredTitle}>{localize(featured.title, i18n.language)}</Text>
                  <View style={styles.featuredFooter}>
                    <Text variant="caption" color={colors.text.secondary}>
                      {metaLine(featured)}
                    </Text>
                    <View style={styles.playBtnCircle}>
                      <Icon name="play" size={16} color="#FFFFFF" strokeWidth={2.2} />
                    </View>
                  </View>
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
    paddingBottom: 110,
    gap: layout.cardGap,
  },
  headerIconBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 16,
  },
  progressTextCol: {
    flex: 1,
    gap: 4,
  },
  progressTitle: {
    fontFamily: fonts.semibold,
  },
  percentPill: {
    backgroundColor: colors.successBg,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.pill,
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
  featuredCard: {
    gap: 8,
    padding: 16,
    borderRadius: 16,
  },
  featuredHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  featuredTitle: {
    fontFamily: fonts.semibold,
    fontSize: 18,
    lineHeight: 24,
  },
  featuredFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  playBtnCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    shadowColor: '#1E4D2B',
    shadowOpacity: 0.3,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
  },
  tutorialCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 16,
  },
  tutorialBody: { flex: 1, minWidth: 0, gap: 2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
});
