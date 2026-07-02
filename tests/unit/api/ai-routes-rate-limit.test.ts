/**
 * SYN-1004 slice 1 — expensive AI routes must be gated by the durable
 * (Upstash-backed) limiter, not just APISecurityChecker's per-instance map.
 *
 * Behavioural proof for a representative route (content/industry): its POST
 * delegates to withRateLimit as the OUTER gate (the inner handler never runs
 * when the limiter short-circuits). Plus a structural assertion that the other
 * two named routes also wrap their POST — type-check proves the wrappers
 * compile; this proves the wiring is present and won't silently regress.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

// ── Behavioural: content/industry POST goes through withRateLimit ────────────
const withRateLimitMock = jest.fn();
jest.mock('@/lib/rate-limit/rate-limiter', () => ({
  withRateLimit: (...a: unknown[]) => withRateLimitMock(...a),
}));
// Heavy deps the route imports at module load — stub so import is cheap.
jest.mock('@/lib/security/api-security-checker', () => ({
  APISecurityChecker: { check: jest.fn(), createSecureResponse: jest.fn() },
  DEFAULT_POLICIES: { AUTHENTICATED_WRITE: {} },
}));
jest.mock('@/lib/services/content-generator', () => ({ contentGenerator: {} }));
jest.mock('@/lib/content/engagement-scorer', () => ({ scoreEngagement: jest.fn() }));
jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

import { POST as industryPost } from '@/app/api/content/industry/route';

describe('content/industry POST rate limiting', () => {
  it('delegates to withRateLimit (durable gate) without running the inner handler', async () => {
    const sentinel = { status: 429 };
    // Simulate the limiter short-circuiting: return without invoking handler.
    withRateLimitMock.mockResolvedValue(sentinel);

    const req = { url: 'http://x/api/content/industry' } as never;
    const res = await industryPost(req);

    expect(withRateLimitMock).toHaveBeenCalledTimes(1);
    expect(withRateLimitMock.mock.calls[0][0]).toBe(req);
    expect(typeof withRateLimitMock.mock.calls[0][1]).toBe('function');
    expect(res).toBe(sentinel);
  });
});

// ── Structural: every named AI route wraps its POST with withRateLimit ───────
describe('AI route durable-limiter wiring', () => {
  const ROUTES = [
    'app/api/video/generate/route.ts',
    'app/api/content/industry/route.ts',
    'app/api/google-business/reviews/[reviewId]/auto-reply/route.ts',
  ];

  it.each(ROUTES)('%s imports and wraps POST with withRateLimit', (rel) => {
    const src = readFileSync(join(process.cwd(), rel), 'utf8');
    expect(src).toMatch(/import\s*\{\s*withRateLimit\s*\}\s*from\s*'@\/lib\/rate-limit\/rate-limiter'/);
    expect(src).toMatch(/return\s+withRateLimit\(/);
  });
});
