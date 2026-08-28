import type { AvatarState } from '@/features/avatar/avatarMachine';

import { directiveFor, resolveDirective, stillDirective } from './animationController';
import { gestureDurationMs, gestureForReply } from './gestureController';

const STATES: AvatarState[] = ['idle', 'listening', 'thinking', 'speaking', 'error'];

describe('directiveFor', () => {
  it('covers all five machine states', () => {
    for (const state of STATES) {
      expect(directiveFor(state)).toBeDefined();
    }
  });

  it('only moves the mouth while speaking', () => {
    // A mouth that moves in any other state is the avatar talking over the
    // farmer, or muttering to itself.
    for (const state of STATES) {
      const expected = state === 'speaking' ? true : false;
      expect(directiveFor(state).mouthActivity > 0).toBe(expected);
    }
  });

  it('keeps the avatar still and attentive while listening', () => {
    const listening = directiveFor('listening');

    expect(listening.gesture).toBe('none');
    expect(listening.expression).toBe('attentive');
    // A listener who gesticulates is not listening.
    expect(listening.headMotion).toBeLessThan(directiveFor('speaking').headMotion);
  });

  it('blinks least while thinking, as concentration does', () => {
    const rates = STATES.map((state) => directiveFor(state).blinkRate);

    expect(directiveFor('thinking').blinkRate).toBe(Math.min(...rates));
  });

  it('keeps every state animated to some degree', () => {
    // A completely frozen avatar reads as a crashed screen.
    for (const state of STATES) {
      expect(directiveFor(state).headMotion).toBeGreaterThan(0);
      expect(directiveFor(state).blinkRate).toBeGreaterThan(0);
    }
  });

  it('presents the error state as reassuring rather than alarmed', () => {
    const error = directiveFor('error');

    expect(error.expression).toBe('concerned');
    expect(error.clip).toBe('idle');
  });
});

describe('stillDirective', () => {
  it('removes all motion for reduce-motion users', () => {
    for (const state of STATES) {
      const still = stillDirective(state);

      expect(still.headMotion).toBe(0);
      expect(still.blinkRate).toBe(0);
      expect(still.mouthActivity).toBe(0);
      expect(still.gesture).toBe('none');
    }
  });

  it('still shows the avatar rather than hiding it', () => {
    expect(stillDirective('speaking').clip).toBe('talking');
  });
});

describe('resolveDirective', () => {
  it('honours the reduce-motion preference', () => {
    expect(resolveDirective('speaking', true).mouthActivity).toBe(0);
    expect(resolveDirective('speaking', false).mouthActivity).toBeGreaterThan(0);
  });
});

describe('gestureForReply', () => {
  it('is deterministic — the same reply always gestures the same way', () => {
    // §7 forbids random gesturing. Repeating a question must not change the body.
    const reply = 'Your field is 2.50 acres.';
    expect(gestureForReply(reply)).toBe(gestureForReply(reply));
  });

  it('opens an empty hand when the assistant cannot answer', () => {
    expect(gestureForReply('That service is not connected yet.')).toBe('open_hand');
    expect(gestureForReply("I can't check today's mandi rate.")).toBe('open_hand');
    expect(gestureForReply('मंडी भाव अभी नहीं जुड़े हैं।')).toBe('open_hand');
  });

  it('never points confidently at something it does not have', () => {
    // The dangerous combination: a refusal that also contains a number.
    expect(gestureForReply('I cannot predict the price for 7 days.')).toBe('open_hand');
  });

  it('points when quoting a real figure', () => {
    expect(gestureForReply('The MSP is ₹2425 per quintal.')).toBe('point');
    expect(gestureForReply('It was 30.1°C yesterday.')).toBe('point');
  });

  it('greets on a greeting', () => {
    expect(gestureForReply('Namaste Ramesh! How can I help?')).toBe('greeting');
  });

  it('falls back to a neutral talking gesture', () => {
    expect(gestureForReply('Wheat is usually sown in November.')).toBe('explain');
  });

  it('does nothing for an empty reply', () => {
    expect(gestureForReply('   ')).toBe('none');
  });
});

describe('gestureDurationMs', () => {
  it('scales with the length of the reply', () => {
    const short = gestureDurationMs('Yes.');
    const long = gestureDurationMs(new Array(60).fill('word').join(' '));

    expect(long).toBeGreaterThan(short);
  });

  it('gives even a one-word answer a visible beat', () => {
    expect(gestureDurationMs('Yes.')).toBeGreaterThanOrEqual(1200);
  });

  it('stops a very long reply gesturing forever', () => {
    expect(gestureDurationMs(new Array(2000).fill('word').join(' '))).toBeLessThanOrEqual(12_000);
  });

  it('is zero for an empty reply', () => {
    expect(gestureDurationMs('')).toBe(0);
  });
});
