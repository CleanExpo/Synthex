/**
 * Server pages that read the database must check access first (spec 9.3).
 *
 * The rule: a code file under app/ (outside app/api and route handlers) that
 * imports a value from a database client module must call
 * `requireOrganisationPageAccess`, imported from lib/auth/page-access.ts, as a
 * direct statement of every top-level function that uses the client, before
 * that function's first use of it.
 *
 * Static guard: the scanner reads syntax trees with the TypeScript parser. It
 * takes a root directory, so the same code checks the real tree and the planted
 * trees below. Planted trees live in a temporary directory, never under app/.
 *
 * What a violation record means (`{ file, rule, detail }`):
 *   R1  a dynamic import() or require of a client module, or a value import
 *       from @prisma/client: bindings cannot be followed, and a page must not
 *       build its own client.
 *   R2  a use of a client binding that is not directly in the body of a
 *       top-level function (module level, a parameter default, a nested
 *       function or a callback): a nested reader can run before the gate while
 *       sitting below it in the text.
 *   R3  a top-level function uses a client binding without
 *       `await requireOrganisationPageAccess(...)` as a direct statement of its
 *       body before the first use.
 *   R4  the gate that is called was not imported from lib/auth/page-access.ts.
 *   unclassified    a file under app/ whose type is on neither list below.
 *   stale-register  a register entry that is gone or no longer imports a client.
 *
 * Register: the ONLY files allowed to import a client without the gate, each
 * with its reason. Adding an entry to turn a red run green defeats the guard;
 * an entry needs its own access check or a public-by-design reason.
 *
 * Cap: this guard stops growing here. A later finding against it is recorded
 * below as a named limit, not as a new rule, unless it is a kind of gap not
 * already listed.
 *
 * Named limits:
 *   L1  A page that reads through a lib/ service it imports is not seen.
 *   L2  The guard proves the call is present and precedes use in each function,
 *       not that the queries are bound to the organisation it returned (the
 *       page tests prove that for the two marketing-agency pages).
 *   L3  A lib/ module that exposes the client by wrapping it, not by
 *       re-exporting it, is not derived as a client module.
 *   L4  A server-action file gets the same rule. A redirecting gate does not
 *       suit an action, so its violation message tells the author to register
 *       the file here with its own check.
 *   L5  main requires its checks without requiring the branch to be up to
 *       date, so the real-tree test runs on the pull request's head, not on
 *       the merged tree: two pull requests that are each clean can merge into
 *       a tree that is not, and the first sign is main's unit tests failing
 *       after the merge.
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import * as ts from 'typescript';

// ---------------------------------------------------------------------------
// The scanner
// ---------------------------------------------------------------------------

type Rule = 'R1' | 'R2' | 'R3' | 'R4' | 'unclassified' | 'stale-register';

interface Violation {
  file: string;
  rule: Rule;
  detail: string;
}

type Register = Readonly<Record<string, string>>;

/** Scanned, except app/api/** and files named `route`. */
const CODE_EXTENSIONS = [
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.mts',
  '.cts',
];

/** Closed list of non-code types. A type on neither list is a violation. */
const IGNORED_EXTENSIONS = [
  '.css',
  '.md',
  '.json',
  '.disabled',
  '.txt',
  '.ico',
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.svg',
  '.webp',
  '.avif',
  '.woff',
  '.woff2',
  '.ttf',
  '.otf',
];

/** Ignored whatever their type: Finder writes the first into any folder it opens. */
const IGNORED_NAMES = ['.DS_Store', '.gitkeep'];

const GATE_NAME = 'requireOrganisationPageAccess';
const GATE_MODULE = 'lib/auth/page-access.ts';
const CLIENT_MODULE = 'lib/prisma.ts';
const PRISMA_PACKAGE = '@prisma/client';

/** Closed register: files that import a database client and need not call the gate. */
const REGISTER: Register = {
  'app/bio/[slug]/page.tsx':
    'public by design: a published bio page, read without sign-in',
  'app/card/[slug]/page.tsx':
    'public by design: a published card page, read without sign-in',
  'app/clients/[slug]/page.tsx':
    'public by design: a published client page, read without sign-in',
  'app/sitemap.ts': 'public by design: the sitemap of published pages',
  'app/dashboard/aeo/page.tsx':
    'own check: identifies the user and reads only the effective organisation of that user (spec 9.7: reported, not changed)',
};

