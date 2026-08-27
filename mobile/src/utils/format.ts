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

/** Initials for the header avatar chip. Falls back to the email's first letter. */
export function initials(fullName: string | null | undefined, email?: string | null): string {
  const source = fullName?.trim();
  if (source) {
    const parts = source.split(/\s+/).slice(0, 2);
    return parts.map((p) => p[0]?.toUpperCase() ?? '').join('');
  }
  return email?.[0]?.toUpperCase() ?? '?';
}

/** First name for the greeting; the email local-part is the fallback. */
export function firstName(fullName: string | null | undefined, email?: string | null): string {
  const source = fullName?.trim();
  if (source) return source.split(/\s+/)[0];
  return email?.split('@')[0] ?? '';
}

/** Which of the three greetings to show, by local hour. */
export function greetingKey(date = new Date()): 'morning' | 'afternoon' | 'evening' {
  const hour = date.getHours();
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}
