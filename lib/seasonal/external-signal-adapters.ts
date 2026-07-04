/**
 * external-signal-adapters — lib/seasonal/external-signal-adapters.ts
 *
 * Not-configured guards for the two seasonal signal sources that have no
 * sanctioned free integration wired yet:
 *
 *   - Google Trends — has NO official API. A scraper / third-party provider is a
 *     founder-gated decision (cost, ToS, reliability). Until a provider is
 *     configured this adapter returns `{ configured: false, signals: [] }`.
 *   - ABS (Australian Bureau of Statistics) — the public SDMX API at
 *     data.abs.gov.au is free, but wiring the industry→dataset mapping is
 *     non-trivial. Stubbed behind the same guard until enabled.
 *
 * HARD RULE (SYN-560): an unconfigured source is SKIPPED, never invented. These
 * adapters NEVER fabricate trend/ABS signals. The engine still produces real
 * holiday (nager.at) and school-term (static JSON) signals without them, so the
 * weekly job degrades gracefully.
 *
 * To enable Google Trends later: implement fetchGoogleTrendsSignals to call the
 * chosen provider and set GOOGLE_TRENDS_PROVIDER (+ any provider key). To enable
 * ABS: implement the SDMX fetch and set ABS_API_ENABLED=true.
 *
 * @task SYN-560
 */

/** A seasonal signal ready to upsert — matches the ingestion route's row shape. */
export interface ExternalSignalRow {
  industrySlug: string;
  locationState: string;
  signalType: string;
  opportunityLabel: string;
  windowStart: Date;
  windowEnd: Date;
  confidenceScore: number;
  source: string;
}

export interface AdapterResult {
  /** Whether a provider is configured for this source. */
  configured: boolean;
  /** Real signals produced by the source. Empty when not configured. */
  signals: ExternalSignalRow[];
  /** Human-readable reason when not configured (for logging). */
  reason?: string;
}

/**
 * Google Trends adapter. Founder-gated: no official API exists, so a provider
 * must be explicitly configured. Returns configured:false (never fabricates)
 * until then.
 */
export async function fetchGoogleTrendsSignals(): Promise<AdapterResult> {
  const provider = process.env.GOOGLE_TRENDS_PROVIDER?.trim();
  if (!provider) {
    return {
      configured: false,
      signals: [],
      reason:
        'GOOGLE_TRENDS_PROVIDER not set — no sanctioned Trends provider (founder-gated). Skipping; no fabricated trend signals.',
    };
  }

  // No provider implementation is wired yet. Adding one (scraper / paid API) is
  // a founder-gated decision — fail closed rather than invent data.
  return {
    configured: false,
    signals: [],
    reason: `GOOGLE_TRENDS_PROVIDER="${provider}" set but no provider implementation is wired. Skipping; no fabricated trend signals.`,
  };
}

/**
 * ABS adapter. The public data.abs.gov.au SDMX API is free but the
 * industry→dataset mapping is not wired yet. Stubbed behind the same guard.
 */
export async function fetchAbsSignals(): Promise<AdapterResult> {
  const enabled = process.env.ABS_API_ENABLED?.trim().toLowerCase() === 'true';
  if (!enabled) {
    return {
      configured: false,
      signals: [],
      reason:
        'ABS_API_ENABLED not true — ABS SDMX integration not wired. Skipping; no fabricated ABS signals.',
    };
  }

  // No SDMX fetch implemented yet — fail closed rather than invent data.
  return {
    configured: false,
    signals: [],
    reason:
      'ABS_API_ENABLED=true but no SDMX fetch implementation is wired. Skipping; no fabricated ABS signals.',
  };
}
