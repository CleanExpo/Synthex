/**
 * Unit tests for runLockedRefresh — the cross-invocation OAuth2 refresh lock.
 *
 * The load-bearing property: when two callers race to refresh the SAME
 * connection's single-use rotating refresh token, exactly ONE performs the
 * upstream rotation and the loser RE-READS the freshly persisted token instead
 * of replaying the just-rotated (now-revoked) token. That is what prevents the
 * invalid_grant / "already used" family of failures under load.
 *
 * The advisory lock is emulated here by serialising the transaction bodies
 * (which is exactly what pg_advisory_xact_lock does across invocations) over a
 * shared in-memory row.
 */

const prismaMock = { $transaction: jest.fn() };
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  prisma: prismaMock,
  default: prismaMock,
}));

// Passthrough crypto so the test asserts on plaintext token values.
jest.mock('@/lib/security/field-encryption', () => ({
  __esModule: true,
  encryptField: (v: string | null | undefined) => (v ? v : null),
  decryptFieldSafe: (v: string | null | undefined) => v ?? null,
}));

import {
  runLockedRefresh,
  MAX_CONSECUTIVE_REFRESH_FAILURES,
} from '@/lib/platform-connections/refresh-lock';
import { PlatformError } from '@/lib/social/base-platform-service';

interface Row {
  id: string;
  userId: string;
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date | null;
  metadata: Record<string, unknown> | null;
  profileName: string | null;
  isActive: boolean;
}

/**
 * Build a fake transaction client over a shared row, and wire prismaMock so
 * transaction bodies run one-at-a-time (advisory-lock semantics).
 */
function installSerializedTx(row: Row) {
  const tx = {
    $executeRaw: jest.fn().mockResolvedValue(1),
    platformConnection: {
      findUnique: jest.fn(async () => (row ? { ...row } : null)),
      update: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
        if ('accessToken' in data) row.accessToken = data.accessToken as string;
        if ('refreshToken' in data)
          row.refreshToken = data.refreshToken as string | null;
        if ('expiresAt' in data) row.expiresAt = data.expiresAt as Date | null;
        if ('metadata' in data)
          row.metadata = data.metadata as Record<string, unknown>;
        if ('isActive' in data) row.isActive = data.isActive as boolean;
        return { id: row.id };
      }),
    },
    notification: { create: jest.fn().mockResolvedValue({}) },
  };

  let chain: Promise<unknown> = Promise.resolve();
  prismaMock.$transaction.mockImplementation(
    (cb: (t: typeof tx) => unknown) => {
      const result = chain.then(() => cb(tx));
      chain = result.catch(() => undefined);
      return result;
    }
  );

  return tx;
}

const FUTURE = () => new Date(Date.now() + 2 * 60 * 60 * 1000); // +2h
const PAST = () => new Date(Date.now() - 60 * 1000); // 1 min ago (stale)

