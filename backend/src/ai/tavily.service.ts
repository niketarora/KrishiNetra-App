import { getEnv } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';

/**
 * Deep research, behind one adapter.
 *
 * This is the only branch allowed to reach outside the app for facts. It is
 * reserved for questions where the answer genuinely changes over time —
 * schemes, subsidies, policy, news — because a web round trip is the slowest
 * thing in the pipeline and most farming questions do not need one.
 *
 * Sources come back with the answer and are shown to the farmer. An answer
 * about a government subsidy that cannot be checked is worth less than one
 * that can.
 */

export type ResearchSource = {
  title: string;
  url: string;
};

export type ResearchResult = {
  answer: string;
  sources: ResearchSource[];
};

/**
 * Read the provider's payload back.
 *
 * A result without a usable answer returns null rather than an empty string,
 * so the caller reports the service as unhelpful instead of speaking silence
 * at the farmer. Sources are best-effort: an answer with no citations is still
 * an answer, but a citation without a URL is not a citation.
 */
export function parseTavilyResult(payload: unknown): ResearchResult | null {
  if (!payload || typeof payload !== 'object') return null;

  const record = payload as Record<string, unknown>;
  const answer = typeof record.answer === 'string' ? record.answer.trim() : '';
  if (!answer) return null;

  const sources: ResearchSource[] = [];
  const results = Array.isArray(record.results) ? record.results : [];

  for (const entry of results) {
    if (!entry || typeof entry !== 'object') continue;
    const item = entry as Record<string, unknown>;
    const url = typeof item.url === 'string' ? item.url.trim() : '';
    if (!url) continue;

    const title = typeof item.title === 'string' && item.title.trim() ? item.title.trim() : url;
    sources.push({ title, url });
  }

  return { answer, sources };
}

/**
 * Search for current information.
 *
 * `depth` is the latency dial from §5 of the brief. 'basic' is the default and
 * covers "what is the current X"; 'advanced' costs noticeably more time and is
 * only used when the router says the question needs several sources compared.
 */
export async function research(
  query: string,
  depth: 'basic' | 'advanced' = 'basic',
  options: { timeoutMs?: number } = {},
): Promise<ResearchResult> {
  const env = getEnv();

  if (!env.TAVILY_API_KEY) {
    throw ApiError.notConnected('Research is not connected yet.');
  }

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? (depth === 'advanced' ? 25_000 : 15_000),
  );

  try {
    const response = await fetch(env.TAVILY_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.TAVILY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        search_depth: depth,
        // The answer is read aloud, so the provider composing it is worth more
        // than us stitching snippets together and hoping they read as prose.
        include_answer: 'advanced',
        max_results: 5,
        // Indian agriculture is the whole subject; narrowing the country keeps
        // scheme results on the right side of a border.
        country: 'india',
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      // The provider's body can quote the key and its quota. Status only.
      console.error('[tavily] search failed with status', response.status);
      throw ApiError.notConnected('Research is unavailable right now.');
    }

    const result = parseTavilyResult(await response.json());
    if (!result) {
      throw ApiError.notConnected('Research could not find an answer to that.');
    }

    return result;
  } catch (error) {
    if (error instanceof ApiError) throw error;

    console.error('[tavily] search failed:', error);
    throw ApiError.notConnected('Research is unavailable right now.');
  } finally {
    clearTimeout(timeout);
  }
}
