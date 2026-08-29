import { FarmArea } from './geo';

/** Area values the farmer reads. Acres/hectares to 2dp, sq metres whole. */
export function formatArea(area: FarmArea) {
  return {
    acres: area.acres.toFixed(2),
    hectares: area.hectares.toFixed(2),
    squareMeters: Math.round(area.squareMeters).toLocaleString('en-IN'),
  };
}

/** "2.40 acres" — the one-line form used on cards. */
export function formatAcres(acres: number): string {
  return `${acres.toFixed(2)} acres`;
}

/**
 * Initials for the header avatar chip.
 *
 * Falls back to the email's first letter, then the phone number's last two
 * digits — a farmer signed up by phone has no email at all (it's optional),
 * so without this fallback the chip would just show "?".
 */
export function initials(
  fullName: string | null | undefined,
  email?: string | null,
  phone?: string | null,
): string {
  const source = fullName?.trim();
  if (source) {
    const parts = source.split(/\s+/).slice(0, 2);
    return parts.map((p) => p[0]?.toUpperCase() ?? '').join('');
  }
  if (email) return email[0]?.toUpperCase() ?? '?';

  const digits = phone?.replace(/\D/g, '');
  return digits ? digits.slice(-2) : '?';
}

/** First name for the greeting; falls back to the email local-part, then the phone number. */
export function firstName(
  fullName: string | null | undefined,
  email?: string | null,
  phone?: string | null,
): string {
  const source = fullName?.trim();
  if (source) return source.split(/\s+/)[0];
  if (email) return email.split('@')[0];
  return phone ?? '';
}

/**
 * Masks a farmer's phone number for display, e.g. `9876543210` or
 * `+919876543210` → `+91 XXXXX 43210` (task spec §14: never show the full
 * number throughout the app). Falls back to the raw value if it isn't a
 * recognisable 10-digit Indian mobile number.
 */
export function maskPhone(phone: string | null | undefined): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '').replace(/^91/, '');
  if (digits.length !== 10) return phone;
  return `+91 XXXXX ${digits.slice(-5)}`;
}

/** Which of the three greetings to show, by local hour. */
export function greetingKey(date = new Date()): 'morning' | 'afternoon' | 'evening' {
  const hour = date.getHours();
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}
