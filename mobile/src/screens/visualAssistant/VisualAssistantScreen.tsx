import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import type { CameraView as CameraViewInstance } from 'expo-camera';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { File, Paths } from 'expo-file-system';

import { Banner, Button, Icon, Screen, ScreenHeader, Text } from '@/components/ui';
import { resolveVisualAssistantAnswer, type VisualAssistantState } from '@/features/visualAssistant/demo';
import { useVisualVoiceRecorder } from '@/features/visualAssistant/useVisualVoiceRecorder';
import { SAMPLE_PLANT_BASE64, SAMPLE_PLANT_URI } from '@/features/visualAssistant/sampleImage';
import { avatarColors, colors, layout, radius } from '@/theme';

type Props = { onBack: () => void };
type CapturedPhoto = { uri: string; base64: string };

const SUGGESTED_QUESTIONS = [
  { id: 'disease', label: '🌿 बीमारी क्या है?', question: 'पौधे में क्या बीमारी या समस्या है और इसका उपचार क्या है?' },
  { id: 'identify', label: '🌾 यह कौन सा पौधा है?', question: 'यह कौन सी फसल या पौधा है? पहचानें।' },
  { id: 'treatment', label: '🧪 दवा व खाद क्या डालें?', question: 'इस फसल के लिए उपयुक्त दवा या कीटनाशक क्या है?' },
  { id: 'spots', label: '🍂 पत्तियों पर धब्बे', question: 'पत्तियों पर धब्बों का क्या कारण और रोकथाम क्या है?' },
];

/**
 * KrishiNetra Multilingual AI Camera & Voice Assistant.
 *
 * Provides camera vision diagnosis in all 22 official Indian languages + English:
 * - High-speed camera photo capture & analysis with Gemini 3.6 Flash
 * - Vernacular voice transcription & speech playback via Sarvam STT & TTS
 * - Shows transcribed/typed question text and AI answer on screen
 * - Replay voice audio on demand in the farmer's native language
 */
