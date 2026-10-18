/**
 * Recording Prisma stand-in for J12 (the prisma boundary, as the unit tests
 * mock it). Every `prisma.<model>.<method>(args)` call is recorded; the result
 * comes from a per-case handler or a neutral default (null / [] / 0 / {}).
 */
type Handler = (args: unknown) => unknown;

export interface DbCall {
  model: string;
  method: string;
  args: unknown;
}

interface Db {
  calls: DbCall[];
  handlers: Map<string, Handler>;
  reset(handlers?: Record<string, Handler>): void;
  callsTo(model: string, method?: string): DbCall[];
}

// One shared instance on globalThis: invokeRoute loads routes under
// jest.isolateModules, which gives the prisma mock a fresh copy of this module.
const g = globalThis as { __j12db?: Db };
export const db: Db = (g.__j12db ??= {
  calls: [] as DbCall[],
  handlers: new Map<string, Handler>(),
  /** Reset recorded calls and handlers; then set `model.method` handlers. */
  reset(handlers: Record<string, Handler> = {}) {
    this.calls = [];
    this.handlers = new Map(Object.entries(handlers));
  },
  callsTo(model: string, method?: string): DbCall[] {
    return this.calls.filter(
      c => c.model === model && (!method || c.method === method)
    );
  },
});

function defaultFor(method: string): unknown {
  if (method === 'findMany' || method === 'groupBy') return [];
  if (method === 'count') return 0;
  if (method.startsWith('find')) return null;
  if (method === 'aggregate')
    return { _sum: {}, _count: {}, _avg: {}, _max: {}, _min: {} };
  if (method.endsWith('Many')) return { count: 0 };
  return {};
}

function modelProxy(model: string): unknown {
  return new Proxy(
    {},
    {
      get(_t, method: string | symbol) {
        if (typeof method !== 'string' || method === 'then') return undefined;
        return async (args: unknown) => {
          db.calls.push({ model, method, args });
          const h = db.handlers.get(`${model}.${method}`);
          return h ? h(args) : defaultFor(method);
        };
      },
    }
  );
}

const models = new Map<string, unknown>();

export const prismaStub: unknown = new Proxy(
  {},
  {
    get(_t, key: string | symbol) {
      if (typeof key !== 'string' || key === 'then') return undefined;
      if (key === '$transaction')
        return async (arg: unknown) =>
          typeof arg === 'function'
            ? (arg as (tx: unknown) => unknown)(prismaStub)
            : Promise.all(arg as unknown[]);
      if (key === '$queryRaw' || key === '$queryRawUnsafe')
        return async (...args: unknown[]) => {
          db.calls.push({ model: '$raw', method: key, args });
          const h = db.handlers.get(`$raw.${key}`);
          return h ? h(args) : [];
        };
      if (key === '$executeRaw' || key === '$executeRawUnsafe')
        return async (...args: unknown[]) => {
          db.calls.push({ model: '$raw', method: key, args });
          return 0;
        };
      if (key.startsWith('$')) return async () => undefined;
      if (!models.has(key)) models.set(key, modelProxy(key));
      return models.get(key);
    },
  }
);
