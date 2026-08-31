import { userClient } from '../config/supabase.js';
import type { SchemesQuery } from '../schemas/scheme.schema.js';
import { ApiError } from '../utils/ApiError.js';

export type SchemeCard = {
  row_id: string;
  name: string;
  short_title: string | null;
  category: string | null;
  scheme_scope: 'CENTRAL' | 'STATE';
  summary: string;
  reasonKey: string;
};

export type SchemeDetail = {
  row_id: string;
  name: string;
  short_title: string | null;
  category: string | null;
  what_is_it: string | null;
  potential_benefit: string | null;
  who_may_be_eligible: string | null;
  documents: string[];
  how_to_apply: string | null;
  official_source: string | null;
  myscheme_url: string | null;
};

function extractSummary(whatIsIt: string | null | undefined): string {
  if (!whatIsIt || !whatIsIt.trim()) return '';
  const clean = whatIsIt.trim().replace(/\s+/g, ' ');
  const match = clean.match(/^([^.?!]+[.?!])/);
  const firstSentence = match ? match[1]?.trim() : clean;
  if (firstSentence && firstSentence.length <= 160) {
    return firstSentence;
  }
  return clean.slice(0, 140).trim() + '…';
}

function computeReasonKey(
  cropCode: string | undefined,
  tags: string[] = [],
  category: string | null = null,
  name = '',
): string {
  if (!cropCode) {
    return 'schemes.reasons.broadlyApplicable';
  }
  const crop = cropCode.toLowerCase().trim();
  const tagMatch = tags.some((t) => t.toLowerCase().includes(crop));
  const categoryMatch = category?.toLowerCase().includes(crop);
  const nameMatch = name.toLowerCase().includes(crop);

  if (tagMatch || categoryMatch || nameMatch) {
    return 'schemes.reasons.cropMatch';
  }

  return 'schemes.reasons.broadlyApplicable';
}

export const ALL_INDIAN_STATES: string[] = [
  'Andaman and Nicobar Islands',
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chandigarh',
  'Chhattisgarh',
  'Dadra & Nagar Haveli and Daman & Diu',
  'Delhi',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jammu and Kashmir',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Ladakh',
  'Lakshadweep',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Puducherry',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
];

let cachedStates: string[] | null = null;

export function _resetSchemesCacheForTesting(): void {
  cachedStates = null;
}

export async function listSchemeStates(token: string): Promise<string[]> {
  if (cachedStates && cachedStates.length > 0) {
    return cachedStates;
  }

  const foundStates = new Set<string>();
  let offset = 0;
  const pageSize = 1000;

  try {
    while (true) {
      const { data, error } = await userClient(token)
        .from('government_schemes')
        .select('state')
        .range(offset, offset + pageSize - 1);

      if (error) {
        cachedStates = ALL_INDIAN_STATES;
        return cachedStates;
      }

      if (!data || data.length === 0) break;
      for (const r of data) {
        if (r.state) foundStates.add(r.state.trim());
      }
      if (data.length < pageSize) break;
      offset += pageSize;
    }
  } catch {
    cachedStates = ALL_INDIAN_STATES;
    return cachedStates;
  }

  const states = Array.from(foundStates)
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));

  cachedStates = states.length > 0 ? states : ALL_INDIAN_STATES;
  return cachedStates;
}

export async function listSchemes(
  token: string,
  query: SchemesQuery,
): Promise<SchemeCard[]> {
  const canonicalStates = await listSchemeStates(token);
  const normalized = query.state.toLowerCase().trim();

  let matchedState = canonicalStates.find(
    (s) => s.toLowerCase() === normalized,
  );

  if (!matchedState) {
    matchedState = ALL_INDIAN_STATES.find(
      (s) => s.toLowerCase() === normalized,
    );
  }

  if (!matchedState) {
    throw ApiError.invalidRequest(`Unknown state: "${query.state}". Please select a valid state.`);
  }

  let dbQuery = userClient(token)
    .from('government_schemes')
    .select('row_id, name, short_title, category, scheme_scope, what_is_it, tags')
    .eq('state', matchedState)
    // Order STATE schemes first, then CENTRAL, then alphabetically by name
    .order('scheme_scope', { ascending: false })
    .order('name', { ascending: true });

  const limit = query.limit ?? 50;
  const offset = query.offset ?? 0;

  dbQuery = dbQuery.range(offset, offset + limit - 1);

  const { data, error } = await dbQuery;
  if (error) throw error;

  let schemesData = data ?? [];
  if (schemesData.length === 0) {
    // If state has no specific rows, fallback to nationwide CENTRAL schemes
    const { data: centralData } = await userClient(token)
      .from('government_schemes')
      .select('row_id, name, short_title, category, scheme_scope, what_is_it, tags')
      .eq('scheme_scope', 'CENTRAL')
      .range(offset, offset + limit - 1);
    if (centralData && centralData.length > 0) {
      schemesData = centralData;
    }
  }

  return schemesData.map((row) => ({
    row_id: row.row_id,
    name: row.name,
    short_title: row.short_title,
    category: row.category,
    scheme_scope: row.scheme_scope,
    summary: extractSummary(row.what_is_it),
    reasonKey: computeReasonKey(query.cropCode, row.tags ?? [], row.category, row.name),
  }));
}

export async function getSchemeDetail(token: string, rowId: string): Promise<SchemeDetail> {
  const { data, error } = await userClient(token)
    .from('government_schemes')
    .select(
      'row_id, name, short_title, category, what_is_it, potential_benefit, who_may_be_eligible, documents, how_to_apply, official_source, myscheme_url',
    )
    .eq('row_id', rowId)
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    throw ApiError.notFound('Scheme not found.');
  }

  return {
    row_id: data.row_id,
    name: data.name,
    short_title: data.short_title,
    category: data.category,
    what_is_it: data.what_is_it,
    potential_benefit: data.potential_benefit,
    who_may_be_eligible: data.who_may_be_eligible,
    documents: data.documents ?? [],
    how_to_apply: data.how_to_apply,
    official_source: data.official_source,
    myscheme_url: data.myscheme_url,
  };
}
