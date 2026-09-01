import type { ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { I18nextProvider } from 'react-i18next';

import i18n from '@/i18n';
import { assist, type AssistantResponse } from '@/services/assistantService';
import { transcribe } from '@/services/avatarService';
import { DataError } from '@/services/errors';

import { AvatarProvider, useAvatar } from './AvatarContext';
import { VoiceRecorderError } from './useVoiceRecorder';

jest.mock('@/services/avatarService', () => ({
  transcribe: jest.fn(),
  speak: jest.fn(async () => ({ audio: '', mimeType: 'audio/wav', sampleRate: 16000 })),
}));

jest.mock('@/services/assistantService', () => ({
  assist: jest.fn(),
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

/** The Navigation Controller, stubbed — it has its own tests. */
const mockGuide = {
  highlight: null,
  running: false,
  register: jest.fn(),
  unregister: jest.fn(),
  run: jest.fn(async () => undefined),
  cancel: jest.fn(),
};

jest.mock('@/features/guide/GuideContext', () => ({
  ...jest.requireActual('@/features/guide/GuideContext'),
  useGuide: () => mockGuide,
}));

const EXPERT: AssistantResponse = {
  type: 'EXPERT_RESPONSE',
  message: 'आपका खेत 2.50 एकड़ है।',
  speech: 'आपका खेत 2.50 एकड़ है।',
  localised: false,
  avatar: { expression: 'helpful', position: 'bottom-right' },
};

const GUIDE: AssistantResponse = {
  type: 'APP_GUIDE',
  message: 'avatar.guide.market_price',
  speech: 'avatar.guide.market_price',
  localised: true,
  navigation: [
    { action: 'NAVIGATE', target: 'Market' },
    { action: 'HIGHLIGHT', target: 'price-card' },
  ],
  avatar: { expression: 'pointing', position: 'bottom-right' },
};

/**
 * Hold the next answer in `speaking` until the test says the audio finished.
 *
 * Playback is what ends a turn, so a test that wants to look at the avatar
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
const mockedAssist = assist as jest.MockedFunction<typeof assist>;

/**
 * i18n has to be present: the provider reads `i18n.language` to tell the API
 * which language to answer in, and localises guidance keys through it.
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
  mockGuide.run.mockReset();
  mockGuide.run.mockResolvedValue(undefined);
  mockGuide.cancel.mockReset();
  mockRecorder.start.mockResolvedValue(undefined);
  mockRecorder.stop.mockResolvedValue('file:///tmp/speech.m4a');
  mockedTranscribe.mockResolvedValue({ text: 'मेरा खेत कितना बड़ा है', language: 'hi-IN' });
  mockedAssist.mockResolvedValue(EXPERT);
});

describe('the voice loop', () => {
  it('runs listening → thinking → speaking → idle against the real services', async () => {
    const finishSpeaking = holdSpeech();
    const { result } = await setup();

    expect(result.current.state).toBe('idle');

    await act(async () => result.current.pressMic());
    expect(result.current.state).toBe('listening');
    expect(mockRecorder.start).toHaveBeenCalled();

    await act(async () => result.current.pressMic());

    await waitFor(() => expect(result.current.state).toBe('speaking'));
    expect(result.current.response).toEqual(EXPERT);

    // The answer being read out is what holds `speaking` open; the avatar is
    // ready for the next question once the audio ends.
    await finishSpeaking();
    await waitFor(() => expect(result.current.state).toBe('idle'));
  });

  it('routes the transcript, not a guess at it', async () => {
    const { result } = await setup();

    await act(async () => result.current.pressMic());
    await act(async () => result.current.pressMic());
    await waitFor(() => expect(mockedAssist).toHaveBeenCalled());

    expect(mockedAssist).toHaveBeenCalledWith('मेरा खेत कितना बड़ा है', 'hi-IN');
  });

  it('reads an expert answer aloud exactly as it came back', async () => {
    const { result } = await setup();

    await act(async () => result.current.pressMic());
    await act(async () => result.current.pressMic());
    await waitFor(() => expect(mockSpeech.play).toHaveBeenCalled());

    expect(mockSpeech.play).toHaveBeenCalledWith('आपका खेत 2.50 एकड़ है।', 'hi-IN');
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
    expect(mockedAssist).toHaveBeenCalled();
  });

  it('sends a tapped suggestion without recording anything', async () => {
    holdSpeech();
    const { result } = await setup();

    await act(async () => result.current.ask('mandi'));
    await waitFor(() => expect(result.current.state).toBe('speaking'));

    expect(mockRecorder.start).not.toHaveBeenCalled();
    expect(mockedAssist).toHaveBeenCalled();
  });
});

describe('guidance', () => {
  it('starts moving the app without waiting for the voice', async () => {
    mockedAssist.mockResolvedValue(GUIDE);
    // Speech that never resolves. If navigation were chained behind it, the
    // guide would never run — which is exactly the regression this guards.
    mockSpeech.play.mockImplementation(() => new Promise(() => {}));

    const { result } = await setup();

    await act(async () => result.current.pressMic());
    await act(async () => result.current.pressMic());

    await waitFor(() => expect(mockGuide.run).toHaveBeenCalledWith(GUIDE.navigation));
    expect(result.current.state).toBe('guiding');
  });

  it('speaks guidance through i18n rather than reading a key aloud', async () => {
    mockedAssist.mockResolvedValue(GUIDE);
    const { result } = await setup();

    await act(async () => result.current.pressMic());
    await act(async () => result.current.pressMic());
    await waitFor(() => expect(mockSpeech.play).toHaveBeenCalled());

    const [spoken] = mockSpeech.play.mock.calls[0] as unknown as [string];
    expect(spoken).not.toBe('avatar.guide.market_price');
    expect(spoken.length).toBeGreaterThan(0);
  });

  it('does not run the guide for an expert answer', async () => {
    const { result } = await setup();

    await act(async () => result.current.pressMic());
    await act(async () => result.current.pressMic());
    await waitFor(() => expect(mockedAssist).toHaveBeenCalled());

    expect(mockGuide.run).not.toHaveBeenCalled();
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
    mockedAssist.mockRejectedValue(new DataError('avatar.errors.reply'));
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
    // Critically: nothing was routed, so the app could not be driven somewhere
    // on the strength of a question the farmer did not ask.
    expect(mockedAssist).not.toHaveBeenCalled();
    expect(mockGuide.run).not.toHaveBeenCalled();
    expect(result.current.response).toBeNull();
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
    // The mic is disabled during `thinking` and labelled "One moment…".
    mockedAssist.mockImplementationOnce(() => new Promise(() => {}));
    const { result } = await setup();

    await act(async () => result.current.pressMic());
    await act(async () => result.current.pressMic());
    expect(result.current.state).toBe('thinking');

    await act(async () => result.current.pressMic());

    expect(result.current.state).toBe('thinking');
    expect(mockRecorder.start).toHaveBeenCalledTimes(1);
  });

  it('cancels a guide in progress when the farmer asks something else', async () => {
    // An abandoned run must not carry on navigating underneath the new
    // question — the farmer would end up somewhere neither of them chose.
    mockedAssist.mockResolvedValue(GUIDE);
    const { result } = await setup();

    await act(async () => result.current.pressMic());
    await act(async () => result.current.pressMic());
    await waitFor(() => expect(mockGuide.run).toHaveBeenCalled());

    await act(async () => result.current.pressMic());

    expect(mockGuide.cancel).toHaveBeenCalled();
  });

  it('ignores a reply that lands after the farmer walked away', async () => {
    let release: (value: AssistantResponse) => void = () => {};
    mockedAssist.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );

    const { result } = await setup();

    await act(async () => result.current.pressMic());
    await act(async () => result.current.pressMic());
    expect(result.current.state).toBe('thinking');

    // They dismiss the avatar before the answer arrives.
    await act(async () => result.current.close());
    expect(result.current.state).toBe('idle');

    // The abandoned reply lands late and must not resurrect the exchange —
    // still less start driving the app around.
    await act(async () => {
      release(GUIDE);
    });

    expect(result.current.state).toBe('idle');
    expect(result.current.response).toBeNull();
    expect(mockGuide.run).not.toHaveBeenCalled();
  });

  it('drops everything when the avatar is dismissed', async () => {
    holdSpeech();
    const { result } = await setup();

    await act(async () => result.current.pressMic());
    await act(async () => result.current.pressMic());
    await waitFor(() => expect(result.current.state).toBe('speaking'));

    await act(async () => result.current.close());

    expect(result.current.state).toBe('idle');
    expect(result.current.response).toBeNull();
    expect(mockRecorder.cancel).toHaveBeenCalled();
    // The answer must not carry on playing to an empty room, and the guide must
    // not carry on walking an app nobody is watching.
    expect(mockSpeech.stop).toHaveBeenCalled();
    expect(mockGuide.cancel).toHaveBeenCalled();
  });
});
