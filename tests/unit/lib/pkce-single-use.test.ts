/**
 * PKCE Single-Use State — Atomic Consume / Fail-Closed Tests
 *
 * Security regression coverage for the auth-replay bug where the database
 * fallback consumed the single-use PKCE state with
 *   prisma.oAuthPKCEState.delete(...).catch(() => {})
 * If that delete failed silently, the state row survived and could be replayed.
 *
 * The fix consumes the state with an atomic, result-checked deleteMany:
 *   - valid unused state            → consumed once, returned (success)
 *   - replay (same state again)     → 0 rows consumed → rejected (null)
 *   - delete affects 0 rows         → rejected (null), no silent pass
 *   - delete throws (cannot consume)→ fail closed, rejected (null), NOT degraded
 *
 * These tests drive the DATABASE path by mocking `@/lib/prisma` (the function
 * under test imports it dynamically) and disabling Redis/in-memory so the
 * database branch is exercised deterministically.
 */

// Mock the Prisma client module so we never touch a real database / Pool.
const mockFindUnique = jest.fn();
const mockDeleteMany = jest.fn();

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    oAuthPKCEState: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      deleteMany: (...args: unknown[]) => mockDeleteMany(...args),
      // create / delete kept as no-op spies for completeness
      create: jest.fn(),
      delete: jest.fn(),
    },
  },
}));

import { retrievePKCEState, getCodeVerifier } from '@/lib/auth/pkce';

const STATE = 'a'.repeat(64);
const VERIFIER = 'b'.repeat(64);

function dbRecord(overrides: Partial<Record<string, unknown>> = {}) {
  const now = Date.now();
  return {
    state: STATE,
    codeVerifier: VERIFIER,
    provider: 'google',
    redirectUri: 'http://localhost:3000/callback',
    linkToUserId: null,
    createdAt: new Date(now),
    expiresAt: new Date(now + 10 * 60 * 1000),
    ...overrides,
  };
}

beforeEach(() => {
  mockFindUnique.mockReset();
  mockDeleteMany.mockReset();
  // Ensure Redis is treated as unavailable so the DB branch runs.
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
});

describe('PKCE database-backed single-use consumption', () => {
  it('valid unused state → consumed exactly once and returned (happy path)', async () => {
    mockFindUnique.mockResolvedValue(dbRecord());
    mockDeleteMany.mockResolvedValue({ count: 1 });

    const result = await retrievePKCEState(STATE);

    expect(result).not.toBeNull();
    expect(result?.state).toBe(STATE);
    expect(result?.codeVerifier).toBe(VERIFIER);
    // Consumption was attempted exactly once, scoped to the unique state.
    expect(mockDeleteMany).toHaveBeenCalledTimes(1);
    expect(mockDeleteMany).toHaveBeenCalledWith({ where: { state: STATE } });
  });

  it('REPLAY: a state already consumed (deleteMany count 0) → rejected, no silent pass', async () => {
    // Record still readable (read happened before the winning delete committed),
    // but the atomic consume removes 0 rows because another request already took it.
    mockFindUnique.mockResolvedValue(dbRecord());
    mockDeleteMany.mockResolvedValue({ count: 0 });

    const result = await retrievePKCEState(STATE);

    expect(result).toBeNull();
  });

  it('consume whose delete affects 0 rows → rejected (count check is the guard)', async () => {
    mockFindUnique.mockResolvedValue(dbRecord());
    mockDeleteMany.mockResolvedValue({ count: 0 });

    const result = await getCodeVerifier(STATE);

    expect(result).toBeNull();
  });

  it('FAIL CLOSED: delete throws → rejected (null), state never returned despite throw', async () => {
    mockFindUnique.mockResolvedValue(dbRecord());
    mockDeleteMany.mockRejectedValue(new Error('connection reset during delete'));

    // The old code swallowed this error and returned the live state (replay window).
    // The fix must reject and must NOT degrade to in-memory.
    const result = await retrievePKCEState(STATE);

    expect(result).toBeNull();
  });

  it('expired state is still burned (consumed) and rejected', async () => {
    mockFindUnique.mockResolvedValue(
      dbRecord({ expiresAt: new Date(Date.now() - 1000) })
    );
    mockDeleteMany.mockResolvedValue({ count: 1 });

    const result = await retrievePKCEState(STATE);

    expect(result).toBeNull();
    // Even when expired, we attempt the atomic delete so it can never be retried.
    expect(mockDeleteMany).toHaveBeenCalledTimes(1);
  });

  it('non-existent state → null without attempting a delete', async () => {
    mockFindUnique.mockResolvedValue(null);

    const result = await retrievePKCEState(STATE);

    expect(result).toBeNull();
    expect(mockDeleteMany).not.toHaveBeenCalled();
  });

  it('simulated end-to-end replay: first call succeeds, second call rejected', async () => {
    // First attempt: row present, delete wins (count 1).
    mockFindUnique.mockResolvedValueOnce(dbRecord());
    mockDeleteMany.mockResolvedValueOnce({ count: 1 });
    const first = await retrievePKCEState(STATE);
    expect(first).not.toBeNull();

    // Second attempt (replay): row already gone, findUnique returns null.
    mockFindUnique.mockResolvedValueOnce(null);
    const second = await retrievePKCEState(STATE);
    expect(second).toBeNull();
  });
});
