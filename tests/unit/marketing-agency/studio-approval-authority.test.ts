/**
 * Who may approve a Client Content Studio draft (SYN-1412, spec section 9.4).
 *
 * The rule under test is `resolveStudioApprovalAuthority`. Nothing above the
 * database client is stood in for: the real access rule and the real ranking
 * run over a row store (tests/helpers/prisma-row-store.ts). Each case lists the
 * rows that exist, and every case carries decoys the right query must leave
 * out: another user who is owner and admin of the Studio organisation, the
 * caller's own owner row, active ownership and Admin role in ANOTHER
 * organisation, and the caller's expired Admin role in the Studio organisation.
 *
 * Every case asserts the whole decision by equality before anything else, so a
 * rule that answers the same for everyone fails each case whose outcome it does
 * not happen to give. Every refused case names the allowed case it is one field
 * away from.
 *
 * The six self-tests of the row store come first: the cases below are only as
 * good as the store's own strictness.
 */

import {
  createPrismaRowStore,
  type PrismaRowStore,
} from '@/tests/helpers/prisma-row-store';

const mockStore = createPrismaRowStore();

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  get default() {
    return mockStore.client;
  },
  get prisma() {
    return mockStore.client;
  },
}));

const mockLog = {
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
};
jest.mock('@/lib/logger', () => ({
  logger: {
    error: (...args: unknown[]) => mockLog.error(...args),
    warn: (...args: unknown[]) => mockLog.warn(...args),
    info: (...args: unknown[]) => mockLog.info(...args),
    debug: (...args: unknown[]) => mockLog.debug(...args),
  },
}));

const mockTrackError = jest.fn();
jest.mock('@/lib/observability/error-tracker', () => ({
  trackError: (...args: unknown[]) => mockTrackError(...args),
}));

import { resolveStudioApprovalAuthority } from '@/lib/marketing-agency/studio/approval-authority';

// The clock is fixed, so expiry is decided by the code under test against a
// known instant. PAST and FUTURE sit one millisecond either side of it.
const NOW = new Date('2026-11-11T00:00:00.000Z');
const PAST = new Date(NOW.getTime() - 1);
const FUTURE = new Date(NOW.getTime() + 1);
const EXACTLY_NOW = new Date(NOW.getTime());

const USER = 'user-1';
const STUDIO = 'org-ra';

// The four decisions, whole.
const allowedAs = (role: 'owner' | 'admin' | 'editor') => ({
  allowed: true,
  role,
});
const NOT_MEMBER = {
  allowed: false,
  reason: 'not_member',
  code: 'STUDIO_APPROVE_NOT_ORG_MEMBER',
};
const INSUFFICIENT_ROLE = {
  allowed: false,
  reason: 'insufficient_role',
  code: 'STUDIO_APPROVE_ROLE_REQUIRED',
};
const UNAVAILABLE = {
  allowed: false,
  reason: 'unavailable',
  code: 'STUDIO_APPROVE_CHECK_UNAVAILABLE',
};

/** The records the caller (user-1) holds about the Studio organisation. */
interface Caller {
  /** User.organizationId: the organisation the caller belongs to directly. */
  home: string;
  /** User.isMultiBusinessOwner: an active ownership then counts as membership. */
  multiBusinessOwner: boolean;
  /** BusinessOwnership.isActive on the Studio organisation; null for no row. */
  ownership: boolean | null;
  /** TeamMember.role on the Studio organisation; null for no row. */
  teamRole: string | null;
  /** Whether that TeamMember row has an acceptedAt. */
  accepted: boolean;
  /** UserRole grants, by role id. */
  grants: Array<{ roleId: string; expiresAt: Date | null }>;
}

// ---- The allowed callers. Every refused caller below is one of these with
// ---- exactly one field changed, and says which.

