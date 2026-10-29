/**
 * In-memory Prisma double for the gate host, where no database exists. Covers what the P6 outcome
 * writer (lib/marketing-agency/outcomes/local-outcome-writer.ts) and performance_get_outcomes use:
 * $transaction(fn), and per model findUnique/findFirst/findMany/upsert/create/update/count with
 * top-level `where` equality (compound unique keys such as organizationId_externalId are
 * flattened), orderBy on one field, take, select. Wired in by prisma-memory-hook.mjs.
 */
import { randomUUID } from 'node:crypto';

const isPlain = v =>
  v !== null &&
  typeof v === 'object' &&
  !Array.isArray(v) &&
  !(v instanceof Date);

/** Flatten compound unique keys ({ a_b: { a, b } }) into plain field equality. */
function flatten(where = {}) {
  const out = {};
  for (const [k, v] of Object.entries(where)) {
    if (isPlain(v) && k.includes('_')) Object.assign(out, flatten(v));
    else out[k] = v;
  }
  return out;
}

const same = (a, b) =>
  a instanceof Date && b instanceof Date
    ? a.getTime() === b.getTime()
    : JSON.stringify(a) === JSON.stringify(b);

function model(defaults) {
  const rows = [];
  const matches = where => {
    const eq = flatten(where);
    return rows.filter(r =>
      Object.entries(eq).every(([k, v]) => same(r[k] ?? null, v))
    );
  };
  const project = (row, select) => {
    if (!row) return null;
    if (!select) return { ...row };
    return Object.fromEntries(
      Object.entries(select)
        .filter(([, on]) => on)
        .map(([k]) => [k, row[k] ?? null])
    );
  };
  const api = {
    async findMany({ where, orderBy, take, select } = {}) {
      let found = matches(where);
      if (orderBy) {
        const [[field, dir]] = Object.entries(orderBy);
        const sign = dir === 'desc' ? -1 : 1;
        found = [...found].sort((a, b) =>
          a[field] > b[field] ? sign : a[field] < b[field] ? -sign : 0
        );
      }
      if (typeof take === 'number') found = found.slice(0, take);
      return found.map(r => project(r, select));
    },
    async findFirst(args = {}) {
      return (await api.findMany({ ...args, take: 1 }))[0] ?? null;
    },
    async findUnique(args) {
      return api.findFirst(args);
    },
    async count({ where } = {}) {
      return matches(where).length;
    },
    async create({ data, select }) {
      const row = {
        id: randomUUID(),
        ...defaults(),
        ...Object.fromEntries(
          Object.entries(data).filter(([, v]) => v !== undefined)
        ),
      };
      rows.push(row);
      return project(row, select);
    },
    async update({ where, data, select }) {
      const row = matches(where)[0];
      if (!row) throw new Error('prisma-memory: update target not found');
      Object.assign(row, data);
      return project(row, select);
    },
    async upsert({ where, create, update, select }) {
      return matches(where)[0]
        ? api.update({ where, data: update, select })
        : api.create({ data: create, select });
    },
  };
  return api;
}

// tsImport gives each call its own module namespace; one shared store per process keeps the writer and the tool on the same rows.
export const prisma = (globalThis.__prismaMemory ??= {
  marketingAgencySignal: model(() => ({ campaignId: null })),
  marketingAgencyOpportunity: model(() => ({})),
  marketingAgencyOutcomeEvent: model(() => ({
    campaignId: null,
    opportunityId: null,
    outcomeMetric: null,
    observedValue: null,
    confidence: null,
    notes: null,
    metadata: null,
    recordedAt: new Date(),
  })),
  async $transaction(fn) {
    return fn(prisma);
  },
});

export default prisma;

export const checkDatabaseHealth = async () => ({
  healthy: true,
  latencyMs: 0,
});
export const getPoolMetrics = () => ({ total: 0, idle: 0, waiting: 0 });
