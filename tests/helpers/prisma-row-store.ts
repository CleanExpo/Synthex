/**
 * A strict stand-in for five Prisma models (`user`, `organization`,
 * `businessOwnership`, `teamMember`, `userRole`), for tests that run the real
 * access and approval rules above the database client (SYN-1412).
 *
 * A test lists the rows that exist; the store answers `findUnique`, `findFirst`
 * and `findMany` by applying the query's own `where` and `select` to those rows.
 * It never holds a prepared answer, so a rule that asks the wrong question gets
 * the wrong rows back, decoys included.
 *
 * What it knows, and nothing else:
 *   - `where`: equality on a column (string, number, boolean, null, Date); a
 *     compound unique key on `findUnique`; `some` on a to-many relation.
 *   - `select`: columns; a relation with its own `select`, and for a to-many
 *     relation its own `where`.
 *
 * Anything else is a usage error: an unknown model, method, argument, column or
 * `where` shape, a query with no `where`, and any filter whose value is
 * `undefined`. Real Prisma drops an `undefined` filter and matches every row, so
 * the store refuses it loudly instead of quietly being stricter. A usage error
 * is thrown synchronously at the call AND kept in `usageErrors`, because the
 * code under test may catch what it is thrown; a test file asserts the list is
 * empty after every test. Its message says the shape "is not defined in the row
 * store" on purpose: a result reader that separates set-up faults from failed
 * assertions must read it as a set-up fault.
 *
 * A planted failure (`fail`) rejects the matching read with exactly the error it
 * was given, the way a failed database read does. `hold` keeps matching reads
 * pending until released. Every read call is counted per model in `reads`,
 * including reads that were planted to fail.
 */

export type RowStoreModel =
  | 'user'
  | 'organization'
  | 'businessOwnership'
  | 'teamMember'
  | 'userRole';

/** `role` holds the rows `userRole.role` resolves to; it has no delegate. */
export type RowStoreTable = RowStoreModel | 'role';

export type RowStoreMethod = 'findUnique' | 'findFirst' | 'findMany';

export type Row = Record<string, unknown>;

export type RowStoreSeed = Partial<Record<RowStoreTable, Row[]>>;

export interface RowStoreRead {
  model: RowStoreModel;
  method: RowStoreMethod;
  args: unknown;
}

/** Which reads a planted failure or a hold applies to. */
export interface RowStoreTarget {
  model: RowStoreModel;
  method?: RowStoreMethod;
  /** Receives the read's own `where`; return true to apply. */
  where?: (where: Row) => boolean;
}

export interface PrismaRowStore {
  /** The object to hand out as the mocked database client. */
  readonly client: Record<string, unknown>;
  /** Replace every table with these rows. Tables not named become empty. */
  seed(rows: RowStoreSeed): void;
  /** Make every matching read reject with exactly `error`. */
  fail(target: RowStoreTarget, error: unknown): void;
  /** Keep matching reads pending; call the returned function to release them. */
  hold(target: RowStoreTarget): () => void;
  /** Clear rows, planted failures, holds, counters, the read log and usage errors. */
  reset(): void;
  /** Read calls per model since the last reset (a copy). */
  readonly reads: Record<RowStoreModel, number>;
  /** Every read call since the last reset, in call order (a copy). */
  readonly calls: RowStoreRead[];
  /** Every usage error since the last reset (a copy). */
  readonly usageErrors: PrismaRowStoreError[];
}

export class PrismaRowStoreError extends Error {
  constructor(detail: string) {
    super(
      `prisma-row-store: ${detail}. This shape is not defined in the row store.`
    );
    this.name = 'PrismaRowStoreError';
  }
}

interface RelationDef {
  table: RowStoreTable;
  many: boolean;
  /** Column on this table. */
  from: string;
  /** Column on the related table. */
  to: string;
}

interface TableDef {
  columns: string[];
  /** Columns every seeded row must state; the rules under test read them. */
  required: string[];
  unique: string[];
  /** Compound unique keys, by the name Prisma gives them. */
  compound: Record<string, string[]>;
  relations: Record<string, RelationDef>;
}