/** D4: a direct member whose team row is editor, with no role grant at all. */
const EDITOR: Caller = {
  home: STUDIO,
  multiBusinessOwner: false,
  ownership: null,
  teamRole: 'editor',
  accepted: true,
  grants: [],
};
/** D4: a seeded owner row, which has no acceptedAt. */
const UNACCEPTED_OWNER_ROW: Caller = {
  ...EDITOR,
  teamRole: 'owner',
  accepted: false,
};
/** D3: a direct member with no team row, holding only the Viewer role. */
const NO_TEAM_ROW: Caller = {
  ...EDITOR,
  teamRole: null,
  grants: [{ roleId: 'role-viewer', expiresAt: null }],
};
/** D2: a direct member with a viewer row and an active ownership. */
const OWNER_WITH_VIEWER_ROW: Caller = {
  ...EDITOR,
  teamRole: 'viewer',
  ownership: true,
};
/**
 * D2: a multi-business owner whose own organisation is another brand. The
 * active ownership is both the membership and the rank; the viewer row is there
 * so that "no team row" cannot be what ranks them.
 */
const BUSINESS_OWNER: Caller = {
  home: 'org-other',
  multiBusinessOwner: true,
  ownership: true,
  teamRole: 'viewer',
  accepted: true,
  grants: [],
};
/** D5: a viewer row lifted by an Editor role that never expires. */
const VIEWER_WITH_EDITOR_ROLE: Caller = {
  ...EDITOR,
  teamRole: 'viewer',
  grants: [{ roleId: 'role-editor', expiresAt: null }],
};
/** D5: the same, expiring one millisecond from now. */
const VIEWER_WITH_EDITOR_ROLE_UNTIL_LATER: Caller = {
  ...VIEWER_WITH_EDITOR_ROLE,
  grants: [{ roleId: 'role-editor', expiresAt: FUTURE }],
};
/** D5: a viewer row lifted by a custom role that carries an admin permission. */
const VIEWER_WITH_CUSTOM_ADMIN_ROLE: Caller = {
  ...EDITOR,
  teamRole: 'viewer',
  grants: [{ roleId: 'role-brand-lead', expiresAt: null }],
};

// ---- The refused callers.

/** D6. One field from EDITOR: the team row's role. */
const VIEWER: Caller = { ...EDITOR, teamRole: 'viewer' };
/** D1. One field from EDITOR: the organisation they belong to directly. */
const PARENT_ONLY: Caller = { ...EDITOR, home: 'org-parent' };

/**
 * Seed the organisations, the caller's records, and the decoys every case
 * carries. None of the decoys may count for the caller.
 */
