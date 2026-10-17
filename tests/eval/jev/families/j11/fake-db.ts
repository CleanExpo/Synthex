/**
 * J11 synthetic database — the Prisma boundary double.
 *
 * Routes import `@/lib/prisma`; j11.jev.test.ts maps that module to
 * `fakePrisma()`. Data is synthetic (org-A, org-B). Any model that was not
 * seeded explicitly answers with one row owned by org-B (id `rec-org-b`), so a
 * cross-tenant id swap finds a real org-B row whatever model the route reads.
 *
 * Filters the double cannot evaluate are recorded in `unsupported` and treated
 * as a match (permissive): a permissive double can only return MORE rows, so a
 * route that still refuses is genuinely refusing, while a leak observed under
 * an unsupported filter is reported INCONCLUSIVE, not FAIL.
 */

export type Row = Record<string, unknown>;

export const ORG_B_ID = 'rec-org-b';
export const ORG_A_ID = 'rec-org-a';
export const ORG_A_MARKER = 'J11-ORG-A-OWN-MARKER';
export const ORG_B_MARKER = 'J11-ORG-B-PRIVATE-MARKER';
const FIXED_DATE = new Date('2026-01-01T00:00:00.000Z');

const READS = [
  'findUnique',
  'findUniqueOrThrow',
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'count',
  'aggregate',
  'groupBy',
] as const;
const OPS = new Set([
  'equals',
  'in',
  'notIn',
  'not',
  'lt',
  'lte',
  'gt',
  'gte',
  'contains',
  'startsWith',
  'endsWith',
  'mode',
  'has',
  'hasSome',
  'isEmpty',
]);

export interface WriteRecord {
  model: string;
  op: string;
  args: unknown;
}

/** The lazily seeded row pair for a model: one org-A row, one org-B row. */
export function tenantRows(model: string): Row[] {
  const a = orgBRow(model);
  for (const [k, v] of Object.entries(a)) {
    if (v === 'org-B') a[k] = 'org-A';
    else if (v === 'user-b') a[k] = 'user-a';
    else if (v === 'team-b') a[k] = 'team-a';
    else if (typeof v === 'string' && v.includes(ORG_B_MARKER))
      a[k] = v.replace(ORG_B_MARKER, ORG_A_MARKER);
  }
  a.id = ORG_A_ID;
  a.email = 'member@org-a.test';
  return [a, orgBRow(model)];
}

export function orgBRow(model: string): Row {
  return {
    id: ORG_B_ID,
    organizationId: 'org-B',
    orgId: 'org-B',
    clientId: 'org-B',
    userId: 'user-b',
    createdById: 'user-b',
    createdBy: 'user-b',
    ownerId: 'user-b',
    authorId: 'user-b',
    submittedById: 'user-b',
    requesterId: 'user-b',
    teamId: 'team-b',
    name: `${ORG_B_MARKER} ${model}`,
    title: ORG_B_MARKER,
    content: ORG_B_MARKER,
    description: ORG_B_MARKER,
    email: 'private@org-b.test',
    status: 'active',
    isActive: true,
    createdAt: FIXED_DATE,
    updatedAt: FIXED_DATE,
  };
}

export function baseSeed(): Record<string, Row[]> {
  return {
    user: [
      {
        id: 'user-a',
        email: 'member@org-a.test',
        name: 'Member A',
        organizationId: 'org-A',
        activeOrganizationId: null,
        isMultiBusinessOwner: false,
        preferences: { role: 'user' },
        role: 'member',
        createdAt: FIXED_DATE,
        updatedAt: FIXED_DATE,
      },
      {
        id: 'user-b',
        email: 'private@org-b.test',
        name: `${ORG_B_MARKER} user`,
        organizationId: 'org-B',
        activeOrganizationId: null,
        isMultiBusinessOwner: false,
        preferences: { role: 'admin' },
        role: 'owner',
        createdAt: FIXED_DATE,
        updatedAt: FIXED_DATE,
      },
    ],
    organization: [
      { id: 'org-A', name: 'Org A', slug: 'org-a', status: 'active' },
      { id: 'org-B', name: ORG_B_MARKER, slug: 'org-b', status: 'active' },
    ],
  };
}

