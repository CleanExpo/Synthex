/**
 * In-memory Prisma fake for the sweep (the data-layer boundary).
 *
 * Mirrors the J8 fake (tests/eval/jev/families/j8.jev.test.ts): any model
 * name is a table, rows are plain objects, writes are atomic within a call.
 * Adds what the sweep's entry points use: equals/mode-insensitive, gte/gt,
 * not, AND, nested relation-less selects (select/include are ignored and the
 * whole row is returned), upsert, delete(Many), $transaction (callback and
 * array forms) and a programmable $queryRaw. `failOn` makes chosen models
 * reject, for read-failure cases.
 *
 * Use: jest.mock('@/lib/prisma', () => require('./lib/fake-db').prismaModule());
 */
type Row = Record<string, unknown>;
type Where = Record<string, unknown>;

interface DbState {
  tables: Record<string, Row[]>;
  /** Model names whose every call rejects (data layer down for that model). */
  failOn: Set<string>;
  /** Rows returned by $queryRaw (welcome-sequence reads users this way). */
  queryRaw: (sql: string) => Row[];
  seq: number;
}

// On globalThis: a route loaded through jest.isolateModules gets its own copy
// of this module, and every copy must see the one store the test seeds.
const g = globalThis as { __sweepDb?: DbState };
export const db: DbState = (g.__sweepDb ??= {
  tables: {},
  failOn: new Set(),
  queryRaw: () => [],
  seq: 0,
});

export function resetDb(): void {
  db.tables = {};
  db.failOn = new Set();
  db.queryRaw = () => [];
  db.seq = 0;
}

export function table(name: string): Row[] {
  return (db.tables[name] ??= []);
}

const isOp = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !(v instanceof Date) && !Array.isArray(v);

const norm = (v: unknown) => (v instanceof Date ? v.getTime() : v);

function eq(a: unknown, b: unknown, insensitive: boolean): boolean {
  if (insensitive && typeof a === 'string' && typeof b === 'string')
    return a.toLowerCase() === b.toLowerCase();
  return norm(a ?? null) === norm(b ?? null);
}

export function matches(row: Row, where: Where | undefined): boolean {
  if (!where) return true;
  for (const [key, cond] of Object.entries(where)) {
    if (cond === undefined) continue;
    if (key === 'OR') {
      if (!(cond as Where[]).some(w => matches(row, w))) return false;
      continue;
    }
    if (key === 'AND') {
      const all = Array.isArray(cond) ? cond : [cond];
      if (!all.every(w => matches(row, w as Where))) return false;
      continue;
    }
    if (key === 'NOT') {
      if (matches(row, cond as Where)) return false;
      continue;
    }
    const v = row[key];
    if (!isOp(cond)) {
      if (!eq(v, cond, false)) return false;
      continue;
    }
    const ops = Object.keys(cond);
    const known = [
      'equals',
      'mode',
      'in',
      'notIn',
      'not',
      'gte',
      'gt',
      'lte',
      'lt',
      'contains',
      'startsWith',
      'path',
    ];
    if (!ops.some(o => known.includes(o))) {
      // A nested relation filter or JSON object compare: compare as a sub-where
      // against an embedded object, otherwise do not match.
      if (isOp(v)) {
        if (!matches(v as Row, cond as Where)) return false;
        continue;
      }
      return false;
    }
    const ci = cond.mode === 'insensitive';
    for (const [op, arg] of Object.entries(cond)) {
      if (arg === undefined) continue;
      const nv = norm(v);
      const na = norm(arg);
      if (op === 'equals' && !eq(v, arg, ci)) return false;
      if (op === 'in' && !(arg as unknown[]).some(x => eq(v, x, ci)))
        return false;
      if (op === 'notIn' && (arg as unknown[]).some(x => eq(v, x, ci)))
        return false;
      if (op === 'not') {
        if (isOp(arg)) {
          if (matches({ [key]: v }, { [key]: arg })) return false;
        } else if (eq(v, arg, ci)) return false;
      }
      if (op === 'gte' && !(v != null && (nv as number) >= (na as number)))
        return false;
      if (op === 'gt' && !(v != null && (nv as number) > (na as number)))
        return false;
      if (op === 'lte' && !(v != null && (nv as number) <= (na as number)))
        return false;
      if (op === 'lt' && !(v != null && (nv as number) < (na as number)))
        return false;
      if (
        op === 'contains' &&
        !(typeof v === 'string' && v.includes(String(arg)))
      )
        return false;
      if (
        op === 'startsWith' &&
        !(typeof v === 'string' && v.startsWith(String(arg)))
      )
        return false;
    }
  }
  return true;
}