const TABLES: Record<RowStoreTable, TableDef> = {
  user: {
    columns: [
      'id',
      'email',
      'name',
      'organizationId',
      'activeOrganizationId',
      'isMultiBusinessOwner',
    ],
    required: ['id', 'organizationId', 'isMultiBusinessOwner'],
    unique: ['id', 'email'],
    compound: {},
    relations: {},
  },
  organization: {
    columns: ['id', 'name', 'slug', 'website', 'settings', 'parentOrgId'],
    required: ['id', 'name', 'slug', 'parentOrgId'],
    unique: ['id', 'slug'],
    compound: {},
    relations: {
      users: { table: 'user', many: true, from: 'id', to: 'organizationId' },
    },
  },
  businessOwnership: {
    columns: ['id', 'ownerId', 'organizationId', 'isActive'],
    required: ['ownerId', 'organizationId', 'isActive'],
    unique: ['id'],
    compound: { ownerId_organizationId: ['ownerId', 'organizationId'] },
    relations: {},
  },
  teamMember: {
    columns: ['id', 'userId', 'organizationId', 'role', 'acceptedAt'],
    required: ['userId', 'organizationId', 'role', 'acceptedAt'],
    unique: ['id'],
    compound: { team_member_user_org: ['userId', 'organizationId'] },
    relations: {},
  },
  userRole: {
    columns: ['id', 'userId', 'roleId', 'expiresAt'],
    required: ['userId', 'roleId', 'expiresAt'],
    unique: ['id'],
    compound: { userId_roleId: ['userId', 'roleId'] },
    relations: {
      role: { table: 'role', many: false, from: 'roleId', to: 'id' },
    },
  },
  role: {
    columns: ['id', 'name', 'permissions', 'organizationId'],
    required: ['id', 'name', 'permissions', 'organizationId'],
    unique: ['id'],
    compound: { organizationId_name: ['organizationId', 'name'] },
    relations: {},
  },
};

const MODELS: RowStoreModel[] = [
  'user',
  'organization',
  'businessOwnership',
  'teamMember',
  'userRole',
];

const METHODS: RowStoreMethod[] = ['findUnique', 'findFirst', 'findMany'];

/** Keys a test runner or a promise check may probe on any object. */
const PROBED = new Set([
  'then',
  'toJSON',
  'asymmetricMatch',
  '$$typeof',
  'nodeType',
  'tagName',
]);

function isRecord(value: unknown): value is Row {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    !(value instanceof Date)
  );
}

function isFilterValue(value: unknown): boolean {
  return (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    value instanceof Date
  );
}

function same(held: unknown, asked: unknown): boolean {
  if (held instanceof Date && asked instanceof Date) {
    return held.getTime() === asked.getTime();
  }
  return held === asked;
}

function copyValue(value: unknown): unknown {
  return Array.isArray(value) ? [...value] : value;
}

function emptyTables(): Record<RowStoreTable, Row[]> {
  return {
    user: [],
    organization: [],
    businessOwnership: [],
    teamMember: [],
    userRole: [],
    role: [],
  };
}

function zeroReads(): Record<RowStoreModel, number> {
  return {
    user: 0,
    organization: 0,
    businessOwnership: 0,
    teamMember: 0,
    userRole: 0,
  };
}

interface Interceptor {
  target: RowStoreTarget;
  wait: () => Promise<void>;
}

/**
 * @param extraDelegates Models the store does not stand in for, exposed on the
 *   client exactly as given (for example plain mocks of campaign-data models).
 */