function isPlainObject(v: unknown): v is Row {
  return (
    typeof v === 'object' &&
    v !== null &&
    !Array.isArray(v) &&
    !(v instanceof Date)
  );
}

function same(a: unknown, b: unknown): boolean {
  if (a instanceof Date && b instanceof Date)
    return a.getTime() === b.getTime();
  if (a === undefined) a = null;
  if (b === undefined) b = null;
  return a === b;
}

export class FakeDb {
  tables: Record<string, Row[]>;
  writes: WriteRecord[] = [];
  unsupported: string[] = [];
  private seq = 0;

  constructor(seed: Record<string, Row[]> = baseSeed()) {
    this.tables = JSON.parse(JSON.stringify(seed), (k, v) =>
      k === 'createdAt' || k === 'updatedAt' ? new Date(v) : v
    );
  }

  table(model: string): Row[] {
    if (!this.tables[model]) this.tables[model] = tenantRows(model);
    return this.tables[model];
  }

  private matchOps(model: string, value: unknown, cond: Row): boolean {
    for (const [op, arg] of Object.entries(cond)) {
      switch (op) {
        case 'equals':
          if (!same(value, arg)) return false;
          break;
        case 'in':
          if (!(arg as unknown[]).some(x => same(value, x))) return false;
          break;
        case 'notIn':
          if ((arg as unknown[]).some(x => same(value, x))) return false;
          break;
        case 'not':
          if (isPlainObject(arg)) {
            if (this.matchOps(model, value, arg)) return false;
          } else if (same(value, arg)) return false;
          break;
        case 'lt':
        case 'lte':
        case 'gt':
        case 'gte': {
          const a = value instanceof Date ? value.getTime() : Number(value);
          const b = arg instanceof Date ? arg.getTime() : Number(arg);
          if (value === null || value === undefined) return false;
          if (op === 'lt' && !(a < b)) return false;
          if (op === 'lte' && !(a <= b)) return false;
          if (op === 'gt' && !(a > b)) return false;
          if (op === 'gte' && !(a >= b)) return false;
          break;
        }
        case 'contains':
        case 'startsWith':
        case 'endsWith': {
          const s = String(value ?? '').toLowerCase();
          const t = String(arg).toLowerCase();
          if (op === 'contains' && !s.includes(t)) return false;
          if (op === 'startsWith' && !s.startsWith(t)) return false;
          if (op === 'endsWith' && !s.endsWith(t)) return false;
          break;
        }
        case 'mode':
          break;
        default:
          this.unsupported.push(`${model}.${op}`);
      }
    }
    return true;
  }

  matches(model: string, row: Row, where: unknown): boolean {
    if (!isPlainObject(where)) return true;
    for (const [key, cond] of Object.entries(where)) {
      if (cond === undefined) continue;
      if (key === 'AND') {
        const list = Array.isArray(cond) ? cond : [cond];
        if (!list.every(c => this.matches(model, row, c))) return false;
        continue;
      }
      if (key === 'OR') {
        const list = cond as unknown[];
        if (list.length && !list.some(c => this.matches(model, row, c)))
          return false;
        continue;
      }
      if (key === 'NOT') {
        const list = Array.isArray(cond) ? cond : [cond];
        if (list.some(c => this.matches(model, row, c))) return false;
        continue;
      }
      const value = row[key];
      if (!isPlainObject(cond)) {
        if (!same(value, cond)) return false;
        continue;
      }
      const keys = Object.keys(cond);
      if (keys.every(k => OPS.has(k))) {
        if (!this.matchOps(model, value, cond)) return false;
        continue;
      }
      // Composite unique key, e.g. userId_organizationId: { userId, organizationId }
      if (
        value === undefined &&
        key.includes('_') &&
        Object.values(cond).every(v => !isPlainObject(v))
      ) {
        if (!Object.entries(cond).every(([k, v]) => same(row[k], v)))
          return false;
        continue;
      }
      if (isPlainObject(value)) {
        if (!this.matches(model, value, cond)) return false;
        continue;
      }
      // Relation filter (some/every/none/is or nested) — not evaluated.
      this.unsupported.push(`${model}.${key}`);
    }
    return true;
  }

