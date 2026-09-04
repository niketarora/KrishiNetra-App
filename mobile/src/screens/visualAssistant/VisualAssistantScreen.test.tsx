import type { Ref } from 'react';
import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithProviders } from '@/test-utils';

import { VisualAssistantScreen } from './VisualAssistantScreen';

type MockPermission = { granted: boolean; canAskAgain: boolean } | null;

let mockPermission: MockPermission = { granted: true, canAskAgain: true };
const mockRequestPermission = jest.fn();
const mockTakePictureAsync = jest.fn(async () => ({
  uri: 'file:///fake-photo.jpg',
  base64: 'ZmFrZS1qcGVnLWJ5dGVz',
}));

// expo-camera needs a native module; these tests only care that this screen
// reads permission state and drives capture/render correctly, not that the
// camera itself initialises — matching how react-native-maps is mocked
// globally in jest.setup.js for the same reason.
jest.mock('expo-camera', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    __esModule: true,
    CameraView: React.forwardRef(
      (props: Record<string, unknown>, ref: Ref<{ takePictureAsync: typeof mockTakePictureAsync }>) => {
        React.useImperativeHandle(ref, () => ({ takePictureAsync: mockTakePictureAsync }));
        return React.createElement(View, props);
      },
    ),
    useCameraPermissions: () => [mockPermission, mockRequestPermission],
  };
});

const mockSendTextPrompt = jest.fn();
const mockFinishUserTurn = jest.fn((text?: string) => {
  if (text) mockSendTextPrompt(text);
});
const mockSendRealtimeImage = jest.fn();
const mockSendRealtimeAudio = jest.fn();
const mockLiveConnect = jest.fn().mockResolvedValue(undefined);
const mockLiveDisconnect = jest.fn();

jest.mock('@/features/visualAssistant/GeminiLiveClient', () => ({
  GeminiLiveClient: jest.fn().mockImplementation((callbacks) => ({
    connect: mockLiveConnect,
    disconnect: mockLiveDisconnect,
    getState: jest.fn(() => 'connected'),
    sendTextPrompt: mockSendTextPrompt,
    sendRealtimeImage: mockSendRealtimeImage,
    sendRealtimeAudio: mockSendRealtimeAudio,
    finishUserTurn: mockFinishUserTurn,
    callbacks,
  })),
}));

jest.mock('@/features/visualAssistant/AudioController', () => ({
  LiveAudioController: jest.fn().mockImplementation(() => ({
    requestPermissions: jest.fn().mockResolvedValue(true),
    startRecording: jest.fn().mockResolvedValue(undefined),
    stopRecording: jest.fn(),
    enqueueAudioChunk: jest.fn(),
    stopPlayback: jest.fn(),
    destroy: jest.fn(),
  })),
}));

const mockInvoke = jest.fn();
jest.mock('@/services/supabase', () => ({
  supabase: { functions: { invoke: (...args: unknown[]) => mockInvoke(...args) } },
}));

const onBack = jest.fn();

async function capture() {
  await fireEvent.press(screen.getByTestId('visual-assistant-capture'));
}

