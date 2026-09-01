import { useEffect } from 'react';
import { Image, Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { useAvatar } from '@/features/avatar/AvatarContext';
import { isAvatarVisible } from '@/features/avatar/avatarMachine';
import type { AvatarExpression, ResearchSource } from '@/services/assistantService';
import { avatarColors, colors, guideColors, layout, radius } from '@/theme';
import { useReduceMotion } from '@/utils/useReduceMotion';

import { Icon } from '../ui/Icon';
import { Text } from '../ui/Text';

/**
 * The farmer guide, peeking from a corner.
 *
 * This replaces the full-screen conversational surface entirely. The point of
 * the redesign is that the farmer keeps looking at their own app while being
 * helped through it — a modal covering that app is the exact thing being fixed,
 * so there is no expanded mode to fall back to.
 *
 * Rendered outside NavigationContainer, so it survives every navigation the
 * guide performs and is reachable from every screen without being a route.
 *
 * The character art is composed for this: he sits on the right of a transparent
 * frame, facing left into the screen, leaning on a green panel. That is why
 * bottom-right is the default anchor and the bubble sits above and to his left
 * — he is looking at what he is talking about. On the left anchor the image is
 * mirrored so the gaze still points inward.
 */

/**
 * One pose today, and one pose is enough to ship: the expression is carried by
 * the bubble and the motion. Dropping in `guide-peek-thinking.png` and friends
 * later is a change to this map and nothing else.
 */
const GUIDE = require('../../../assets/avatar/guide-peek.png');

const EXPRESSIONS: Record<AvatarExpression, number> = {
  helpful: GUIDE,
  thinking: GUIDE,
  pointing: GUIDE,
  concerned: GUIDE,
};

/** Source aspect is 3:2, and the character occupies its right-hand half. */
const CHARACTER_WIDTH = 260;
const CHARACTER_HEIGHT = 174;

export function AvatarPeek() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();

  const { state, response, transcript, language, errorKey, close, pressMic } = useAvatar();

  const visible = isAvatarVisible(state);
  const offset = useSharedValue(visible ? 0 : 1);

  useEffect(() => {
    offset.value = reduceMotion
      ? visible
        ? 0
        : 1
      : withTiming(visible ? 0 : 1, {
          duration: 260,
          easing: Easing.out(Easing.cubic),
        });
  }, [offset, reduceMotion, visible]);

  const slide = useAnimatedStyle(() => ({
    opacity: 1 - offset.value,
    transform: [{ translateY: offset.value * 40 }],
  }));

  // Nothing is mounted while idle. The guide is an interruption by design; a
  // permanently docked character would be furniture the farmer stops seeing.
  if (!visible) return null;

  const directive = response?.avatar;
  const onLeft = directive?.position === 'bottom-left';
  const sources: ResearchSource[] =
    response?.type === 'RESEARCH_RESPONSE' ? response.sources : [];

  const currentLang = language ? language.split('-')[0] : undefined;

  // What the avatar is showing right now: the farmer's own words while it
  // works, the answer once it has one, and — while listening — nothing at all,
  // because the farmer is the one talking.
  //
  // The error line names what actually failed. A blocked microphone and an
  // unreachable assistant need different things from the farmer, so telling
  // them "sorry, I couldn't hear you" for both would send them to the wrong fix.
  const message =
    state === 'error'
      ? t(errorKey ?? 'avatar.errors.generic', { lng: currentLang })
      : state === 'listening'
        ? t('avatar.status.listening', { lng: currentLang })
        : response
          ? response.localised
            ? t(response.message, { lng: currentLang })
            : response.message
          : (transcript ?? t('avatar.status.thinking', { lng: currentLang }));

  return (
    <Animated.View
      // The container spans the width so the bubble can use it, but only its
      // own children take touches — the app underneath stays fully usable.
      pointerEvents="box-none"
      style={[
        styles.peek,
        { bottom: layout.navHeight },
        slide,
      ]}
    >
      <View style={[styles.bubble, onLeft ? styles.bubbleLeft : styles.bubbleRight]}>
        <View style={styles.statusRow}>
          <View style={[styles.dot, { backgroundColor: avatarColors.state[state] }]} />
          <Text variant="micro" color={colors.text.muted} style={styles.status}>
            {t(`avatar.status.${state}`, { lng: currentLang })}
          </Text>

          <Pressable
            onPress={close}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={t('avatar.close', { lng: currentLang })}
          >
            <Icon name="close" size={16} color={colors.text.muted} strokeWidth={2} />
          </Pressable>
        </View>

        {transcript && state !== 'listening' ? (
          <View style={styles.transcriptBox}>
            <View style={styles.transcriptHeader}>
              <Icon name="mic" size={12} color={colors.accent} strokeWidth={2} />
              <Text variant="micro" color={colors.accent} style={styles.transcriptLabel}>
                {t('avatar.youAsked', { lng: currentLang })}
              </Text>
            </View>
            <Text variant="caption" color={colors.text.primary} style={styles.transcriptText}>
              "{transcript}"
            </Text>
          </View>
        ) : null}

        <Text
          variant="body"
          // The message changes as the exchange moves through its states, and a
          // farmer using a screen reader needs to hear it without hunting.
          accessibilityLiveRegion="polite"
          style={styles.message}
        >
          {message}
        </Text>

        {sources.length > 0 ? (
          <View style={styles.sources}>
            <Text variant="micro" color={colors.text.muted}>
              {t('avatar.sources.label', { lng: currentLang })}
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.sourceRow}
            >
              {sources.map((source) => (
                <Pressable
                  key={source.url}
                  onPress={() => void Linking.openURL(source.url)}
                  style={({ pressed }) => [styles.sourceChip, pressed && styles.sourceChipPressed]}
                  accessibilityRole="link"
                  accessibilityLabel={source.title}
                >
                  <Text variant="micro" color={colors.accent} numberOfLines={1}>
                    {source.title}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        ) : null}

        <Pressable
          onPress={pressMic}
          disabled={state === 'thinking'}
          style={({ pressed }) => [
            styles.micButton,
            state === 'listening' && styles.micListening,
            state === 'thinking' && styles.micDisabled,
            pressed && styles.micPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel={t(`avatar.mic.${state}`, { lng: currentLang })}
          accessibilityState={{ disabled: state === 'thinking' }}
        >
          <Icon name="mic" size={16} color={colors.text.onPrimary} strokeWidth={2} />
          <Text variant="micro" color={colors.text.onPrimary}>
            {t(`avatar.mic.${state}`, { lng: currentLang })}
          </Text>
        </Pressable>
      </View>

      <View
        pointerEvents="none"
        style={[styles.characterRow, onLeft ? styles.characterLeft : styles.characterRight]}
      >
        <Image
          source={EXPRESSIONS[directive?.expression ?? 'helpful']}
          style={[styles.character, onLeft && styles.characterMirrored]}
          resizeMode="contain"
          // Purely decorative — everything the character conveys is in the
          // bubble text above him, which is what a screen reader reads.
          accessible={false}
        />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  peek: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  bubble: {
    backgroundColor: guideColors.bubbleBg,
    borderWidth: 1,
    borderColor: guideColors.bubbleBorder,
    borderRadius: radius.lg,
    padding: layout.cardPadding,
    gap: 10,
    marginHorizontal: layout.screenPadding,
    // The character overlaps the bubble's lower edge, so he reads as holding
    // it up rather than standing beside an unrelated card.
    marginBottom: -14,
    elevation: 8,
    shadowColor: '#1C1F1A',
    shadowOpacity: 0.16,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  bubbleRight: { marginLeft: layout.screenPadding + 24 },
  bubbleLeft: { marginRight: layout.screenPadding + 24 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: radius.pill },
  status: { flex: 1, letterSpacing: 0.6 },
  transcriptBox: {
    backgroundColor: colors.neutralBg,
    borderRadius: radius.md,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderLeftWidth: 3,
    borderLeftColor: colors.accent,
    gap: 2,
  },
  transcriptHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  transcriptLabel: {
    fontWeight: '600',
    letterSpacing: 0.4,
  },
  transcriptText: {
    fontStyle: 'italic',
    lineHeight: 18,
  },
  message: { lineHeight: 21 },
  sources: { gap: 6 },
  sourceRow: { gap: 8, paddingRight: 8 },
  sourceChip: {
    maxWidth: 180,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.accentBg,
    borderWidth: 1,
    borderColor: colors.accentBorder,
  },
  sourceChipPressed: { backgroundColor: colors.accentBadgeBg },
  micButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 36,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  micListening: { backgroundColor: colors.danger },
  micDisabled: { opacity: 0.55 },
  micPressed: { opacity: 0.85 },
  characterRow: { flexDirection: 'row' },
  characterRight: { justifyContent: 'flex-end' },
  characterLeft: { justifyContent: 'flex-start' },
  character: { width: CHARACTER_WIDTH, height: CHARACTER_HEIGHT },
  // Mirrored on the left anchor so he still faces into the screen rather than
  // off the edge of it.
  characterMirrored: { transform: [{ scaleX: -1 }] },
});
