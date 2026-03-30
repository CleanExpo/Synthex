/**
 * ExternalAPIClient interface tests — SYN-541
 *
 * Verifies that GBPClient satisfies the ExternalAPIClient interface and that
 * normaliseError maps HTTP status codes to the correct ExternalAPIErrorCode.
 *
 * Board decision: SYN-538 / SYN-541 | Session 9 | 2026-03-30
 */

import { GBPClient } from '@/lib/external-apis/gbp-client';
import type { ExternalAPIClient } from '@/lib/external-apis/interface';
import type { GBPRequest, GBPResponse } from '@/lib/external-apis/gbp-client';

describe('GBPClient — ExternalAPIClient interface compliance', () => {
  // TypeScript type check: if this line compiles, the interface is satisfied.
  const client: ExternalAPIClient<GBPRequest, GBPResponse> = new GBPClient();

  it('satisfies ExternalAPIClient interface (type-level)', () => {
    expect(typeof client.fetch).toBe('function');
    expect(typeof client.normaliseError).toBe('function');
    expect(client.retryPolicy).toBeDefined();
    expect(client.quotaGuard).toBeDefined();
  });

  it('has correct retryPolicy configuration', () => {
    expect(client.retryPolicy.maxAttempts).toBe(3);
    expect(client.retryPolicy.backoffMs).toEqual([1_000, 5_000, 15_000]);
    expect(client.retryPolicy.retryOn).toContain('RATE_LIMITED');
    expect(client.retryPolicy.retryOn).toContain('NETWORK_TIMEOUT');
  });

  it('has correct quotaGuard configuration', () => {
    expect(client.quotaGuard.dailyLimit).toBe(800);
    expect(client.quotaGuard.onLimitExceeded).toBe('skip');
  });
});

describe('GBPClient.normaliseError', () => {
  const client = new GBPClient();

  it('maps HTTP 429 to RATE_LIMITED (retryable: true)', () => {
    const result = client.normaliseError({ status: 429 });
    expect(result.code).toBe('RATE_LIMITED');
    expect(result.retryable).toBe(true);
  });

  it('maps HTTP 401 to UNAUTHORIZED (retryable: false)', () => {
    const result = client.normaliseError({ status: 401 });
    expect(result.code).toBe('UNAUTHORIZED');
    expect(result.retryable).toBe(false);
  });

  it('maps HTTP 403 to UNAUTHORIZED (retryable: false)', () => {
    const result = client.normaliseError({ status: 403 });
    expect(result.code).toBe('UNAUTHORIZED');
    expect(result.retryable).toBe(false);
  });

  it('maps HTTP 404 to NOT_FOUND (retryable: false)', () => {
    const result = client.normaliseError({ status: 404 });
    expect(result.code).toBe('NOT_FOUND');
    expect(result.retryable).toBe(false);
  });

  it('maps HTTP 504 to NETWORK_TIMEOUT (retryable: true)', () => {
    const result = client.normaliseError({ status: 504 });
    expect(result.code).toBe('NETWORK_TIMEOUT');
    expect(result.retryable).toBe(true);
  });

  it('maps fetch TypeError to NETWORK_TIMEOUT (retryable: true)', () => {
    const result = client.normaliseError(new TypeError('Failed to fetch'));
    expect(result.code).toBe('NETWORK_TIMEOUT');
    expect(result.retryable).toBe(true);
  });

  it('maps unknown errors to UNKNOWN (retryable: false)', () => {
    const result = client.normaliseError('something unexpected');
    expect(result.code).toBe('UNKNOWN');
    expect(result.retryable).toBe(false);
  });
});

describe('GBPClient.fetch (stub)', () => {
  const client = new GBPClient();

  it('returns success: false with UNKNOWN code until SYN-530 is implemented', async () => {
    const result = await client.fetch({
      locationName: 'accounts/123/locations/456',
      action: 'listReviews',
    });
    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('UNKNOWN');
    expect(result.error?.message).toContain('SYN-530');
  });
});
