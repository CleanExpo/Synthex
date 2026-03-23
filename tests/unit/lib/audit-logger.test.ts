/**
 * Unit Tests for Audit Logger
 *
 * Tests lib/audit/audit-logger.ts:
 * - logAuditEvent stores the correct event type, userId, and metadata
 * - Each AuditEvent literal maps to an inferred severity and category
 * - The function never throws — Prisma errors are swallowed silently
 * - All 12 AuditEvent literals are accepted without TypeScript errors
 */

// ---------------------------------------------------------------------------
// Mock Prisma before any imports that reference it
// ---------------------------------------------------------------------------

const mockAuditLogCreate = jest.fn();

jest.mock('@/lib/prisma', () => ({
  prisma: {
    auditLog: {
      create: (...args: unknown[]) => mockAuditLogCreate(...args),
    },
  },
}));

import {
  logAuditEvent,
  type AuditEvent,
  type AuditLogEntry,
} from '@/lib/audit/audit-logger';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Capture the data argument passed to prisma.auditLog.create */
function capturedCreateData(): Record<string, unknown> {
  expect(mockAuditLogCreate).toHaveBeenCalledTimes(1);
  const call = mockAuditLogCreate.mock.calls[0][0] as {
    data: Record<string, unknown>;
  };
  return call.data;
}

// ---------------------------------------------------------------------------
// Core behaviour
// ---------------------------------------------------------------------------