type FunctionNode =
  | ts.FunctionDeclaration
  | ts.FunctionExpression
  | ts.ArrowFunction
  | ts.MethodDeclaration
  | ts.GetAccessorDeclaration
  | ts.SetAccessorDeclaration
  | ts.ConstructorDeclaration;

const toPosix = (p: string): string => p.split(path.sep).join('/');

function walk(dir: string, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

function parse(file: string, withParents: boolean): ts.SourceFile {
  const ext = path.extname(file).toLowerCase();
  let kind = ts.ScriptKind.JSX;
  if (ext === '.tsx') kind = ts.ScriptKind.TSX;
  else if (['.ts', '.mts', '.cts'].includes(ext)) kind = ts.ScriptKind.TS;
  return ts.createSourceFile(
    file,
    fs.readFileSync(file, 'utf8'),
    ts.ScriptTarget.Latest,
    withParents,
    kind
  );
}

function isPrismaPackage(specifier: string): boolean {
  return (
    specifier === PRISMA_PACKAGE || specifier.startsWith(`${PRISMA_PACKAGE}/`)
  );
}

/** Local names an import statement binds to values (type-only bindings left out). */
function valueNames(statement: ts.ImportDeclaration): string[] {
  const clause = statement.importClause;
  if (!clause || clause.isTypeOnly) return [];
  const names: string[] = [];
  if (clause.name) names.push(clause.name.text);
  const bindings = clause.namedBindings;
  if (bindings && ts.isNamespaceImport(bindings))
    names.push(bindings.name.text);
  if (bindings && ts.isNamedImports(bindings)) {
    for (const element of bindings.elements) {
      if (!element.isTypeOnly) names.push(element.name.text);
    }
  }
  return names;
}

function isFunctionNode(node: ts.Node): node is FunctionNode {
  return (
    ts.isFunctionDeclaration(node) ||
    ts.isFunctionExpression(node) ||
    ts.isArrowFunction(node) ||
    ts.isMethodDeclaration(node) ||
    ts.isGetAccessorDeclaration(node) ||
    ts.isSetAccessorDeclaration(node) ||
    ts.isConstructorDeclaration(node)
  );
}

/** A function declaration, a top-level const initialised with a function, or the default export. */
function isTopLevelFunction(fn: FunctionNode): boolean {
  if (ts.isFunctionDeclaration(fn)) return ts.isSourceFile(fn.parent);
  if (!ts.isArrowFunction(fn) && !ts.isFunctionExpression(fn)) return false;
  const parent = fn.parent;
  if (ts.isExportAssignment(parent)) return !parent.isExportEquals;
  return (
    ts.isVariableDeclaration(parent) &&
    parent.initializer === fn &&
    ts.isVariableDeclarationList(parent.parent) &&
    (parent.parent.flags & ts.NodeFlags.Const) !== 0 &&
    ts.isVariableStatement(parent.parent.parent) &&
    ts.isSourceFile(parent.parent.parent.parent)
  );
}

function functionLabel(fn: FunctionNode): string {
  if (ts.isFunctionDeclaration(fn) && fn.name) return fn.name.text;
  if (ts.isVariableDeclaration(fn.parent) && ts.isIdentifier(fn.parent.name)) {
    return fn.parent.name.text;
  }
  return 'the default export';
}

/** True when the identifier reads a binding, not when it names a property, a declaration or a type. */
function isValueReference(id: ts.Identifier): boolean {
  const parent: ts.Node & { name?: ts.Node; propertyName?: ts.Node } =
    id.parent;
  if (parent.propertyName === id) return false;
  if (parent.name === id && !ts.isShorthandPropertyAssignment(parent)) {
    return false;
  }
  for (let node: ts.Node | undefined = parent; node; node = node.parent) {
    if (ts.isTypeNode(node)) return false;
  }
  return true;
}

/** `await <gate>(...)` alone, or as a variable initialiser. Returns the name called. */
function gateStatementCallee(
  statement: ts.Statement,
  accepted: ReadonlySet<string>
): string | null {
  const callee = (expression: ts.Expression | undefined): string | null => {
    if (!expression || !ts.isAwaitExpression(expression)) return null;
    const call = expression.expression;
    if (!ts.isCallExpression(call) || !ts.isIdentifier(call.expression)) {
      return null;
    }
    return accepted.has(call.expression.text) ? call.expression.text : null;
  };
  if (ts.isExpressionStatement(statement)) return callee(statement.expression);
  if (ts.isVariableStatement(statement)) {
    for (const declaration of statement.declarationList.declarations) {
      const name = callee(declaration.initializer);
      if (name) return name;
    }
  }
  return null;
}

function isServerActionFile(sf: ts.SourceFile): boolean {
  for (const statement of sf.statements) {
    if (
      !ts.isExpressionStatement(statement) ||
      !ts.isStringLiteral(statement.expression)
    ) {
      return false;
    }
    if (statement.expression.text === 'use server') return true;
  }
  return false;
}

/**
 * Scans `<root>/app` and returns one record per violation, sorted. An empty
 * list is a clean tree.
 */
function scanAppTree(root: string, register: Register): Violation[] {
  const violations: Violation[] = [];
  const clientFile = path.join(root, CLIENT_MODULE);
  const gateFile = path.join(root, GATE_MODULE);

  // Import specifier -> file: the `@/` alias, relative paths, code extensions, `/index`.
  const resolved = new Map<string, string | null>();
  const resolveImport = (
    specifier: string,
    fromFile: string
  ): string | null => {
    let base: string;
    if (specifier.startsWith('@/')) base = path.join(root, specifier.slice(2));
    else if (specifier.startsWith('.')) {
      base = path.resolve(path.dirname(fromFile), specifier);
    } else return null;
    const known = resolved.get(base);
    if (known !== undefined) return known;
    const candidates = [
      base,
      ...CODE_EXTENSIONS.map(ext => base + ext),
      ...CODE_EXTENSIONS.map(ext => path.join(base, `index${ext}`)),
    ];
    const hit =
      candidates.find(c => fs.existsSync(c) && fs.statSync(c).isFile()) ?? null;
    resolved.set(base, hit);
    return hit;
  };

  // A client module is lib/prisma.ts, or a file that re-exports from a client
  // module or exports a binding it imported from one. Asked recursively and
  // remembered, so a barrel anywhere is covered without being named.
  const remembered = new Map<string, boolean>();
  const visiting = new Set<string>();
  let cycleSeen = false;
  const exposesClient = (file: string): boolean => {
    const sf = parse(file, false);
    const exportedLocals = new Set<string>();
    for (const statement of sf.statements) {
      if (ts.isExportDeclaration(statement)) {
        if (statement.isTypeOnly) continue;
        const clause = statement.exportClause;
        const elements =
          clause && ts.isNamedExports(clause) ? clause.elements : undefined;
        if (statement.moduleSpecifier) {
          if (!ts.isStringLiteral(statement.moduleSpecifier)) continue;
          if (elements && elements.every(e => e.isTypeOnly)) continue;
          const target = resolveImport(statement.moduleSpecifier.text, file);
          if (target && isClientModule(target)) return true;
        } else if (elements) {
          for (const element of elements) {
            if (!element.isTypeOnly) {
              exportedLocals.add((element.propertyName ?? element.name).text);
            }
          }
        }
      } else if (ts.isExportAssignment(statement)) {
        if (ts.isIdentifier(statement.expression)) {
          exportedLocals.add(statement.expression.text);
        }
      } else if (
        ts.isVariableStatement(statement) &&
        statement.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword)
      ) {
        for (const declaration of statement.declarationList.declarations) {
          const init = declaration.initializer;
          if (init && ts.isIdentifier(init)) exportedLocals.add(init.text);
        }
      }
    }
    if (exportedLocals.size === 0) return false;
    for (const statement of sf.statements) {
      if (
        !ts.isImportDeclaration(statement) ||
        !ts.isStringLiteral(statement.moduleSpecifier) ||
        !valueNames(statement).some(name => exportedLocals.has(name))
      ) {
        continue;
      }
      const target = resolveImport(statement.moduleSpecifier.text, file);
      if (target && isClientModule(target)) return true;
    }
    return false;
  };
  function isClientModule(file: string): boolean {
    if (file === clientFile) return true;
    const known = remembered.get(file);
    if (known !== undefined) return known;
    if (visiting.has(file)) {
      cycleSeen = true;
      return false;
    }
    visiting.add(file);
    const result = exposesClient(file);
    visiting.delete(file);
    // A "no" reached through an unfinished cycle is only final for the outermost question.
    if (result || !cycleSeen || visiting.size === 0) {
      remembered.set(file, result);
    }
    if (visiting.size === 0) cycleSeen = false;
    return result;
  }

  const triggeredFiles = new Set<string>();
  const registered = new Set(Object.keys(register));

  for (const file of walk(path.join(root, 'app'))) {
    const rel = toPosix(path.relative(root, file));
    const name = path.basename(file);
    const ext = path.extname(file).toLowerCase();
    if (IGNORED_NAMES.includes(name) || IGNORED_EXTENSIONS.includes(ext)) {
      continue;
    }
    if (!CODE_EXTENSIONS.includes(ext)) {
      violations.push({
        file: rel,
        rule: 'unclassified',
        detail: `file type "${ext || name}" is on neither the code list nor the ignored list of this guard; add it to one of them`,
      });
      continue;
    }
    if (rel.startsWith('app/api/') || path.basename(file, ext) === 'route') {
      continue;
    }

    // Facts first, rules after: what triggers a file is read from its imports
    // alone, so no rule below can change whether a register entry is stale.
    const sf = parse(file, true);
    const clientNames = new Set<string>();
    const gateNames = new Set<string>();
    const loads: string[] = [];
    for (const statement of sf.statements) {
      if (
        !ts.isImportDeclaration(statement) ||
        !ts.isStringLiteral(statement.moduleSpecifier)
      ) {
        continue;
      }
      const specifier = statement.moduleSpecifier.text;
      const names = valueNames(statement);
      if (names.length === 0) continue;
      if (isPrismaPackage(specifier)) {
        loads.push(
          `imports a value from "${specifier}"; a page must not build its own client (a type-only import is fine)`
        );
        continue;
      }
      const target = resolveImport(specifier, file);
      if (!target) continue;
      if (isClientModule(target)) names.forEach(n => clientNames.add(n));
      const bindings = statement.importClause?.namedBindings;
      if (target === gateFile && bindings && ts.isNamedImports(bindings)) {
        for (const element of bindings.elements) {
          if (
            !element.isTypeOnly &&
            (element.propertyName ?? element.name).text === GATE_NAME
          ) {
            gateNames.add(element.name.text);
          }
        }
      }
    }

    const misplaced: string[] = [];
    const firstUse = new Map<FunctionNode, { name: string; start: number }>();
    let callsGateByName = false;
    const dynamicLoad = (how: string, specifier: string): void => {
      const target = resolveImport(specifier, file);
      if (isPrismaPackage(specifier) || (target && isClientModule(target))) {
        loads.push(
          `loads "${specifier}" with ${how}; bindings from it cannot be followed, so import the client statically`
        );
      }
    };
    const visit = (node: ts.Node): void => {
      if (ts.isCallExpression(node)) {
        const callee = node.expression;
        const arg = node.arguments[0];
        if (arg && ts.isStringLiteralLike(arg)) {
          if (callee.kind === ts.SyntaxKind.ImportKeyword) {
            dynamicLoad('a dynamic import()', arg.text);
          } else if (ts.isIdentifier(callee) && callee.text === 'require') {
            dynamicLoad('require()', arg.text);
          }
        }
        if (ts.isIdentifier(callee) && callee.text === GATE_NAME) {
          callsGateByName = true;
        }
      }
      if (
        ts.isImportEqualsDeclaration(node) &&
        !node.isTypeOnly &&
        ts.isExternalModuleReference(node.moduleReference) &&
        ts.isStringLiteralLike(node.moduleReference.expression)
      ) {
        dynamicLoad('import = require()', node.moduleReference.expression.text);
      }
      if (
        ts.isIdentifier(node) &&
        clientNames.has(node.text) &&
        isValueReference(node)
      ) {
        let fn: FunctionNode | undefined;
        let inParameter = false;
        for (let up: ts.Node | undefined = node.parent; up; up = up.parent) {
          if (ts.isParameter(up)) inParameter = true;
          if (isFunctionNode(up)) {
            fn = up;
            break;
          }
        }
        const where = !fn
          ? 'at module level'
          : inParameter
            ? 'in a parameter default'
            : !isTopLevelFunction(fn)
              ? 'inside a nested function or callback'
              : null;
        if (where) {
          misplaced.push(
            `uses the database client binding "${node.text}" ${where}; write the query directly in the body of a gated top-level function (a function declaration, a top-level const initialised with a function, or the default export), or move the read to lib/`
          );
        } else if (fn) {
          const start = node.getStart(sf);
          const seen = firstUse.get(fn);
          if (!seen || start < seen.start) {
            firstUse.set(fn, { name: node.text, start });
          }
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);

    if (clientNames.size === 0 && loads.length === 0) continue;
    triggeredFiles.add(rel);
    if (registered.has(rel)) continue;

    const action = isServerActionFile(sf)
      ? '. This is a server-action file ("use server"): a redirecting gate does not suit an action, so register the file in this guard with its own check and the reason'
      : '';
    const report = (rule: Rule, detail: string): void => {
      violations.push({ file: rel, rule, detail: detail + action });
    };

    // R1: a load whose bindings cannot be followed, or a client of the page's own.
    for (const detail of loads) report('R1', detail);

    // R2: every use sits directly in the body of a top-level function.
    for (const detail of misplaced) report('R2', detail);

    // R3: each such function awaits the gate, as a direct statement of its
    // body, before its first use of a client binding.
    const accepted = new Set([GATE_NAME, ...gateNames]);
    for (const [fn, use] of firstUse) {
      const body = fn.body;
      const gated =
        !!body &&
        ts.isBlock(body) &&
        body.statements.some(
          statement =>
            gateStatementCallee(statement, accepted) !== null &&
            statement.getEnd() <= use.start
        );
      if (!gated) {
        report(
          'R3',
          `${functionLabel(fn)} uses the database client binding "${use.name}" without "await ${GATE_NAME}(...)" as a direct statement of its body (not inside a branch, loop, try or inner function) before that first use`
        );
      }
    }

    // R4: the gate called is the one exported by lib/auth/page-access.ts.
    if (callsGateByName && !gateNames.has(GATE_NAME)) {
      report(
        'R4',
        `calls ${GATE_NAME}, but that name was not imported from ${GATE_MODULE}; a local function or another module's function of the same name does not count`
      );
    }
  }

  // Staleness: every register entry still exists, in scope, and still imports a client.
  for (const rel of registered) {
    if (!triggeredFiles.has(rel)) {
      violations.push({
        file: rel,
        rule: 'stale-register',
        detail:
          'stale register entry: the file is gone, out of scope, or no longer imports a database client; remove the entry',
      });
    }
  }

  return violations.sort(
    (a, b) =>
      a.file.localeCompare(b.file) ||
      a.rule.localeCompare(b.rule) ||
      a.detail.localeCompare(b.detail)
  );
}

// ---------------------------------------------------------------------------
// Planted trees
// ---------------------------------------------------------------------------

const REPO_ROOT = path.resolve(__dirname, '../../..');

/** Every planted tree gets these; the scanner resolves imports inside the planted root. */
const STUBS: Record<string, string> = {
  'lib/prisma.ts': `export const prisma = { campaign: {} };
export async function withTransaction<T>(run: (tx: typeof prisma) => T) {
  return run(prisma);
}
export type TransactionClient = typeof prisma;
export default prisma;
`,
  'lib/db/index.ts': `export { prisma, withTransaction, default } from '@/lib/prisma';
export type { TransactionClient } from '@/lib/prisma';
`,
  'lib/auth/page-access.ts': `export async function requireOrganisationPageAccess(slug: string, returnTo: string) {
  return { userId: 'u', returnTo, organisation: { id: 'o', name: 'n', slug } };
}
`,
  'lib/other-access.ts': `export async function requireOrganisationPageAccess(slug: string, returnTo: string) {
  return { userId: 'u', returnTo, organisation: { id: 'o', name: 'n', slug } };
}
`,
};

const planted: string[] = [];

function plant(files: Record<string, string>): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'page-access-guard-'));
  planted.push(root);
  for (const [rel, text] of Object.entries({ ...STUBS, ...files })) {
    const full = path.join(root, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, text);
  }
  return root;
}

