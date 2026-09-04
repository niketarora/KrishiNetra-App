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
// camera itself initialises.
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

    it('shows suggestion chips after capturing photo and allows selecting one', async () => {
      mockInvoke.mockResolvedValueOnce({
        data: { answer: 'यह एक स्वस्थ मिर्च का पौधा है।' },
        error: null,
      });

      await renderWithProviders(<VisualAssistantScreen onBack={onBack} />);
      await capture();

      const chip = screen.getByText('🌿 बीमारी क्या है?');
      expect(chip).toBeTruthy();
      await fireEvent.press(chip);

      expect(await screen.findByText('यह एक स्वस्थ मिर्च का पौधा है।')).toBeTruthy();
    });
  });

  describe('asking a question in any language', () => {
    it('sends photo and question, displays the asked question and answer on screen', async () => {
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

      // Verifies both the asked question text and the answer text appear on screen
      expect(await screen.findByText('"Are these tomatoes ripe?"')).toBeTruthy();
      expect(screen.getByText('Your tomatoes look ready to pick.')).toBeTruthy();
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

  describe('voice query with Sarvam STT & TTS', () => {
    it('shows microphone button and starts voice recording', async () => {
      await renderWithProviders(<VisualAssistantScreen onBack={onBack} />);
      await capture();

      expect(screen.getByTestId('visual-assistant-mic')).toBeTruthy();

      await fireEvent.press(screen.getByTestId('visual-assistant-mic'));

      expect(screen.getByTestId('visual-assistant-voice-recording')).toBeTruthy();
      expect(screen.getByTestId('visual-assistant-voice-stop')).toBeTruthy();
      expect(screen.getByTestId('visual-assistant-voice-cancel')).toBeTruthy();
    });

    it('cancels voice recording when cancel is pressed', async () => {
      await renderWithProviders(<VisualAssistantScreen onBack={onBack} />);
      await capture();

      await fireEvent.press(screen.getByTestId('visual-assistant-mic'));
      expect(screen.getByTestId('visual-assistant-voice-recording')).toBeTruthy();

      await fireEvent.press(screen.getByTestId('visual-assistant-voice-cancel'));
      expect(screen.queryByTestId('visual-assistant-voice-recording')).toBeNull();
      expect(screen.getByTestId('visual-assistant-mic')).toBeTruthy();
    });

    it('submits voice query and displays transcribed diagnosis answer', async () => {
      mockInvoke.mockResolvedValueOnce({
        data: {
          answer: 'यह मरोड़िया रोग के लक्षण हैं।',
        },
        error: null,
      });

      await renderWithProviders(<VisualAssistantScreen onBack={onBack} />);
      await capture();

      await fireEvent.press(screen.getByTestId('visual-assistant-mic'));
      await fireEvent.press(screen.getByTestId('visual-assistant-voice-stop'));

      expect(await screen.findByText('यह मरोड़िया रोग के लक्षण हैं।')).toBeTruthy();
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