export function VisualAssistantScreen({ onBack }: Props) {
  const { t, i18n } = useTranslation();
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraError, setCameraError] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<'back' | 'front'>('back');
  const cameraRef = useRef<CameraViewInstance>(null);

  // Still photo mode state
  const [state, setState] = useState<VisualAssistantState>('idle');
  const [photo, setPhoto] = useState<CapturedPhoto | null>(null);
  const [question, setQuestion] = useState('');
  const [askedQuestion, setAskedQuestion] = useState<string | null>(null);
  const [answer, setAnswer] = useState<string | null>(null);
  const [latestAudio, setLatestAudio] = useState<string | null>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Voice recording state for Sarvam STT
  const voiceRecorder = useVisualVoiceRecorder();
  const [isTranscribingVoice, setIsTranscribingVoice] = useState(false);

  const stillPlayerRef = useRef<AudioPlayer | null>(null);

  // Stop still audio player helper
  const stopStillAudio = useCallback(() => {
    if (stillPlayerRef.current) {
      try {
        stillPlayerRef.current.remove();
      } catch {
        // Ignored
      }
      stillPlayerRef.current = null;
    }
    setIsPlayingAudio(false);
  }, []);

  // Play spoken WAV audio
  const playSpokenAudio = useCallback(async (base64Wav: string) => {
    if (!base64Wav) return;
    stopStillAudio();

    try {
      await setAudioModeAsync({
        playsInSilentMode: true,
        allowsRecording: false,
        shouldRouteThroughEarpiece: false,
      });

      const file = new File(Paths.cache, 'visual-answer.wav');
      if (file.exists) file.delete();
      file.create();
      file.write(base64Wav, { encoding: 'base64' });

      const player = createAudioPlayer(file);
      stillPlayerRef.current = player;
      setIsPlayingAudio(true);

      player.addListener('playbackStatusUpdate', (status) => {
        if (status.didJustFinish) {
          setIsPlayingAudio(false);
          stopStillAudio();
        }
      });

      player.play();
    } catch (err) {
      console.warn('[VisualAssistant] Audio playback error:', err);
      setIsPlayingAudio(false);
    }
  }, [stopStillAudio]);

  // Ask for camera permission immediately on mount
  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) {
      void requestPermission();
    }
  }, [permission, requestPermission]);

  // Clean up audio on unmount
  useEffect(() => {
    return () => {
      stopStillAudio();
    };
  }, [stopStillAudio]);

  const flipCamera = useCallback(() => {
    setCameraFacing((current) => (current === 'back' ? 'front' : 'back'));
  }, []);

  const handleSendMessage = useCallback(async (customText?: string) => {
    const textToSend = (customText ?? question).trim();
    if (!textToSend) return;

    // Capture camera frame if not already captured
    let currentPhoto = photo;
    if (!currentPhoto && cameraRef.current) {
      try {
        const snap = await cameraRef.current.takePictureAsync({ base64: true, quality: 0.5 });
        if (snap?.base64) {
          currentPhoto = { uri: snap.uri, base64: snap.base64 };
          setPhoto(currentPhoto);
          setState('captured');
        }
      } catch (err) {
        console.warn('Snap error:', err);
      }
    }

    if (!currentPhoto) return;

    setAskedQuestion(textToSend);
    setState('asking');
    setErrorMessage(null);
    stopStillAudio();

    try {
      const result = await resolveVisualAssistantAnswer(t, {
        imageBase64: currentPhoto.base64,
        mimeType: 'image/jpeg',
        questionText: textToSend,
        language: i18n.language || 'hi',
      });

      setAnswer(result.answer);
      setLatestAudio(result.audio ?? null);
      setState('answered');
      setQuestion('');

      // Automatically speak the response aloud in the farmer's language
      if (result.audio) {
        void playSpokenAudio(result.audio);
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : t('visualAssistant.errors.generic'));
      setState('error');
    }
  }, [i18n.language, photo, playSpokenAudio, question, stopStillAudio, t]);

  // --- Sarvam Voice Query Handlers (STT -> Vision in 22 languages -> TTS) ------
  const handleStartVoiceQuery = useCallback(async () => {
    stopStillAudio();
    const started = await voiceRecorder.startRecording();
    if (!started) {
      setErrorMessage(t('visualAssistant.permissionMic') || 'Microphone permission required for voice query.');
    }
  }, [stopStillAudio, voiceRecorder, t]);

  const handleStopVoiceQuery = useCallback(async () => {
    setIsTranscribingVoice(true);
    setErrorMessage(null);

    const audioBase64 = await voiceRecorder.stopAndGetBase64();
    if (!audioBase64) {
      setIsTranscribingVoice(false);
      setErrorMessage(t('visualAssistant.voiceError') || 'Could not record audio. Please try again.');
      return;
    }

    // Auto snap camera frame if no photo captured yet
    let currentPhoto = photo;
    if (!currentPhoto && cameraRef.current) {
      try {
        const snap = await cameraRef.current.takePictureAsync({ base64: true, quality: 0.5 });
        if (snap?.base64) {
          currentPhoto = { uri: snap.uri, base64: snap.base64 };
          setPhoto(currentPhoto);
          setState('captured');
        }
      } catch (err) {
        console.warn('Voice query snap error:', err);
      }
    }

    if (!currentPhoto) {
      setIsTranscribingVoice(false);
      setErrorMessage(t('visualAssistant.errors.generic'));
      return;
    }

    setState('asking');
    stopStillAudio();

    try {
      const result = await resolveVisualAssistantAnswer(t, {
        imageBase64: currentPhoto.base64,
        mimeType: 'image/jpeg',
        questionText: question.trim() || undefined,
        audioBase64,
        audioMimeType: 'audio/mp4',
        language: i18n.language || 'hi',
      });

      const resolvedQuestion = result.question || question.trim() || t('visualAssistant.spokenQuestion') || 'मौखिक प्रश्न (Voice Query)';
      setAskedQuestion(resolvedQuestion);
      setQuestion(resolvedQuestion);
      setAnswer(result.answer);
      setLatestAudio(result.audio ?? null);
      setState('answered');

      // Automatically play Sarvam TTS spoken answer
      if (result.audio) {
        void playSpokenAudio(result.audio);
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : t('visualAssistant.errors.generic'));
      setState('error');
    } finally {
      setIsTranscribingVoice(false);
    }
  }, [
    i18n.language,
    photo,
    playSpokenAudio,
    question,
    stopStillAudio,
    t,
    voiceRecorder,
  ]);

  const handleCancelVoiceQuery = useCallback(async () => {
    await voiceRecorder.cancelRecording();
    setIsTranscribingVoice(false);
  }, [voiceRecorder]);

  const captureStill = useCallback(async () => {
    if (!cameraRef.current) return;
    stopStillAudio();

    try {
      const result = await cameraRef.current.takePictureAsync({
        base64: true,
        quality: 0.4,
        skipProcessing: true,
      });
      if (!result?.base64) {
        setCameraError(true);
        return;
      }
      setPhoto({ uri: result.uri, base64: result.base64 });
      setState('captured');
      setAnswer(null);
      setAskedQuestion(null);
      setLatestAudio(null);
      setErrorMessage(null);
    } catch {
      setCameraError(true);
    }
  }, [stopStillAudio]);

  const loadSamplePhoto = useCallback(() => {
    stopStillAudio();
    setPhoto({ uri: SAMPLE_PLANT_URI, base64: SAMPLE_PLANT_BASE64 });
    setState('captured');
    setQuestion('इस पौधे में क्या समस्या या बीमारी है?');
    setAnswer(null);
    setAskedQuestion(null);
    setLatestAudio(null);
    setErrorMessage(null);
  }, [stopStillAudio]);

  const retakeStill = useCallback(() => {
    stopStillAudio();
    setPhoto(null);
    setQuestion('');
    setAskedQuestion(null);
    setAnswer(null);
    setLatestAudio(null);
    setErrorMessage(null);
    setState('idle');
  }, [stopStillAudio]);

  const handleSelectChip = useCallback((chipQuestion: string) => {
    setQuestion(chipQuestion);
    void handleSendMessage(chipQuestion);
  }, [handleSendMessage]);

  // --- Permission resolving -------------------------------------------------
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

  // --- Permission denied ----------------------------------------------------
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

  // --- Camera unavailable --------------------------------------------------
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
          facing={cameraFacing}
          onCameraReady={() => setCameraError(false)}
          onMountError={() => setCameraError(true)}
        />
      )}

      <SafeAreaView style={styles.overlay} edges={['top', 'bottom']} pointerEvents="box-none">
        <View style={styles.header}>
          <Pressable
            onPress={() => {
              stopStillAudio();
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
              {t('visualAssistant.headerTitle')}
            </Text>
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

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}
        >
          <View style={styles.bottomArea}>
            {/* AI Response & Question Display Card */}
            {answer ? (
              <View style={styles.answerCard} testID="visual-assistant-answer">
                {askedQuestion ? (
                  <View style={styles.askedQuestionBox}>
                    <View style={styles.askedBadge}>
                      <Text variant="microMedium" color="#FFFFFF">
                        👨‍🌾 {t('visualAssistant.yourQuestion') || 'आपका सवाल'}
                      </Text>
                    </View>
                    <Text variant="bodyMedium" color="#FFFFFF" style={styles.askedQuestionText}>
                      "{askedQuestion}"
                    </Text>
                  </View>
                ) : null}

                <View style={styles.answerHeaderRow}>
                  <View style={styles.answerBadge}>
                    <Text variant="microMedium" color={avatarColors.state.speaking}>
                      {t('visualAssistant.answerLabel')}
                    </Text>
                  </View>

                  {isPlayingAudio ? (
                    <View style={styles.speakingBadge}>
                      <View style={styles.speakingDot} />
                      <Text variant="microMedium" color="#FFFFFF">
                        बोल रहा है...
                      </Text>
                    </View>
                  ) : null}
                </View>

                <Text variant="body" color="#FFFFFF" style={styles.answerText}>
                  {answer}
                </Text>

                {/* Spoken Voice Replay Controls */}
                {latestAudio ? (
                  <View style={styles.audioControlsRow}>
                    {isPlayingAudio ? (
                      <Pressable
                        onPress={stopStillAudio}
                        style={styles.audioActionButton}
                        accessibilityRole="button"
                        accessibilityLabel="Stop Audio"
                      >
                        <Icon name="close" size={16} color="#FFFFFF" />
                        <Text variant="bodyMedium" color="#FFFFFF">
                          रोकें (Stop)
                        </Text>
                      </Pressable>
                    ) : (
                      <Pressable
                        onPress={() => void playSpokenAudio(latestAudio)}
                        style={styles.audioActionButton}
                        accessibilityRole="button"
                        accessibilityLabel="Replay Voice"
                      >
                        <Icon name="play" size={16} color="#FFFFFF" />
                        <Text variant="bodyMedium" color="#FFFFFF">
                          🔊 आवाज़ सुनें (Replay)
                        </Text>
                      </Pressable>
                    )}
                  </View>
                ) : null}
              </View>
            ) : null}

            {errorMessage ? (
              <Banner title={errorMessage} tone="danger" icon="alert" />
            ) : null}

            {/* Quick Suggestion Chips */}
            {showingPhoto && !answer && !asking ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chipsContainer}
              >
                {SUGGESTED_QUESTIONS.map((item) => (
                  <Pressable
                    key={item.id}
                    style={styles.suggestionChip}
                    onPress={() => handleSelectChip(item.question)}
                  >
                    <Text variant="microMedium" color="#FFFFFF">
                      {item.label}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            ) : null}

            {/* Interactive Message Box with Text Input, Voice Mic & Send */}
            {voiceRecorder.isRecording ? (
              <View style={styles.voiceRecordingRow} testID="visual-assistant-voice-recording">
                <View style={styles.voiceRecordingIndicator}>
                  <View style={styles.recordingPulseDot} />
                  <Text variant="microMedium" color="#EF4444">
                    {t('visualAssistant.listeningVoice') || 'बोलें... (Listening...)'} ({voiceRecorder.recordSeconds}s)
                  </Text>
                </View>
                <View style={styles.voiceRecordingActions}>
                  <Pressable
                    onPress={() => void handleCancelVoiceQuery()}
                    style={styles.voiceCancelButton}
                    accessibilityRole="button"
                    accessibilityLabel={t('visualAssistant.cancelVoice')}
                    testID="visual-assistant-voice-cancel"
                  >
                    <Icon name="close" size={16} color="#FFFFFF" />
                  </Pressable>
                  <Pressable
                    onPress={() => void handleStopVoiceQuery()}
                    style={styles.voiceStopAskButton}
                    accessibilityRole="button"
                    accessibilityLabel={t('visualAssistant.stopAndAsk')}
                    testID="visual-assistant-voice-stop"
                  >
                    <Icon name="check" size={16} color="#FFFFFF" strokeWidth={2.5} />
                    <Text variant="microMedium" color="#FFFFFF">
                      {t('visualAssistant.stopAndAsk') || 'पूछें'}
                    </Text>
                  </Pressable>
                </View>
              </View>
            ) : isTranscribingVoice ? (
              <View style={styles.voiceRecordingRow} testID="visual-assistant-transcribing">
                <ActivityIndicator size="small" color={avatarColors.state.speaking} />
                <Text variant="microMedium" color="#FFFFFF">
                  {t('visualAssistant.transcribingVoice') || 'Sarvam AI आवाज़ को समझ रहा है...'}
                </Text>
              </View>
            ) : (
              <View style={styles.messageBoxRow}>
                <View style={styles.inputContainer}>
                  <TextInput
                    style={styles.messageInput}
                    placeholder="Type or speak question about this crop..."
                    placeholderTextColor="rgba(255, 255, 255, 0.6)"
                    value={question}
                    onChangeText={setQuestion}
                    editable={!asking}
                    returnKeyType="send"
                    onSubmitEditing={() => void handleSendMessage()}
                    testID="visual-assistant-question"
                  />
                </View>

                {/* Voice Query Mic Button (Sarvam STT in 22 languages) */}
                <Pressable
                  onPress={() => void handleStartVoiceQuery()}
                  disabled={asking}
                  style={({ pressed }) => [
                    styles.micButton,
                    pressed && styles.capturePressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={t('visualAssistant.askWithVoice')}
                  testID="visual-assistant-mic"
                >
                  <Icon name="mic" size={20} color="#FFFFFF" strokeWidth={2.2} />
                </Pressable>

                {/* Send Question Button */}
                <Pressable
                  onPress={() => void handleSendMessage()}
                  disabled={!question.trim() || asking}
                  style={({ pressed }) => [
                    styles.sendButton,
                    !question.trim() && styles.sendButtonDisabled,
                    pressed && styles.capturePressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Send Question"
                  testID="visual-assistant-ask"
                >
                  {asking ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Icon name="rocket" size={20} color="#FFFFFF" strokeWidth={2.2} />
                  )}
                </Pressable>
              </View>
            )}

            {/* Camera Actions Bar */}
            <View style={styles.actionRow}>
              {showingPhoto ? (
                <Button
                  label={t('visualAssistant.retake') || 'दोबारा फोटो लें'}
                  onPress={retakeStill}
                  variant="secondary"
                  icon="restart"
                  style={styles.flexButton}
                />
              ) : null}

              <Pressable
                onPress={captureStill}
                style={({ pressed }) => [styles.snapButton, pressed && styles.capturePressed]}
                accessibilityRole="button"
                accessibilityLabel={t('visualAssistant.captureLabel')}
                testID="visual-assistant-capture"
              >
                <Icon name="camera" size={26} color="#151714" strokeWidth={2} />
              </Pressable>

              <Pressable
                onPress={loadSamplePhoto}
                style={({ pressed }) => [styles.sampleButtonSmall, pressed && styles.capturePressed]}
                accessibilityRole="button"
                accessibilityLabel="Test sample plant"
                testID="visual-assistant-load-sample"
              >
                <Icon name="book" size={20} color="#FFFFFF" strokeWidth={2} />
              </Pressable>
            </View>

            <Text variant="micro" color={avatarColors.footerHint} center>
              {t('visualAssistant.answerDisclaimer')}
            </Text>
          </View>
        </KeyboardAvoidingView>
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
  bottomArea: {
    paddingHorizontal: layout.screenPadding,
    paddingBottom: 18,
    paddingTop: 14,
    gap: 12,
  },
  askedQuestionBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: radius.md,
    padding: 10,
    gap: 4,
    marginBottom: 4,
  },
  askedBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  askedQuestionText: {
    lineHeight: 20,
    fontStyle: 'italic',
  },
  answerCard: {
    backgroundColor: 'rgba(21, 23, 20, 0.95)',
    padding: layout.cardPadding,
    gap: 8,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  answerHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  answerBadge: { alignSelf: 'flex-start' },
  speakingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  speakingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
  },
  answerText: {
    lineHeight: 22,
  },
  audioControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 4,
  },
  audioActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  chipsContainer: {
    gap: 8,
    paddingVertical: 4,
  },
  suggestionChip: {
    backgroundColor: 'rgba(21, 23, 20, 0.88)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  messageBoxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  inputContainer: {
    flex: 1,
  },
  messageInput: {
    backgroundColor: 'rgba(21, 23, 20, 0.92)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    borderRadius: radius.pill,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: '#FFFFFF',
    fontSize: 15,
  },
  sendButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000000',
    shadowOpacity: 0.3,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  sendButtonDisabled: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  micButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#059669',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000000',
    shadowOpacity: 0.3,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  voiceRecordingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(21, 23, 20, 0.94)',
    borderWidth: 1.5,
    borderColor: '#EF4444',
    borderRadius: radius.pill,
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 12,
  },
  voiceRecordingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  recordingPulseDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#EF4444',
  },
  voiceRecordingActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  voiceCancelButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  voiceStopAskButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  flexButton: {
    flex: 1,
  },
  snapButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000000',
    shadowOpacity: 0.35,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  sampleButtonSmall: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  capturePressed: { opacity: 0.85 },
});
