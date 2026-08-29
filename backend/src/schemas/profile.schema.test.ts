import { describe, expect, it } from '@jest/globals';

import { updateProfileSchema } from './profile.schema.js';

describe('updateProfileSchema', () => {
  it('accepts a well-formed partial update', () => {
    const result = updateProfileSchema.safeParse({ full_name: 'Asha', language: 'hi' });
    expect(result.success).toBe(true);
  });

  it('accepts an optional email', () => {
    const result = updateProfileSchema.safeParse({ email: 'asha@example.com' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.email).toBe('asha@example.com');
  });

  it('treats an empty-string email as clearing it, not as invalid', () => {
    const result = updateProfileSchema.safeParse({ email: '' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.email).toBeNull();
  });

  it('rejects a malformed email', () => {
    const result = updateProfileSchema.safeParse({ email: 'not-an-email' });
    expect(result.success).toBe(false);
  });

  it('accepts notification preference booleans', () => {
    const result = updateProfileSchema.safeParse({
      in_app_alerts: false,
      sms_alerts: true,
      voice_alerts: false,
    });
    expect(result.success).toBe(true);
  });

  it('refuses an empty body', () => {
    expect(updateProfileSchema.safeParse({}).success).toBe(false);
  });

  it('refuses a field it does not own, such as a location column', () => {
    // Location is read-only from this endpoint (IMPLEMENTATION.md: don't
    // redesign the location system yet) — a client that tries gets a 400.
    const result = updateProfileSchema.safeParse({ location_city: 'Jaipur' });
    expect(result.success).toBe(false);
  });

  it('refuses an id in the body', () => {
    const result = updateProfileSchema.safeParse({ id: '00000000-0000-0000-0000-000000000000' });
    expect(result.success).toBe(false);
  });
});