describe('runLockedRefresh — concurrency + rotation safety', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rotates once for two concurrent refreshers; the loser re-reads the fresh token', async () => {
    const row: Row = {
      id: 'conn-1',
      userId: 'user-1',
      accessToken: 'A1',
      refreshToken: 'R1',
      expiresAt: PAST(),
      metadata: {},
      profileName: 'acct',
      isActive: true,
    };
    installSerializedTx(row);

    let rotations = 0;
    // Each caller presents the SAME starting refresh token R1 (as two separate
    // invocations would). Only the winner should actually rotate it.
    const doRefresh = jest.fn(async () => {
      rotations += 1;
      // Simulate upstream latency so the race window is real.
      await new Promise(r => setTimeout(r, 5));
      return {
        accessToken: 'A2',
        refreshToken: 'R2',
        expiresAt: FUTURE(),
      };
    });

    const [a, b] = await Promise.all([
      runLockedRefresh({
        connectionId: 'conn-1',
        platform: 'twitter',
        doRefresh,
      }),
      runLockedRefresh({
        connectionId: 'conn-1',
        platform: 'twitter',
        doRefresh,
      }),
    ]);

    // Exactly one upstream rotation happened — the single-use token was not
    // double-spent.
    expect(rotations).toBe(1);
    expect(doRefresh).toHaveBeenCalledTimes(1);

    // BOTH callers end up with the rotated token: the winner from the refresh,
    // the loser from re-reading the persisted row under the lock.
    expect(a.accessToken).toBe('A2');
    expect(b.accessToken).toBe('A2');
    expect(row.refreshToken).toBe('R2');
  });

  it('re-uses the persisted token without refreshing when it is already fresh', async () => {
    const row: Row = {
      id: 'conn-2',
      userId: 'user-2',
      accessToken: 'FRESH',
      refreshToken: 'R1',
      expiresAt: FUTURE(),
      metadata: {},
      profileName: null,
      isActive: true,
    };
    installSerializedTx(row);
    const doRefresh = jest.fn();

    const result = await runLockedRefresh({
      connectionId: 'conn-2',
      platform: 'twitter',
      doRefresh,
    });

    expect(doRefresh).not.toHaveBeenCalled();
    expect(result.accessToken).toBe('FRESH');
  });

  it('does NOT count or disable on a server/config error (rethrows as transient)', async () => {
    const row: Row = {
      id: 'conn-3',
      userId: 'user-3',
      accessToken: 'A1',
      refreshToken: 'R1',
      expiresAt: PAST(),
      metadata: {},
      profileName: null,
      isActive: true,
    };
    const tx = installSerializedTx(row);
    const doRefresh = jest.fn(async () => {
      throw new PlatformError(
        'twitter',
        'X OAuth 2.0 client credentials (TWITTER_CLIENT_ID/SECRET) not configured'
      );
    });

    await expect(
      runLockedRefresh({
        connectionId: 'conn-3',
        platform: 'twitter',
        doRefresh,
      })
    ).rejects.toThrow(/not configured/);

    // Server misconfig must never touch the connection: no counter, no disable.
    expect(tx.platformConnection.update).not.toHaveBeenCalled();
    expect(row.isActive).toBe(true);
    expect(row.metadata?.refreshFailureCount).toBeUndefined();
  });

  it('disables the connection only after N consecutive genuine failures', async () => {
    const row: Row = {
      id: 'conn-4',
      userId: 'user-4',
      accessToken: 'A1',
      refreshToken: 'R1',
      expiresAt: PAST(),
      metadata: {},
      profileName: 'acct',
      isActive: true,
    };
    const tx = installSerializedTx(row);
    const doRefresh = jest.fn(async () => {
      throw new PlatformError(
        'twitter',
        'Value passed for the token was invalid'
      );
    });

    for (let i = 1; i <= MAX_CONSECUTIVE_REFRESH_FAILURES; i++) {
      // keep the token stale between attempts
      row.expiresAt = PAST();
      await expect(
        runLockedRefresh({
          connectionId: 'conn-4',
          platform: 'twitter',
          doRefresh,
        })
      ).rejects.toThrow(PlatformError);

      if (i < MAX_CONSECUTIVE_REFRESH_FAILURES) {
        // Not yet at the threshold — still active, counter climbing.
        expect(row.isActive).toBe(true);
        expect(row.metadata?.refreshFailureCount).toBe(i);
      }
    }

    // Nth consecutive failure disables + flags for reconnect + notifies once.
    expect(row.isActive).toBe(false);
    expect(row.metadata?.authStatus).toBe('requires_reauth');
    expect(tx.notification.create).toHaveBeenCalledTimes(1);
  });

  it('resets the failure counter after a successful refresh', async () => {
    const row: Row = {
      id: 'conn-5',
      userId: 'user-5',
      accessToken: 'A1',
      refreshToken: 'R1',
      expiresAt: PAST(),
      metadata: { refreshFailureCount: 2 },
      profileName: null,
      isActive: true,
    };
    installSerializedTx(row);
    const doRefresh = jest.fn(async () => ({
      accessToken: 'A2',
      refreshToken: 'R2',
      expiresAt: FUTURE(),
    }));

    await runLockedRefresh({
      connectionId: 'conn-5',
      platform: 'twitter',
      doRefresh,
    });

    expect(row.metadata?.refreshFailureCount).toBe(0);
    expect(row.metadata?.lastRefreshError).toBeNull();
  });
});
