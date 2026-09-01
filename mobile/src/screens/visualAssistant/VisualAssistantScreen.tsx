import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import type { CameraView as CameraViewInstance } from 'expo-camera';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { Banner, Button, Icon, Input, Screen, ScreenHeader, Text } from '@/components/ui';
import { resolveVisualAssistantAnswer, type VisualAssistantState } from '@/features/visualAssistant/demo';
import { GeminiLiveClient } from '@/features/visualAssistant/GeminiLiveClient';
import { LiveAudioController } from '@/features/visualAssistant/AudioController';
import { SAMPLE_PLANT_BASE64, SAMPLE_PLANT_URI } from '@/features/visualAssistant/sampleImage';
import type { LiveConnectionState } from '@/features/visualAssistant/types';
import { avatarColors, colors, layout, radius } from '@/theme';

type Props = { onBack: () => void };
type CapturedPhoto = { uri: string; base64: string };

/**
 * KrishiNetra Live AI Camera & Voice Assistant.
 *
 * Provides real-time multimodal live interaction with Google Gemini Live API:
 * - Live camera preview with 1-2 FPS continuous frame streaming
 * - Real-time spoken dialogue with Indian farmer agricultural system instruction
 * - Native audio streaming & barge-in / interruption handling
 * - Gemini function calling to KrishiNetra backend services
 * - Optional still-photo snapshot analysis mode
 */
