import type { ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { I18nextProvider } from 'react-i18next';

import i18n from '@/i18n';
import { chat, transcribe } from '@/services/avatarService';
import { DataError } from '@/services/errors';

import { AvatarProvider, useAvatar } from './AvatarContext';
import { VoiceRecorderError } from './useVoiceRecorder';

jest.mock('@/services/avatarService', () => ({
  transcribe: jest.fn(),
  chat: jest.fn(),
  speak: jest.fn(async () => ({ audio: '', mimeType: 'audio/wav', sampleRate: 16000 })),
}));

const mockRecorder = {
  start: jest.fn(async () => undefined),
  stop: jest.fn(async () => 'file:///tmp/speech.m4a'),
  cancel: jest.fn(async () => undefined),
};

jest.mock('./useVoiceRecorder', () => ({
  ...jest.requireActual('./useVoiceRecorder'),
  useVoiceRecorder: () => mockRecorder,
}));

const mockSpeech = {
  play: jest.fn(async () => undefined),
  stop: jest.fn(),
};

jest.mock('./useSpeechPlayer', () => ({
  ...jest.requireActual('./useSpeechPlayer'),
  useSpeechPlayer: () => mockSpeech,
}));

/**
 * Hold the next answer in `speaking` until the test says the audio finished.
 *
 * Playback is what ends a turn now, so a test that wants to look at the avatar
 * mid-answer has to stop the audio from completing instantly.
 */
function holdSpeech(): () => Promise<void> {
  let release: () => void = () => {};
  mockSpeech.play.mockImplementationOnce(
    () =>
      new Promise<undefined>((resolve) => {
        release = () => resolve(undefined);
      }),
  );

  return async () => {
    await act(async () => release());
  };
}

const mockedTranscribe = transcribe as jest.MockedFunction<typeof transcribe>;
const mockedChat = chat as jest.MockedFunction<typeof chat>;

/**
 * i18n has to be present: the provider reads `i18n.language` to tell the API
 * which language to answer in, and without it that arrives undefined.
 */
function wrapper({ children }: { children: ReactNode }) {
  return (
    <I18nextProvider i18n={i18n}>
      <AvatarProvider>{children}</AvatarProvider>
    </I18nextProvider>
  );
}

/**
 * Testing Library v14's `renderHook` is async, exactly like its `render` —
 * see the note in `test-utils.tsx`. Forgetting the await leaves `result`
 * undefined rather than failing loudly.
 */
async function setup() {
  return renderHook(() => useAvatar(), { wrapper });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockSpeech.play.mockReset();
  mockSpeech.play.mockResolvedValue(undefined);
  mockSpeech.stop.mockReset();
  mockRecorder.start.mockResolvedValue(undefined);
  mockRecorder.stop.mockResolvedValue('file:///tmp/speech.m4a');
  mockedTranscribe.mockResolvedValue({ text: 'मेरा खेत कितना बड़ा है', language: 'hi-IN' });
  mockedChat.mockResolvedValue({ text: 'आपका खेत 2.50 एकड़ है।', model: 'gemini-2.5-flash' });
});

describe('the conversational loop', () => {
  it('runs listening → thinking → speaking → idle against the real services', async () => {
    const finishSpeaking = holdSpeech();
    const { result } = await setup();

    expect(result.current.state).toBe('idle');

    await act(async () => result.current.pressMic());
    expect(result.current.state).toBe('listening');
    expect(mockRecorder.start).toHaveBeenCalled();

    await act(async () => result.current.pressMic());

    await waitFor(() => expect(result.current.state).toBe('speaking'));
    expect(result.current.answer).toBe('आपका खेत 2.50 एकड़ है।');

    // The answer being read out is what holds `speaking` open; the avatar is
    // ready for the next question once the audio ends.
    await finishSpeaking();
    await waitFor(() => expect(result.current.state).toBe('idle'));
  });

  it('reads the answer aloud in the language it was given', async () => {
    const { result } = await setup();

    await act(async () => result.current.pressMic());
    await act(async () => result.current.pressMic());
    await waitFor(() => expect(mockSpeech.play).toHaveBeenCalled());

    expect(mockSpeech.play).toHaveBeenCalledWith(
      'आपका खेत 2.50 एकड़ है।',
      expect.any(String),
    );
  });

  it('keeps the answer when the voice fails', async () => {
    // A farmer who can read the sentence has still been answered. Losing the
    // audio must not turn a good reply into an error screen.
    mockSpeech.play.mockRejectedValueOnce(new DataError('avatar.errors.voice'));
    const { result } = await setup();

    await act(async () => result.current.pressMic());
    await act(async () => result.current.pressMic());

    await waitFor(() => expect(result.current.state).toBe('idle'));
    expect(result.current.errorKey).toBeNull();
    expect(mockedChat).toHaveBeenCalled();
  });

  it('sends the transcript to the model, not a guess at it', async () => {
    const { result } = await setup();

    await act(async () => result.current.pressMic());
    await act(async () => result.current.pressMic());
    await waitFor(() => expect(mockedChat).toHaveBeenCalled());

    expect(mockedChat).toHaveBeenCalledWith(
      [{ role: 'user', text: 'मेरा खेत कितना बड़ा है' }],
      expect.any(String),
    );
  });

  it('labels the answer as coming from the assistant', async () => {
    holdSpeech();
    const { result } = await setup();

    await act(async () => result.current.pressMic());
    await act(async () => result.current.pressMic());
    await waitFor(() => expect(result.current.state).toBe('speaking'));

    // Never "From your field record" — the wording is the model's, even when
    // the underlying facts are the farmer's own.
    expect(result.current.source).toBe('avatar.sources.assistant');
  });

  it('carries the conversation forward so follow-ups make sense', async () => {
    const { result } = await setup();

    await act(async () => result.current.pressMic());
    await act(async () => result.current.pressMic());
    await waitFor(() => expect(mockedChat).toHaveBeenCalledTimes(1));

    mockedTranscribe.mockResolvedValue({ text: 'और मंडी भाव?', language: 'hi-IN' });

    await act(async () => result.current.pressMic());
    await act(async () => result.current.pressMic());
    await waitFor(() => expect(mockedChat).toHaveBeenCalledTimes(2));

    expect(mockedChat.mock.calls[1]?.[0]).toEqual([
      { role: 'user', text: 'मेरा खेत कितना बड़ा है' },
      { role: 'model', text: 'आपका खेत 2.50 एकड़ है।' },
      { role: 'user', text: 'और मंडी भाव?' },
    ]);
  });

  it('sends a tapped suggestion without recording anything', async () => {
    holdSpeech();
    const { result } = await setup();

    await act(async () => result.current.ask('mandi'));
    await waitFor(() => expect(result.current.state).toBe('speaking'));

    expect(mockRecorder.start).not.toHaveBeenCalled();
    expect(mockedChat).toHaveBeenCalled();
  });
});

