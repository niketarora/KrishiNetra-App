import { describe, expect, it } from '@jest/globals';

import { phoneToBridgeEmail } from './phoneAuth.service.js';

describe('phoneAuth.service', () => {
  it('formats bridge email deterministically', () => {
    expect(phoneToBridgeEmail('9876543210')).toBe('p9876543210@phone.demo.krishinetra.app');
  });
});