export function VisualAssistantScreen({ onBack }: Props) {
  const { t } = useTranslation();
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraError, setCameraError] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<'back' | 'front'>('back');
  const cameraRef = useRef<CameraViewInstance>(null);

  // Still photo mode state
  const [state, setState] = useState<VisualAssistantState>('idle');
  const [photo, setPhoto] = useState<CapturedPhoto | null>(null);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Live session state
  const [isLiveActive, setIsLiveActive] = useState(false);
  const [liveState, setLiveState] = useState<LiveConnectionState>('disconnected');
  const [liveSubtitle, setLiveSubtitle] = useState<string>('');

  const liveClientRef = useRef<GeminiLiveClient | null>(null);
  const audioControllerRef = useRef<LiveAudioController | null>(null);
  const frameTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Ask for camera permission immediately on mount
  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) {
      void requestPermission();
    }
  }, [permission, requestPermission]);

  // Clean up live session on unmount
  useEffect(() => {
    return () => {
      stopLiveSession();
    };
  }, []);

  const flipCamera = useCallback(() => {
    setCameraFacing((current) => (current === 'back' ? 'front' : 'back'));
  }, []);

  // Frame sampler: captures 1 frame per second from CameraView and sends to Gemini Live
  const sampleAndSendFrame = useCallback(async () => {
    if (!cameraRef.current || !liveClientRef.current || liveClientRef.current.getState() === 'disconnected') {
      return;
    }

    try {
      const result = await cameraRef.current.takePictureAsync({
        base64: true,
        quality: 0.4,
        skipProcessing: true,
      });

      if (result?.base64 && liveClientRef.current) {
        liveClientRef.current.sendRealtimeImage(result.base64);
      }
    } catch {
      // Ignored during live stream
    }
  }, []);

  const startLiveSession = useCallback(async () => {
    if (isLiveActive) return;

    audioControllerRef.current = new LiveAudioController();
    await audioControllerRef.current.requestPermissions();

    setErrorMessage(null);
    setLiveSubtitle(t('visualAssistant.defaultGreeting'));
    setIsLiveActive(true);

    const client = new GeminiLiveClient({
      onStatusChange: (newState) => {
        setLiveState(newState);
      },
      onAudioData: (base64AudioChunk) => {
        audioControllerRef.current?.enqueueAudioChunk(base64AudioChunk);
      },
      onInterrupted: () => {
        audioControllerRef.current?.stopPlayback();
      },
      onTranscript: (text) => {
        setLiveSubtitle((prev) => (prev ? `${prev} ${text}` : text));
      },
      onToolCall: async () => ({}),
      onError: (msg) => {
        setErrorMessage(msg);
        setIsLiveActive(false);
      },
    });

    liveClientRef.current = client;
    await client.connect();

    // Start 1 FPS frame sampling
    frameTimerRef.current = setInterval(() => {
      void sampleAndSendFrame();
    }, 1200);
  }, [isLiveActive, sampleAndSendFrame, t]);

  const stopLiveSession = useCallback(() => {
    if (frameTimerRef.current) {
      clearInterval(frameTimerRef.current);
      frameTimerRef.current = null;
    }
    if (liveClientRef.current) {
      liveClientRef.current.disconnect();
      liveClientRef.current = null;
    }
    if (audioControllerRef.current) {
      audioControllerRef.current.destroy();
      audioControllerRef.current = null;
    }

    setIsLiveActive(false);
    setLiveState('disconnected');
    setLiveSubtitle('');
  }, []);

  const captureStill = useCallback(async () => {
    if (!cameraRef.current) return;
    if (isLiveActive) stopLiveSession();

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
  }, [isLiveActive, stopLiveSession]);

  const loadSamplePhoto = useCallback(() => {
    if (isLiveActive) stopLiveSession();
    setPhoto({ uri: SAMPLE_PLANT_URI, base64: SAMPLE_PLANT_BASE64 });
    setState('captured');
    setQuestion('what fruit is it');
    setAnswer(null);
    setErrorMessage(null);
  }, [isLiveActive, stopLiveSession]);

  const retakeStill = useCallback(() => {
    setPhoto(null);
    setQuestion('');
    setAnswer(null);
    setErrorMessage(null);
    setState('idle');
  }, []);

  const askStill = useCallback(async () => {
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

  // --- Camera unavailable on simulator -------------------------------------
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

  const getStatusPillColor = () => {
    switch (liveState) {
      case 'speaking':
        return avatarColors.state.speaking;
      case 'listening':
        return avatarColors.state.listening;
      case 'thinking':
      case 'connecting':
        return avatarColors.state.thinking;
      case 'error':
        return colors.danger;
      default:
        return colors.primary;
    }
  };

  const getStatusLabel = () => {
    switch (liveState) {
      case 'connecting':
        return t('visualAssistant.connecting');
      case 'speaking':
        return t('visualAssistant.speaking');
      case 'thinking':
        return t('visualAssistant.thinking');
      case 'listening':
      case 'connected':
        return t('visualAssistant.listening');
      case 'error':
        return 'Connection Error';
      default:
        return 'Live Camera';
    }
  };

  return (
    <View style={styles.root} testID="visual-assistant-camera">
      {showingPhoto ? (
        <Image source={{ uri: photo.uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      ) : (
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          facing={cameraFacing}
          onCameraReady={() => setCameraError(false)}
          onMountError={() => setCameraError(true)}
        />
      )}

      <SafeAreaView style={styles.overlay} edges={['top', 'bottom']} pointerEvents="box-none">
        <View style={styles.header}>
          <Pressable
            onPress={() => {
              stopLiveSession();
              onBack();
            }}
            hitSlop={12}
            style={styles.headerButton}
            accessibilityRole="button"
            accessibilityLabel={t('common.back')}
          >
            <Icon name="back" size={22} color="#FFFFFF" strokeWidth={2} />
          </Pressable>

          <View style={styles.headerTitleContainer}>
            <Text variant="cardTitle" color="#FFFFFF" center>
              {isLiveActive ? t('visualAssistant.liveTitle') : t('visualAssistant.headerTitle')}
            </Text>
            {isLiveActive ? (
              <View style={[styles.liveStatusBadge, { backgroundColor: getStatusPillColor() }]}>
                <View style={styles.pulsingDot} />
                <Text variant="microMedium" color="#FFFFFF">
                  {getStatusLabel()}
                </Text>
              </View>
            ) : null}
          </View>

          <View style={styles.headerRightActions}>
            <Pressable
              onPress={flipCamera}
              hitSlop={12}
              style={styles.headerButton}
              accessibilityRole="button"
              accessibilityLabel={t('visualAssistant.switchCamera')}
            >
              <Icon name="restart" size={20} color="#FFFFFF" strokeWidth={2} />
            </Pressable>

            {showingPhoto ? (
              <Pressable
                onPress={retakeStill}
                hitSlop={12}
                style={styles.headerButton}
                accessibilityRole="button"
                accessibilityLabel={t('visualAssistant.retake')}
                testID="visual-assistant-retake"
              >
                <Icon name="close" size={20} color="#FFFFFF" strokeWidth={2} />
              </Pressable>
            ) : null}
          </View>
        </View>

        <View style={styles.bottomArea}>
          {isLiveActive ? (
            <View style={styles.liveActiveCard}>
              <View style={styles.liveSpeechRow}>
                <Icon name="mic" size={20} color={avatarColors.state.speaking} />
                <Text variant="bodyMedium" color="#FFFFFF" style={styles.liveSubtitleText}>
                  {liveSubtitle || t('visualAssistant.defaultGreeting')}
                </Text>
              </View>
              <Button
                label={t('visualAssistant.endLive')}
                onPress={stopLiveSession}
                variant="secondary"
                icon="close"
              />
            </View>
          ) : state === 'idle' ? (
            <View style={styles.controlsRow}>
              <View style={styles.liveStartBlock}>
                <Button
                  label={t('visualAssistant.startLive')}
                  onPress={() => void startLiveSession()}
                  variant="primary"
                  icon="play"
                  style={styles.startLiveButton}
                />
              </View>

              <Text variant="microMedium" color="#EDEEE9" center style={styles.hint}>
                {t('visualAssistant.captureSub')}
              </Text>

              <View style={styles.captureRow}>
                <Pressable
                  onPress={loadSamplePhoto}
                  style={({ pressed }) => [styles.sampleButton, pressed && styles.capturePressed]}
                  accessibilityRole="button"
                  accessibilityLabel="Test with sample plant image"
                  testID="visual-assistant-load-sample"
                >
                  <Icon name="book" size={24} color="#FFFFFF" strokeWidth={2} />
                </Pressable>

                <Pressable
                  onPress={captureStill}
                  style={({ pressed }) => [styles.captureButton, pressed && styles.capturePressed]}
                  accessibilityRole="button"
                  accessibilityLabel={t('visualAssistant.captureLabel')}
                  testID="visual-assistant-capture"
                >
                  <Icon name="camera" size={32} color="#151714" strokeWidth={2} />
                </Pressable>
              </View>
            </View>
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
                onSubmitEditing={() => void askStill()}
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
                onPress={() => void askStill()}
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
    justifyContent: 'space-between',
  },
  headerTitleContainer: {
    alignItems: 'center',
    gap: 4,
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  headerButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  liveStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  pulsingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
  },
  bottomArea: {
    paddingHorizontal: layout.screenPadding,
    paddingBottom: 18,
    paddingTop: 14,
    gap: 12,
  },
  controlsRow: {
    gap: 12,
  },
  liveStartBlock: {
    marginBottom: 4,
  },
  startLiveButton: {
    backgroundColor: colors.primary,
  },
  hint: { minHeight: 18 },
  captureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    paddingVertical: 4,
  },
  sampleButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.45)',
  },
  captureButton: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    elevation: 6,
    shadowColor: '#000000',
    shadowOpacity: 0.3,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  capturePressed: { opacity: 0.85 },
  liveActiveCard: {
    backgroundColor: 'rgba(21, 23, 20, 0.92)',
    borderRadius: radius.lg,
    padding: layout.cardPadding,
    gap: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  liveSpeechRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  liveSubtitleText: {
    flex: 1,
    lineHeight: 22,
  },
  answerCard: {
    backgroundColor: avatarColors.pillBg,
    padding: layout.cardPadding,
    gap: 6,
    borderRadius: radius.lg,
  },
  answerBadge: { alignSelf: 'flex-start' },
});
