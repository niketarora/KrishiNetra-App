import React, { useState } from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button, Card, Icon, Text } from '@/components/ui';
import { localize, type LocalizedText } from '@/features/learning/tutorials';
import { colors, layout, radius } from '@/theme';

const { width } = Dimensions.get('window');

type Props = {
  steps: LocalizedText[];
  onComplete: () => void;
};

/**
 * An interactive way to view tutorial steps one by one.
 *
 * This component handles the state of which step is currently being viewed.
 * It uses the existing `Card` and `Button` components from the design system
 * to maintain visual consistency.
 */
export function TutorialFlashcardPager({ steps, onComplete }: Props) {
  const { i18n, t } = useTranslation();
  const [index, setIndex] = useState(0);
  const language = i18n.language;

  const handleNext = () => {
    if (index < steps.length - 1) {
      setIndex(index + 1);
    } else {
      onComplete();
    }
  };

  const handlePrev = () => {
    if (index > 0) {
      setIndex(index - 1);
    }
  };

  const progress = (index + 1) / steps.length;

  return (
    <View style={styles.container}>
      <Card style={styles.flashcard}>
        <View style={styles.header}>
          <Text variant="microMedium" color={colors.text.muted}>
            {t('learning.stepCount', { current: index + 1, total: steps.length })}
          </Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
          </View>
        </View>

        <View style={styles.body}>
          <Text variant="bodyLarge" style={styles.stepText}>
            {localize(steps[index], language)}
          </Text>
        </View>

        <View style={styles.footer}>
          <Button
            variant="secondary"
            icon="chevron"
            onPress={handlePrev}
            disabled={index === 0}
            style={styles.navButton}
            accessibilityLabel={t('common.back')}
          />

          <View style={styles.dots}>
            {steps.map((_, i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  i === index && styles.dotActive,
                ]}
              />
            ))}
          </View>

          <Button
            variant={index === steps.length - 1 ? 'primary' : 'secondary'}
            icon={index === steps.length - 1 ? 'check' : 'chevron'}
            onPress={handleNext}
            style={[
              styles.navButton,
              index < steps.length - 1 && styles.nextButton,
            ]}
            accessibilityLabel={index === steps.length - 1 ? t('learning.completed') : t('common.continue')}
          />
        </View>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 8,
  },
  flashcard: {
    minHeight: 280,
    justifyContent: 'space-between',
    padding: 24,
  },
  header: {
    alignItems: 'center',
    gap: 12,
  },
  progressTrack: {
    height: 4,
    width: '100%',
    backgroundColor: colors.neutralBg,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
  },
  body: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 24,
  },
  stepText: {
    textAlign: 'center',
    lineHeight: 28,
    fontSize: 20,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  navButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    paddingHorizontal: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextButton: {
    transform: [{ rotate: '180deg' }],
  },
  dots: {
    flexDirection: 'row',
    gap: 8,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.border,
  },
  dotActive: {
    backgroundColor: colors.primary,
    width: 12,
  },
});
