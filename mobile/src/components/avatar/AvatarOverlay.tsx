import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { useAuth } from '@/features/auth/AuthContext';
import { useAvatar } from '@/features/avatar/AvatarContext';
import { questionText, suggestionChips } from '@/features/avatar/demoScript';
import { avatarColors, colors, layout } from '@/theme';
import { firstName } from '@/utils/format';

import { Icon } from '../ui/Icon';
import { Text } from '../ui/Text';
import { AvatarStage } from './AvatarStage';
import { Waveform } from './Waveform';

/**
 * The AI Farmer Avatar — a full-screen conversational surface, not a chat
 * bubble. Matches the prototype's `voiceOpen` layout: dark shell, the farmer
 * filling the frame, subtitles over the image, and a single wide mic control.
 *
 * Phase 1 is the complete visual shell driven by a scripted exchange. There is
 * no microphone capture, no speech recognition, no model and no speech
 * synthesis behind it — the header says so, so nobody mistakes the loop for a
 * live assistant. Phase 5 connects the real pipeline to the same states.
 */
export function AvatarOverlay() {
  const { t } = useTranslation();
  const { user, profile } = useAuth();
  const { isOpen, state, question, answer, source, close, ask, pressMic } = useAvatar();

  const name = firstName(profile?.full_name, user?.email);
  const chips = suggestionChips(t);

  // What the avatar is showing at this moment: its greeting when idle, the
  // farmer's question while it listens and thinks, the answer while speaking.
  const speech =
    state === 'idle'
      ? t('avatar.greeting', { name })
      : state === 'error'
        ? t('avatar.errorMessage')
        : state === 'speaking' && answer
          ? answer
          : question
            ? questionText(t, question)
            : t('avatar.greeting', { name });

  const stateColor = avatarColors.state[state];

  return (
    <Modal
      visible={isOpen}
      animationType="slide"
      onRequestClose={close}
      statusBarTranslucent
      accessibilityViewIsModal
    >
      <SafeAreaView style={styles.shell} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Pressable
            onPress={close}
            hitSlop={10}
            style={styles.headerButton}
            accessibilityRole="button"
            accessibilityLabel={t('avatar.close')}
          >
            <Icon name="back" size={22} color="#FFFFFF" strokeWidth={2} />
          </Pressable>

          <View style={styles.headerText}>
            <Text variant="cardTitle" color="#FFFFFF">
              {t('avatar.headerTitle')}
            </Text>
            <Text variant="micro" color={avatarColors.headerSubtitle} style={styles.headerSubtitle}>
              {t('avatar.headerSubtitle')}
            </Text>
          </View>
        </View>

        <AvatarStage
          state={state}
          statusLabel={t(`avatar.status.${state}`)}
          speech={speech}
          source={state === 'speaking' ? source : null}
        />

        <View style={styles.controls}>
          <View style={styles.statusRow}>
            <Text variant="caption" color={stateColor}>
              {t(`avatar.status.${state}`)}
            </Text>
            <View style={styles.waveSlot}>
              <Waveform state={state} />
            </View>
          </View>

          {state === 'idle' ? (
            <View style={styles.chipsBlock}>
              <Text variant="micro" color={avatarColors.footerHint} style={styles.chipsLabel}>
                {t('avatar.tryAsking')}
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chips}
              >
                {chips.map((chip) => (
                  <Pressable
                    key={chip.key}
                    onPress={() => ask(chip.key)}
                    style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}
                    accessibilityRole="button"
                  >
                    <Text variant="caption" color={avatarColors.chipText}>
                      {chip.label}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          ) : null}

          {state === 'error' ? (
            <View style={styles.errorBlock} accessibilityRole="alert">
              <Icon name="alert" size={18} color={avatarColors.errorText} strokeWidth={2} />
              <Text variant="caption" color={avatarColors.errorText} style={styles.errorText}>
                {t('avatar.errorMessage')}
              </Text>
            </View>
          ) : null}

          <View style={styles.actionRow}>
            <Pressable
              onPress={pressMic}
              disabled={state === 'thinking'}
              style={({ pressed }) => [
                styles.micButton,
                { backgroundColor: state === 'error' ? colors.danger : colors.primary },
                state === 'thinking' && styles.micDisabled,
                pressed && styles.micPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel={t(`avatar.mic.${state}`)}
              accessibilityState={{ disabled: state === 'thinking' }}
            >
              <Icon name="mic" size={24} color="#FFFFFF" strokeWidth={2} />
              <Text variant="bodyMedium" color="#FFFFFF" style={styles.micLabel}>
                {t(`avatar.mic.${state}`)}
              </Text>
            </Pressable>

            <Pressable
              onPress={close}
              style={({ pressed }) => [styles.endButton, pressed && styles.endButtonPressed]}
              accessibilityRole="button"
              accessibilityLabel={t('avatar.end')}
            >
              <Icon name="close" size={22} color={avatarColors.errorText} strokeWidth={2} />
            </Pressable>
          </View>

          <Text variant="micro" color={avatarColors.footerHint}>
            {t(`avatar.footer.${state}`)}
          </Text>
          <Text variant="micro" color={avatarColors.footerHint}>
            {t('avatar.previewNotice')}
          </Text>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1, backgroundColor: avatarColors.shell },
  header: {
    height: layout.headerHeight,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
  },
  headerButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerText: { flex: 1 },
  headerSubtitle: { marginTop: 2 },
  controls: {
    backgroundColor: avatarColors.shell,
    paddingHorizontal: layout.screenPadding,
    paddingTop: 14,
    paddingBottom: 18,
    gap: 12,
  },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  waveSlot: { flex: 1, alignItems: 'flex-end', justifyContent: 'center', height: 26 },
  chipsBlock: { gap: 8 },
  chipsLabel: { letterSpacing: 0.8 },
  chips: { gap: 8, paddingRight: 8 },
  chip: {
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: avatarColors.chipBorder,
  },
  chipPressed: { backgroundColor: avatarColors.chipPressed },
  errorBlock: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 12,
    backgroundColor: avatarColors.errorBlockBg,
  },
  errorText: { flex: 1 },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  micButton: {
    flex: 1,
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
  },
  micDisabled: { opacity: 0.55 },
  micPressed: { opacity: 0.85 },
  micLabel: { fontSize: 15 },
  endButton: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: avatarColors.endButtonBg,
    borderWidth: 1,
    borderColor: avatarColors.endButtonBorder,
  },
  endButtonPressed: { backgroundColor: avatarColors.endButtonPressed },
});
