/**
 * Track A — consumption boundary (handoff-20260711-074357).
 *
 * The invite-only market gate must FAIL CLOSED: the open-market door is
 * shut unless NEXT_PUBLIC_INVITE_ONLY_MODE is explicitly the literal
 * string 'false'. An unset, empty, or typo'd flag means the gate is ON.
 *
 * Also covers the recency-bounded TeamInvitation bypass (the schema has
 * no expiresAt on team_invitations, so the window is enforced on sentAt)
 * and the invite-evidence check used by org-provisioning routes.
 */

// --- Mocks ---------------------------------------------------------------
const mockTeamFindFirst = jest.fn();
const mockCodeFindFirst = jest.fn();

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  prisma: {
    teamInvitation: { findFirst: (...a: unknown[]) => mockTeamFindFirst(...a) },
    inviteCode: { findFirst: (...a: unknown[]) => mockCodeFindFirst(...a) },
  },
  default: {
    teamInvitation: { findFirst: (...a: unknown[]) => mockTeamFindFirst(...a) },
    inviteCode: { findFirst: (...a: unknown[]) => mockCodeFindFirst(...a) },
  },
}));

import { isInviteOnlyMode } from '@/lib/auth/invite-mode';
import {
  TEAM_INVITE_VALID_DAYS,
  teamInviteCutoff,
  findPendingTeamInvite,
  hasInviteEvidence,
} from '@/lib/auth/invite-gate';

const DAY_MS = 24 * 60 * 60 * 1000;
const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV };
  delete process.env.NEXT_PUBLIC_INVITE_ONLY_MODE;
  mockTeamFindFirst.mockReset().mockResolvedValue(null);
  mockCodeFindFirst.mockReset().mockResolvedValue(null);
});

afterAll(() => {
  process.env = ORIGINAL_ENV;
});

describe('isInviteOnlyMode — fail-closed flag', () => {
  it('is ON when the env var is unset (fail closed)', () => {
    expect(isInviteOnlyMode()).toBe(true);
  });

  it('is ON when explicitly "true"', () => {
    process.env.NEXT_PUBLIC_INVITE_ONLY_MODE = 'true';
    expect(isInviteOnlyMode()).toBe(true);
  });

  it('is OFF only for the literal string "false"', () => {
    process.env.NEXT_PUBLIC_INVITE_ONLY_MODE = 'false';
    expect(isInviteOnlyMode()).toBe(false);
  });

  it.each(['', '0', 'no', 'FALSE', 'False', ' false'])(
    'is ON for any non-literal value (%j)',
    value => {
      process.env.NEXT_PUBLIC_INVITE_ONLY_MODE = value;
      expect(isInviteOnlyMode()).toBe(true);
    }
  );
});

describe('teamInviteCutoff', () => {
  it('is exactly TEAM_INVITE_VALID_DAYS before the given time', () => {
    const now = new Date('2026-07-11T00:00:00.000Z');
    expect(teamInviteCutoff(now).getTime()).toBe(
      now.getTime() - TEAM_INVITE_VALID_DAYS * DAY_MS
    );
  });
});

describe('findPendingTeamInvite — recency-bounded signup bypass', () => {
  it('queries only sent/pending invitations inside the recency window', async () => {
    mockTeamFindFirst.mockResolvedValue({ id: 'ti-1' });
    const before = Date.now();

    const result = await findPendingTeamInvite('Person@Example.com');

    expect(result).toEqual({ id: 'ti-1' });
    const where = mockTeamFindFirst.mock.calls[0][0].where;
    expect(where.email).toEqual({
      equals: 'Person@Example.com',
      mode: 'insensitive',
    });
    expect(where.status).toEqual({ in: ['sent', 'pending'] });
    expect(where.sentAt.gte).toBeInstanceOf(Date);
    const expectedCutoff = before - TEAM_INVITE_VALID_DAYS * DAY_MS;
    expect(
      Math.abs((where.sentAt.gte as Date).getTime() - expectedCutoff)
    ).toBeLessThan(5_000);
  });

  it('returns null when nothing matches', async () => {
    await expect(
      findPendingTeamInvite('nobody@example.com')
    ).resolves.toBeNull();
  });
});

describe('hasInviteEvidence — org-provisioning evidence', () => {
  it('accepts a recent team invitation without consulting invite codes', async () => {
    mockTeamFindFirst.mockResolvedValue({ id: 'ti-1' });

    await expect(hasInviteEvidence('p@example.com', 'user-1')).resolves.toBe(
      true
    );
    expect(mockCodeFindFirst).not.toHaveBeenCalled();

    const where = mockTeamFindFirst.mock.calls[0][0].where;
    expect(where.status).toEqual({ in: ['sent', 'pending', 'accepted'] });
    expect(where.sentAt.gte).toBeInstanceOf(Date);
  });

  it('accepts an invite code redeemed by this user', async () => {
    mockCodeFindFirst.mockResolvedValue({ id: 'ic-1' });

    await expect(hasInviteEvidence('p@example.com', 'user-1')).resolves.toBe(
      true
    );

    const where = mockCodeFindFirst.mock.calls[0][0].where;
    expect(where.OR).toEqual(expect.arrayContaining([{ usedBy: 'user-1' }]));
  });

  it('accepts an active invite code locked to this email', async () => {
    mockCodeFindFirst.mockResolvedValue({ id: 'ic-2' });

    await expect(hasInviteEvidence('Locked@Example.com')).resolves.toBe(true);

    const where = mockCodeFindFirst.mock.calls[0][0].where;
    expect(where.OR).toEqual(
      expect.arrayContaining([
        {
          email: { equals: 'Locked@Example.com', mode: 'insensitive' },
          isActive: true,
        },
      ])
    );
  });

  it('omits the usedBy clause when no userId is known (OAuth pre-create)', async () => {
    await hasInviteEvidence('p@example.com');

    const where = mockCodeFindFirst.mock.calls[0][0].where;
    expect(where.OR).toHaveLength(1);
    expect(where.OR[0]).not.toHaveProperty('usedBy');
  });

  it('is false with no invitation and no code', async () => {
    await expect(hasInviteEvidence('p@example.com', 'user-1')).resolves.toBe(
      false
    );
  });
});
