import { ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Badge, Banner, Button, Card, EmptyState, Screen, ScreenHeader, Text } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthContext';
import { getCategory, getTutorial, localize } from '@/features/learning/tutorials';
import { useLearningProgress } from '@/features/learning/useLearningProgress';
import { colors, layout } from '@/theme';

type Props = {
  tutorialId: string;
  onBack: () => void;
};

/**
 * One tutorial, read top to bottom: why it matters, steps, tips, and — where
 * the content has one — a common mistake to avoid, styled as a warning
 * banner since that is exactly the semantics `Banner` already carries
 * elsewhere in the app.
 */
export function TutorialDetailScreen({ tutorialId, onBack }: Props) {
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
        {category ? <Badge label={localize(category.label, language)} tone="accent" /> : null}

        <Card>
          <Text variant="caption">{t('learning.whyItMatters')}</Text>
          <Text variant="body" style={styles.sectionBody}>
            {localize(tutorial.why, language)}
          </Text>
        </Card>

        <Card>
          <Text variant="caption" style={styles.sectionTitle}>
            {t('learning.steps')}
          </Text>
          {tutorial.steps.map((step, index) => (
            <View key={index} style={styles.listRow}>
              <Text variant="bodyMedium" color={colors.text.secondary}>
                {`${index + 1}.`}
              </Text>
              <Text variant="body" style={styles.listText}>
                {localize(step, language)}
              </Text>
            </View>
          ))}
        </Card>

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
  listRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  listText: { flex: 1 },
});