describe('failures', () => {
  it('reports a blocked microphone specifically', async () => {
    mockRecorder.start.mockRejectedValue(new VoiceRecorderError('permission'));
    const { result } = await setup();

    await act(async () => result.current.pressMic());

    await waitFor(() => expect(result.current.state).toBe('error'));
    expect(result.current.errorKey).toBe('avatar.errors.micPermission');
  });

  it('reports an unreachable assistant differently from a dead mic', async () => {
    mockedChat.mockRejectedValue(new DataError('avatar.errors.reply'));
    const { result } = await setup();

    await act(async () => result.current.pressMic());
    await act(async () => result.current.pressMic());

    await waitFor(() => expect(result.current.state).toBe('error'));
    expect(result.current.errorKey).toBe('avatar.errors.reply');
  });

  it('never invents an answer when transcription fails', async () => {
    mockedTranscribe.mockRejectedValue(new DataError('avatar.errors.transcribe'));
    const { result } = await setup();

    await act(async () => result.current.pressMic());
    await act(async () => result.current.pressMic());

    await waitFor(() => expect(result.current.state).toBe('error'));
    // Critically: the model was never asked, so it could not answer a question
    // the farmer did not ask.
    expect(mockedChat).not.toHaveBeenCalled();
    expect(result.current.answer).toBeNull();
  });

  it('clears the error when the farmer tries again', async () => {
    mockRecorder.start.mockRejectedValueOnce(new VoiceRecorderError('permission'));
    const { result } = await setup();

    await act(async () => result.current.pressMic());
    await waitFor(() => expect(result.current.state).toBe('error'));

    await act(async () => result.current.pressMic());

    expect(result.current.state).toBe('listening');
    expect(result.current.errorKey).toBeNull();
  });
});

describe('interruption', () => {
  it('does not let the farmer interrupt while a question is in flight', async () => {
    // The Phase 1 design disables the mic during `thinking` and labels it
    // "One moment…". Honoured here rather than changed.
    mockedChat.mockImplementationOnce(() => new Promise(() => {}));
    const { result } = await setup();

    await act(async () => result.current.pressMic());
    await act(async () => result.current.pressMic());
    expect(result.current.state).toBe('thinking');

    await act(async () => result.current.pressMic());

    expect(result.current.state).toBe('thinking');
    expect(mockRecorder.start).toHaveBeenCalledTimes(1);
  });

  it('ignores a reply that lands after the farmer walked away', async () => {
    let release: (value: { text: string; model: string }) => void = () => {};
    mockedChat.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );

    const { result } = await setup();

    await act(async () => result.current.pressMic());
    await act(async () => result.current.pressMic());
    expect(result.current.state).toBe('thinking');

    // They close the sheet before the answer arrives.
    await act(async () => result.current.close());
    expect(result.current.state).toBe('idle');

    // The abandoned reply lands late and must not resurrect the conversation.
    await act(async () => {
      release({ text: 'stale answer', model: 'gemini-2.5-flash' });
    });

    expect(result.current.state).toBe('idle');
    expect(result.current.answer).toBeNull();
  });

  it('drops the conversation when the sheet closes', async () => {
    holdSpeech();
    const { result } = await setup();

    await act(async () => result.current.pressMic());
    await act(async () => result.current.pressMic());
    await waitFor(() => expect(result.current.state).toBe('speaking'));

    await act(async () => result.current.close());

    expect(result.current.state).toBe('idle');
    expect(result.current.answer).toBeNull();
    expect(mockRecorder.cancel).toHaveBeenCalled();
    // The answer must not carry on playing to an empty room.
    expect(mockSpeech.stop).toHaveBeenCalled();

    // A new session starts with no history — the previous exchange is gone.
    await act(async () => result.current.ask('area'));
    await waitFor(() => expect(mockedChat).toHaveBeenCalledTimes(2));
    expect(mockedChat.mock.calls[1]?.[0]).toHaveLength(1);
  });
});
