/**
 * Google AI Overview fetch adapter — SYN-584 (dark run).
 *
 * ┌─────────────────────────── DEPENDENCY GATE ───────────────────────────┐
 * │ Querying Google AI Overview requires an external SERP provider that     │
 * │ surfaces the AI Overview block (e.g. DataForSEO SERP `ai_overview`, or   │
 * │ SerpApi). As of this ticket NO such provider or credential is wired      │
 * │ into the Synthex stack (no DataForSEO client, no DATAFORSEO_* /          │
 * │ SERP_PROVIDER env). Standing up one is a FOUNDER-GATED decision.         │
 * │                                                                          │
 * │ Until a provider is configured, `defaultAiOverviewFetcher` returns       │
 * │ `configured: false` with an `errorReason` — the monitor records that     │
 * │ reason on the row. It NEVER fabricates a citation result.                │
 * └──────────────────────────────────────────────────────────────────────┘
 *
 * To wire a real provider later: implement a fetcher with this same signature
 * that calls the provider, returns the AI Overview text block as `rawText`,
 * and surfaces `statusCode` (esp. 429) so the monitor's backoff can react.
 */

export interface AiOverviewFetchResult {
  /** True only when a real provider is configured and was queried. */
  configured: boolean;
  /**
   * Raw AI Overview text block for the query, or null when absent / not
   * configured. Brand detection is performed by the caller on this text.
   */
  rawText: string | null;
  /** Populated when the fetch could not produce a usable result. */
  errorReason: string | null;
  /** HTTP-style status from the provider; 429 signals rate limiting. */
  statusCode?: number;
}

export type AiOverviewFetcher = (
  queryText: string
) => Promise<AiOverviewFetchResult>;

/** Env var a future provider adapter would read. Presence is checked so the
 *  not-configured message can name what is missing. */
const PROVIDER_ENV_KEYS = [
  'DATAFORSEO_LOGIN',
  'DATAFORSEO_PASSWORD',
  'SERPAPI_KEY',
  'SERP_PROVIDER',
] as const;

export function isAiOverviewProviderConfigured(): boolean {
  // A real provider needs BOTH DataForSEO credentials, OR a SerpApi key.
  const hasDataForSeo =
    !!process.env.DATAFORSEO_LOGIN && !!process.env.DATAFORSEO_PASSWORD;
  const hasSerpApi = !!process.env.SERPAPI_KEY;
  return hasDataForSeo || hasSerpApi;
}

export const AI_OVERVIEW_NOT_CONFIGURED_REASON =
  'AI Overview provider not configured (SYN-584 dependency gate): ' +
  `set one of [${PROVIDER_ENV_KEYS.join(', ')}] and wire a fetcher`;

/**
 * Default fetcher used by the weekly cron. No provider is wired, so this always
 * reports not-configured. It performs no network I/O and fabricates nothing.
 */
export const defaultAiOverviewFetcher: AiOverviewFetcher = async () => ({
  configured: false,
  rawText: null,
  errorReason: AI_OVERVIEW_NOT_CONFIGURED_REASON,
});