function seedStudio(caller: Caller): void {
  mockStore.seed({
    organization: [
      {
        id: 'org-parent',
        name: 'Unite Group',
        slug: 'unite',
        parentOrgId: null,
      },
      {
        id: STUDIO,
        name: 'RestoreAssist',
        slug: 'restoreassist',
        parentOrgId: 'org-parent',
      },
      {
        id: 'org-other',
        name: 'Another Brand',
        slug: 'another-brand',
        parentOrgId: 'org-parent',
      },
    ],
    user: [
      {
        id: USER,
        organizationId: caller.home,
        isMultiBusinessOwner: caller.multiBusinessOwner,
      },
      // Decoy: another user, a member and multi-business owner of the Studio
      // organisation.
      { id: 'user-2', organizationId: STUDIO, isMultiBusinessOwner: true },
    ],
    businessOwnership: [
      // Decoys: another user's active ownership of the Studio organisation,
      // and the caller's active ownership of another organisation.
      { ownerId: 'user-2', organizationId: STUDIO, isActive: true },
      { ownerId: USER, organizationId: 'org-other', isActive: true },
      ...(caller.ownership === null
        ? []
        : [
            {
              ownerId: USER,
              organizationId: STUDIO,
              isActive: caller.ownership,
            },
          ]),
    ],
    teamMember: [
      // Decoys: another user's owner row here, and the caller's owner row in
      // another organisation.
      {
        userId: 'user-2',
        organizationId: STUDIO,
        role: 'owner',
        acceptedAt: PAST,
      },
      {
        userId: USER,
        organizationId: 'org-other',
        role: 'owner',
        acceptedAt: PAST,
      },
      ...(caller.teamRole === null
        ? []
        : [
            {
              userId: USER,
              organizationId: STUDIO,
              role: caller.teamRole,
              acceptedAt: caller.accepted ? PAST : null,
            },
          ]),
    ],
    role: [
      {
        id: 'role-admin',
        name: 'Admin',
        permissions: ['*'],
        organizationId: STUDIO,
      },
      {
        id: 'role-editor',
        name: 'Editor',
        permissions: ['content:write'],
        organizationId: STUDIO,
      },
      {
        id: 'role-viewer',
        name: 'Viewer',
        permissions: ['content:read'],
        organizationId: STUDIO,
      },
      // Two custom roles, one field apart: the admin permission.
      {
        id: 'role-brand-lead',
        name: 'Brand Lead',
        permissions: ['content:write', 'manage_members'],
        organizationId: STUDIO,
      },
      {
        id: 'role-brand-writer',
        name: 'Brand Writer',
        permissions: ['content:write'],
        organizationId: STUDIO,
      },
      {
        id: 'role-other-admin',
        name: 'Admin',
        permissions: ['*'],
        organizationId: 'org-other',
      },
      {
        id: 'role-other-editor',
        name: 'Editor',
        permissions: ['content:write'],
        organizationId: 'org-other',
      },
    ],
    userRole: [
      // Decoys: another user's Admin role here; the caller's Admin role in
      // another organisation; the caller's Admin role here, already expired.
      { userId: 'user-2', roleId: 'role-admin', expiresAt: null },
      { userId: USER, roleId: 'role-other-admin', expiresAt: null },
      { userId: USER, roleId: 'role-admin', expiresAt: PAST },
      ...caller.grants.map(grant => ({ userId: USER, ...grant })),
    ],
  });
}

/** A clean store holding this caller's rows, and clean log and tracker mocks. */
function given(caller: Caller): void {
  mockStore.reset();
  seedStudio(caller);
  mockLog.error.mockClear();
  mockTrackError.mockClear();
}

/** Every read of this model rejects with a planted error, which is returned. */
function failRead(
  model:
    | 'user'
    | 'organization'
    | 'businessOwnership'
    | 'teamMember'
    | 'userRole'
): Error {
  const planted = new Error(`planted: the ${model} read failed`);
  mockStore.fail({ model }, planted);
  return planted;
}

const decide = () => resolveStudioApprovalAuthority(USER, STUDIO);

/**
 * One turn of the event loop: every read that is not held has settled. Only
 * Date is faked below, so this timer is a real one.
 */
const settle = () => new Promise<void>(resolve => setTimeout(resolve, 0));

/** What each error line said, in the order the lines were written. */
function errorLines() {
  return mockLog.error.mock.calls.map(call => {
    const fields = (call[1] ?? {}) as Record<string, unknown>;
    return {
      userId: fields.userId,
      organizationId: fields.organizationId,
      read: fields.read,
      decision: fields.decision,
      code: 'code' in fields ? fields.code : 'no code field',
    };
  });
}

/** What each error-tracker call carried, in call order. */
function trackerCalls() {
  return mockTrackError.mock.calls.map(call => {
    const context = (call[1] ?? {}) as {
      operation?: unknown;
      userId?: unknown;
      metadata?: Record<string, unknown>;
    };
    const metadata = context.metadata ?? {};
    return {
      error: call[0] as unknown,
      operation: context.operation,
      userId: context.userId,
      organizationId: metadata.organizationId,
      read: metadata.read,
      decision: metadata.decision,
      code: 'code' in metadata ? metadata.code : 'no code field',
    };
  });
}

// ---------------------------------------------------------------------------
// The row store's own strictness
// ---------------------------------------------------------------------------

