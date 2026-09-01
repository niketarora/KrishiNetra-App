import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Screen, ScreenHeader, Text } from '@/components/ui';
import { TutorialFlashcardPager } from '@/components/learning/TutorialFlashcardPager';
import { getTutorial, localize } from '@/features/learning/tutorials';
import { layout, colors } from '@/theme';

type Props = {
  tutorialId: string;
  onBack: () => void;
  onComplete: () => void;
};

/**
 * Screen that presents tutorial steps as interactive flashcards.
 *
 * This provides an alternative, more focused way to digest tutorial content
 * compared to the standard list view in TutorialDetailScreen.
 */
export function TutorialFlashcardScreen({ tutorialId, onBack, onComplete }: Props) {
  const { t, i18n } = useTranslation();
  const tutorial = getTutorial(tutorialId);

  if (!tutorial) {
    return null;
  }

  const language = i18n.language;

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
          onComplete={onComplete}
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
