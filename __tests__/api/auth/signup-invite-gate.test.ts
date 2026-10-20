/**
 * POST /api/auth/signup — invite-only gate (server-side, fail closed).
 *
 * SYN-1070 (f34c98c25) made invite codes optional on this route, so with
 * NEXT_PUBLIC_INVITE_ONLY_MODE=true anyone could still create an account by
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
    },
    teamInvitation: {
      findFirst: (...a: unknown[]) => mockTeamInviteFindFirst(...a),
    },
    auditLog: { create: (...a: unknown[]) => mockAuditCreate(...a) },
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

  it('creates the account for a recent team invitee without a code', async () => {
    mockTeamInviteFindFirst.mockResolvedValue({ id: 'team-invite-1' });

    const res = await signup(baseBody);

    expect(res.status).toBe(200);
    expect(mockUserCreate).toHaveBeenCalledTimes(1);
    expect(mockTeamInviteFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          email: { equals: baseBody.email, mode: 'insensitive' },
        }),
      })
    );
  });
});

describe('POST /api/auth/signup — invite-only mode off', () => {
  it('creates the account without a code when the flag is not "true"', async () => {
    process.env.NEXT_PUBLIC_INVITE_ONLY_MODE = 'false';

    const res = await signup(baseBody);

    expect(res.status).toBe(200);
    expect(mockUserCreate).toHaveBeenCalledTimes(1);
  });
});