describe('prisma row store', () => {
  type Delegate = Record<string, (args: unknown) => Promise<unknown>>;
  const model = (store: PrismaRowStore, name: string) =>
    store.client[name] as Delegate;

  /** A store of its own, so a usage error provoked here stays here. */
  function seeded(): PrismaRowStore {
    const store = createPrismaRowStore();
    store.seed({
      organization: [
        { id: 'org-parent', name: 'Parent', slug: 'parent', parentOrgId: null },
        {
          id: 'org-ra',
          name: 'RestoreAssist',
          slug: 'restoreassist',
          parentOrgId: 'org-parent',
        },
      ],
      user: [
        { id: 'user-1', organizationId: 'org-ra', isMultiBusinessOwner: false },
        { id: 'user-2', organizationId: 'org-ra', isMultiBusinessOwner: false },
        {
          id: 'user-3',
          organizationId: 'org-parent',
          isMultiBusinessOwner: false,
        },
      ],
      teamMember: [
        {
          userId: 'user-1',
          organizationId: 'org-ra',
          role: 'viewer',
          acceptedAt: null,
        },
        {
          userId: 'user-1',
          organizationId: 'org-parent',
          role: 'owner',
          acceptedAt: null,
        },
        {
          userId: 'user-2',
          organizationId: 'org-ra',
          role: 'editor',
          acceptedAt: null,
        },
      ],
      role: [
        {
          id: 'role-editor',
          name: 'Editor',
          permissions: ['content:write'],
          organizationId: 'org-ra',
        },
        {
          id: 'role-admin',
          name: 'Admin',
          permissions: ['*'],
          organizationId: 'org-parent',
        },
      ],
      userRole: [
        { userId: 'user-1', roleId: 'role-editor', expiresAt: null },
        { userId: 'user-1', roleId: 'role-admin', expiresAt: PAST },
        { userId: 'user-2', roleId: 'role-admin', expiresAt: null },
      ],
    });
    return store;
  }

  it('row store matches a compound unique key', async () => {
    const store = seeded();
    const byKey = (userId: string, organizationId: string) =>
      model(store, 'teamMember').findUnique({
        where: { team_member_user_org: { userId, organizationId } },
        select: { role: true },
      });

    // Both halves of the key decide: the same user elsewhere, and another
    // user here, are different rows.
    expect(await byKey('user-1', 'org-ra')).toEqual({ role: 'viewer' });
    expect(await byKey('user-1', 'org-parent')).toEqual({ role: 'owner' });
    expect(await byKey('user-2', 'org-ra')).toEqual({ role: 'editor' });
    expect(await byKey('user-2', 'org-parent')).toBeNull();
    expect(store.usageErrors).toEqual([]);
  });

  it('row store applies a where inside a relation select', async () => {
    const store = seeded();
    const membersNamed = (userId: string) =>
      model(store, 'organization').findUnique({
        where: { id: 'org-ra' },
        select: {
          parentOrgId: true,
          users: { where: { id: userId }, select: { id: true } },
        },
      });

    // The organisation has two members; the inner where keeps the one asked for.
    expect(await membersNamed('user-1')).toEqual({
      parentOrgId: 'org-parent',
      users: [{ id: 'user-1' }],
    });
    expect(await membersNamed('user-3')).toEqual({
      parentOrgId: 'org-parent',
      users: [],
    });
    expect(store.usageErrors).toEqual([]);
  });

  it('row store applies a some filter', async () => {
    const store = seeded();
    const parentWithMember = (userId: string) =>
      model(store, 'organization').findFirst({
        where: { id: 'org-parent', users: { some: { id: userId } } },
        select: { id: true },
      });

    expect(await parentWithMember('user-3')).toEqual({ id: 'org-parent' });
    expect(await parentWithMember('user-1')).toBeNull();
    expect(store.usageErrors).toEqual([]);
  });

  it('row store returns the selected relation', async () => {
    const store = seeded();
    const grants = await model(store, 'userRole').findMany({
      where: { userId: 'user-1' },
      select: {
        expiresAt: true,
        role: {
          select: { name: true, permissions: true, organizationId: true },
        },
      },
    });

    // Every grant of this user, whatever its organisation or expiry, each with
    // the role it points at; another user's grant is not among them.
    expect(grants).toEqual([
      {
        expiresAt: null,
        role: {
          name: 'Editor',
          permissions: ['content:write'],
          organizationId: 'org-ra',
        },
      },
      {
        expiresAt: PAST,
        role: {
          name: 'Admin',
          permissions: ['*'],
          organizationId: 'org-parent',
        },
      },
    ]);
    expect(store.usageErrors).toEqual([]);
  });

  it('row store throws on an undefined filter value', () => {
    const store = seeded();
    const refused = /is undefined|must be a value, not undefined/;

    // Real Prisma would drop each of these filters and match every row.
    expect(() =>
      model(store, 'userRole').findMany({ where: { userId: undefined } })
    ).toThrow(refused);
    expect(() =>
      model(store, 'teamMember').findUnique({
        where: {
          team_member_user_org: { userId: 'user-1', organizationId: undefined },
        },
      })
    ).toThrow(refused);
    expect(() =>
      model(store, 'organization').findUnique({
        where: { id: 'org-ra' },
        select: { users: { where: { id: undefined }, select: { id: true } } },
      })
    ).toThrow(refused);
    // Each refusal is also kept, for code that catches what it is thrown.
    expect(store.usageErrors).toHaveLength(3);
  });

  it('row store throws on an unknown model or where shape', () => {
    const store = seeded();
    const refused = /is not defined in the row store/;

    expect(() => store.client.post).toThrow(refused);
    expect(() => model(store, 'user').count).toThrow(refused);
    // A list filter, a comparison, and a filter through a to-one relation.
    expect(() =>
      model(store, 'user').findMany({ where: { id: { in: ['user-1'] } } })
    ).toThrow(refused);
    expect(() =>
      model(store, 'userRole').findMany({
        where: { userId: 'user-1', expiresAt: { gt: NOW } },
      })
    ).toThrow(refused);
    expect(() =>
      model(store, 'userRole').findMany({
        where: { userId: 'user-1', role: { organizationId: 'org-ra' } },
      })
    ).toThrow(refused);
    // An argument the store does not apply, a query with no where, and a
    // findUnique that names no unique key.
    expect(() =>
      model(store, 'userRole').findMany({
        where: { userId: 'user-1' },
        include: { role: true },
      })
    ).toThrow(refused);
    expect(() => model(store, 'teamMember').findMany({})).toThrow(refused);
    expect(() =>
      model(store, 'teamMember').findUnique({ where: { userId: 'user-1' } })
    ).toThrow(refused);
    expect(store.usageErrors).toHaveLength(8);
  });
});

