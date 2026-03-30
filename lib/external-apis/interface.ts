/**
 * ExternalAPIClient — Typed interface for all external API integrations.
 *
 * Every external API integration in Synthex MUST implement this interface.
 * GBP (Google Business Profile) is the first implementation — see gbp-client.ts.
 * Future integrations: Yelp, Google Search Console, Meta Graph API.
 *
 * Board decision: SYN-538 / SYN-541 | Session 9 | 2026-03-30
 */

export type ExternalAPIErrorCode =
  | 'RATE_LIMITED'
  | 'UNAUTHORIZED'
  | 'NOT_FOUND'
  | 'QUOTA_EXCEEDED'
  | 'NETWORK_TIMEOUT'
  | 'MALFORMED_RESPONSE'
  | 'UNKNOWN';

export interface ExternalAPIError {
  code: ExternalAPIErrorCode;
  message: string;
  rawStatus?: number;
  retryable: boolean;
}

export interface ExternalAPIResult<T> {
  success: boolean;
  data?: T;
  error?: ExternalAPIError;
  /** If set, caller should wait this many ms before retrying */
  retryAfterMs?: number;
}

export interface RetryPolicy {
  /** Maximum number of retry attempts (not counting the initial attempt) */
  maxAttempts: number;
  /** Backoff durations in ms for each retry attempt. e.g. [1000, 5000, 15000] */
  backoffMs: number[];
  /** Which error codes should trigger a retry */
  retryOn: ExternalAPIErrorCode[];
}

export interface QuotaGuard {
  /** Maximum calls allowed per day */
  dailyLimit: number;
  /** Async function returning current day's usage count */
  currentUsage: () => Promise<number>;
  /** Behaviour when daily limit is exceeded */
  onLimitExceeded: 'throw' | 'queue' | 'skip';
}

/**
 * All external API integrations must implement this interface.
 *
 * Usage:
 * ```typescript
 * import type { ExternalAPIClient } from '@/lib/external-apis/interface';
 * import { GBPClient } from '@/lib/external-apis/gbp-client';
 *
 * const client: ExternalAPIClient<GBPRequest, GBPResponse> = new GBPClient();
 * const result = await client.fetch(request);
 * if (!result.success) console.error(result.error?.code);
 * ```
 */
export interface ExternalAPIClient<TRequest, TResponse> {
  /** Execute the API request, returning a typed result (never throws) */
  fetch(request: TRequest): Promise<ExternalAPIResult<TResponse>>;
  /** Retry configuration for transient failures */
  retryPolicy: RetryPolicy;
  /** Daily quota enforcement */
  quotaGuard: QuotaGuard;
  /** Normalise a raw API error into a typed ExternalAPIError */
  normaliseError(raw: unknown): ExternalAPIError;
}
