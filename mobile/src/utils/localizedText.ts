/**
 * Bilingual inline content shared by every feature that ships its own local
 * demo/static content (Learning tutorials, Government Schemes, Krishi
 * Updates, AR guide steps). This is content, not UI chrome, so it lives on
 * the data directly rather than as i18n keys — the same pattern the crop
 * catalogue already uses (`name_en`/`name_hi` on one record, see
 * `services/agronomy.ts`).
 *
 * Originally defined only in `features/learning/tutorials.ts`; pulled out
 * here once a second and third feature needed the same shape, rather than
 * redefining it three times.
 */
export type LocalizedText = { en: string; hi: string };

/** Picks the farmer's language the same way `cropName()` picks a crop name. */
export function localize(text: LocalizedText, language: string): string {
  return language.startsWith('hi') ? text.hi : text.en;
}
