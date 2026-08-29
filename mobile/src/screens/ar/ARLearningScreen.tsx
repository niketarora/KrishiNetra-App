import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Badge, Button, EmptyState, Screen, ScreenHeader, Text } from '@/components/ui';
import { getArSteps } from '@/features/ar/demoArGuides';
import { colors, layout } from '@/theme';

type Props = {
  tutorialId: string;
  onBack: () => void;
};

/**
 * AR Learning Preview — a product prototype, not real augmented reality.
 *
 * There is no camera feed and no image analysis here: the "viewfinder" is a
 * plain styled `View`, and the step script is a fixed local list from
 * `features/ar/demoArGuides.ts`. This is deliberate — a system that actually
 * understood a field through a camera needs computer vision and domain
 * models that don't exist yet (see that module's file comment). The banner
 * below says so up front rather than letting the mocked camera view imply
 * otherwise.
 */
export function ARLearningScreen({ tutorialId, onBack }: Props) {
  const { t } = useTranslation();
  const steps = getArSteps(tutorialId);
  const [stepIndex, setStepIndex] = useState(0);

  if (!steps || steps.length === 0) {
    return (
      <Screen edges={['top']}>
        <ScreenHeader title={t('ar.title')} onBack={onBack} />
        <EmptyState
          icon="camera"
          title={t('ar.notAvailableTitle')}
          body={t('ar.notAvailableBody')}
          testID="ar-not-available"
        />
      </Screen>
    );
  }

  const step = steps[stepIndex];
  const isLastStep = stepIndex === steps.length - 1;

  return (
    <Screen edges={['top']} style={styles.screen}>
      <ScreenHeader title={t('ar.title')} onBack={onBack} />

      <View style={styles.viewfinder} testID="ar-viewfinder">
        <Badge label={t('ar.previewBadge')} tone="accent" />
        <Text variant="micro" color="rgba(255,255,255,0.75)" style={styles.disclaimer}>
          {t('ar.disclaimer')}
        </Text>

        <View style={styles.stepCard} testID={`ar-step-${step.id}`}>
          <Text variant="caption" color={colors.text.onPrimary}>
            {t('ar.stepLabel', { number: stepIndex + 1, total: steps.length })}
          </Text>
          <Text variant="bodyMedium" color={colors.text.onPrimary}>
            {t(step.instructionKey)}
          </Text>
        </View>

        {step.markerLabelKey ? (
          <View style={styles.markerBlock} pointerEvents="none">
            <View style={styles.markerDot} />
            <Text variant="micro" color="rgba(255,255,255,0.85)">
              {t(step.markerLabelKey)}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.footer}>
        <Button
          label={isLastStep ? t('ar.finish') : t('ar.nextStep')}
          onPress={() => (isLastStep ? onBack() : setStepIndex((i) => i + 1))}
          testID="ar-next-step"
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: '#0A0C09' },
  viewfinder: {
    flex: 1,
    backgroundColor: '#1C1F1A',
    margin: layout.screenPadding,
    padding: layout.cardPadding,
    justifyContent: 'space-between',
  },
  disclaimer: { marginTop: 6 },
  stepCard: {
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
    padding: layout.cardPadding,
    gap: 4,
    maxWidth: 280,
  },
  markerBlock: { alignItems: 'center', gap: 4, marginBottom: 8 },
  markerDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.85)',
  },
  footer: { paddingHorizontal: layout.screenPadding, paddingBottom: 16 },
});
