/**
 * Track A — consumption boundary (handoff-20260711-074357).
 *
 * lib/auth/signInFlow.ts handleOAuthLogin is the shared OAuth first-login
 * path (Google + GitHub). Invite-only mode is opt-in (`NEXT_PUBLIC_INVITE_ONLY_MODE=true`).
 * must NOT create an account for an uninvited email; existing linked
 * accounts keep logging in.
 */
jest.mock('@/lib/auth/account-service', () => ({
  accountService: {
    findUserByProviderAccount: jest.fn(async () => null),
    findUserByEmail: jest.fn(async () => null),
    createAccount: jest.fn(async () => undefined),
  },
}));

jest.mock('@/lib/auth/jwt-utils', () => ({
  isOwnerEmail: jest.fn(() => false),
}));

jest.mock('@/lib/auth/monitoring', () => ({
  authMonitor: { trackEvent: jest.fn() },
}));

const mockUserCreate = jest.fn();
const mockTeamFindFirst = jest.fn();
const mockCodeFindFirst = jest.fn();

const prismaMock = {
  user: {
    create: (...a: unknown[]) => mockUserCreate(...a),
    findUnique: jest.fn(async () => null),
    update: jest.fn(async () => ({})),
  },
  teamInvitation: { findFirst: (...a: unknown[]) => mockTeamFindFirst(...a) },
  inviteCode: { findFirst: (...a: unknown[]) => mockCodeFindFirst(...a) },
};

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  prisma: prismaMock,
  default: prismaMock,
}));

import { signInFlow } from '@/lib/auth/signInFlow';

const PROFILE = {
  id: 'gh-123',
  email: 'new@example.com',
  name: 'New User',
  emailVerified: true,
};

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV };
  delete process.env.NEXT_PUBLIC_INVITE_ONLY_MODE;
  // getSupabaseAdmin must resolve null so the profiles upsert is skipped
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  jest.clearAllMocks();
  mockTeamFindFirst.mockResolvedValue(null);
  mockCodeFindFirst.mockResolvedValue(null);
  mockUserCreate.mockResolvedValue({
    id: 'user-new',
    email: PROFILE.email,
    name: PROFILE.name,
    avatar: null,
    emailVerified: true,
  });
});

afterAll(() => {
  process.env = ORIGINAL_ENV;
});

describe('signInFlow.handleOAuthLogin — invite gate on OAuth first login', () => {
  it('creates an account for an uninvited email when invite-only is unset', async () => {
    const result = await signInFlow.handleOAuthLogin('github', PROFILE);

    expect(mockUserCreate).toHaveBeenCalled();
    expect(result.success).toBe(true);
  });

  it('refuses to create an account for an uninvited email when invite-only is on', async () => {
    process.env.NEXT_PUBLIC_INVITE_ONLY_MODE = 'true';
    const result = await signInFlow.handleOAuthLogin('github', PROFILE);

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/invite-only/i);
    expect(mockUserCreate).not.toHaveBeenCalled();
  });

  it('creates the account when the email has invite evidence', async () => {
    mockTeamFindFirst.mockResolvedValue({ id: 'ti-1' });

    const result = await signInFlow.handleOAuthLogin('github', PROFILE);

    expect(mockUserCreate).toHaveBeenCalled();
    expect(result.success).toBe(true);
  });

  it('creates the account without evidence when the market is explicitly open', async () => {
    process.env.NEXT_PUBLIC_INVITE_ONLY_MODE = 'false';

    const result = await signInFlow.handleOAuthLogin('github', PROFILE);

    expect(mockUserCreate).toHaveBeenCalled();
    expect(result.success).toBe(true);
  });
});
