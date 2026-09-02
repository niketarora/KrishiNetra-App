import { ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Badge, Banner, Button, Card, EmptyState, Screen, ScreenHeader, Text } from '@/components/ui';
import { VideoPreview } from '@/components/learning/VideoPreview';
import { useAuth } from '@/features/auth/AuthContext';
import { getCategory, getTutorial, localize } from '@/features/learning/tutorials';
import { useLearningProgress } from '@/features/learning/useLearningProgress';
import { colors, layout } from '@/theme';

type Props = {
  tutorialId: string;
  onBack: () => void;
  onOpenAr: (tutorialId: string) => void;
  onOpenFlashcards?: (tutorialId: string) => void;
};

/**
 * One tutorial, read top to bottom: an optional video, why it matters,
 * steps, tips, a common mistake to avoid (styled as a warning banner, the
 * semantics `Banner` already carries elsewhere), and an optional "Try AR
 * guidance" entry. Every section but the video/AR ones always renders
 * regardless of whether this tutorial has either — most tutorials have
 * neither, and that must keep working exactly as before.
 */
export function TutorialDetailScreen({ tutorialId, onBack, onOpenAr, onOpenFlashcards }: Props) {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { isComplete, markComplete } = useLearningProgress(user?.id ?? null);

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

  const category = getCategory(tutorial.categoryId);
  const complete = isComplete(tutorial.id);
  const language = i18n.language;

  return (
    <Screen>
      <ScreenHeader title={localize(tutorial.title, language)} onBack={onBack} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {tutorial.video ? <VideoPreview video={tutorial.video} /> : null}

        {category ? <Badge label={localize(category.label, language)} tone="accent" /> : null}

        {/* "Why it matters" reads as introductory motivation, not a data
            field, so it gets the soft agricultural-green tint the rest of
            the app reserves for important context rather than a plain white
            bordered box. */}
        <Card tone="success">
          <Text variant="caption" color={colors.primaryDark}>{t('learning.whyItMatters')}</Text>
          <Text variant="body" color={colors.primaryDark} style={styles.sectionBody}>
            {localize(tutorial.why, language)}
          </Text>
        </Card>

        <Card>
          <Text variant="caption" style={styles.sectionTitle}>
            {t('learning.steps')}
          </Text>
          {tutorial.steps.map((step, index) => (
            <View key={index} style={styles.listRow}>
              <View style={styles.stepNumber}>
                <Text variant="microMedium" color={colors.text.onPrimary}>
                  {index + 1}
                </Text>
              </View>
              <Text variant="body" style={styles.listText}>
                {localize(step, language)}
              </Text>
            </View>
          ))}
        </Card>

        {onOpenFlashcards ? (
          <Button
            label={t('learning.studyFlashcards')}
            onPress={() => onOpenFlashcards(tutorial.id)}
            variant="secondary"
            icon="book"
            testID="study-flashcards"
          />
        ) : null}

        <Card>
          <Text variant="caption" style={styles.sectionTitle}>
            {t('learning.tips')}
          </Text>
          {tutorial.tips.map((tip, index) => (
            <View key={index} style={styles.listRow}>
              <Text variant="bodyMedium" color={colors.text.secondary}>
                {'•'}
              </Text>
              <Text variant="body" style={styles.listText}>
                {localize(tip, language)}
              </Text>
            </View>
          ))}
        </Card>

        {tutorial.commonMistake ? (
          <Banner
            title={t('learning.commonMistake')}
            detail={localize(tutorial.commonMistake, language)}
            tone="warning"
          />
        ) : null}

        {tutorial.hasArGuide ? (
          <View style={styles.arBlock}>
            <Button
              label={t('learning.tryArGuidance')}
              onPress={() => onOpenAr(tutorial.id)}
              variant="secondary"
              icon="camera"
              testID="try-ar-guidance"
            />
            <Text variant="micro" color={colors.text.muted} style={styles.arHint}>
              {t('learning.arHint')}
            </Text>
          </View>
        ) : null}

        {complete ? (
          <Badge label={t('learning.completed')} tone="success" />
        ) : (
          <Button
            label={t('learning.markComplete')}
            onPress={() => void markComplete(tutorial.id)}
            testID="mark-complete"
          />
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
  sectionTitle: { marginBottom: 8 },
  sectionBody: { marginTop: 6 },
  listRow: { flexDirection: 'row', gap: 10, marginTop: 8 },
  stepNumber: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    marginTop: 1,
  },
  listText: { flex: 1 },
  arBlock: { gap: 6 },
  arHint: { fontStyle: 'italic' },
});
