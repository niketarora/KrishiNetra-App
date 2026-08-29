import type { LocalizedText } from '@/utils/localizedText';

/**
 * Government Schemes — local/demo directory for this version. No government
 * API key lives in this app (see `demoSchemes.ts`'s file comment); when a
 * real backend source exists, only `demoSchemes.ts` needs to be replaced by
 * a fetch through KrishiNetra's own backend — this shape stays the same.
 */
export type SchemeCategory = 'incomeSupport' | 'insurance' | 'soilHealth' | 'credit' | 'irrigation' | 'other';

export type GovernmentScheme = {
  id: string;
  name: LocalizedText;
  category: SchemeCategory;
  /** One line — "What is it?" in list form. */
  summary: LocalizedText;
  benefit: LocalizedText;
  eligibility: LocalizedText;
  documents: LocalizedText[];
  howToApply: LocalizedText;
  /** The scheme's real, stable official domain — a link out, never scraped. */
  officialUrl: string;
  /** Lightweight, transparent match inputs — see `matching.ts`. */
  metadata: {
    crops?: string[];
    landSizeMaxAcres?: number;
    regions?: string[];
  };
};

export type SchemeEligibilityStatus = 'mayBeEligible' | 'checkEligibility';

export type SchemeEligibility = {
  schemeId: string;
  status: SchemeEligibilityStatus;
  /** i18n key explaining the match in hedged language — never a legal claim. */
  reasonKey: string;
};
