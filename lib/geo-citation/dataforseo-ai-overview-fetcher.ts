/**
 * DataForSEO AI Overview fetcher — implements the SYN-584 dependency gate.
 *
 * Satisfies the `AiOverviewFetcher` contract in ai-overview-adapter.ts by
 * querying DataForSEO's SERP endpoint and returning the `ai_overview` block.
 *
 * The gate's rules are preserved exactly, because they are the whole point of
 * the adapter: this NEVER fabricates a result. Every failure path returns
 * `configured` honestly and puts a reason on the row.
 *
 *   - credentials absent      -> configured:false + the adapter's own reason
 *   - provider errored        -> configured:true,  rawText:null, errorReason set
 *   - queried, no AI Overview -> configured:true,  rawText:null, errorReason:null
 *
 * That third case is the one worth being careful about: "we asked and Google
 * showed no AI Overview" is a real observation and must NOT look identical to
 * "we could not ask". The monitor distinguishes them by errorReason.
 */

import {
  AI_OVERVIEW_NOT_CONFIGURED_REASON,
  type AiOverviewFetchResult,
  type AiOverviewFetcher,
} from './ai-overview-adapter';

const ENDPOINT =
  'https://api.dataforseo.com/v3/serp/google/organic/live/advanced';

/** DataForSEO bills per request, so the monitor's own rate limit is the budget
 *  control. Keep this timeout well under the cron's per-item budget. */
const REQUEST_TIMEOUT_MS = 30_000;

export interface DataForSeoFetcherOptions {
  locationName?: string;
  languageCode?: string;
  /** Injectable for tests. Defaults to global fetch. */
  fetchImpl?: typeof fetch;
}

/** Pull the AI Overview text out of a DataForSEO SERP result.
 *  Returns null when the SERP genuinely contained no AI Overview block. */
export function extractAiOverviewText(payload: unknown): string | null {
  const tasks = (payload as { tasks?: unknown[] })?.tasks;
  if (!Array.isArray(tasks) || tasks.length === 0) return null;

  for (const task of tasks) {
    const results = (task as { result?: unknown[] })?.result;
    if (!Array.isArray(results)) continue;
    for (const result of results) {
      const items = (result as { items?: unknown[] })?.items;
      if (!Array.isArray(items)) continue;
      for (const item of items) {
        const it = item as {
          type?: string;
          text?: string;
          markdown?: string;
          items?: { text?: string }[];
        };
        if (it?.type !== 'ai_overview') continue;
        if (typeof it.markdown === 'string' && it.markdown.trim()) {
          return it.markdown;
        }
        if (typeof it.text === 'string' && it.text.trim()) return it.text;
        if (Array.isArray(it.items)) {
          const joined = it.items
            .map(sub => (typeof sub?.text === 'string' ? sub.text : ''))
            .filter(Boolean)
            .join('\n')
            .trim();
          if (joined) return joined;
        }
      }
    }
  }
  return null;
}

export function createDataForSeoAiOverviewFetcher(
  options: DataForSeoFetcherOptions = {}
): AiOverviewFetcher {
  const {
    locationName = 'Australia',
    languageCode = 'en',
    fetchImpl,
  } = options;

  return async (queryText: string): Promise<AiOverviewFetchResult> => {
    const login = process.env.DATAFORSEO_LOGIN;
    const password = process.env.DATAFORSEO_PASSWORD;

    // Credentials are read per call, not at module load, so a deploy that adds
    // them takes effect without a rebuild — and so tests can toggle them.
    if (!login || !password) {
      return {
        configured: false,
        rawText: null,
        errorReason: AI_OVERVIEW_NOT_CONFIGURED_REASON,
      };
    }

    const doFetch = fetchImpl ?? fetch;
    const auth = Buffer.from(`${login}:${password}`).toString('base64');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await doFetch(ENDPOINT, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify([
          {
            keyword: queryText,
            location_name: locationName,
            language_code: languageCode,
            device: 'desktop',
            os: 'windows',
          },
        ]),
        signal: controller.signal,
      });

      if (!response.ok) {
        return {
          configured: true,
          rawText: null,
          errorReason: `DataForSEO HTTP ${response.status}`,
          statusCode: response.status,
        };
      }

      const payload = await response.json();

      // DataForSEO returns 200 with a non-20000 status_code on task failure.
      const taskStatus = (
        payload as {
          tasks?: { status_code?: number; status_message?: string }[];
        }
      )?.tasks?.[0];
      if (
        taskStatus &&
        typeof taskStatus.status_code === 'number' &&
        taskStatus.status_code !== 20000
      ) {
        return {
          configured: true,
          rawText: null,
          errorReason:
            `DataForSEO task ${taskStatus.status_code}: ` +
            `${taskStatus.status_message ?? 'unknown'}`,
          statusCode: response.status,
        };
      }

      // null here means "asked, and there was no AI Overview" — a real result.
      return {
        configured: true,
        rawText: extractAiOverviewText(payload),
        errorReason: null,
        statusCode: response.status,
      };
    } catch (error) {
      const reason =
        error instanceof Error && error.name === 'AbortError'
          ? `DataForSEO request timed out after ${REQUEST_TIMEOUT_MS}ms`
          : `DataForSEO request failed: ${
              error instanceof Error ? error.message : String(error)
            }`;
      return { configured: true, rawText: null, errorReason: reason };
    } finally {
      clearTimeout(timer);
    }
  };
}
