import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { EmptyState, Screen, ScreenHeader, Text } from '@/components/ui';
import { TutorialFlashcardPager } from '@/components/learning/TutorialFlashcardPager';
import { useAuth } from '@/features/auth/AuthContext';
import { getTutorial, localize } from '@/features/learning/tutorials';
import { useLearningProgress } from '@/features/learning/useLearningProgress';
import { colors, layout } from '@/theme';

type Props = {
  tutorialId: string;
  onBack: () => void;
  onComplete?: () => void;
};

/**
 * Screen that presents tutorial steps as interactive flashcards.
 *
 * This provides an alternative, more focused way to digest tutorial content
 * compared to the standard list view in TutorialDetailScreen.
 */
export function TutorialFlashcardScreen({ tutorialId, onBack, onComplete }: Props) {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { markComplete } = useLearningProgress(user?.id ?? null);

  const tutorial = getTutorial(tutorialId);

  if (!tutorial) {
    return (
      <Screen>
        <ScreenHeader title={t('learning.title')} onBack={onBack} />
        <EmptyState
          icon="book"
          title={t('learning.notFoundTitle')}
          body={t('learning.notFoundBody')}
          testID="tutorial-not-found"
        />
      </Screen>
    );
  }

  const language = i18n.language;

  const handleComplete = () => {
    void markComplete(tutorial.id);
    if (onComplete) {
      onComplete();
    } else {
      onBack();
    }
  };

  return (
    <Screen>
      <ScreenHeader
        title={localize(tutorial.title, language)}
        onBack={onBack}
      />

      <View style={styles.content}>
        <View style={styles.intro}>
          <Text variant="caption" color={colors.text.muted}>
            {t('learning.flashcardIntro')}
          </Text>
        </View>

        <TutorialFlashcardPager
          steps={tutorial.steps}
          onComplete={handleComplete}
        />

        <View style={styles.footer}>
          <Text variant="micro" color={colors.text.muted} style={styles.footerText}>
            {t('learning.flashcardHint')}
          </Text>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    paddingHorizontal: layout.screenPadding,
    justifyContent: 'center',
    paddingBottom: 60,
  },
  intro: {
    alignItems: 'center',
    marginBottom: 24,
  },
  footer: {
    marginTop: 24,
    alignItems: 'center',
  },
  footerText: {
    textAlign: 'center',
    fontStyle: 'italic',
  },
});

