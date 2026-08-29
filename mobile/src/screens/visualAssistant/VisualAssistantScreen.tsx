import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import type { CameraView as CameraViewInstance } from 'expo-camera';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { Banner, Button, Icon, Input, Screen, ScreenHeader, Text } from '@/components/ui';
import { resolveVisualAssistantAnswer, type VisualAssistantState } from '@/features/visualAssistant/demo';
import { avatarColors, colors, layout } from '@/theme';

type Props = { onBack: () => void };

type CapturedPhoto = { uri: string; base64: string };

/**
 * Camera-first "Ask KrishiNetra" prototype.
 *
 * This milestone is real, but still temporary/demo architecture:
 *  - The photo is genuinely captured and sent (via
 *    `features/visualAssistant/demo.ts`) to a vision-capable LLM through a
 *    Supabase Edge Function that keeps the API key server-side.
 *  - The question is typed, not spoken — there is no speech recognition here.
 *  - The answer is a real, unverified model response, not a KrishiNetra
 *    agricultural decision — it never passes through Engine 2, so the UI
 *    keeps a visible disclaimer wherever it's shown.
 *
 * Deliberately NOT wired into `AvatarContext`/`avatarMachine`/`AvatarOverlay` —
 * this screen owns its own small state so it stays easy to extend or remove.
 */
