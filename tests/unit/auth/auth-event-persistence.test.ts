/**
 * P2 / spec C6 — auth-event persistence + PII minimization.
 *
 * Covers the two pure functions the consolidation introduces:
 *  - sanitizeAuthEventPii: hash email (sha256), truncate IP to /24 (IPv4) / /48
 *    (IPv6), drop user_agent.
 *  - toImmutableAuditEvent: map a genuine AuthEvent onto the canonical
 *    audit_events_immutable AuditEvent shape (category 'auth'), or null for the
 *    non-auth events that piggyback on authMonitor.trackEvent.
 *
 * The RLS-dependent "does it actually land under service-role vs get denied as
 * anon" behaviour is proven on a Supabase branch (spec §13), not here.
 */
import { createHash } from 'crypto';
import {
  sanitizeAuthEventPii,
  toImmutableAuditEvent,
  type AuthEvent,
} from '@/lib/auth/monitoring';

const baseEvent = (over: Partial<AuthEvent> = {}): AuthEvent => ({
  type: 'failure',
  method: 'email',
  email: 'user@example.com',
  timestamp: new Date('2026-07-11T02:00:00.000Z'),
  environment: 'production',
  sessionId: 'sess_123',
  ipAddress: '203.0.113.47',
  userAgent: 'Mozilla/5.0 (secret device)',
  ...over,
});

describe('sanitizeAuthEventPii', () => {
  it('hashes email with sha256 (hex), normalized lower/trim', () => {
    const expected = createHash('sha256')
      .update('user@example.com', 'utf8')
      .digest('hex');
    expect(sanitizeAuthEventPii(baseEvent()).emailHash).toBe(expected);
    // Same email, different casing/whitespace → identical hash (correlatable).
    expect(
      sanitizeAuthEventPii(baseEvent({ email: '  User@Example.COM ' }))
        .emailHash
    ).toBe(expected);
    expect(sanitizeAuthEventPii(baseEvent()).emailHash).toMatch(
      /^[0-9a-f]{64}$/
    );
  });

  it('returns no emailHash when email absent', () => {
    expect(
      sanitizeAuthEventPii(baseEvent({ email: undefined })).emailHash
    ).toBeUndefined();
  });

  it('truncates IPv4 to /24 (zeroes the last octet)', () => {
    expect(
      sanitizeAuthEventPii(baseEvent({ ipAddress: '203.0.113.47' })).ipAddress
    ).toBe('203.0.113.0');
    expect(
      sanitizeAuthEventPii(baseEvent({ ipAddress: '10.8.0.255' })).ipAddress
    ).toBe('10.8.0.0');
  });

  it('truncates IPv6 to /48 and drops absent/malformed IPs', () => {
    expect(
      sanitizeAuthEventPii(baseEvent({ ipAddress: '2001:db8:1234:5678::1' }))
        .ipAddress
    ).toBe('2001:db8:1234::');
    expect(
      sanitizeAuthEventPii(baseEvent({ ipAddress: undefined })).ipAddress
    ).toBeUndefined();
    expect(
      sanitizeAuthEventPii(baseEvent({ ipAddress: 'not-an-ip' })).ipAddress
    ).toBeUndefined();
  });

  it('never exposes user_agent or raw email', () => {
    const out = sanitizeAuthEventPii(baseEvent());
    expect(JSON.stringify(out)).not.toContain('secret device');
    expect(JSON.stringify(out)).not.toContain('user@example.com');
  });
});

describe('toImmutableAuditEvent', () => {
  it('maps a failure auth event onto the immutable auth AuditEvent', () => {
    const ae = toImmutableAuditEvent(baseEvent({ type: 'failure' }));
    expect(ae).not.toBeNull();
    expect(ae!.action).toBe('auth_monitor.failure');
    expect(ae!.resource).toBe('authentication');
    expect(ae!.category).toBe('auth'); // routes to audit_events_immutable
    expect(ae!.outcome).toBe('failure');
    expect(ae!.severity).toBe('medium');
    expect(ae!.details!.emailHash).toBe(
      createHash('sha256').update('user@example.com', 'utf8').digest('hex')
    );
    expect(ae!.ipAddress).toBe('203.0.113.0');
    expect(ae!.userAgent).toBeUndefined(); // PII: user_agent dropped
  });

  it('marks success/logout/attempt as low-severity success', () => {
    for (const type of ['success', 'logout', 'attempt'] as const) {
      const ae = toImmutableAuditEvent(baseEvent({ type }));
      expect(ae!.outcome).toBe('success');
      expect(ae!.severity).toBe('low');
    }
    expect(toImmutableAuditEvent(baseEvent({ type: 'error' }))!.outcome).toBe(
      'failure'
    );
  });

  it('carries NO raw PII anywhere in the emitted event', () => {
    const ae = toImmutableAuditEvent(baseEvent());
    const serialized = JSON.stringify(ae);
    expect(serialized).not.toContain('user@example.com');
    expect(serialized).not.toContain('secret device');
  });

  it('returns null for non-auth events that piggyback on trackEvent', () => {
    // generate-content funnels these through authMonitor.trackEvent; they must
    // NOT be persisted to the immutable auth ledger (kept in-memory only).
    expect(
      toImmutableAuditEvent(
        baseEvent({ type: 'content_generation' as AuthEvent['type'] })
      )
    ).toBeNull();
    expect(
      toImmutableAuditEvent(
        baseEvent({ type: 'content_generation_error' as AuthEvent['type'] })
      )
    ).toBeNull();
  });

  it('omits undefined detail fields', () => {
    const ae = toImmutableAuditEvent(
      baseEvent({
        email: undefined,
        sessionId: undefined,
        provider: undefined,
        error: undefined,
      })
    );
    expect(ae!.details).not.toHaveProperty('emailHash');
    expect(ae!.details).not.toHaveProperty('sessionId');
    expect(ae!.details).not.toHaveProperty('provider');
    expect(ae!.details).not.toHaveProperty('error');
  });
});