describe('logAuditEvent', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuditLogCreate.mockResolvedValue({}); // default: success
  });

  // -------------------------------------------------------------------------
  // Happy-path storage
  // -------------------------------------------------------------------------

  describe('stores correct fields in the database', () => {
    it('sets action to the event name', async () => {
      await logAuditEvent({ event: 'user.login', userId: 'user-1' });

      const data = capturedCreateData();
      expect(data.action).toBe('user.login');
    });

    it('sets userId when provided', async () => {
      await logAuditEvent({ event: 'user.logout', userId: 'user-abc' });

      const data = capturedCreateData();
      expect(data.userId).toBe('user-abc');
    });

    it('sets userId to null when omitted (unauthenticated event)', async () => {
      await logAuditEvent({ event: 'user.login_failed' });

      const data = capturedCreateData();
      expect(data.userId).toBeNull();
    });

    it('stores metadata as the details field', async () => {
      await logAuditEvent({
        event: 'api.rate_limit_exceeded',
        userId: 'user-2',
        metadata: { endpoint: '/api/posts', count: 42 },
      });

      const data = capturedCreateData();
      expect(data.details).toEqual({ endpoint: '/api/posts', count: 42 });
    });

    it('stores empty object as details when metadata is omitted', async () => {
      await logAuditEvent({ event: 'user.login', userId: 'u1' });

      const data = capturedCreateData();
      expect(data.details).toEqual({});
    });

    it('stores ipAddress when provided', async () => {
      await logAuditEvent({ event: 'user.login', ipAddress: '1.2.3.4' });

      const data = capturedCreateData();
      expect(data.ipAddress).toBe('1.2.3.4');
    });

    it('stores ipAddress as null when not provided', async () => {
      await logAuditEvent({ event: 'user.login' });

      const data = capturedCreateData();
      expect(data.ipAddress).toBeNull();
    });

    it('stores userAgent when provided', async () => {
      await logAuditEvent({ event: 'user.login', userAgent: 'Mozilla/5.0' });

      const data = capturedCreateData();
      expect(data.userAgent).toBe('Mozilla/5.0');
    });

    it('stores userAgent as null when not provided', async () => {
      await logAuditEvent({ event: 'user.login' });

      const data = capturedCreateData();
      expect(data.userAgent).toBeNull();
    });

    it('defaults outcome to "success" when not specified', async () => {
      await logAuditEvent({ event: 'user.login', userId: 'u1' });

      const data = capturedCreateData();
      expect(data.outcome).toBe('success');
    });

    it('stores the provided outcome override', async () => {
      await logAuditEvent({
        event: 'user.login_failed',
        outcome: 'failure',
      });

      const data = capturedCreateData();
      expect(data.outcome).toBe('failure');
    });

    it('stores outcome "warning" correctly', async () => {
      await logAuditEvent({
        event: 'api.rate_limit_exceeded',
        outcome: 'warning',
      });

      const data = capturedCreateData();
      expect(data.outcome).toBe('warning');
    });
  });

  // -------------------------------------------------------------------------
  // Resource derivation from event prefix
  // -------------------------------------------------------------------------

  describe('derives resource from the event prefix', () => {
    it('extracts "user" from user.login', async () => {
      await logAuditEvent({ event: 'user.login' });
      const data = capturedCreateData();
      expect(data.resource).toBe('user');
    });

    it('extracts "billing" from billing.subscription_created', async () => {
      await logAuditEvent({ event: 'billing.subscription_created' });
      const data = capturedCreateData();
      expect(data.resource).toBe('billing');
    });

    it('extracts "account" from account.deletion_requested', async () => {
      await logAuditEvent({ event: 'account.deletion_requested' });
      const data = capturedCreateData();
      expect(data.resource).toBe('account');
    });

    it('extracts "admin" from admin.user_suspended', async () => {
      await logAuditEvent({ event: 'admin.user_suspended' });
      const data = capturedCreateData();
      expect(data.resource).toBe('admin');
    });
  });

  // -------------------------------------------------------------------------
  // Severity inference
  // -------------------------------------------------------------------------

  describe('infers correct severity', () => {
    it('user.login → low', async () => {
      await logAuditEvent({ event: 'user.login' });
      expect(capturedCreateData().severity).toBe('low');
    });

    it('user.login_failed → medium', async () => {
      await logAuditEvent({ event: 'user.login_failed' });
      expect(capturedCreateData().severity).toBe('medium');
    });

    it('user.logout → low', async () => {
      await logAuditEvent({ event: 'user.logout' });
      expect(capturedCreateData().severity).toBe('low');
    });

    it('user.password_change → medium', async () => {
      await logAuditEvent({ event: 'user.password_change' });
      expect(capturedCreateData().severity).toBe('medium');
    });

    it('billing.subscription_created → low', async () => {
      await logAuditEvent({ event: 'billing.subscription_created' });
      expect(capturedCreateData().severity).toBe('low');
    });

    it('billing.subscription_cancelled → medium', async () => {
      await logAuditEvent({ event: 'billing.subscription_cancelled' });
      expect(capturedCreateData().severity).toBe('medium');
    });

    it('billing.subscription_upgraded → low', async () => {
      await logAuditEvent({ event: 'billing.subscription_upgraded' });
      expect(capturedCreateData().severity).toBe('low');
    });

    it('account.deletion_requested → high', async () => {
      await logAuditEvent({ event: 'account.deletion_requested' });
      expect(capturedCreateData().severity).toBe('high');
    });

    it('account.data_exported → medium', async () => {
      await logAuditEvent({ event: 'account.data_exported' });
      expect(capturedCreateData().severity).toBe('medium');
    });

    it('admin.user_suspended → high', async () => {
      await logAuditEvent({ event: 'admin.user_suspended' });
      expect(capturedCreateData().severity).toBe('high');
    });

    it('api.rate_limit_exceeded → medium', async () => {
      await logAuditEvent({ event: 'api.rate_limit_exceeded' });
      expect(capturedCreateData().severity).toBe('medium');
    });

    it('security.cron_unauthorised → critical', async () => {
      await logAuditEvent({ event: 'security.cron_unauthorised' });
      expect(capturedCreateData().severity).toBe('critical');
    });
  });

  // -------------------------------------------------------------------------
  // Category inference
  // -------------------------------------------------------------------------

  describe('infers correct category', () => {
    it('user.login → auth', async () => {
      await logAuditEvent({ event: 'user.login' });
      expect(capturedCreateData().category).toBe('auth');
    });

    it('user.password_change → security', async () => {
      await logAuditEvent({ event: 'user.password_change' });
      expect(capturedCreateData().category).toBe('security');
    });

    it('billing.subscription_created → data', async () => {
      await logAuditEvent({ event: 'billing.subscription_created' });
      expect(capturedCreateData().category).toBe('data');
    });

    it('account.deletion_requested → compliance', async () => {
      await logAuditEvent({ event: 'account.deletion_requested' });
      expect(capturedCreateData().category).toBe('compliance');
    });

    it('account.data_exported → compliance', async () => {
      await logAuditEvent({ event: 'account.data_exported' });
      expect(capturedCreateData().category).toBe('compliance');
    });

    it('admin.user_suspended → security', async () => {
      await logAuditEvent({ event: 'admin.user_suspended' });
      expect(capturedCreateData().category).toBe('security');
    });

    it('api.rate_limit_exceeded → api', async () => {
      await logAuditEvent({ event: 'api.rate_limit_exceeded' });
      expect(capturedCreateData().category).toBe('api');
    });

    it('security.cron_unauthorised → security', async () => {
      await logAuditEvent({ event: 'security.cron_unauthorised' });
      expect(capturedCreateData().category).toBe('security');
    });
  });

  // -------------------------------------------------------------------------
  // Error resilience — never throws
  // -------------------------------------------------------------------------

  describe('never throws on Prisma errors', () => {
    it('swallows a Prisma write error', async () => {
      mockAuditLogCreate.mockRejectedValue(new Error('DB connection refused'));

      // Must not throw
      await expect(
        logAuditEvent({ event: 'user.login', userId: 'u1' })
      ).resolves.toBeUndefined();
    });

    it('returns undefined (void) on success', async () => {
      const result = await logAuditEvent({ event: 'user.login', userId: 'u1' });
      expect(result).toBeUndefined();
    });

    it('returns undefined (void) even when DB fails', async () => {
      mockAuditLogCreate.mockRejectedValue(new Error('timeout'));

      const result = await logAuditEvent({ event: 'user.logout' });
      expect(result).toBeUndefined();
    });

    it('does not propagate a Prisma unique constraint error', async () => {
      mockAuditLogCreate.mockRejectedValue(
        Object.assign(new Error('Unique constraint violation'), {
          code: 'P2002',
        })
      );

      await expect(
        logAuditEvent({ event: 'account.data_exported', userId: 'u2' })
      ).resolves.not.toThrow();
    });
  });

  // -------------------------------------------------------------------------
  // TypeScript type safety — all 12 AuditEvent literals are valid
  // -------------------------------------------------------------------------

  describe('all 12 AuditEvent literals are accepted (type safety)', () => {
    const ALL_EVENTS: AuditEvent[] = [
      'user.login',
      'user.login_failed',
      'user.logout',
      'user.password_change',
      'billing.subscription_created',
      'billing.subscription_cancelled',
      'billing.subscription_upgraded',
      'account.deletion_requested',
      'account.data_exported',
      'admin.user_suspended',
      'api.rate_limit_exceeded',
      'security.cron_unauthorised',
    ];

    it('has exactly 12 events defined', () => {
      expect(ALL_EVENTS).toHaveLength(12);
    });

    it.each(ALL_EVENTS)(
      '"%s" is callable without TypeScript errors',
      async event => {
        const entry: AuditLogEntry = { event };
        await expect(logAuditEvent(entry)).resolves.not.toThrow();
      }
    );
  });
});
