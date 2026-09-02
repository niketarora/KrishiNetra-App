import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Card, Icon, Text } from '@/components/ui';
import { localize, type LocalizedText } from '@/features/learning/tutorials';
import { colors, radius } from '@/theme';

type Props = {
  steps: LocalizedText[];
  onComplete: () => void;
};

/**
 * An interactive way to view tutorial steps one by one.
 *
 * This component handles the state of which step is currently being viewed.
 * It uses the existing `Card` component from the design system
 * to maintain visual consistency.
 */
export function TutorialFlashcardPager({ steps, onComplete }: Props) {
  const { i18n, t } = useTranslation();
  const [index, setIndex] = useState(0);
  const language = i18n.language;

  const isLast = index === steps.length - 1;

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

  const progress = steps.length > 0 ? (index + 1) / steps.length : 0;

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
          <Text variant="body" style={styles.stepText}>
            {localize(steps[index], language)}
          </Text>
        </View>

        <View style={styles.footer}>
          <Pressable
            onPress={handlePrev}
            disabled={index === 0}
            testID="flashcard-prev"
            style={({ pressed }) => [
              styles.navButton,
              styles.secondaryNavButton,
              index === 0 && styles.navButtonDisabled,
              pressed && index > 0 && styles.navButtonPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={t('common.back')}
          >
            <View style={styles.prevIconWrap}>
              <Icon
                name="chevron"
                size={20}
                color={index === 0 ? colors.text.muted : colors.text.primary}
              />
            </View>
          </Pressable>

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

          <Pressable
            onPress={handleNext}
            testID="flashcard-next"
            style={({ pressed }) => [
              styles.navButton,
              isLast ? styles.primaryNavButton : styles.secondaryNavButton,
              pressed && (isLast ? styles.primaryNavButtonPressed : styles.navButtonPressed),
            ]}
            accessibilityRole="button"
            accessibilityLabel={isLast ? t('learning.completed') : t('common.continue')}
          >
            <Icon
              name={isLast ? 'check' : 'chevron'}
              size={20}
              color={isLast ? colors.text.onPrimary : colors.text.primary}
            />
          </Pressable>
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryNavButton: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: 'transparent',
  },
  primaryNavButton: {
    backgroundColor: colors.primary,
  },
  primaryNavButtonPressed: {
    backgroundColor: colors.primaryDark,
  },
  navButtonPressed: {
    backgroundColor: colors.neutralBg,
  },
  navButtonDisabled: {
    opacity: 0.35,
  },
  prevIconWrap: {
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