export function VisualAssistantScreen({ onBack }: Props) {
  const { t } = useTranslation();
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraError, setCameraError] = useState(false);
  const cameraRef = useRef<CameraViewInstance>(null);

  const [state, setState] = useState<VisualAssistantState>('idle');
  const [photo, setPhoto] = useState<CapturedPhoto | null>(null);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // The screen's whole purpose needs the camera, so ask immediately rather
  // than waiting for a tap — mirrors FieldLocationScreen's request pattern,
  // just triggered on open instead of on a button press.
  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) {
      void requestPermission();
    }
  }, [permission, requestPermission]);

  const capture = useCallback(async () => {
    if (!cameraRef.current) return;
    try {
      const result = await cameraRef.current.takePictureAsync({ base64: true, quality: 0.5 });
      if (!result?.base64) {
        setCameraError(true);
        return;
      }
      setPhoto({ uri: result.uri, base64: result.base64 });
      setState('captured');
      setAnswer(null);
      setErrorMessage(null);
    } catch {
      setCameraError(true);
    }
  }, []);

  const retake = useCallback(() => {
    setPhoto(null);
    setQuestion('');
    setAnswer(null);
    setErrorMessage(null);
    setState('idle');
  }, []);

  const ask = useCallback(async () => {
    if (!photo || !question.trim()) return;

    setState('asking');
    setErrorMessage(null);

    try {
      const result = await resolveVisualAssistantAnswer(t, {
        imageBase64: photo.base64,
        mimeType: 'image/jpeg',
        questionText: question,
      });
      setAnswer(result.answer);
      setState('answered');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : t('visualAssistant.errors.generic'));
      setState('error');
    }
  }, [photo, question, t]);

  // --- Permission still resolving -----------------------------------------
  if (!permission) {
    return (
      <Screen>
        <ScreenHeader title={t('visualAssistant.headerTitle')} onBack={onBack} />
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </Screen>
    );
  }

  // --- Permission denied ---------------------------------------------------
  if (!permission.granted) {
    return (
      <Screen>
        <ScreenHeader title={t('visualAssistant.headerTitle')} onBack={onBack} />
        <View style={styles.permissionBody}>
          <Banner
            title={t('visualAssistant.permissionTitle')}
            detail={
              permission.canAskAgain
                ? t('visualAssistant.permissionBody')
                : t('visualAssistant.permissionDenied')
            }
            tone="warning"
            icon="camera"
          />
          {permission.canAskAgain ? (
            <Button
              label={t('visualAssistant.permissionAllow')}
              onPress={() => void requestPermission()}
              icon="camera"
              testID="visual-assistant-allow-camera"
            />
          ) : null}
        </View>
      </Screen>
    );
  }

  // --- Camera unavailable on this device/simulator --------------------------
  if (cameraError) {
    return (
      <Screen>
        <ScreenHeader title={t('visualAssistant.headerTitle')} onBack={onBack} />
        <View style={styles.permissionBody}>
          <Banner title={t('visualAssistant.unavailable')} tone="danger" icon="alert" />
        </View>
      </Screen>
    );
  }

  const showingPhoto = state !== 'idle' && photo;
  const asking = state === 'asking';

  return (
    <View style={styles.root} testID="visual-assistant-camera">
      {showingPhoto ? (
        <Image source={{ uri: photo.uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      ) : (
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          facing="back"
          onCameraReady={() => setCameraError(false)}
          onMountError={() => setCameraError(true)}
        />
      )}

      <SafeAreaView style={styles.overlay} edges={['top', 'bottom']} pointerEvents="box-none">
        <View style={styles.header}>
          <Pressable
            onPress={onBack}
            hitSlop={12}
            style={styles.headerButton}
            accessibilityRole="button"
            accessibilityLabel={t('common.back')}
          >
            <Icon name="back" size={22} color="#FFFFFF" strokeWidth={2} />
          </Pressable>
          <Text variant="cardTitle" color="#FFFFFF" center style={styles.headerTitle}>
            {t('visualAssistant.headerTitle')}
          </Text>
          {showingPhoto ? (
            <Pressable
              onPress={retake}
              hitSlop={12}
              style={styles.headerButton}
              accessibilityRole="button"
              accessibilityLabel={t('visualAssistant.retake')}
              testID="visual-assistant-retake"
            >
              <Icon name="restart" size={20} color="#FFFFFF" strokeWidth={2} />
            </Pressable>
          ) : (
            <View style={styles.headerButton} />
          )}
        </View>

        <View style={styles.bottomArea}>
          {state === 'idle' ? (
            <>
              <Text variant="caption" color="#EDEEE9" center style={styles.hint}>
                {t('visualAssistant.captureSub')}
              </Text>
              <View style={styles.captureBlock}>
                <Pressable
                  onPress={capture}
                  style={({ pressed }) => [styles.captureButton, pressed && styles.capturePressed]}
                  accessibilityRole="button"
                  accessibilityLabel={t('visualAssistant.captureLabel')}
                  testID="visual-assistant-capture"
                >
                  <Icon name="camera" size={32} color="#151714" strokeWidth={2} />
                </Pressable>
              </View>
            </>
          ) : (
            <>
              {answer ? (
                <View style={styles.answerCard} testID="visual-assistant-answer">
                  <View style={styles.answerBadge}>
                    <Text variant="microMedium" color={avatarColors.state.speaking}>
                      {t('visualAssistant.answerLabel')}
                    </Text>
                  </View>
                  <Text variant="body" color="#FFFFFF">
                    {answer}
                  </Text>
                </View>
              ) : null}

              {errorMessage ? (
                <Banner title={errorMessage} tone="danger" icon="alert" />
              ) : null}

              <Input
                label={t('visualAssistant.questionLabel')}
                placeholder={t('visualAssistant.questionPlaceholder')}
                value={question}
                onChangeText={setQuestion}
                editable={!asking}
                returnKeyType="send"
                onSubmitEditing={() => void ask()}
                testID="visual-assistant-question"
              />

              <Button
                label={
                  asking
                    ? t('visualAssistant.asking')
                    : answer
                      ? t('visualAssistant.askAgain')
                      : t('visualAssistant.askButton')
                }
                onPress={() => void ask()}
                loading={asking}
                disabled={!question.trim()}
                testID="visual-assistant-ask"
              />
            </>
          )}

          <Text variant="micro" color={avatarColors.footerHint} center>
            {t('visualAssistant.answerDisclaimer')}
          </Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000000' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  permissionBody: { paddingHorizontal: layout.screenPadding, paddingTop: 8, gap: 16 },
  overlay: { flex: 1, justifyContent: 'space-between' },
  header: {
    height: layout.headerHeight,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  headerButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1 },
  bottomArea: {
    paddingHorizontal: layout.screenPadding,
    paddingBottom: 18,
    paddingTop: 14,
    gap: 12,
  },
  hint: { minHeight: 18 },
  captureBlock: { alignItems: 'center', paddingVertical: 8 },
  captureButton: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  capturePressed: { opacity: 0.85 },
  answerCard: {
    backgroundColor: avatarColors.pillBg,
    padding: layout.cardPadding,
    gap: 6,
  },
  answerBadge: { alignSelf: 'flex-start' },
});
