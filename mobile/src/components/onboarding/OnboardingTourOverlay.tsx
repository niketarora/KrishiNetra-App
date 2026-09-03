import { useEffect } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { useOnboardingTour } from '@/features/onboarding/OnboardingTourContext';
import { navigateToStackRoute } from '@/navigation/navigationRef';
import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { colors, fonts, radius } from '@/theme';
import { CurvedArrow } from './CurvedArrow';

const PADDING = 6;

export function OnboardingTourOverlay() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const {
    step,
    isActive,
    isLandRegistered,
    targetRect,
    nextStep,
    skipTour,
    finishTour,
  } = useOnboardingTour();

  const pulse = useSharedValue(0);

  useEffect(() => {
    if (isActive) {
      pulse.value = withRepeat(
        withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.ease) }),
        -1,
        true,
      );
    } else {
      pulse.value = 0;
    }
  }, [isActive, pulse]);

  const animatedBorderStyle = useAnimatedStyle(() => ({
    opacity: 0.8 + pulse.value * 0.2,
    transform: [{ scale: 1 + pulse.value * 0.02 }],
  }));

  console.log('[TourOverlay] render:', { isActive, step, isLandRegistered, targetRect });

  if (!isActive) return null;

  // While farmer is drawing boundary or entering crop in Step 4 before land is registered,
  // do not render the overlay so map and form inputs remain completely accessible.
  if (step === 4 && !isLandRegistered && !targetRect) {
    return null;
  }

  const getTitle = () => {
    return t(`tour.step${step}.title`);
  };

  const getDescription = () => {
    if (step === 4 && isLandRegistered) {
      return t('tour.step4.registeredDesc');
    }
    return t(`tour.step${step}.description`);
  };

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* 4 Dimmed Backdrop Pieces Framing the Spotlight Hole Reliably */}
      {targetRect ? (
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          {/* Top backdrop & touch blocker */}
          <Pressable
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: Math.max(0, targetRect.y - PADDING),
              backgroundColor: 'rgba(0, 0, 0, 0.52)',
            }}
            onPress={() => {}}
          />
          {/* Bottom backdrop & touch blocker */}
          <Pressable
            style={{
              position: 'absolute',
              top: targetRect.y + targetRect.height + PADDING,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.52)',
            }}
            onPress={() => {}}
          />
          {/* Left backdrop & touch blocker */}
          <Pressable
            style={{
              position: 'absolute',
              top: Math.max(0, targetRect.y - PADDING),
              left: 0,
              width: Math.max(0, targetRect.x - PADDING),
              height: targetRect.height + PADDING * 2,
              backgroundColor: 'rgba(0, 0, 0, 0.52)',
            }}
            onPress={() => {}}
          />
          {/* Right backdrop & touch blocker */}
          <Pressable
            style={{
              position: 'absolute',
              top: Math.max(0, targetRect.y - PADDING),
              left: targetRect.x + targetRect.width + PADDING,
              right: 0,
              height: targetRect.height + PADDING * 2,
              backgroundColor: 'rgba(0, 0, 0, 0.52)',
            }}
            onPress={() => {}}
          />
        </View>
      ) : (
        <Pressable
          style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0, 0, 0, 0.52)' }]}
          onPress={() => {}}
        />
      )}

      {/* Target Highlight Ring, Arrow, and Direct Touch Hotspot */}
      {targetRect ? (
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          {/* Direct touchable hotspot over the highlighted target */}
          <Pressable
            style={{
              position: 'absolute',
              left: targetRect.x - PADDING,
              top: targetRect.y - PADDING,
              width: targetRect.width + PADDING * 2,
              height: targetRect.height + PADDING * 2,
              borderRadius: (targetRect.radius ?? 12) + PADDING,
              zIndex: 10,
            }}
            onPress={() => {
              if (step === 1 || step === 2 || step === 3) {
                nextStep();
              } else if (step === 4 && !isLandRegistered) {
                navigateToStackRoute('RegisterBoundary');
              }
            }}
            accessibilityRole="button"
            accessibilityLabel="Tour Target Action"
          />

          {/* Glowing Dashed Border around target */}
          <Animated.View
            style={[
              styles.highlightBorder,
              {
                left: targetRect.x - PADDING,
                top: targetRect.y - PADDING,
                width: targetRect.width + PADDING * 2,
                height: targetRect.height + PADDING * 2,
                borderRadius: (targetRect.radius ?? 12) + PADDING,
              },
              animatedBorderStyle,
            ]}
          />

          {/* Directional Curved Arrows */}
          {step === 1 && (
            <CurvedArrow
              direction="up-right"
              style={[
                styles.arrow,
                {
                  left: targetRect.x - 56,
                  top: targetRect.y + targetRect.height + 4,
                },
              ]}
            />
          )}

          {step === 2 && (
            <CurvedArrow
              direction="down"
              style={[
                styles.arrow,
                {
                  left: targetRect.x + targetRect.width / 2 - 30,
                  top: targetRect.y - 54,
                },
              ]}
            />
          )}

          {step === 3 && (
            <CurvedArrow
              direction="up"
              style={[
                styles.arrow,
                {
                  left: targetRect.x + targetRect.width / 2 - 20,
                  top: targetRect.y + targetRect.height + 8,
                },
              ]}
            />
          )}

          {step === 4 && !isLandRegistered && (
            <CurvedArrow
              direction="up"
              style={[
                styles.arrow,
                {
                  left: targetRect.x + targetRect.width / 2 - 20,
                  top: targetRect.y + targetRect.height + 6,
                },
              ]}
            />
          )}

          {/* Step 4 Target Registered Checkmark Badge */}
          {step === 4 && isLandRegistered && (
            <View
              style={[
                styles.checkBadge,
                {
                  left: targetRect.x + targetRect.width - 14,
                  top: targetRect.y + targetRect.height - 14,
                },
              ]}
            >
              <Icon name="check" size={16} color="#FFFFFF" strokeWidth={2.5} />
            </View>
          )}
        </View>
      ) : null}

      {/* Bottom Floating Container */}
      <View
        style={[
          styles.bottomContainer,
          { bottom: insets.bottom + 16 },
        ]}
        pointerEvents="box-none"
      >
        {/* Step 4 Land Registered Success Card */}
        {step === 4 && isLandRegistered && (
          <View style={styles.successCard}>
            <View style={styles.successIconCircle}>
              <Icon name="check" size={20} color={colors.primary} strokeWidth={2.5} />
            </View>
            <View style={styles.successTextContainer}>
              <Text style={styles.successTitle}>
                {t('tour.step4.successTitle')}
              </Text>
              <Text style={styles.successBody}>
                {t('tour.step4.successDescription')}
              </Text>
              <Pressable
                style={styles.viewFarmBtn}
                onPress={nextStep}
                accessibilityRole="button"
              >
                <Text style={styles.viewFarmBtnText}>
                  {t('tour.step4.viewMyFarm')}
                </Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* Main Onboarding Flashcard */}
        <View style={styles.flashcard}>
          <View style={styles.stepBadge}>
            <Text style={styles.stepBadgeText}>
              {t('tour.stepBadge', { step, total: 6, defaultValue: `Step ${step} of 6` })}
            </Text>
          </View>

          <View style={styles.cardHeaderRow}>
            <View style={styles.cardTextCol}>
              <Text style={styles.title}>{getTitle()}</Text>
              <Text style={styles.description}>{getDescription()}</Text>
            </View>
            {step === 3 && (
              <View style={styles.cardGraphicCircle}>
                <Icon name="field" size={30} color={colors.primary} />
              </View>
            )}
          </View>

          {/* Controls: Skip | Dots | Next */}
          <View style={styles.controlsRow}>
            <Pressable
              onPress={() => void skipTour()}
              hitSlop={12}
              style={styles.skipBtn}
              accessibilityRole="button"
              accessibilityLabel={t('tour.skip')}
            >
              <Text style={styles.skipText}>{t('tour.skip')}</Text>
            </Pressable>

            <View style={styles.dotsRow}>
              {([1, 2, 3, 4, 5, 6] as const).map((i) => (
                <View
                  key={i}
                  style={[
                    styles.dot,
                    i === step && styles.activeDot,
                  ]}
                />
              ))}
            </View>

            {/* In Step 4 before land is registered, hide Next */}
            {step === 4 && !isLandRegistered ? (
              <View style={styles.skipBtn} />
            ) : (
              <Pressable
                onPress={() => {
                  if (step === 6) {
                    void finishTour();
                  } else {
                    nextStep();
                  }
                }}
                style={styles.nextBtn}
                accessibilityRole="button"
                accessibilityLabel={step === 6 ? t('tour.finish') : t('tour.next')}
              >
                <Text style={styles.nextText}>
                  {step === 6 ? t('tour.finish') : t('tour.next')}
                </Text>
              </Pressable>
            )}
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  highlightBorder: {
    position: 'absolute',
    borderWidth: 2.5,
    borderColor: '#F59E0B',
    borderStyle: 'dashed',
    backgroundColor: 'transparent',
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 10,
  },
  arrow: {
    position: 'absolute',
    zIndex: 100,
  },
  checkBadge: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    elevation: 12,
  },
  bottomContainer: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 1000,
  },
  successCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#EAF5EE',
    borderColor: '#B7E4C7',
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    gap: 12,
    shadowColor: '#1B4332',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  successIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  successTextContainer: {
    flex: 1,
    gap: 4,
  },
  successTitle: {
    fontFamily: fonts.semibold,
    fontWeight: '700',
    fontSize: 16,
    color: colors.primary,
  },
  successBody: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.text.secondary,
    lineHeight: 18,
    marginBottom: 8,
  },
  viewFarmBtn: {
    alignSelf: 'stretch',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: 24,
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewFarmBtnText: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: colors.primary,
  },
  flashcard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingHorizontal: 22,
    paddingTop: 18,
    paddingBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 14,
  },
  stepBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#E8F5E9',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 10,
  },
  stepBadgeText: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: '#1B5E20',
    fontWeight: '600',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  cardTextCol: {
    flex: 1,
  },
  cardGraphicCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#E8F5E9',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
    borderWidth: 1,
    borderColor: '#C8E6C9',
  },
  title: {
    fontFamily: fonts.semibold,
    fontWeight: '700',
    fontSize: 21,
    lineHeight: 26,
    color: colors.primary,
    marginBottom: 8,
  },
  description: {
    fontFamily: fonts.regular,
    fontSize: 14.5,
    color: colors.text.secondary,
    lineHeight: 21,
    marginBottom: 20,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  skipBtn: {
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  skipText: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.text.secondary,
    textDecorationLine: 'underline',
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#D1D5DB',
  },
  activeDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: colors.primary,
  },
  nextBtn: {
    backgroundColor: colors.primary,
    borderRadius: 24,
    paddingVertical: 10,
    paddingHorizontal: 24,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextText: {
    fontFamily: fonts.semibold,
    fontSize: 15,
    color: '#FFFFFF',
  },
});
