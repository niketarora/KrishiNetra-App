import type { Farm } from '@/services/farms';

import type { GovernmentScheme, SchemeEligibility } from './types';

/**
 * A transparent, local "may be relevant" filter — not an eligibility check.
 * Every status this produces is one of two hedged states
 * (`mayBeEligible`/`checkEligibility`), and every reason is a translation
 * key phrased accordingly (see `schemes.reasons.*` in the locale files) —
 * this module must never claim legal eligibility, per the product brief.
 */
export function matchSchemes(
  schemes: GovernmentScheme[],
  farm: Farm | null,
  cropCode: string | null,
): SchemeEligibility[] {
  return schemes.map((scheme) => {
    if (!farm) {
      return { schemeId: scheme.id, status: 'checkEligibility', reasonKey: 'schemes.reasons.noFarm' };
    }

    const crops = scheme.metadata.crops;
    if (crops && crops.length > 0 && cropCode && crops.includes(cropCode)) {
      return { schemeId: scheme.id, status: 'mayBeEligible', reasonKey: 'schemes.reasons.cropMatch' };
    }

    const landSizeMax = scheme.metadata.landSizeMaxAcres;
    if (landSizeMax !== undefined && Number(farm.area_acres) <= landSizeMax) {
      return { schemeId: scheme.id, status: 'mayBeEligible', reasonKey: 'schemes.reasons.landSizeMatch' };
    }

    // A scheme with no crop or land-size restriction at all is broadly
    // applicable, so any registered farm counts as "may be relevant".
    const broad = (!crops || crops.length === 0) && landSizeMax === undefined;
    if (broad) {
      return { schemeId: scheme.id, status: 'mayBeEligible', reasonKey: 'schemes.reasons.broadlyApplicable' };
    }

    return { schemeId: scheme.id, status: 'checkEligibility', reasonKey: 'schemes.reasons.unknown' };
  });
}