// ---------------------------------------------------------------------------
// The approval rule
// ---------------------------------------------------------------------------

describe('resolveStudioApprovalAuthority', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers({
      now: NOW,
      doNotFake: [
        'hrtime',
        'nextTick',
        'performance',
        'queueMicrotask',
        'requestAnimationFrame',
        'cancelAnimationFrame',
        'requestIdleCallback',
        'cancelIdleCallback',
        'setImmediate',
        'clearImmediate',
        'setInterval',
        'clearInterval',
        'setTimeout',
        'clearTimeout',
      ],
    });
    mockStore.reset();
  });

  afterEach(() => {
    jest.useRealTimers();
    // A query the row store does not know is a fault in the set-up, even when
    // the code under test turned it into a plausible answer.
    expect(mockStore.usageErrors).toEqual([]);
  });

  // ---- D1: not a direct member ---------------------------------------------

  it('refuses a parent-workspace-only member as not_member', async () => {
    // One field from EDITOR (allowed): the caller belongs to the parent
    // workspace, not to the Studio organisation. The editor row is still held.
    given(PARENT_ONLY);
    expect(await decide()).toEqual(NOT_MEMBER);
  });

  it('refuses an owner whose only path is an ownership without the multi-business flag as not_member', async () => {
    // One field from BUSINESS_OWNER (allowed): the flag. The active ownership
    // is still held and would rank owner, but it is no longer membership.
    given({ ...BUSINESS_OWNER, multiBusinessOwner: false });
    expect(await decide()).toEqual(NOT_MEMBER);
  });

  it('refuses a TeamMember owner row with no direct membership as not_member', async () => {
    // One field from UNACCEPTED_OWNER_ROW (allowed): the organisation the
    // caller belongs to directly. A team row alone never gives membership.
    given({ ...UNACCEPTED_OWNER_ROW, home: 'org-other' });
    expect(await decide()).toEqual(NOT_MEMBER);
  });

  it('refuses a non-member as not_member even when a role read fails', async () => {
    // One field from "allows a TeamMember editor when the ownership read
    // fails": the organisation the caller belongs to directly.
    given(PARENT_ONLY);
    failRead('businessOwnership');
    expect(await decide()).toEqual(NOT_MEMBER);

    // And when all three role reads fail: membership was read, and it is false.
    given(PARENT_ONLY);
    failRead('businessOwnership');
    failRead('teamMember');
    failRead('userRole');
    expect(await decide()).toEqual(NOT_MEMBER);
  });

  // ---- D2 to D5: allowed ------------------------------------------------------

  it('allows an active business owner', async () => {
    given(BUSINESS_OWNER);
    expect(await decide()).toEqual(allowedAs('owner'));
  });

  it('allows a TeamMember viewer who holds an active ownership', async () => {
    given(OWNER_WITH_VIEWER_ROW);
    expect(await decide()).toEqual(allowedAs('owner'));
  });

  it('allows a direct member with no TeamMember row', async () => {
    // Owner by the no-row convention, though the only role held is Viewer.
    given(NO_TEAM_ROW);
    expect(await decide()).toEqual(allowedAs('owner'));
  });

  it('allows a TeamMember editor with no UserRole', async () => {
    given(EDITOR);
    expect(await decide()).toEqual(allowedAs('editor'));
  });

  it('allows an unaccepted TeamMember owner row', async () => {
    given(UNACCEPTED_OWNER_ROW);
    expect(await decide()).toEqual(allowedAs('owner'));
  });

  it('allows a viewer whose Editor role has no expiry', async () => {
    given(VIEWER_WITH_EDITOR_ROLE);
    expect(await decide()).toEqual(allowedAs('editor'));
  });

  it('allows a viewer whose Editor role expires in the future', async () => {
    given(VIEWER_WITH_EDITOR_ROLE_UNTIL_LATER);
    expect(await decide()).toEqual(allowedAs('editor'));
  });

  it('ranks a custom role with an admin permission as admin', async () => {
    given(VIEWER_WITH_CUSTOM_ADMIN_ROLE);
    expect(await decide()).toEqual(allowedAs('admin'));

    // The pair, one field apart: a custom role without the admin permission.
    given({
      ...VIEWER_WITH_CUSTOM_ADMIN_ROLE,
      grants: [{ roleId: 'role-brand-writer', expiresAt: null }],
    });
    expect(await decide()).toEqual(INSUFFICIENT_ROLE);
  });

  it('allows an active owner when the UserRole read fails', async () => {
    given(OWNER_WITH_VIEWER_ROW);
    failRead('userRole');
    expect(await decide()).toEqual(allowedAs('owner'));
  });

  it('allows an active owner when the TeamMember read fails', async () => {
    given(OWNER_WITH_VIEWER_ROW);
    failRead('teamMember');
    expect(await decide()).toEqual(allowedAs('owner'));
  });

  it('allows a TeamMember editor when the ownership read fails', async () => {
    given(EDITOR);
    failRead('businessOwnership');
    expect(await decide()).toEqual(allowedAs('editor'));
  });

  // ---- D6: a member whose every record ranks below editor ---------------------

  it('refuses a TeamMember viewer with no higher role', async () => {
    // One field from EDITOR (allowed): the team row's role. The decoys (an
    // expired Admin role here, an Admin role elsewhere) do not lift it.
    given(VIEWER);
    expect(await decide()).toEqual(INSUFFICIENT_ROLE);

    // One field from OWNER_WITH_VIEWER_ROW (allowed): the ownership is held
    // but no longer active.
    given({ ...OWNER_WITH_VIEWER_ROW, ownership: false });
    expect(await decide()).toEqual(INSUFFICIENT_ROLE);
  });

  it('refuses an unaccepted TeamMember viewer row', async () => {
    // One field from UNACCEPTED_OWNER_ROW (allowed): the row's role. An
    // unaccepted row is still a row; it is not "no row, so owner".
    given({ ...UNACCEPTED_OWNER_ROW, teamRole: 'viewer' });
    expect(await decide()).toEqual(INSUFFICIENT_ROLE);
  });

  it('refuses a collaborator who holds only the Viewer role', async () => {
    // One field from NO_TEAM_ROW (allowed): a collaborator row exists. This is
    // what accepting a non-owner invitation records.
    given({ ...NO_TEAM_ROW, teamRole: 'collaborator' });
    expect(await decide()).toEqual(INSUFFICIENT_ROLE);
  });

  it('refuses an unrecognised role string', async () => {
    // One field from EDITOR (allowed): the team row's role.
    given({ ...EDITOR, teamRole: 'publisher' });
    expect(await decide()).toEqual(INSUFFICIENT_ROLE);
  });

  it('refuses a viewer whose Editor role has expired', async () => {
    // One field from VIEWER_WITH_EDITOR_ROLE_UNTIL_LATER (allowed): the expiry
    // is one millisecond before now, not one after.
    given({
      ...VIEWER_WITH_EDITOR_ROLE,
      grants: [{ roleId: 'role-editor', expiresAt: PAST }],
    });
    expect(await decide()).toEqual(INSUFFICIENT_ROLE);
  });

  it('refuses a viewer whose Editor role expires exactly now', async () => {
    // One field from VIEWER_WITH_EDITOR_ROLE_UNTIL_LATER (allowed): the expiry
    // is this instant. A grant is kept only while its expiry is later than now.
    given({
      ...VIEWER_WITH_EDITOR_ROLE,
      grants: [{ roleId: 'role-editor', expiresAt: EXACTLY_NOW }],
    });
    expect(await decide()).toEqual(INSUFFICIENT_ROLE);
  });

  it('refuses a viewer whose Editor role is in another organisation', async () => {
    // One field from VIEWER_WITH_EDITOR_ROLE (allowed): which organisation the
    // granted Editor role belongs to.
    given({
      ...VIEWER_WITH_EDITOR_ROLE,
      grants: [{ roleId: 'role-other-editor', expiresAt: null }],
    });
    expect(await decide()).toEqual(INSUFFICIENT_ROLE);
  });

  // ---- Decided on what was read -----------------------------------------------

  it('reports unavailable when the membership read fails', async () => {
    // The pair is EDITOR with every read answered (allowed). Membership is
    // never assumed, even beside an editor row that was read.
    given(EDITOR);
    failRead('user');
    expect(await decide()).toEqual(UNAVAILABLE);

    // A later read of the same membership rule: the organisation lookup that
    // decides a caller whose own record points elsewhere.
    given(PARENT_ONLY);
    failRead('organization');
    expect(await decide()).toEqual(UNAVAILABLE);
  });

  it('reports unavailable, not not_member, when every read fails', async () => {
    // With its reads answered this caller is not_member (the first case above).
    given(PARENT_ONLY);
    failRead('user');
    failRead('organization');
    failRead('businessOwnership');
    failRead('teamMember');
    failRead('userRole');
    expect(await decide()).toEqual(UNAVAILABLE);
  });

  it('reports unavailable for a viewer when the UserRole read fails', async () => {
    // One field from "allows an active owner when the UserRole read fails":
    // no ownership. Nothing read allows, and the read that failed could have.
    given(VIEWER);
    failRead('userRole');
    expect(await decide()).toEqual(UNAVAILABLE);
  });

  it('reports unavailable for a viewer when the ownership read fails', async () => {
    // One field from "allows a TeamMember editor when the ownership read
    // fails": the team row's role.
    given(VIEWER);
    failRead('businessOwnership');
    expect(await decide()).toEqual(UNAVAILABLE);
  });

  it('reports unavailable, never owner, when the TeamMember read fails', async () => {
    // One field from "allows an active owner when the TeamMember read fails":
    // no ownership. A failed team-row read is not "no row": it gives no rank.
    given(VIEWER);
    failRead('teamMember');
    expect(await decide()).toEqual(UNAVAILABLE);

    // The same for a caller who really has no team row, and would be owner by
    // convention had the read answered.
    given(NO_TEAM_ROW);
    failRead('teamMember');
    expect(await decide()).toEqual(UNAVAILABLE);
  });

  // ---- Reporting and ordering ---------------------------------------------------

  it('writes one error line naming each failed read', async () => {
    // All four reads fail, each with its own error object.
    given(VIEWER);
    const planted = {
      membership: failRead('user'),
      ownership: failRead('businessOwnership'),
      teamMember: failRead('teamMember'),
      userRole: failRead('userRole'),
    };
    await decide();

    expect(mockLog.error).toHaveBeenCalledTimes(4);
    expect(mockTrackError).toHaveBeenCalledTimes(4);
    const line = {
      userId: USER,
      organizationId: STUDIO,
      decision: 'unavailable',
      code: 'STUDIO_APPROVE_CHECK_UNAVAILABLE',
    };
    expect(errorLines()).toEqual([
      { ...line, read: 'membership' },
      { ...line, read: 'ownership' },
      { ...line, read: 'teamMember' },
      { ...line, read: 'userRole' },
    ]);
    // The tracker is handed the rejection itself, not a copy or a new error.
    const handed = [
      planted.membership,
      planted.ownership,
      planted.teamMember,
      planted.userRole,
    ];
    expect(
      trackerCalls().map((call, index) => call.error === handed[index])
    ).toEqual([true, true, true, true]);
    expect(trackerCalls().map(call => ({ ...call, error: 'checked' }))).toEqual(
      (['membership', 'ownership', 'teamMember', 'userRole'] as const).map(
        read => ({
          ...line,
          error: 'checked',
          operation: 'studio/approval-authority',
          read,
        })
      )
    );

    // A failed read beside a record that allows is still reported, with the
    // decision that was reached and no code.
    given(OWNER_WITH_VIEWER_ROW);
    const roleStoreDown = failRead('userRole');
    await decide();
    const allowedLine = {
      userId: USER,
      organizationId: STUDIO,
      read: 'userRole',
      decision: 'allowed',
      code: 'no code field',
    };
    expect(errorLines()).toEqual([allowedLine]);
    expect(
      trackerCalls().map(call => ({
        ...call,
        error: call.error === roleStoreDown,
      }))
    ).toEqual([
      { ...allowedLine, error: true, operation: 'studio/approval-authority' },
    ]);

    // The same for a caller refused as not a member.
    given(PARENT_ONLY);
    failRead('teamMember');
    await decide();
    expect(errorLines()).toEqual([
      {
        userId: USER,
        organizationId: STUDIO,
        read: 'teamMember',
        decision: 'not_member',
        code: 'no code field',
      },
    ]);
    expect(mockTrackError).toHaveBeenCalledTimes(1);

    // And nothing is written when every read answers, allowed or refused.
    given(EDITOR);
    await decide();
    given(VIEWER);
    await decide();
    expect(mockLog.error).not.toHaveBeenCalled();
    expect(mockTrackError).not.toHaveBeenCalled();
  });

  it('starts the role reads before the membership read resolves', async () => {
    given(EDITOR);
    // The first read of the membership rule stays pending until released.
    const release = mockStore.hold({ model: 'user' });
    let settled = false;
    const pending = decide().then(result => {
      settled = true;
      return result;
    });
    try {
      await settle();
      // Membership has asked its first question and is still waiting; each of
      // the three role reads has already been asked.
      expect(mockStore.reads).toEqual({
        user: 1,
        organization: 0,
        businessOwnership: 1,
        teamMember: 1,
        userRole: 1,
      });
      expect(settled).toBe(false);
    } finally {
      release();
    }
    expect(await pending).toEqual(allowedAs('editor'));
  });
});
