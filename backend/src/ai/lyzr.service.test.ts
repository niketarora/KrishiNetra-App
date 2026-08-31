import { describe, expect, it } from '@jest/globals';

import { parseLyzrReply, sessionIdFor } from './lyzr.service.js';

describe('sessionIdFor', () => {
  it('follows the provider\'s own <agent_id>-<suffix> shape', () => {
    expect(sessionIdFor('6a94552a7dd0e20947e32b1a', 'xioid0hh')).toBe(
      '6a94552a7dd0e20947e32b1a-xioid0hh',
    );
  });

  it('gives each farmer their own thread under the same agent', () => {
    // This is the only thing keeping one farmer's follow-up from landing in
    // another farmer's conversation — `user_id` is the account, shared by all.
    const a = sessionIdFor('agent-1', '11111111-1111-1111-1111-111111111111');
    const b = sessionIdFor('agent-1', '22222222-2222-2222-2222-222222222222');

    expect(a).not.toBe(b);
    expect(a.startsWith('agent-1-')).toBe(true);
  });
});

/**
 * The provider has spelled its reply field differently across API versions, so
 * the parser accepts the plausible names. The alternative is an adapter that
 * silently returns nothing after a provider upgrade — a failure that looks
 * exactly like the agent having no answer.
 */
describe('parseLyzrReply', () => {
  it('reads the documented field', () => {
    expect(parseLyzrReply({ response: 'Spray neem oil in the evening.' })).toBe(
      'Spray neem oil in the evening.',
    );
  });

  it('reads the other field names the API has used', () => {
    expect(parseLyzrReply({ answer: 'a' })).toBe('a');
    expect(parseLyzrReply({ message: 'b' })).toBe('b');
    expect(parseLyzrReply({ output: 'c' })).toBe('c');
    expect(parseLyzrReply({ text: 'd' })).toBe('d');
  });

  it('prefers the documented field when several are present', () => {
    expect(parseLyzrReply({ text: 'fallback', response: 'primary' })).toBe('primary');
  });

  it('accepts a bare string body', () => {
    expect(parseLyzrReply('  Water at dawn.  ')).toBe('Water at dawn.');
  });

  it('trims surrounding whitespace', () => {
    expect(parseLyzrReply({ response: '\n  Yellow leaves mean nitrogen. \n' })).toBe(
      'Yellow leaves mean nitrogen.',
    );
  });

  it('returns null when there is nothing to say', () => {
    expect(parseLyzrReply({ response: '   ' })).toBeNull();
    expect(parseLyzrReply({ status: 'ok' })).toBeNull();
    expect(parseLyzrReply({})).toBeNull();
    expect(parseLyzrReply(null)).toBeNull();
    expect(parseLyzrReply(123)).toBeNull();
  });

  it('ignores a non-string value in a field it otherwise reads', () => {
    expect(parseLyzrReply({ response: { nested: 'no' }, text: 'yes' })).toBe('yes');
  });
});
