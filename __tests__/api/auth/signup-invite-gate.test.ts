/**
 * POST /api/auth/signup — invite-only gate (server-side, fail closed).
 *
 * The gate is ON unless NEXT_PUBLIC_INVITE_ONLY_MODE is the literal 'false'
 * (an unset flag keeps it on). SYN-1070 (f34c98c25) made invite codes
 * optional on this route, so with the gate on anyone could still create an account by
 * omitting the code. Synthex logins are for named operators only, so the
 * route must refuse account creation without invite evidence: a valid invite
 * code, or a recent team invitation addressed to the email.
 *
 * The route runs for real; only prisma, bcrypt, rate limiting, email and the
 * token signer are mocked.
 */
import { createMockNextRequest } from '@/tests/helpers/mock-request';

jest.mock('@/lib/logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('@/lib/middleware/api-rate-limit', () => ({
  authStrict: (_req: unknown, fn: () => Promise<unknown>) => fn(),
}));

jest.mock('bcryptjs', () => ({
  __esModule: true,
  default: { hash: async () => 'hashed-password' },
}));

jest.mock('@/lib/auth/jwt-utils', () => ({
  generateToken: () => 'test-token',
}));

jest.mock('@/lib/email/index', () => ({
  email: { sendWelcomeEmail: async () => undefined },
}));

const mockUserFindFirst = jest.fn();
const mockUserCreate = jest.fn();
const mockInviteFindUnique = jest.fn();
const mockInviteUpdate = jest.fn();
const mockInviteUpdateMany = jest.fn();
const mockTeamInviteFindFirst = jest.fn();
const mockAuditCreate = jest.fn();

jest.mock('@/lib/prisma', () => {
  const instance = {
    user: {
      findFirst: (...a: unknown[]) => mockUserFindFirst(...a),
      create: (...a: unknown[]) => mockUserCreate(...a),
    },
    inviteCode: {
      findUnique: (...a: unknown[]) => mockInviteFindUnique(...a),
      update: (...a: unknown[]) => mockInviteUpdate(...a),
      updateMany: (...a: unknown[]) => mockInviteUpdateMany(...a),
    },
    teamInvitation: {
      findFirst: (...a: unknown[]) => mockTeamInviteFindFirst(...a),
    },
    auditLog: { create: (...a: unknown[]) => mockAuditCreate(...a) },
    $transaction: (fn: (tx: unknown) => Promise<unknown>) => fn(instance),
  };
  return { __esModule: true, prisma: instance, default: instance };
});

import { POST } from '@/app/api/auth/signup/route';

const baseBody = {
  name: 'New Person',
  email: 'new.person@example.com',
  password: 'ValidPass123',
};

function signup(body: Record<string, unknown>) {
  return POST(
    createMockNextRequest({ method: 'POST', body }) as unknown as Parameters<
      typeof POST
    >[0]
  );
}

const ORIGINAL_FLAG = process.env.NEXT_PUBLIC_INVITE_ONLY_MODE;

beforeEach(() => {
  mockUserFindFirst.mockReset().mockResolvedValue(null);
  mockUserCreate.mockReset().mockImplementation(async ({ data }) => ({
    id: 'user-new',
    email: data.email,
    name: data.name,
  }));
  mockInviteFindUnique.mockReset().mockResolvedValue(null);
  mockInviteUpdate.mockReset().mockResolvedValue({});
  mockInviteUpdateMany.mockReset().mockResolvedValue({ count: 1 });
  mockTeamInviteFindFirst.mockReset().mockResolvedValue(null);
  mockAuditCreate.mockReset().mockResolvedValue({});
});

afterAll(() => {
  if (ORIGINAL_FLAG === undefined) {
    delete process.env.NEXT_PUBLIC_INVITE_ONLY_MODE;
  } else {
    process.env.NEXT_PUBLIC_INVITE_ONLY_MODE = ORIGINAL_FLAG;
  }
});

