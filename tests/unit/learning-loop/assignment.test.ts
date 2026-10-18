/**
 * Server-issued card sessions: signed only under the per-IP mint cap, verified by the server.
 */
const checkRateLimit = jest.fn();
jest.mock('@/lib/auth/rate-limit', () => ({
  checkRateLimit: (...a: unknown[]) => checkRateLimit(...a),
}));

import {
  issueSessionFor,
  MINT_PER_HOUR,
  verifySession,
} from '@/lib/learning-loop/assignment';

beforeEach(() => {
  process.env.JWT_SECRET = 'test-only-card-assignment-secret';
  checkRateLimit.mockReset();
});

it('signs a session under the per-IP mint cap and the server verifies it', async () => {
  checkRateLimit.mockResolvedValue({ ok: true });
  const s = await issueSessionFor('phill', '203.0.113.9');
  expect(s.sig).toBeTruthy();
  expect(verifySession(s.id, s.sig ?? undefined)).toBe(true);
  expect(checkRateLimit).toHaveBeenCalledWith(
    null,
    expect.objectContaining({
      namespace: 'card-session-mint',
      ipKey: '203.0.113.9',
      limits: expect.objectContaining({
        ip: { limit: MINT_PER_HOUR, windowSeconds: 3600 },
      }),
    })
  );
});

it('past the cap a reload still gets a session, but unsigned, so it can never count as random', async () => {
  checkRateLimit.mockResolvedValue({ ok: false, retryAfterSeconds: 100 });
  const s = await issueSessionFor('phill', '203.0.113.9');
  expect(s.id).toMatch(/^[0-9a-f-]{36}$/);
  expect(s.sig).toBeNull();
  expect(verifySession(s.id, undefined)).toBe(false);
});
