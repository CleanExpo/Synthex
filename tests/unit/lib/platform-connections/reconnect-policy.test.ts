/**
 * Unit tests for the proactive reconnect policy (SYN-1003).
 *
 * LinkedIn stores no refresh token, so its token dies at ~60 days with no
 * warning. The policy must flag a no-refresh-token connection for reconnect
 * BEFORE expiry, and must leave refreshable connections alone.
 */
import {
  evaluateProactiveReconnect,
  PROACTIVE_RECONNECT_WINDOW_MS,
} from '@/lib/platform-connections/reconnect-policy';

const NOW = new Date('2026-06-17T00:00:00.000Z');
const inDays = (n: number) => new Date(NOW.getTime() + n * 24 * 60 * 60 * 1000);

describe('evaluateProactiveReconnect', () => {
  it('does not flag a connection that has a refresh token (it self-heals)', () => {
    const r = evaluateProactiveReconnect(
      { expiresAt: inDays(1), hasRefreshToken: true },
      'linkedin',
      NOW,
    );
    expect(r.needsReconnect).toBe(false);
  });

  it('does not flag when expiry is comfortably beyond the window', () => {
    const r = evaluateProactiveReconnect(
      { expiresAt: inDays(30), hasRefreshToken: false },
      'linkedin',
      NOW,
    );
    expect(r.needsReconnect).toBe(false);
  });

  it('flags a no-refresh-token connection expiring within the window', () => {
    const r = evaluateProactiveReconnect(
      { expiresAt: inDays(3), hasRefreshToken: false },
      'linkedin',
      NOW,
    );
    expect(r.needsReconnect).toBe(true);
    expect(r.reason).toMatch(/LinkedIn/);
    expect(r.reason).toMatch(/cannot refresh automatically/i);
    expect(r.reason).toMatch(/expires on/i);
  });

  it('flags an already-expired no-refresh-token connection with past-tense copy', () => {
    const r = evaluateProactiveReconnect(
      { expiresAt: inDays(-2), hasRefreshToken: false },
      'linkedin',
      NOW,
    );
    expect(r.needsReconnect).toBe(true);
    expect(r.reason).toMatch(/expired on/i);
  });

  it('does not flag when there is no known expiry', () => {
    const r = evaluateProactiveReconnect(
      { expiresAt: null, hasRefreshToken: false },
      'linkedin',
      NOW,
    );
    expect(r.needsReconnect).toBe(false);
  });

  it('treats the window boundary as still within range', () => {
    const r = evaluateProactiveReconnect(
      { expiresAt: new Date(NOW.getTime() + PROACTIVE_RECONNECT_WINDOW_MS), hasRefreshToken: false },
      'linkedin',
      NOW,
    );
    expect(r.needsReconnect).toBe(true);
  });
});