describe('POST /api/auth/signup — invite-only mode on', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_INVITE_ONLY_MODE = 'true';
  });

  it('refuses account creation when no invite code and no team invitation exist', async () => {
    const res = await signup(baseBody);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/invite/i);
    expect(mockUserCreate).not.toHaveBeenCalled();
  });

  it('refuses an unknown invite code', async () => {
    const res = await signup({ ...baseBody, inviteCode: 'SX-NOPE99' });

    expect(res.status).toBe(400);
    expect(mockUserCreate).not.toHaveBeenCalled();
  });

  it('creates the account when a valid invite code is supplied', async () => {
    mockInviteFindUnique.mockResolvedValue({
      id: 'code-1',
      code: 'SX-ABCDEF',
      isActive: true,
      expiresAt: null,
      useCount: 0,
      maxUses: 1,
      email: null,
    });

    const res = await signup({ ...baseBody, inviteCode: 'SX-ABCDEF' });

    expect(res.status).toBe(200);
    expect(mockUserCreate).toHaveBeenCalledTimes(1);
    expect(mockInviteUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'code-1' } })
    );
  });

  // Both requests read useCount 0 before either writes. The database row is
  // modelled by `row`: a conditional claim only matches while its where clause
  // still holds against the CURRENT row (useCount below maxUses, as Postgres
  // would evaluate it), whatever the request read earlier.
  function fakeInviteRow(maxUses: number) {
    const row = { id: 'code-1', useCount: 0 };
    mockInviteFindUnique.mockResolvedValue({
      id: 'code-1',
      code: 'SX-ABCDEF',
      isActive: true,
      expiresAt: null,
      useCount: 0,
      maxUses,
      email: null,
    });
    mockInviteUpdateMany.mockImplementation(
      async ({
        where,
      }: {
        where: { id: string; useCount?: number | { lt: number } };
      }) => {
        if (where.id !== row.id) return { count: 0 };
        const u = where.useCount;
        if (typeof u === 'number' && u !== row.useCount) return { count: 0 };
        if (u && typeof u === 'object' && !(row.useCount < u.lt)) {
          return { count: 0 };
        }
        row.useCount += 1;
        return { count: 1 };
      }
    );
    return row;
  }

  it('lets both of two racing signups consume a multi-use code that has uses left', async () => {
    const row = fakeInviteRow(5);

    const [a, b] = await Promise.all([
      signup({
        ...baseBody,
        email: 'first@example.com',
        inviteCode: 'SX-ABCDEF',
      }),
      signup({
        ...baseBody,
        email: 'second@example.com',
        inviteCode: 'SX-ABCDEF',
      }),
    ]);

    expect([a.status, b.status]).toEqual([200, 200]);
    expect(mockUserCreate).toHaveBeenCalledTimes(2);
    expect(row.useCount).toBe(2);
  });

  it('lets only one of two racing signups consume a single-use code', async () => {
    const row = fakeInviteRow(1);

    const [a, b] = await Promise.all([
      signup({
        ...baseBody,
        email: 'first@example.com',
        inviteCode: 'SX-ABCDEF',
      }),
      signup({
        ...baseBody,
        email: 'second@example.com',
        inviteCode: 'SX-ABCDEF',
      }),
    ]);

    expect([a.status, b.status].sort()).toEqual([200, 400]);
    expect(mockUserCreate).toHaveBeenCalledTimes(1);
    expect(row.useCount).toBe(1);
  });

  it('does not report success when consuming the code fails', async () => {
    mockInviteFindUnique.mockResolvedValue({
      id: 'code-1',
      code: 'SX-ABCDEF',
      isActive: true,
      expiresAt: null,
      useCount: 0,
      maxUses: 1,
      email: null,
    });
    mockInviteUpdateMany.mockRejectedValue(new Error('db unavailable'));

    const res = await signup({ ...baseBody, inviteCode: 'SX-ABCDEF' });

    expect(res.status).toBe(500);
    expect(mockUserCreate).not.toHaveBeenCalled();
  });

  // A TeamInvitation carries no secret, so knowing an invitee's email must not
  // be enough to claim their account with a caller-chosen password.
  it('refuses a pending team invitee without a code (email alone is not proof)', async () => {
    mockTeamInviteFindFirst.mockResolvedValue({ id: 'team-invite-1' });

    const res = await signup(baseBody);

    expect(res.status).toBe(400);
    expect(mockUserCreate).not.toHaveBeenCalled();
  });
});

describe('POST /api/auth/signup — flag unset (default)', () => {
  // SEAM: the POST handler with NEXT_PUBLIC_INVITE_ONLY_MODE absent. Catches a
  // default that lets a codeless signup through when the env var is missing
  // from a deployment. Misses: the value Next.js inlines at build time.
  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_INVITE_ONLY_MODE;
  });

  it('refuses account creation without an invite code', async () => {
    const res = await signup(baseBody);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/invite code is required/i);
    expect(mockUserCreate).not.toHaveBeenCalled();
  });
});

describe('POST /api/auth/signup — invite-only mode off', () => {
  it('creates the account without a code only when the flag is literal "false"', async () => {
    process.env.NEXT_PUBLIC_INVITE_ONLY_MODE = 'false';

    const res = await signup(baseBody);

    expect(res.status).toBe(200);
    expect(mockUserCreate).toHaveBeenCalledTimes(1);
  });
});
