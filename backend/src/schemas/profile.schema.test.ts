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

  it('accepts location attributes', () => {
    const result = updateProfileSchema.safeParse({
      location_city: 'Pratapgarh',
      location_district: 'Pratapgarh',
      location_state: 'Rajasthan',
      location_country: 'India',
      location_latitude: 24.0324,
      location_longitude: 74.7812,
      location_source: 'gps',
    });
    expect(result.success).toBe(true);
  });

  it('refuses unowned fields in the body such as unknown keys or id', () => {
    expect(updateProfileSchema.safeParse({ unknown_prop: 'val' }).success).toBe(false);
    expect(updateProfileSchema.safeParse({ id: '00000000-0000-0000-0000-000000000000' }).success).toBe(false);
  });
});