function apply(row: Row, data: Row): void {
  for (const [k, v] of Object.entries(data)) {
    if (v === undefined) continue;
    if (isOp(v) && 'increment' in v)
      row[k] = ((row[k] as number) ?? 0) + (v.increment as number);
    else if (isOp(v) && 'decrement' in v)
      row[k] = ((row[k] as number) ?? 0) - (v.decrement as number);
    else if (isOp(v) && 'set' in v) row[k] = v.set;
    else if (isOp(v) && ('connect' in v || 'create' in v)) continue;
    else row[k] = v;
  }
  row.updatedAt = new Date();
}

const clone = <T>(r: T): T => (r ? ({ ...(r as object) } as T) : r);

function model(name: string) {
  const rows = () => table(name);
  const guard = () => {
    if (db.failOn.has(name) || db.failOn.has('*'))
      return Promise.reject(new Error(`sweep: ${name} unavailable`));
    return undefined;
  };
  const sorted = (a: { where?: Where; take?: number; skip?: number }) =>
    rows()
      .filter(r => matches(r, a.where))
      .slice(a.skip ?? 0, (a.skip ?? 0) + (a.take ?? Infinity));
  return {
    async findMany(a: { where?: Where; take?: number; skip?: number } = {}) {
      await guard();
      return sorted(a).map(clone);
    },
    async findFirst(a: { where?: Where } = {}) {
      await guard();
      return clone(rows().find(r => matches(r, a.where)) ?? null);
    },
    async findUnique(a: { where: Where }) {
      await guard();
      return clone(rows().find(r => matches(r, a.where)) ?? null);
    },
    async findFirstOrThrow(a: { where?: Where } = {}) {
      await guard();
      const r = rows().find(x => matches(x, a.where));
      if (!r) throw new Error(`${name}: not found`);
      return clone(r);
    },
    async findUniqueOrThrow(a: { where: Where }) {
      await guard();
      const r = rows().find(x => matches(x, a.where));
      if (!r) throw new Error(`${name}: not found`);
      return clone(r);
    },
    async count(a: { where?: Where } = {}) {
      await guard();
      return rows().filter(r => matches(r, a.where)).length;
    },
    async aggregate() {
      await guard();
      return { _count: rows().length, _sum: {}, _avg: {} };
    },
    async groupBy() {
      await guard();
      return [];
    },
    async create(a: { data: Row }) {
      await guard();
      db.seq += 1;
      const row: Row = {
        id: `${name}-${db.seq}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      apply(row, a.data);
      rows().push(row);
      return clone(row);
    },
    async createMany(a: { data: Row[] }) {
      await guard();
      for (const d of a.data) {
        db.seq += 1;
        rows().push({ id: `${name}-${db.seq}`, ...d });
      }
      return { count: a.data.length };
    },
    async update(a: { where: Where; data: Row }) {
      await guard();
      const row = rows().find(r => matches(r, a.where));
      if (!row) throw new Error(`${name}.update: no row`);
      apply(row, a.data);
      return clone(row);
    },
    async updateMany(a: { where?: Where; data: Row }) {
      await guard();
      const hit = rows().filter(r => matches(r, a.where));
      hit.forEach(r => apply(r, a.data));
      return { count: hit.length };
    },
    async upsert(a: { where: Where; create: Row; update: Row }) {
      await guard();
      const row = rows().find(r => matches(r, a.where));
      if (row) {
        apply(row, a.update);
        return clone(row);
      }
      db.seq += 1;
      const created: Row = { id: `${name}-${db.seq}`, createdAt: new Date() };
      apply(created, a.create);
      rows().push(created);
      return clone(created);
    },
    async delete(a: { where: Where }) {
      await guard();
      const i = rows().findIndex(r => matches(r, a.where));
      if (i < 0) throw new Error(`${name}.delete: no row`);
      return rows().splice(i, 1)[0];
    },
    async deleteMany(a: { where?: Where } = {}) {
      await guard();
      const keep = rows().filter(r => !matches(r, a.where));
      const count = rows().length - keep.length;
      db.tables[name] = keep;
      return { count };
    },
  };
}

const models: Record<string, ReturnType<typeof model>> = {};

export const fakePrisma: Record<string, unknown> = new Proxy(
  {},
  {
    get(_t, prop: string) {
      if (prop === '$transaction')
        return async (arg: unknown) =>
          typeof arg === 'function'
            ? (arg as (tx: unknown) => unknown)(fakePrisma)
            : Promise.all(arg as Promise<unknown>[]);
      if (prop === '$queryRaw' || prop === '$queryRawUnsafe')
        return async (strings: TemplateStringsArray | string) =>
          db.queryRaw(
            typeof strings === 'string' ? strings : strings.join('?')
          );
      if (prop === '$executeRaw' || prop === '$executeRawUnsafe')
        return async () => 0;
      if (prop === '$connect' || prop === '$disconnect')
        return async () => undefined;
      if (prop === 'then') return undefined;
      if (typeof prop !== 'string' || prop.startsWith('$')) return undefined;
      return (models[prop] ??= model(prop));
    },
  }
);

export function prismaModule() {
  return { __esModule: true, default: fakePrisma, prisma: fakePrisma };
}