describe('VisualAssistantScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPermission = { granted: true, canAskAgain: true };
  });

  describe('camera permission', () => {
    it('shows the live camera and capture button once permission is granted', async () => {
      await renderWithProviders(<VisualAssistantScreen onBack={onBack} />);

      expect(screen.getByTestId('visual-assistant-camera')).toBeTruthy();
      expect(screen.getByTestId('visual-assistant-capture')).toBeTruthy();
    });

    it('asks again rather than dead-ending when permission can still be requested', async () => {
      mockPermission = { granted: false, canAskAgain: true };
      await renderWithProviders(<VisualAssistantScreen onBack={onBack} />);

      expect(mockRequestPermission).toHaveBeenCalled();
      expect(screen.getByText('Allow camera')).toBeTruthy();
    });

    it('points the farmer to phone settings when permission is permanently denied', async () => {
      mockPermission = { granted: false, canAskAgain: false };
      await renderWithProviders(<VisualAssistantScreen onBack={onBack} />);

      expect(
        screen.getByText("Camera permission is off. Turn it on in your phone's settings to use this feature."),
      ).toBeTruthy();
      expect(screen.queryByText('Allow camera')).toBeNull();
    });
  });

  describe('capturing a photo', () => {
    it('takes a real picture and reveals the question field', async () => {
      await renderWithProviders(<VisualAssistantScreen onBack={onBack} />);

      await capture();

      expect(mockTakePictureAsync).toHaveBeenCalledWith(
        expect.objectContaining({ base64: true }),
      );
      expect(screen.getByTestId('visual-assistant-question')).toBeTruthy();
      expect(screen.getByTestId('visual-assistant-ask')).toBeTruthy();
    });

    it('returns to the live camera on retake', async () => {
      await renderWithProviders(<VisualAssistantScreen onBack={onBack} />);

      await capture();
      await fireEvent.press(screen.getByTestId('visual-assistant-retake'));

      expect(screen.getByTestId('visual-assistant-capture')).toBeTruthy();
      expect(screen.queryByTestId('visual-assistant-retake')).toBeNull();
    });
  });

  describe('asking a real question', () => {
    it('sends the photo and question, then shows the real answer with a disclaimer', async () => {
      mockInvoke.mockResolvedValueOnce({
        data: { answer: 'Your tomatoes look ready to pick.' },
        error: null,
      });

      await renderWithProviders(<VisualAssistantScreen onBack={onBack} />);
      await capture();

      await fireEvent.changeText(
        screen.getByTestId('visual-assistant-question'),
        'Are these tomatoes ripe?',
      );
      await fireEvent.press(screen.getByTestId('visual-assistant-ask'));

      expect(mockInvoke).toHaveBeenCalledWith(
        'visual-assistant-ask',
        expect.objectContaining({
          body: expect.objectContaining({
            imageBase64: 'ZmFrZS1qcGVnLWJ5dGVz',
            mimeType: 'image/jpeg',
            question: 'Are these tomatoes ripe?',
          }),
        }),
      );

      expect(await screen.findByText('Your tomatoes look ready to pick.')).toBeTruthy();
      expect(screen.getByText('AI answer')).toBeTruthy();
      expect(
        screen.getByText(
          'This answer comes directly from an AI model and is not yet checked by KrishiNetra — a preview, not official advice.',
        ),
      ).toBeTruthy();
    });

    it('shows a translated error and lets the farmer retry when the call fails', async () => {
      mockInvoke.mockResolvedValueOnce({ data: null, error: new Error('boom') });

      await renderWithProviders(<VisualAssistantScreen onBack={onBack} />);
      await capture();

      await fireEvent.changeText(
        screen.getByTestId('visual-assistant-question'),
        'Are these tomatoes ripe?',
      );
      await fireEvent.press(screen.getByTestId('visual-assistant-ask'));

      expect(
        await screen.findByText("We couldn't get an answer. Check your connection and try again."),
      ).toBeTruthy();
      // Never a raw/internal error string reaching the farmer.
      expect(screen.queryByText('boom')).toBeNull();
      expect(screen.getByTestId('visual-assistant-ask')).toBeTruthy();
    });

    it('disables Ask until a question is typed', async () => {
      await renderWithProviders(<VisualAssistantScreen onBack={onBack} />);
      await capture();

      await fireEvent.press(screen.getByTestId('visual-assistant-ask'));

      expect(mockInvoke).not.toHaveBeenCalled();
    });
  });

  describe('live assistant mode', () => {
    it('allows typing and sending a question in live mode', async () => {
      await renderWithProviders(<VisualAssistantScreen onBack={onBack} />);

      // Start live mode
      await fireEvent.press(screen.getByText('Start Live Assistant'));

      expect(mockLiveConnect).toHaveBeenCalled();
      expect(screen.getByTestId('visual-assistant-live-card')).toBeTruthy();

      // Type question into live mode input
      await fireEvent.changeText(
        screen.getByTestId('visual-assistant-question'),
        'पत्तियों में पीलापन क्यों है?',
      );
      await fireEvent.press(screen.getByTestId('visual-assistant-ask'));

      expect(mockSendTextPrompt).toHaveBeenCalledWith('पत्तियों में पीलापन क्यों है?');
      expect(screen.getByText('पत्तियों में पीलापन क्यों है?')).toBeTruthy();
    });

    it('allows tapping suggestion chips during live mode', async () => {
      await renderWithProviders(<VisualAssistantScreen onBack={onBack} />);

      // Start live mode
      await fireEvent.press(screen.getByText('Start Live Assistant'));

      // Suggestion chip should be visible and clickable in live mode
      const chip = screen.getByText('🌿 बीमारी क्या है?');
      expect(chip).toBeTruthy();
      await fireEvent.press(chip);

      expect(mockSendTextPrompt).toHaveBeenCalledWith(
        'पौधे में क्या बीमारी या समस्या है और इसका उपचार क्या है?',
      );
    });

    it('triggers question completion when End Question & Ask AI button is pressed in live mode', async () => {
      await renderWithProviders(<VisualAssistantScreen onBack={onBack} />);

      // Start live mode
      await fireEvent.press(screen.getByText('Start Live Assistant'));

      // The live ask button should be present
      const askButton = screen.getByTestId('visual-assistant-live-ask');
      expect(askButton).toBeTruthy();

      await fireEvent.press(askButton);

      expect(mockFinishUserTurn).toHaveBeenCalled();
    });
  });

  describe('navigation', () => {
    it('goes back from the header', async () => {
      await renderWithProviders(<VisualAssistantScreen onBack={onBack} />);

      await fireEvent.press(screen.getByLabelText('Back'));

      expect(onBack).toHaveBeenCalled();
    });
  });
});
