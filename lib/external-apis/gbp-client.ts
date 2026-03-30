/**
 * GBPClient — Google Business Profile API stub implementation.
 *
 * First implementor of ExternalAPIClient<TRequest, TResponse>.
 * The fetch() method is a stub — actual implementation ships with SYN-530
 * (Build Review Intelligence Engine: GBP monitoring + dashboard panel).
 *
 * Board decision: SYN-538 / SYN-541 | Session 9 | 2026-03-30
 */

import type {
  ExternalAPIClient,
  ExternalAPIError,
  ExternalAPIErrorCode,
  ExternalAPIResult,
  QuotaGuard,
  RetryPolicy,
} from './interface';

// ---------------------------------------------------------------------------
// GBP-specific request / response shapes (expand in SYN-530)
// ---------------------------------------------------------------------------

export interface GBPRequest {
  /** Google Business Profile location name, e.g. accounts/123/locations/456 */
  locationName: string;
  /** API action to perform */
  action: 'listReviews' | 'getLocation' | 'replyToReview';
  /** Optional payload (for reply actions) */
  payload?: Record<string, unknown>;
}

export interface GBPResponse {
  /** Raw API response body — typed further in SYN-530 */
  data: Record<string, unknown>;
  /** ISO timestamp of the response */
  timestamp: string;
}

// ---------------------------------------------------------------------------
// GBP HTTP status → ExternalAPIErrorCode mapping
// ---------------------------------------------------------------------------

const STATUS_CODE_MAP: Record<number, ExternalAPIErrorCode> = {
  400: 'MALFORMED_RESPONSE',
  401: 'UNAUTHORIZED',
  403: 'UNAUTHORIZED',
  404: 'NOT_FOUND',
  429: 'RATE_LIMITED',
  500: 'UNKNOWN',
  502: 'UNKNOWN',
  503: 'UNKNOWN',
  504: 'NETWORK_TIMEOUT',
};

// ---------------------------------------------------------------------------
// GBPClient implementation
// ---------------------------------------------------------------------------

export class GBPClient
  implements ExternalAPIClient<GBPRequest, GBPResponse>
{
  /**
   * GBP API allows ~1,000 requests/day per project.
   * Conservative limit of 800 leaves 20% headroom for bursts.
   */
  readonly quotaGuard: QuotaGuard = {
    dailyLimit: 800,
    currentUsage: async () => {
      // TODO (SYN-530): Query pipeline_cost_ledger for today's GBP call count
      return 0;
    },
    onLimitExceeded: 'skip',
  };

  readonly retryPolicy: RetryPolicy = {
    maxAttempts: 3,
    backoffMs: [1_000, 5_000, 15_000],
    retryOn: ['RATE_LIMITED', 'NETWORK_TIMEOUT'],
  };

  normaliseError(raw: unknown): ExternalAPIError {
    // Handle fetch/network errors
    if (raw instanceof TypeError && raw.message.includes('fetch')) {
      return {
        code: 'NETWORK_TIMEOUT',
        message: raw.message,
        retryable: true,
      };
    }

    // Handle objects with an HTTP status code
    if (
      raw !== null &&
      typeof raw === 'object' &&
      'status' in raw &&
      typeof (raw as { status: unknown }).status === 'number'
    ) {
      const status = (raw as { status: number }).status;
      const code: ExternalAPIErrorCode =
        STATUS_CODE_MAP[status] ?? 'UNKNOWN';
      return {
        code,
        message:
          (raw as { message?: string }).message ??
          `GBP API returned HTTP ${status}`,
        rawStatus: status,
        retryable: code === 'RATE_LIMITED' || code === 'NETWORK_TIMEOUT',
      };
    }

    // Fallback
    return {
      code: 'UNKNOWN',
      message:
        raw instanceof Error ? raw.message : 'Unknown GBP API error',
      retryable: false,
    };
  }

  /**
   * STUB — implement in SYN-530.
   * Returns a typed failure until the real GBP API integration is built.
   */
  async fetch(_request: GBPRequest): Promise<ExternalAPIResult<GBPResponse>> {
    return {
      success: false,
      error: {
        code: 'UNKNOWN',
        message:
          'GBPClient.fetch() is not yet implemented. See SYN-530.',
        retryable: false,
      },
    };
  }
}

export const gbpClient = new GBPClient();
