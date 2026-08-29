import { TUTORIALS, type Tutorial } from './tutorials';

/**
 * "Recommended for you" — a transparent match against the farmer's real
 * registered crop (`Tutorial.metadata.crops`), not a recommendation engine.
 * Falls back to the featured tutorial plus one generally-useful one when
 * there's no crop on record or no tutorial mentions it, so the section is
 * never empty for a farmer who hasn't added a crop yet.
 */
export function recommendTutorials(cropCode: string | null, limit = 2): Tutorial[] {
  const matches = cropCode
    ? TUTORIALS.filter((tutorial) => tutorial.metadata.crops?.includes(cropCode))
    : [];

  if (matches.length >= limit) return matches.slice(0, limit);

  const fallback = TUTORIALS.filter(
    (tutorial) => !matches.includes(tutorial) && (tutorial.featured || tutorial.metadata.crops === undefined),
  );

  return [...matches, ...fallback].slice(0, limit);
}