  private attach(row: Row, args: Row | undefined): Row {
    const spec = (args?.include ?? args?.select) as Row | undefined;
    if (!isPlainObject(spec)) return { ...row };
    const out: Row = { ...row };
    for (const [k, v] of Object.entries(spec)) {
      if (!v || out[k] !== undefined) continue;
      if (k === '_count') {
        out[k] = {};
        continue;
      }
      const fk = row[`${k}Id`];
      if (fk !== undefined && this.tables[k]) {
        out[k] = this.tables[k].find(r => same(r.id, fk)) ?? null;
      } else {
        out[k] = k.endsWith('s') ? [] : null;
      }
    }
    return out;
  }

  private nextId(model: string): string {
    this.seq += 1;
    return `${model}-${this.seq}`;
  }

  run(model: string, op: string, raw: unknown): unknown {
    const args = (isPlainObject(raw) ? raw : {}) as Row;
    const rows = this.table(model);
    const found = () => rows.filter(r => this.matches(model, r, args.where));
    if ((READS as readonly string[]).includes(op)) {
      const hits = found();
      if (op === 'count') return hits.length;
      if (op === 'aggregate')
        return { _count: { _all: hits.length }, _sum: {}, _avg: {} };
      if (op === 'groupBy') return [];
      if (op === 'findMany') {
        const take = typeof args.take === 'number' ? args.take : undefined;
        return hits.slice(0, take).map(r => this.attach(r, args));
      }
      const hit = hits[0];
      if (!hit && op.endsWith('OrThrow')) throw new Error(`${model} not found`);
      return hit ? this.attach(hit, args) : null;
    }
    this.writes.push({ model, op, args: raw });
    if (op === 'create' || op === 'upsert') {
      if (op === 'upsert') {
        const hit = found()[0];
        if (hit) {
          Object.assign(hit, args.update as Row);
          return { ...hit };
        }
      }
      const data = (op === 'create' ? args.data : args.create) as Row;
      const row: Row = {
        id: this.nextId(model),
        createdAt: FIXED_DATE,
        updatedAt: FIXED_DATE,
        ...(data ?? {}),
      };
      rows.push(row);
      return { ...row };
    }
    if (op === 'createMany' || op === 'createManyAndReturn') {
      const list = (
        Array.isArray(args.data) ? args.data : [args.data]
      ) as Row[];
      for (const d of list) rows.push({ id: this.nextId(model), ...d });
      return op === 'createMany' ? { count: list.length } : list;
    }
    if (op === 'update' || op === 'delete') {
      const hit = found()[0];
      if (!hit) throw new Error(`${model} record to ${op} not found`);
      if (op === 'update') Object.assign(hit, args.data as Row);
      else rows.splice(rows.indexOf(hit), 1);
      return { ...hit };
    }
    if (op === 'updateMany' || op === 'deleteMany') {
      const hits = found();
      for (const h of hits) {
        if (op === 'updateMany') Object.assign(h, args.data as Row);
        else rows.splice(rows.indexOf(h), 1);
      }
      return { count: hits.length };
    }
    this.unsupported.push(`${model}.${op}()`);
    return null;
  }

  /** Writes that touched an org-B row (by id) or wrote org-B data. */
  orgBWrites(): WriteRecord[] {
    return this.writes.filter(w =>
      JSON.stringify(w.args ?? {}).includes(ORG_B_ID)
    );
  }
}

/** The PrismaClient-shaped proxy over a FakeDb resolved at call time. */
export function fakePrisma(current: () => FakeDb): unknown {
  const client: unknown = new Proxy(
    {},
    {
      get(_t, prop: string | symbol) {
        if (typeof prop !== 'string' || prop === 'then') return undefined;
        if (prop === '$transaction')
          return async (arg: unknown) =>
            typeof arg === 'function'
              ? (arg as (c: unknown) => unknown)(client)
              : Promise.all(arg as unknown[]);
        if (prop === '$queryRaw' || prop === '$queryRawUnsafe')
          return async () => [];
        if (prop === '$executeRaw' || prop === '$executeRawUnsafe')
          return async () => 0;
        if (prop.startsWith('$')) return async () => undefined;
        return new Proxy(
          {},
          {
            get(_m, op: string | symbol) {
              if (typeof op !== 'string' || op === 'then') return undefined;
              return async (args: unknown) => current().run(prop, op, args);
            },
          }
        );
      },
    }
  );
  return client;
}