export function createPrismaRowStore(
  extraDelegates: Record<string, unknown> = {}
): PrismaRowStore {
  let tables = emptyTables();
  let interceptors: Interceptor[] = [];
  let reads = zeroReads();
  let calls: RowStoreRead[] = [];
  let usageErrors: PrismaRowStoreError[] = [];

  const misuse: (detail: string) => never = detail => {
    const error = new PrismaRowStoreError(detail);
    usageErrors.push(error);
    throw error;
  };

  /** Refuse every `where` shape the store does not know, whatever rows exist. */
  const checkWhere = (
    table: RowStoreTable,
    where: unknown,
    path: string,
    uniqueKeys: boolean
  ): Row => {
    if (!isRecord(where)) return misuse(`${path} must be an object`);
    const def = TABLES[table];
    let keysFound = 0;
    for (const [key, value] of Object.entries(where)) {
      const at = `${path}.${key}`;
      if (value === undefined) {
        misuse(
          `${at} is undefined; Prisma would drop the filter and match every row`
        );
      }
      if (def.columns.includes(key)) {
        if (!isFilterValue(value)) {
          misuse(`${at}: only equality on a column is known`);
        }
        if (uniqueKeys && def.unique.includes(key)) {
          if (value === null) misuse(`${at}: a unique key cannot be null`);
          keysFound += 1;
        }
        continue;
      }
      if (uniqueKeys && key in def.compound) {
        const fields = def.compound[key];
        if (
          !isRecord(value) ||
          Object.keys(value).length !== fields.length ||
          !fields.every(field => field in value)
        ) {
          misuse(`${at} must state exactly ${fields.join(' and ')}`);
        }
        for (const field of fields) {
          const part = (value as Row)[field];
          if (part === undefined || part === null || !isFilterValue(part)) {
            misuse(`${at}.${field} must be a value, not ${String(part)}`);
          }
        }
        keysFound += 1;
        continue;
      }
      const relation = def.relations[key];
      if (relation?.many) {
        if (
          !isRecord(value) ||
          Object.keys(value).length !== 1 ||
          !('some' in value)
        ) {
          misuse(`${at}: only a "some" filter is known on a to-many relation`);
        }
        checkWhere(relation.table, (value as Row).some, `${at}.some`, false);
        continue;
      }
      misuse(`${at}: unknown where field or shape for ${table}`);
    }
    if (uniqueKeys && keysFound === 0) {
      misuse(`${path} must hold a unique key of ${table}`);
    }
    return where;
  };

  const related = (relation: RelationDef, row: Row): Row[] =>
    tables[relation.table].filter(other =>
      same(other[relation.to], row[relation.from])
    );

  const matches = (table: RowStoreTable, row: Row, where: Row): boolean => {
    const def = TABLES[table];
    return Object.entries(where).every(([key, value]) => {
      if (def.columns.includes(key)) return same(row[key], value);
      if (key in def.compound) {
        return def.compound[key].every(field =>
          same(row[field], (value as Row)[field])
        );
      }
      const relation = def.relations[key];
      return related(relation, row).some(other =>
        matches(relation.table, other, (value as Row).some as Row)
      );
    });
  };

  const checkSelect = (
    table: RowStoreTable,
    select: unknown,
    path: string
  ): Row => {
    if (!isRecord(select) || Object.keys(select).length === 0) {
      return misuse(`${path} must be an object that selects something`);
    }
    const def = TABLES[table];
    for (const [key, value] of Object.entries(select)) {
      const at = `${path}.${key}`;
      if (def.columns.includes(key)) {
        if (typeof value !== 'boolean') misuse(`${at} must be true or false`);
        continue;
      }
      const relation = def.relations[key];
      if (!relation) misuse(`${at}: unknown select field for ${table}`);
      if (value === true) continue;
      if (!isRecord(value)) misuse(`${at} must be true or an object`);
      const known = relation.many ? ['where', 'select'] : ['select'];
      for (const [option, optionValue] of Object.entries(value as Row)) {
        if (!known.includes(option)) {
          misuse(`${at}.${option}: unknown option on a selected relation`);
        }
        if (option === 'where') {
          checkWhere(relation.table, optionValue, `${at}.where`, false);
        } else if (optionValue !== undefined) {
          checkSelect(relation.table, optionValue, `${at}.select`);
        }
      }
    }
    return select;
  };

  const project = (table: RowStoreTable, row: Row, select?: Row): Row => {
    const def = TABLES[table];
    const out: Row = {};
    if (select === undefined) {
      for (const column of def.columns) out[column] = copyValue(row[column]);
      return out;
    }
    for (const [key, value] of Object.entries(select)) {
      if (def.columns.includes(key)) {
        if (value === true) out[key] = copyValue(row[key]);
        continue;
      }
      const relation = def.relations[key];
      const options: Row = isRecord(value) ? value : {};
      const inner = options.select as Row | undefined;
      const rows = related(relation, row)
        .filter(
          other =>
            options.where === undefined ||
            matches(relation.table, other, options.where as Row)
        )
        .map(other => project(relation.table, other, inner));
      out[key] = relation.many ? rows : (rows[0] ?? null);
    }
    return out;
  };

  const read = (
    model: RowStoreModel,
    method: RowStoreMethod,
    args: unknown
  ): Promise<unknown> => {
    reads[model] += 1;
    calls.push({ model, method, args });
    const at = `${model}.${method}`;
    if (!isRecord(args)) return misuse(`${at} needs an argument object`);
    for (const key of Object.keys(args)) {
      if (key !== 'where' && key !== 'select') {
        misuse(`${at}: unknown argument "${key}"`);
      }
    }
    // The whole query is checked before any planted failure applies, so a shape
    // the store does not know is never hidden behind one.
    const where = checkWhere(
      model,
      args.where,
      `${at}.where`,
      method === 'findUnique'
    );
    const select =
      args.select === undefined
        ? undefined
        : checkSelect(model, args.select, `${at}.select`);
    const hits = tables[model].filter(row => matches(model, row, where));
    if (method === 'findUnique' && hits.length > 1) {
      misuse(`${at}: ${hits.length} seeded rows share one unique key`);
    }
    const found = hits.map(row => project(model, row, select));
    const answer = method === 'findMany' ? found : (found[0] ?? null);
    const waits = interceptors.filter(
      ({ target }) =>
        target.model === model &&
        (target.method === undefined || target.method === method) &&
        (target.where === undefined || target.where(where))
    );
    return (async () => {
      for (const { wait } of waits) await wait();
      return answer;
    })();
  };

  const strict = (name: string, target: Record<string, unknown>) =>
    new Proxy(target, {
      get(held, key) {
        if (typeof key === 'symbol') return Reflect.get(held, key);
        if (key in held) return held[key];
        if (PROBED.has(key)) return undefined;
        return misuse(`unknown ${name} "${key}"`);
      },
    });

  const delegates: Record<string, unknown> = { ...extraDelegates };
  for (const model of MODELS) {
    if (model in extraDelegates) {
      throw new PrismaRowStoreError(
        `"${model}" is a model the store stands in for; it cannot be replaced`
      );
    }
    const delegate: Record<string, unknown> = {};
    for (const method of METHODS) {
      delegate[method] = (args: unknown) => read(model, method, args);
    }
    delegates[model] = strict(`method on ${model}`, delegate);
  }
  const client = strict('model', delegates);

  const seed = (rows: RowStoreSeed): void => {
    const next = emptyTables();
    for (const [name, list] of Object.entries(rows)) {
      if (!(name in TABLES)) misuse(`seed: unknown table "${name}"`);
      const table = name as RowStoreTable;
      const def = TABLES[table];
      (list ?? []).forEach((row, index) => {
        const at = `seed.${table}[${index}]`;
        for (const [column, value] of Object.entries(row)) {
          if (!def.columns.includes(column)) {
            misuse(`${at}: unknown column "${column}"`);
          }
          if (value === undefined) misuse(`${at}.${column} is undefined`);
        }
        for (const column of def.required) {
          if (!(column in row)) misuse(`${at} must state "${column}"`);
        }
        const full: Row = {};
        for (const column of def.columns) full[column] = row[column] ?? null;
        if (full.id === null) full.id = `${table}-${index + 1}`;
        next[table].push(full);
      });
      const keys = [
        ...def.unique.map(column => [column]),
        ...Object.values(def.compound),
      ];
      for (const key of keys) {
        const seen = new Set<string>();
        for (const row of next[table]) {
          if (key.some(column => row[column] === null)) continue;
          const value = JSON.stringify(key.map(column => row[column]));
          if (seen.has(value)) {
            misuse(`seed.${table}: two rows share ${key.join('+')} ${value}`);
          }
          seen.add(value);
        }
      }
    }
    tables = next;
  };

  return {
    client,
    seed,
    fail(target, error) {
      interceptors.push({ target, wait: () => Promise.reject(error) });
    },
    hold(target) {
      let release: () => void = () => undefined;
      const gate = new Promise<void>(resolve => {
        release = resolve;
      });
      interceptors.push({ target, wait: () => gate });
      return release;
    },
    reset() {
      tables = emptyTables();
      interceptors = [];
      reads = zeroReads();
      calls = [];
      usageErrors = [];
    },
    get reads() {
      return { ...reads };
    },
    get calls() {
      return [...calls];
    },
    get usageErrors() {
      return [...usageErrors];
    },
  };
}
