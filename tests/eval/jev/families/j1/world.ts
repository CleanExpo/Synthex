/**
 * J1 synthetic two-tenant world behind a fake Prisma client (the DB boundary).
 *
 * Two organisations exist: org-A (the caller, user-A) and org-B (user-B).
 * A query is answered by the identities it names:
 *   - names only org-A identities  -> an org-A row
 *   - names only org-B identities  -> an org-B row
 *   - names both (a correctly scoped lookup of an org-B id) -> no row
 *   - names neither -> no row
 * Leaf string values are classified; nothing else about the query is modelled.
 * State lives on globalThis because invokeRoute isolates the module registry.
 */

export const ORG_A = 'org-A';
export const ORG_B = 'org-B';
export const USER_A = 'user-A';
export const USER_B = 'user-B';
/** Resource ids (UUID-shaped so id validators accept them): aaaaaaaa-* is org-A's, bbbbbbbb-* org-B's. */
export const RES_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa0001';
export const RES_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbb0001';
export const B_MARKER = 'org-b-secret-marker';

interface WorldState {
  calls: string[];
}

const KEY = '__J1_WORLD__';

export function worldState(): WorldState {
  const g = globalThis as unknown as Record<string, WorldState>;
  if (!g[KEY]) g[KEY] = { calls: [] };
  return g[KEY];
}

export function resetWorld(): void {
  worldState().calls = [];
}

type Owner = 'A' | 'B';

function scan(value: unknown, found: Set<Owner>, depth = 0): void {
  if (depth > 12 || value === null || value === undefined) return;
  if (typeof value === 'string') {
    const v = value.toLowerCase();
    if (v === 'org-a' || v === 'user-a' || v.startsWith('aaaaaaaa-'))
      found.add('A');
    if (v === 'org-b' || v === 'user-b' || v.startsWith('bbbbbbbb-'))
      found.add('B');
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) scan(item, found, depth + 1);
    return;
  }
  if (typeof value === 'object')
    for (const item of Object.values(value as object))
      scan(item, found, depth + 1);
}

function owners(where: unknown): Set<Owner> {
  const found = new Set<Owner>();
  scan(where, found);
  return found;
}

function firstId(where: unknown): string | undefined {
  if (!where || typeof where !== 'object') return undefined;
  const w = where as Record<string, unknown>;
  for (const k of ['id', 'orgId', 'organizationId'])
    if (typeof w[k] === 'string') return w[k] as string;
  return undefined;
}

function userRow(owner: Owner) {
  const org = owner === 'A' ? ORG_A : ORG_B;
  return {
    id: owner === 'A' ? USER_A : USER_B,
    email: owner === 'A' ? 'user-a@org-a.test' : 'user-b@org-b.test',
    name: owner === 'A' ? 'User A' : `User B ${B_MARKER}`,
    organizationId: org,
    activeOrganizationId: org,
    role: 'user',
    onboardingComplete: true,
    organization: {
      id: org,
      name: `Org ${owner}`,
      slug: org,
      status: 'active',
    },
    // No membership row: the direct org creator (owner), see lib/auth/with-auth.ts.
    teamMemberships: [],
  };
}

function orgRow(owner: Owner) {
  const org = owner === 'A' ? ORG_A : ORG_B;
  return {
    id: org,
    name: owner === 'A' ? 'Org A' : `Org B ${B_MARKER}`,
    slug: org,
    plan: 'pro',
    status: 'active',
    ownerId: owner === 'A' ? USER_A : USER_B,
    // Each user administers their own organisation only.
    settings: { admins: [owner === 'A' ? USER_A : USER_B] },
    createdAt: new Date(0),
    updatedAt: new Date(0),
  };
}

function resourceRow(owner: Owner, id: string | undefined) {
  const org = owner === 'A' ? ORG_A : ORG_B;
  const user = owner === 'A' ? USER_A : USER_B;
  return {
    id: id ?? (owner === 'A' ? RES_A : RES_B),
    organizationId: org,
    orgId: org,
    clientId: org,
    teamId: org,
    userId: user,
    ownerId: user,
    createdBy: user,
    createdById: user,
    authorId: user,
    requestedBy: user,
    submittedBy: user,
    steps: [],
    currentStep: 0,
    name: owner === 'A' ? 'A resource' : `B resource ${B_MARKER}`,
    title: owner === 'A' ? 'A resource' : `B resource ${B_MARKER}`,
    content: owner === 'A' ? 'A content' : `B content ${B_MARKER}`,
    status: 'pending',
    role: 'owner',
    permissions: ['admin'],
    settings: { admins: [user] },
    metadata: {},
    createdAt: new Date(0),
    updatedAt: new Date(0),
    organization: { id: org },
    user: { id: user, organizationId: org },
    team: { id: org, organizationId: org },
  };
}

// ── Machine keys (McpApiKey rows, looked up by sha-256 hash) ─────────────────
const KEYS = '__J1_KEYS__';

