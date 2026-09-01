import type { AssistantResponse } from '@/services/assistantService';

import {
  avatarReducer,
  initialAvatarState,
  isAudioActive,
  isAvatarVisible,
  type AvatarMachineState,
  type AvatarState,
} from './avatarMachine';

const at = (state: AvatarState, overrides: Partial<AvatarMachineState> = {}): AvatarMachineState => ({
  ...initialAvatarState,
  state,
  ...overrides,
});

const EXPERT: AssistantResponse = {
  type: 'EXPERT_RESPONSE',
  message: '2.40 acres',
  speech: '2.40 acres',
  localised: false,
  avatar: { expression: 'helpful', position: 'bottom-right' },
};

const GUIDE: AssistantResponse = {
  type: 'APP_GUIDE',
  message: 'avatar.guide.market_price',
  speech: 'avatar.guide.market_price',
  localised: true,
  navigation: [{ action: 'NAVIGATE', target: 'Market' }],
  avatar: { expression: 'pointing', position: 'bottom-right' },
};

describe('avatarReducer', () => {
  it('starts idle with nothing said', () => {
    expect(initialAvatarState).toEqual({
      state: 'idle',
      question: null,
      transcript: null,
      language: null,
      response: null,
    });
  });

  describe('the happy path', () => {
    it('runs idle → listening → thinking → speaking → idle for a spoken answer', () => {
      let state = initialAvatarState;

      state = avatarReducer(state, { type: 'START_LISTENING', question: 'area' });
      expect(state.state).toBe('listening');
      expect(state.question).toBe('area');

      state = avatarReducer(state, { type: 'STOP_LISTENING', transcript: 'how big is my field', language: 'en-IN' });
      expect(state.state).toBe('thinking');
      expect(state.transcript).toBe('how big is my field');
      expect(state.language).toBe('en-IN');

      state = avatarReducer(state, { type: 'RESOLVE', response: EXPERT });
      expect(state.state).toBe('speaking');
      expect(state.response).toEqual(EXPERT);

      state = avatarReducer(state, { type: 'DONE' });
      expect(state.state).toBe('idle');
      // The response stays available, so the last line remains on screen.
      expect(state.response).toEqual(EXPERT);
    });

    it('runs through guiding when the app is being driven', () => {
      let state = at('thinking');

      state = avatarReducer(state, { type: 'RESOLVE', response: GUIDE });
      expect(state.state).toBe('speaking');

      state = avatarReducer(state, { type: 'GUIDE_STARTED' });
      expect(state.state).toBe('guiding');
      expect(state.response).toEqual(GUIDE);

      state = avatarReducer(state, { type: 'DONE' });
      expect(state.state).toBe('idle');
    });
  });

  describe('START_LISTENING', () => {
    it.each<AvatarState>(['idle', 'listening', 'thinking', 'speaking', 'guiding', 'error'])(
      'is accepted from %s, so the farmer can always interrupt',
      (from) => {
        const next = avatarReducer(at(from), { type: 'START_LISTENING', question: 'mandi' });
        expect(next.state).toBe('listening');
      },
    );

    it('clears the previous answer so a stale line is never shown mid-question', () => {
      const speaking = at('speaking', { question: 'area', response: EXPERT, transcript: 'old' });
      const next = avatarReducer(speaking, { type: 'START_LISTENING', question: 'sell' });

      expect(next.response).toBeNull();
      expect(next.transcript).toBeNull();
      expect(next.question).toBe('sell');
    });

    it('keeps the current question when none is supplied', () => {
      const next = avatarReducer(at('idle', { question: 'weather' }), { type: 'START_LISTENING' });
      expect(next.question).toBe('weather');
    });
  });

  describe('STOP_LISTENING', () => {
    it('moves to thinking only while listening', () => {
      expect(avatarReducer(at('listening'), { type: 'STOP_LISTENING' }).state).toBe('thinking');
    });

    it.each<AvatarState>(['idle', 'thinking', 'speaking', 'guiding', 'error'])(
      'is ignored from %s',
      (from) => {
        expect(avatarReducer(at(from), { type: 'STOP_LISTENING' }).state).toBe(from);
      },
    );
  });

  describe('RESOLVE', () => {
    it('speaks the answer when one was pending', () => {
      const next = avatarReducer(at('thinking', { question: 'mandi' }), {
        type: 'RESOLVE',
        response: GUIDE,
      });

      expect(next.state).toBe('speaking');
      expect(next.response).toEqual(GUIDE);
    });

    it.each<AvatarState>(['idle', 'listening', 'speaking', 'guiding', 'error'])(
      'is ignored from %s, so a late answer cannot speak over the farmer',
      (from) => {
        const next = avatarReducer(at(from), { type: 'RESOLVE', response: EXPERT });

        expect(next.state).toBe(from);
        expect(next.response).toBeNull();
      },
    );
  });

  describe('GUIDE_STARTED', () => {
    it.each<AvatarState>(['idle', 'listening', 'thinking', 'guiding', 'error'])(
      'is ignored from %s — guidance only follows an answer',
      (from) => {
        expect(avatarReducer(at(from), { type: 'GUIDE_STARTED' }).state).toBe(from);
      },
    );

    it('keeps the response, because the bubble is still showing it', () => {
      const next = avatarReducer(at('speaking', { response: GUIDE }), { type: 'GUIDE_STARTED' });
      expect(next.response).toEqual(GUIDE);
    });
  });

  describe('FAIL', () => {
    it.each<AvatarState>(['listening', 'thinking', 'speaking', 'guiding', 'error'])(
      'moves to error from %s',
      (from) => {
        expect(avatarReducer(at(from), { type: 'FAIL' }).state).toBe('error');
      },
    );

    it('does not error out of idle — there is nothing in flight to fail', () => {
      expect(avatarReducer(at('idle'), { type: 'FAIL' }).state).toBe('idle');
    });

    it('drops any partial answer', () => {
      const next = avatarReducer(at('speaking', { response: EXPERT }), { type: 'FAIL' });
      expect(next.response).toBeNull();
    });
  });

  describe('error recovery', () => {
    it('retries out of the error state back into a full exchange', () => {
      let state = at('error', { question: 'crop' });

      state = avatarReducer(state, { type: 'START_LISTENING' });
      expect(state.state).toBe('listening');

      state = avatarReducer(state, { type: 'STOP_LISTENING' });
      state = avatarReducer(state, { type: 'RESOLVE', response: EXPERT });
      expect(state.state).toBe('speaking');
    });
  });

  describe('DONE', () => {
    it('returns to idle after speaking, and after guiding', () => {
      expect(avatarReducer(at('speaking'), { type: 'DONE' }).state).toBe('idle');
      expect(avatarReducer(at('guiding'), { type: 'DONE' }).state).toBe('idle');
    });

    it.each<AvatarState>(['idle', 'listening', 'thinking', 'error'])(
      'is ignored from %s',
      (from) => {
        expect(avatarReducer(at(from), { type: 'DONE' }).state).toBe(from);
      },
    );
  });

  describe('RESET', () => {
    it('wipes the exchange, so the next one starts clean', () => {
      const busy = at('guiding', { question: 'sell', response: GUIDE, transcript: 'sell or wait' });
      expect(avatarReducer(busy, { type: 'RESET' })).toEqual(initialAvatarState);
    });
  });

  it('never mutates the state it is given', () => {
    const before = at('listening', { question: 'area' });
    const snapshot = { ...before };

    avatarReducer(before, { type: 'STOP_LISTENING' });

    expect(before).toEqual(snapshot);
  });
});

describe('isAudioActive', () => {
  it('is true only while someone has the floor', () => {
    expect(isAudioActive('listening')).toBe(true);
    expect(isAudioActive('speaking')).toBe(true);
    // Guiding is still the avatar talking, just while the app moves.
    expect(isAudioActive('guiding')).toBe(true);
    expect(isAudioActive('idle')).toBe(false);
    expect(isAudioActive('thinking')).toBe(false);
    expect(isAudioActive('error')).toBe(false);
  });
});

describe('isAvatarVisible', () => {
  it('shows the avatar for every state except idle', () => {
    // Idle is the whole point of a peek: it is hidden until it has something
    // to say, so it never becomes furniture the farmer stops noticing.
    expect(isAvatarVisible('idle')).toBe(false);

    for (const state of ['listening', 'thinking', 'speaking', 'guiding', 'error'] as AvatarState[]) {
      expect(isAvatarVisible(state)).toBe(true);
    }
  });
});
