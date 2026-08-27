import {
  avatarReducer,
  initialAvatarState,
  isAudioActive,
  type AvatarMachineState,
  type AvatarState,
} from './avatarMachine';

const at = (state: AvatarState, overrides: Partial<AvatarMachineState> = {}): AvatarMachineState => ({
  ...initialAvatarState,
  state,
  ...overrides,
});

describe('avatarReducer', () => {
  it('starts idle with nothing said', () => {
    expect(initialAvatarState).toEqual({
      state: 'idle',
      question: null,
      answer: null,
      source: null,
    });
  });

  describe('the happy path', () => {
    it('runs idle → listening → thinking → speaking → idle', () => {
      let state = initialAvatarState;

      state = avatarReducer(state, { type: 'START_LISTENING', question: 'area' });
      expect(state.state).toBe('listening');
      expect(state.question).toBe('area');

      state = avatarReducer(state, { type: 'STOP_LISTENING' });
      expect(state.state).toBe('thinking');

      state = avatarReducer(state, { type: 'RESOLVE', answer: '2.40 acres', source: 'record' });
      expect(state.state).toBe('speaking');
      expect(state.answer).toBe('2.40 acres');
      expect(state.source).toBe('record');

      state = avatarReducer(state, { type: 'DONE' });
      expect(state.state).toBe('idle');
      // The answer stays available, so the last line remains on screen.
      expect(state.answer).toBe('2.40 acres');
    });
  });

  describe('START_LISTENING', () => {
    it.each<AvatarState>(['idle', 'listening', 'thinking', 'speaking', 'error'])(
      'is accepted from %s, so the farmer can always interrupt',
      (from) => {
        const next = avatarReducer(at(from), { type: 'START_LISTENING', question: 'mandi' });
        expect(next.state).toBe('listening');
      },
    );

    it('clears the previous answer so a stale line is never shown mid-question', () => {
      const speaking = at('speaking', { question: 'area', answer: 'old answer', source: 'record' });
      const next = avatarReducer(speaking, { type: 'START_LISTENING', question: 'sell' });

      expect(next.answer).toBeNull();
      expect(next.source).toBeNull();
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

    it.each<AvatarState>(['idle', 'thinking', 'speaking', 'error'])(
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
        answer: 'Not connected yet',
        source: 'preview',
      });

      expect(next.state).toBe('speaking');
      expect(next.answer).toBe('Not connected yet');
    });

    it.each<AvatarState>(['idle', 'listening', 'speaking', 'error'])(
      'is ignored from %s, so a late answer cannot speak over the farmer',
      (from) => {
        const next = avatarReducer(at(from), {
          type: 'RESOLVE',
          answer: 'late',
          source: null,
        });

        expect(next.state).toBe(from);
        expect(next.answer).toBeNull();
      },
    );

    it('accepts a null source for an ungrounded answer', () => {
      const next = avatarReducer(at('thinking'), {
        type: 'RESOLVE',
        answer: 'No field saved yet',
        source: null,
      });

      expect(next.state).toBe('speaking');
      expect(next.source).toBeNull();
    });
  });

  describe('FAIL', () => {
    it.each<AvatarState>(['listening', 'thinking', 'speaking', 'error'])(
      'moves to error from %s',
      (from) => {
        expect(avatarReducer(at(from), { type: 'FAIL' }).state).toBe('error');
      },
    );

    it('does not error out of idle — there is nothing in flight to fail', () => {
      expect(avatarReducer(at('idle'), { type: 'FAIL' }).state).toBe('idle');
    });

    it('drops any partial answer', () => {
      const next = avatarReducer(at('speaking', { answer: 'half said', source: 'record' }), {
        type: 'FAIL',
      });

      expect(next.answer).toBeNull();
      expect(next.source).toBeNull();
    });
  });

  describe('error recovery', () => {
    it('retries out of the error state back into a full exchange', () => {
      let state = at('error', { question: 'crop' });

      state = avatarReducer(state, { type: 'START_LISTENING' });
      expect(state.state).toBe('listening');

      state = avatarReducer(state, { type: 'STOP_LISTENING' });
      state = avatarReducer(state, { type: 'RESOLVE', answer: 'ok', source: null });
      expect(state.state).toBe('speaking');
    });
  });

  describe('DONE', () => {
    it('returns to idle after speaking', () => {
      expect(avatarReducer(at('speaking'), { type: 'DONE' }).state).toBe('idle');
    });

    it.each<AvatarState>(['idle', 'listening', 'thinking', 'error'])(
      'is ignored from %s',
      (from) => {
        expect(avatarReducer(at(from), { type: 'DONE' }).state).toBe(from);
      },
    );
  });

  describe('RESET', () => {
    it('wipes the conversation, so reopening starts clean', () => {
      const busy = at('speaking', { question: 'sell', answer: 'hold', source: 'model' });
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
  it('is true only while someone is speaking', () => {
    expect(isAudioActive('listening')).toBe(true);
    expect(isAudioActive('speaking')).toBe(true);
    expect(isAudioActive('idle')).toBe(false);
    expect(isAudioActive('thinking')).toBe(false);
    expect(isAudioActive('error')).toBe(false);
  });
});
