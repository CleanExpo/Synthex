/**
 * Workspace Umbrella API Tests — SYN-847 (security: parent metadata disclosure)
 *
 * GET /api/workspaces/[parentSlug]
 *
 * Verifies the parent-metadata disclosure gate:
 *   - 401 unauthenticated
 *   - 403 not a member of the parent OR any child
 *   - 200 child-only member: receives children but NOT the parent's full
 *         profile (description/website/logo/status/domain/id are withheld)
 *   - 200 parent member (master admin): receives the full parent profile
 *
 * Follows the repo 401 → 403 → 400 → 200 ordering. Prisma + APISecurityChecker
 * are mocked per the existing route-test convention (see tests/unit/api/teams.test.ts).
 */

const mockPrisma = {
  organization: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
  },
};

const mockSecurityChecker = {
  check: jest.fn(),
  createSecureResponse: jest.fn((body: unknown, status: number) => {
    return new Response(JSON.stringify(body), { status });
  }),
};

const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
};

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  prisma: mockPrisma,
  default: mockPrisma,
}));

jest.mock('@/lib/security/api-security-checker', () => ({
  APISecurityChecker: mockSecurityChecker,
  DEFAULT_POLICIES: {
    AUTHENTICATED_READ: {},
    AUTHENTICATED_WRITE: {},
  },
}));

jest.mock('@/lib/logger', () => ({
  logger: mockLogger,
}));

import type { NextRequest } from 'next/server';
import { GET } from '@/app/api/workspaces/[parentSlug]/route';

const PARENT_SLUG = 'unite-group';
const PARENT_ID = 'org-parent-1';

const FULL_PARENT = {
  id: PARENT_ID,
  slug: PARENT_SLUG,
  name: 'Unite Group',
  description: 'Umbrella for the Nexus portfolio',
  website: 'https://unite-group.example',
  logo: 'https://unite-group.example/logo.png',
  status: 'active',
  domain: 'unite-group.synthex.social',
  settings: {},
};

const CHILD = {
  id: 'org-child-1',
  slug: 'restoreassist',
  name: 'RestoreAssist',
  description: 'Restoration ops',
  website: 'https://restoreassist.example',
  logo: null,
  industry: 'restoration',
  status: 'active',
  domain: 'restoreassist.synthex.social',
  settings: {},
  _count: { campaigns: 3, platformConnections: 2, users: 5 },
};

function makeRequest(): NextRequest {
  // The route delegates all request inspection to APISecurityChecker.check
  // (mocked here) and never reads request properties directly, so a minimal
  // stub is sufficient and avoids the jsdom Request/NextRequest polyfill clash.
  return {
    url: 'https://synthex.social/api/workspaces/unite-group',
  } as unknown as NextRequest;
}

function makeParams(slug = PARENT_SLUG) {
  return { params: Promise.resolve({ parentSlug: slug }) };
}

/** Build the parent.findUnique payload with the given member user IDs. */
function parentWithMembers(memberIds: string[]) {
  return {
    ...FULL_PARENT,
    users: memberIds.map(id => ({ id })),
  };
}

describe('GET /api/workspaces/[parentSlug] — parent metadata disclosure', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSecurityChecker.check.mockResolvedValue({
      allowed: true,
      context: { userId: 'user-1' },
    });
    // resetMocks in jest.worktree.cjs wipes implementations between tests,
    // so re-establish createSecureResponse each run.
    mockSecurityChecker.createSecureResponse.mockImplementation(
      (body: unknown, status: number) =>
        new Response(JSON.stringify(body), { status })
    );
  });

  // ── 401 ────────────────────────────────────────────────────────────────────
  it('returns 401 when unauthenticated', async () => {
    mockSecurityChecker.check.mockResolvedValue({
      allowed: false,
      error: 'Authentication required',
      context: {},
    });

    const res = await GET(makeRequest(), makeParams());
    expect(res.status).toBe(401);
  });

  // ── 403 ────────────────────────────────────────────────────────────────────
  it('returns 403 when the user is a member of neither the parent nor any child', async () => {
    // Caller (user-1) is NOT in parent.users …
    mockPrisma.organization.findUnique.mockResolvedValue(
      parentWithMembers(['someone-else'])
    );
    // … and is a member of zero children.
    mockPrisma.organization.findMany.mockResolvedValue([]);

    const res = await GET(makeRequest(), makeParams());
    expect(res.status).toBe(403);
  });

  // ── 404 (not found) ──────────────────────────────────────────────────────
  it('returns 404 when the parent slug does not exist', async () => {
    mockPrisma.organization.findUnique.mockResolvedValue(null);

    const res = await GET(makeRequest(), makeParams('does-not-exist'));
    expect(res.status).toBe(404);
  });

  // ── 200 child-only member: NO parent metadata leak ──────────────────────────
  it('does NOT leak parent metadata to a child-only member', async () => {
    // Caller is NOT in parent.users (not a parent member) …
    mockPrisma.organization.findUnique.mockResolvedValue(
      parentWithMembers(['someone-else'])
    );
    // … but IS a member of one child.
    mockPrisma.organization.findMany.mockResolvedValue([CHILD]);

    const res = await GET(makeRequest(), makeParams());
    expect(res.status).toBe(200);

    const body = await res.json();

    // Workspace still renders: name + slug are present, master-admin flag false.
    expect(body.parent.name).toBe('Unite Group');
    expect(body.parent.slug).toBe(PARENT_SLUG);
    expect(body.parent.isMasterAdmin).toBe(false);

    // The sensitive parent profile fields must be withheld.
    expect(body.parent.id).toBeUndefined();
    expect(body.parent.description).toBeUndefined();
    expect(body.parent.website).toBeUndefined();
    expect(body.parent.logo).toBeUndefined();
    expect(body.parent.status).toBeUndefined();
    expect(body.parent.domain).toBeUndefined();

    // The child the user belongs to is still returned.
    expect(body.children).toHaveLength(1);
    expect(body.children[0].slug).toBe('restoreassist');
  });

  // ── 200 parent member (master admin): full metadata ─────────────────────────
  it('returns the full parent profile to an actual parent member (master admin)', async () => {
    // Caller IS in parent.users → master admin.
    mockPrisma.organization.findUnique.mockResolvedValue(
      parentWithMembers(['user-1'])
    );
    mockPrisma.organization.findMany.mockResolvedValue([CHILD]);

    const res = await GET(makeRequest(), makeParams());
    expect(res.status).toBe(200);

    const body = await res.json();

    expect(body.parent.isMasterAdmin).toBe(true);
    expect(body.parent.id).toBe(PARENT_ID);
    expect(body.parent.description).toBe(FULL_PARENT.description);
    expect(body.parent.website).toBe(FULL_PARENT.website);
    expect(body.parent.logo).toBe(FULL_PARENT.logo);
    expect(body.parent.status).toBe(FULL_PARENT.status);
    expect(body.parent.domain).toBe(FULL_PARENT.domain);
  });
});