/** The whole result of scanning a planted tree, as `{ file, rule }` records. */
function scanPlanted(
  files: Record<string, string>,
  register: Register = {}
): Array<{ file: string; rule: Rule }> {
  return scanAppTree(plant(files), register).map(({ file, rule }) => ({
    file,
    rule,
  }));
}

afterEach(() => {
  for (const root of planted.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

const PAGE = 'app/x/page.tsx';
const CLIENT_IMPORT = `import prisma from '@/lib/prisma';\n`;
const GATE_IMPORT = `import { requireOrganisationPageAccess } from '@/lib/auth/page-access';\n`;
const GATE = `  const { organisation } = await requireOrganisationPageAccess(client, returnTo);\n`;
const QUERY = `  const campaign = await prisma.campaign.findFirst({
    where: { organizationId: organisation.id },
  });
`;

/** The gated page: the shape the two marketing-agency pages take once gated. */
const PAGE_OPEN = `type RouteCtx = { params: Promise<{ client: string }> };

export default async function Page({ params }: RouteCtx) {
  const { client } = await params;
  const returnTo = '/dashboard/marketing-agency/' + encodeURIComponent(client);
`;
const PAGE_CLOSE = `  const drafts = await prisma.studioContentDraft.findMany({
    where: { organizationId: organisation.id },
  });
  return { campaign, drafts };
}
`;
const GATED_PAGE =
  CLIENT_IMPORT + GATE_IMPORT + PAGE_OPEN + GATE + QUERY + PAGE_CLOSE;

/** The plain unguarded page: one import line, one query. */
const unguardedPage = (importLine: string, query: string): string =>
  `${importLine}
export default async function Page() {
  return ${query};
}
`;
const UNGUARDED_PAGE = unguardedPage(
  `import prisma from '@/lib/prisma';`,
  'prisma.campaign.findMany()'
);

describe('server pages check access before reading the database', () => {
  it('the real app tree has no unguarded database reader', () => {
    expect(scanAppTree(REPO_ROOT, REGISTER)).toEqual([]);
  });

  describe('planted violations: the planted file is reported once, under its rule, and nothing else is', () => {
    it('flags an unguarded page', () => {
      expect(scanPlanted({ [PAGE]: UNGUARDED_PAGE })).toEqual([
        { file: PAGE, rule: 'R3' },
      ]);
    });

    it('flags an unguarded JavaScript page', () => {
      expect(scanPlanted({ 'app/x/page.js': UNGUARDED_PAGE })).toEqual([
        { file: 'app/x/page.js', rule: 'R3' },
      ]);
    });

    it('flags a file of an unclassified type', () => {
      expect(scanPlanted({ 'app/x/page.vue': '<template />\n' })).toEqual([
        { file: 'app/x/page.vue', rule: 'unclassified' },
      ]);
    });

    it('flags an unguarded layout', () => {
      const layout = `${CLIENT_IMPORT}
export default async function Layout({ children }: { children: unknown }) {
  await prisma.campaign.count();
  return children;
}
`;
      expect(scanPlanted({ 'app/x/layout.tsx': layout })).toEqual([
        { file: 'app/x/layout.tsx', rule: 'R3' },
      ]);
    });

    it('flags a client imported under another name', () => {
      const page = unguardedPage(
        `import db from '@/lib/prisma';`,
        'db.campaign.findMany()'
      );
      expect(scanPlanted({ [PAGE]: page })).toEqual([
        { file: PAGE, rule: 'R3' },
      ]);
    });

    it('flags a named helper imported from the client module', () => {
      const page = unguardedPage(
        `import { withTransaction } from '@/lib/prisma';`,
        'withTransaction(tx => tx.campaign.findMany())'
      );
      expect(scanPlanted({ [PAGE]: page })).toEqual([
        { file: PAGE, rule: 'R3' },
      ]);
    });

    it('flags a client imported through the lib/db barrel', () => {
      const page = unguardedPage(
        `import { prisma } from '@/lib/db';`,
        'prisma.campaign.findMany()'
      );
      expect(scanPlanted({ [PAGE]: page })).toEqual([
        { file: PAGE, rule: 'R3' },
      ]);
    });

    it('flags a client imported through a barrel under app', () => {
      const page = unguardedPage(
        `import { db } from '../db';`,
        'db.campaign.findMany()'
      );
      expect(
        scanPlanted({
          'app/db.ts': `export { default as db } from '@/lib/prisma';\n`,
          [PAGE]: page,
        })
      ).toEqual([{ file: PAGE, rule: 'R3' }]);
    });

    it('flags a nested function that queries', () => {
      // The nested reader is called above the gate while sitting below it.
      const page = `${CLIENT_IMPORT}${GATE_IMPORT}${PAGE_OPEN}  const campaign = await load();
${GATE}  async function load() {
    return prisma.campaign.findFirst();
  }
  return { campaign, organisation };
}
`;
      expect(scanPlanted({ [PAGE]: page })).toEqual([
        { file: PAGE, rule: 'R2' },
      ]);
    });

    it('flags a query in a parameter default', () => {
      const page = `${CLIENT_IMPORT}${GATE_IMPORT}
export default async function Page(campaign = prisma.campaign.findFirst()) {
  const { organisation } = await requireOrganisationPageAccess('ccw', '/x');
  return { campaign, organisation };
}
`;
      expect(scanPlanted({ [PAGE]: page })).toEqual([
        { file: PAGE, rule: 'R2' },
      ]);
    });

    it('flags a client imported by a relative path', () => {
      const page = unguardedPage(
        `import prisma from '../../lib/prisma';`,
        'prisma.campaign.findMany()'
      );
      expect(scanPlanted({ [PAGE]: page })).toEqual([
        { file: PAGE, rule: 'R3' },
      ]);
    });

    it('flags a value import from @prisma/client', () => {
      const page = unguardedPage(
        `import { PrismaClient } from '@prisma/client';`,
        'new PrismaClient().campaign.findMany()'
      );
      expect(scanPlanted({ [PAGE]: page })).toEqual([
        { file: PAGE, rule: 'R1' },
      ]);
    });

    it('flags a dynamic import of the client', () => {
      const page = `${GATE_IMPORT}${PAGE_OPEN}${GATE}  const { default: db } = await import('@/lib/prisma');
  return db.campaign.findFirst({ where: { organizationId: organisation.id } });
}
`;
      expect(scanPlanted({ [PAGE]: page })).toEqual([
        { file: PAGE, rule: 'R1' },
      ]);
    });

    it('flags a gate that appears only in a comment and a string', () => {
      const page = `${CLIENT_IMPORT}${GATE_IMPORT}${PAGE_OPEN}  // await requireOrganisationPageAccess(client, returnTo);
  const note = 'await requireOrganisationPageAccess(client, returnTo)';
  return prisma.campaign.findFirst({ where: { name: note + returnTo } });
}
`;
      expect(scanPlanted({ [PAGE]: page })).toEqual([
        { file: PAGE, rule: 'R3' },
      ]);
    });

    it('flags a gate placed after the query', () => {
      const page = `${CLIENT_IMPORT}${GATE_IMPORT}${PAGE_OPEN}  const campaign = await prisma.campaign.findFirst();
${GATE}  return { campaign, organisation };
}
`;
      expect(scanPlanted({ [PAGE]: page })).toEqual([
        { file: PAGE, rule: 'R3' },
      ]);
    });

    it('flags a gate inside a branch', () => {
      const page = `${CLIENT_IMPORT}${GATE_IMPORT}${PAGE_OPEN}  if (client !== 'demo') {
    await requireOrganisationPageAccess(client, returnTo);
  }
  return prisma.campaign.findFirst();
}
`;
      expect(scanPlanted({ [PAGE]: page })).toEqual([
        { file: PAGE, rule: 'R3' },
      ]);
    });

    it('flags generateMetadata that queries without its own gate', () => {
      const page = `${CLIENT_IMPORT}${GATE_IMPORT}
export async function generateMetadata() {
  const first = await prisma.campaign.findFirst();
  return { title: first?.name };
}

${PAGE_OPEN}${GATE}${QUERY}${PAGE_CLOSE}`;
      expect(scanPlanted({ [PAGE]: page })).toEqual([
        { file: PAGE, rule: 'R3' },
      ]);
    });

    it('flags a query at module level', () => {
      const page = `${CLIENT_IMPORT}${GATE_IMPORT}
const campaigns = prisma.campaign.findMany();

${PAGE_OPEN}${GATE}  return { campaigns: await campaigns, organisation };
}
`;
      expect(scanPlanted({ [PAGE]: page })).toEqual([
        { file: PAGE, rule: 'R2' },
      ]);
    });

    it('flags a gate of the same name imported from another module', () => {
      const page =
        CLIENT_IMPORT +
        `import { requireOrganisationPageAccess } from '@/lib/other-access';\n` +
        PAGE_OPEN +
        GATE +
        QUERY +
        PAGE_CLOSE;
      expect(scanPlanted({ [PAGE]: page })).toEqual([
        { file: PAGE, rule: 'R4' },
      ]);
    });

    it('flags a stale register entry', () => {
      // An entry whose file is gone.
      expect(
        scanPlanted({}, { 'app/gone/page.tsx': 'was public by design' })
      ).toEqual([{ file: 'app/gone/page.tsx', rule: 'stale-register' }]);
      // An entry whose file no longer imports a client.
      expect(
        scanPlanted(
          {
            'app/quiet/page.tsx': `export default function Page() {\n  return null;\n}\n`,
          },
          { 'app/quiet/page.tsx': 'no longer reads the database' }
        )
      ).toEqual([{ file: 'app/quiet/page.tsx', rule: 'stale-register' }]);
    });
  });

  describe('planted clean cases: nothing is reported', () => {
    it('passes a gated page', () => {
      expect(scanPlanted({ [PAGE]: GATED_PAGE })).toEqual([]);
    });

    it('passes a page whose default export and generateMetadata are both gated', () => {
      const page = `${CLIENT_IMPORT}${GATE_IMPORT}
export async function generateMetadata({ params }: RouteCtx) {
  const { client } = await params;
  const { organisation } = await requireOrganisationPageAccess(client, '/x');
  const first = await prisma.campaign.findFirst({
    where: { organizationId: organisation.id },
  });
  return { title: first?.name };
}

${PAGE_OPEN}${GATE}${QUERY}${PAGE_CLOSE}`;
      expect(scanPlanted({ [PAGE]: page })).toEqual([]);
    });

    it('passes a type-only import', () => {
      const page = `import type { Prisma } from '@prisma/client';
import type prisma from '@/lib/prisma';
import { type TransactionClient } from '@/lib/db';

type Props = {
  where?: Prisma.CampaignWhereInput;
  db?: typeof prisma;
  tx?: TransactionClient;
};

export default function Page(props: Props) {
  return props.where ? 1 : 0;
}
`;
      expect(scanPlanted({ [PAGE]: page })).toEqual([]);
    });

    it('ignores route files and files under app/api', () => {
      expect(
        scanPlanted({
          'app/api/x/helper.ts': UNGUARDED_PAGE,
          'app/y/route.ts': `${CLIENT_IMPORT}
export async function GET() {
  return Response.json(await prisma.campaign.findMany());
}
`,
        })
      ).toEqual([]);
    });

    it('ignores listed non-code files', () => {
      expect(
        scanPlanted({
          'app/x/styles.css': 'body {}\n',
          'app/x/NOTES.md': '# notes\n',
          'app/x/.DS_Store': '',
          'app/x/.gitkeep': '',
        })
      ).toEqual([]);
    });
  });
});