function keyTable(): Map<string, Record<string, unknown>> {
  const g = globalThis as unknown as Record<
    string,
    Map<string, Record<string, unknown>>
  >;
  if (!g[KEYS]) g[KEYS] = new Map();
  return g[KEYS];
}

/** Register an org-A key (user-A) by its hash. Returns the raw key. */
export function registerKey(
  raw: string,
  hash: string,
  scopes: string[],
  overrides: Record<string, unknown> = {}
): string {
  keyTable().set(hash, {
    id: `key-${raw}`,
    keyHash: hash,
    organizationId: ORG_A,
    userId: USER_A,
    label: raw,
    scopes,
    expiresAt: null,
    revokedAt: null,
    ...overrides,
  });
  return raw;
}

function rowFor(model: string, where: unknown): Record<string, unknown> | null {
  if (model === 'mcpApiKey') {
    const hash = (where as { keyHash?: unknown } | undefined)?.keyHash;
    return typeof hash === 'string' ? (keyTable().get(hash) ?? null) : null;
  }
  const o = owners(where);
  if (o.size !== 1) return null;
  const owner = [...o][0];
  if (model === 'user') return userRow(owner);
  if (model === 'organization') return orgRow(owner);
  if (model === 'userRole')
    return {
      id: `user-role-${owner}`,
      userId: owner === 'A' ? USER_A : USER_B,
      role: {
        name: 'owner',
        permissions: ['admin'],
        organizationId: owner === 'A' ? ORG_A : ORG_B,
      },
    };
  return resourceRow(owner, firstId(where));
}

class NotFoundError extends Error {
  code = 'P2025';
  constructor(model: string) {
    super(`JEV fake DB: ${model} record to update not found`);
    this.name = 'PrismaClientKnownRequestError';
  }
}

function modelApi(model: string) {
  const log = (op: string) => worldState().calls.push(`${model}.${op}`);
  type Args = { where?: unknown; data?: Record<string, unknown> } | undefined;
  return {
    findUnique: async (a: Args) => (log('findUnique'), rowFor(model, a?.where)),
    findUniqueOrThrow: async (a: Args) => {
      log('findUniqueOrThrow');
      const r = rowFor(model, a?.where);
      if (!r) throw new NotFoundError(model);
      return r;
    },
    findFirst: async (a: Args) => (log('findFirst'), rowFor(model, a?.where)),
    findFirstOrThrow: async (a: Args) => {
      log('findFirstOrThrow');
      const r = rowFor(model, a?.where);
      if (!r) throw new NotFoundError(model);
      return r;
    },
    findMany: async (a: Args) => {
      log('findMany');
      const r = rowFor(model, a?.where);
      return r ? [r] : [];
    },
    count: async (a: Args) => (log('count'), rowFor(model, a?.where) ? 1 : 0),
    aggregate: async () => (
      log('aggregate'),
      { _count: 0, _sum: {}, _avg: {} }
    ),
    groupBy: async () => (log('groupBy'), []),
    create: async (a: Args) => (
      log('create'),
      {
        ...resourceRow('A', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa0002'),
        ...(a?.data ?? {}),
      }
    ),
    createMany: async () => (log('createMany'), { count: 1 }),
    update: async (a: Args) => {
      log('update');
      const r = rowFor(model, a?.where);
      if (!r) throw new NotFoundError(model);
      return { ...r, ...(a?.data ?? {}) };
    },
    upsert: async (a: Args) => {
      log('upsert');
      const r = rowFor(model, a?.where);
      return r ?? resourceRow('A', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa0002');
    },
    delete: async (a: Args) => {
      log('delete');
      const r = rowFor(model, a?.where);
      if (!r) throw new NotFoundError(model);
      return r;
    },
    updateMany: async (a: Args) => (
      log('updateMany'),
      { count: rowFor(model, a?.where) ? 1 : 0 }
    ),
    deleteMany: async (a: Args) => (
      log('deleteMany'),
      { count: rowFor(model, a?.where) ? 1 : 0 }
    ),
  };
}

/** A Prisma-shaped client over the two-tenant world. */
export function fakePrisma(): Record<string, unknown> {
  const models = new Map<string, ReturnType<typeof modelApi>>();
  const client: Record<string, unknown> = new Proxy(
    {},
    {
      get(_t, prop) {
        if (typeof prop !== 'string' || prop === 'then') return undefined;
        if (prop === '$transaction')
          return async (arg: unknown) => {
            worldState().calls.push('$transaction');
            if (typeof arg === 'function') return arg(client);
            return Promise.all(arg as Promise<unknown>[]);
          };
        if (prop === '$queryRaw' || prop === '$queryRawUnsafe')
          return async () => (worldState().calls.push(prop), []);
        if (prop === '$executeRaw' || prop === '$executeRawUnsafe')
          return async () => (worldState().calls.push(prop), 0);
        if (prop.startsWith('$')) return async () => undefined;
        if (!models.has(prop)) models.set(prop, modelApi(prop));
        return models.get(prop);
      },
    }
  );
  return client;
}
