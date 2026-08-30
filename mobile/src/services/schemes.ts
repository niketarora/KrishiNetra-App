import { apiFetch } from './api';

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

export type ListSchemesParams = {
  state: string;
  cropCode?: string;
  limit?: number;
  offset?: number;
};

export async function listSchemeStates(): Promise<string[]> {
  return apiFetch<string[]>('/api/v1/schemes/states', {
    fallbackKey: 'schemes.loadError',
  });
}

export async function listSchemes(params: ListSchemesParams): Promise<SchemeCard[]> {
  const query = new URLSearchParams();
  query.set('state', params.state);
  if (params.cropCode) query.set('cropCode', params.cropCode);
  if (params.limit !== undefined) query.set('limit', String(params.limit));
  if (params.offset !== undefined) query.set('offset', String(params.offset));

  return apiFetch<SchemeCard[]>(`/api/v1/schemes?${query.toString()}`, {
    fallbackKey: 'schemes.loadError',
  });
}

export async function getSchemeDetail(rowId: string): Promise<SchemeDetail> {
  return apiFetch<SchemeDetail>(`/api/v1/schemes/${encodeURIComponent(rowId)}`, {
    fallbackKey: 'schemes.loadError',
  });
}
