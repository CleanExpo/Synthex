/**
 * J2 data-layer boundary: a Prisma client whose reads fail.
 *
 * Used as the jest.mock factory for '@/lib/prisma' (the same boundary the
 * existing route tests mock). A single-row user/teamMember/organization read
 * whose `select` asks only for auth fields (IDENTITY_READS) succeeds for the synthetic org-A
 * user, so the request reaches the route's real data read. Every other call —
 * including a user read with no select or with profile fields, which is route
 * data, not auth — and $queryRaw / $transaction reject as an unreachable
 * database would. Plain functions, not jest.fn, so resetMocks cannot erase them.
 */
export const J2_USER_ID = 'user-org-A';
export const J2_ORG_ID = 'org-A';
export const J2_DB_ERROR = 'J2 planted: database unavailable (ECONNREFUSED)';

const SYNTHETIC_USER = {
  id: J2_USER_ID,
  email: 'member@org-a.test',
  name: 'Org A Member',
  role: 'user',
  organizationId: J2_ORG_ID,
  isMultiBusinessOwner: false,
  activeOrganizationId: null,
  organization: { id: J2_ORG_ID, name: 'Org A', status: 'active' },
  teamMemberships: [{ role: 'admin', organizationId: J2_ORG_ID }],
};
const SYNTHETIC_MEMBERSHIP = {
  id: 'member-org-A',
  userId: J2_USER_ID,
  organizationId: J2_ORG_ID,
  role: 'admin',
  acceptedAt: new Date('2026-01-01T00:00:00.000Z'),
};
const SYNTHETIC_ORG = { id: J2_ORG_ID, status: 'active' };
// Per model: the row served and the only fields an auth/org-scope select may ask for
// (withAuth, withOrg, getEffectiveOrganizationId and its suspended-org check).
const IDENTITY_READS: Record<string, { row: unknown; fields: Set<string> }> = {
  user: {
    row: SYNTHETIC_USER,
    fields: new Set([
      'id',
      'email',
      'name',
      'role',
      'organizationId',
      'organization',
      'teamMemberships',
      'isMultiBusinessOwner',
      'activeOrganizationId',
    ]),
  },
  teamMember: {
    row: SYNTHETIC_MEMBERSHIP,
    fields: new Set(['id', 'userId', 'organizationId', 'role', 'acceptedAt']),
  },
  organization: { row: SYNTHETIC_ORG, fields: new Set(['id', 'status']) },
};
const SINGLE_ROW = new Set([
  'findUnique',
  'findFirst',
  'findUniqueOrThrow',
  'findFirstOrThrow',
]);

function isAuthSelect(args: unknown, fields: Set<string>): boolean {
  const select = (args as { select?: Record<string, unknown> } | undefined)
    ?.select;
  return (
    !!select &&
    Object.keys(select).length > 0 &&
    Object.keys(select).every(k => fields.has(k))
  );
}

/** Rejected data-layer calls so far; global because each route loads its own mock copy. */
export function dbRejects(): number {
  return (globalThis as { __j2DbRejects?: number }).__j2DbRejects ?? 0;
}

function reject(): Promise<never> {
  const g = globalThis as { __j2DbRejects?: number };
  g.__j2DbRejects = (g.__j2DbRejects ?? 0) + 1;
  return Promise.reject(new Error(J2_DB_ERROR));
}

function model(name: string): unknown {
  return new Proxy(
    {},
    {
      get(_t, method) {
        if (method === 'then') return undefined;
        const identity = IDENTITY_READS[name];
        if (identity && SINGLE_ROW.has(String(method)))
          return (args?: unknown) =>
            isAuthSelect(args, identity.fields)
              ? Promise.resolve(identity.row)
              : reject();
        return reject;
      },
    }
  );
}

export const failingPrisma: unknown = new Proxy(
  {},
  {
    get(_t, prop) {
      if (prop === 'then') return undefined;
      if (typeof prop !== 'string') return undefined;
      if (prop.startsWith('$')) return reject;
      return model(prop);
    },
  }
);

/** Module shape of lib/prisma with every async export failing. */
export function failingPrismaModule(): Record<string, unknown> {
  return {
    __esModule: true,
    prisma: failingPrisma,
    default: failingPrisma,
    checkDatabaseHealth: () =>
      Promise.resolve({ healthy: false, error: J2_DB_ERROR }),
    getPoolMetrics: () => ({}),
    disconnectPrisma: () => Promise.resolve(),
    reconnectPrisma: () => Promise.resolve(false),
    executeWithRetry: reject,
    withTransaction: reject,
  };
}
