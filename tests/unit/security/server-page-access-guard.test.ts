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
 *   R4  the gate name has any binding other than the one named import from
 *       lib/auth/page-access.ts (a local declaration of any kind at any depth,
 *       a parameter, a catch binding, an import from another module), or the
 *       gate is called without that import. The import under another local
 *       name is not the gate.
 *   unclassified    a file under app/ whose type is on neither list below, or
 *       a scanned file with an import() or require() whose module name is
 *       not exactly one plain string literal (it may be the client), or any
 *       use of the name `require` other than the direct callee of such a call
 *       (wrapped, assigned, passed, re-bound; a property name is not a use),
 *       or (U1) a local module name, one that starts with `.` or `@/`, that a
 *       scanned file loads and that does not resolve to a file spelt exactly
 *       as on disk (a query, a fragment, another letter case, a missing
 *       file). An asset that exists resolves; a type-only import is not a load.
 *       (V2) Resolved means exactly one candidate on disk, a regular file and
 *       no symbolic link. (V1) Any other name must be a plain package name.
 *   stale-register  a register entry that is gone or no longer imports a client.
 *
 * U2: a module the scanner follows that loads a name failing U1, V1 or V2
 * counts as a client module. U3: a test holds `@/` to the real tsconfig.json
 * and package.json as the only alias.
 * U4: it allows two in-repo packages, no other, and none may load a client.
 *
 * Register: the ONLY files allowed to import a client without the gate, each
 * with its reason. Adding an entry to turn a red run green defeats the guard;
 * an entry needs its own access check or a public-by-design reason.
 *
 * Cap: this guard stops growing here. A later finding against it is recorded
 * below as a named limit, not as a new rule, unless it is a kind of gap not
 * already listed. The guard's reading of module names is now complete by
 * partition (local names must resolve to exactly one real file; other names
 * must be plain package names), so a later finding about a module-name
 * spelling is a defect in that partition, and a finding about a loader
 * outside the three forms is limit L6. That completeness rests on the alias
 * and package checks (U3, U4).
 *
 * Named limits:
 *   L1  A page that reads through a lib/ service it imports is not seen.
 *   L2  The guard proves the call is present and precedes use in each function,
 *       not that the queries are bound to the organisation it returned (the
 *       page tests prove that for the two marketing-agency pages).
 *   L3  A module outside app/ (lib/, components/, anywhere the scanner follows
 *       but does not scan) is derived as a client module only when it hands
 *       the client on by a plain re-export with bare names: `export ... from`,
 *       `export { x }`, `export default x` or `export const x = y` (or by
 *       rule U2). Any other way it hands the client on is not derived: an
 *       expression around it such as a cast or parentheses, a local alias, a
 *       member of a namespace, destructuring, a wrapper object, a function
 *       that returns it. That is the same exposure as L1 and is accepted.
 *   L4  A server-action file gets the same rule. A redirecting gate does not
 *       suit an action, so its violation message tells the author to register
 *       the file here with its own check.
 *   L5  main requires its checks without requiring the branch to be up to
 *       date, so the real-tree test runs on the pull request's head, not on
 *       the merged tree: two pull requests that are each clean can merge into
 *       a tree that is not, and the first sign is main's unit tests failing
 *       after the merge.
 *   L6  The scanner reads three ways of loading a module: a static import or
 *       export-from, import(), and the identifier `require`. A load that uses
 *       none of them is not seen: a property named require (module.require,
 *       globalThis.require), createRequire, eval, new Function, the client
 *       read from the global lib/prisma.ts stores it on, or a database client
 *       other than Prisma. An alias defined in the bundler's own config
 *       (next.config) is not read. Closing this needs a check at run time, not
 *       more scanner cases (SYN-1413 F-12).
 *   L7  A registered file is exempt from every rule, `unclassified` included.
 *   L8  In a followed module only literal module names are read, local or
 *       not. An import() or require() with a name that is not a literal, or a
 *       wrapped require, in a followed module is not read: the same exposure
 *       as L1.
 *   L9  A hard link or a copy of the client file under another name inside
 *       lib/ is a second client module the guard does not know: the same
 *       exposure as L1.
 *   L10 Package indirection is checked only as far as U4 goes. Not read: an
 *       `npm:` alias in a dependency, the built output (dist) of the two
 *       in-repo packages, their own manifests, and a symbolic link to a
 *       folder that holds the client.
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

/** Specifier extension -> the TypeScript extensions the bundler tries in its place. */
const TS_FOR_JS_EXTENSION: Readonly<Record<string, readonly string[]>> = {
  '.js': ['.ts', '.tsx'],
  '.jsx': ['.tsx'],
  '.mjs': ['.mts'],
  '.cjs': ['.cts'],
};

const GATE_NAME = 'requireOrganisationPageAccess';
const GATE_MODULE = 'lib/auth/page-access.ts';
const CLIENT_MODULE = 'lib/prisma.ts';
const PRISMA_PACKAGE = '@prisma/client';

/** The one alias the scanner knows: `@/x` is `<root>/x` (held to the real config by a test below). */
const ALIAS_PREFIX = '@/';
const aliasPath = (root: string, specifier: string): string =>
  path.join(root, specifier.slice(ALIAS_PREFIX.length));

/** A local module name: a relative path or the `@/` alias. It must resolve to a file. */
const isLocalSpecifier = (specifier: string): boolean =>
  specifier.startsWith('.') || specifier.startsWith(ALIAS_PREFIX);

/**
 * V1: every other module name must be a plain package name or a Node builtin,
 * `node:<name>` or `[@scope/]name[/subpath]`, in the characters npm allows in
 * a name and ordinary path characters in the subpath. No query, fragment,
 * loader prefix, scheme, space, backslash, leading `/` or `~`, and no subpath
 * part made only of dots (`pkg/../../lib/prisma` climbs out of the package).
 */
const PACKAGE_NAME =
  /^(?:node:[a-z][a-z0-9_]*(?:\/[a-z][a-z0-9_]*)*|(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*(?:\/(?!\.+(?:\/|$))[A-Za-z0-9._-]+)*)$/;

/**
 * U4: the only dependencies that may name a place on disk, each at its own
 * folder. A page reaches their code by a plain package name, so the alias
 * check reads every code file in them, outside the skipped folders (installed
 * packages and build output).
 */
const IN_REPO_PACKAGES: Readonly<Record<string, string>> = {
  '@unite-group/brand-config': 'file:./packages/brand-config',
  '@unite-group/control-module': 'file:./packages/control-module',
};
const PACKAGE_SKIPPED_FOLDERS = ['node_modules', 'dist'];
const DEPENDENCY_FIELDS = [
  'dependencies',
  'devDependencies',
  'optionalDependencies',
  'peerDependencies',
  'overrides',
];
/** A dependency version that names a place on disk, not a registry version. */
const LOCAL_VERSION = /^(?:file:|link:|workspace:|\.|\/|~\/|[A-Za-z]:[\\/])/;

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

function walk(
  dir: string,
  out: string[] = [],
  skippedFolders: readonly string[] = []
): string[] {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (!entry.isDirectory()) out.push(full);
    else if (!skippedFolders.includes(entry.name)) {
      walk(full, out, skippedFolders);
    }
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

/** True when every name in a non-empty `{ ... }` list carries `type`. */
function allTypeOnly(
  elements: ts.NodeArray<ts.ImportSpecifier | ts.ExportSpecifier>
): boolean {
  return elements.length > 0 && elements.every(e => e.isTypeOnly);
}

/**
 * The module names a file loads when it runs, at any depth: a static import
 * (a side-effect import too), an export-from, an import-equals require, and
 * an import() or require() whose first argument is a plain literal. Type-only
 * forms are left out, as they are not loads.
 */
function loadedSpecifiers(sf: ts.SourceFile): string[] {
  const found: string[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node)) {
      const clause = node.importClause;
      const bindings = clause?.namedBindings;
      const typeOnly =
        !!clause &&
        (clause.isTypeOnly ||
          (!clause.name &&
            !!bindings &&
            ts.isNamedImports(bindings) &&
            allTypeOnly(bindings.elements)));
      if (!typeOnly && ts.isStringLiteral(node.moduleSpecifier)) {
        found.push(node.moduleSpecifier.text);
      }
    } else if (ts.isExportDeclaration(node)) {
      const clause = node.exportClause;
      const typeOnly =
        node.isTypeOnly ||
        (!!clause && ts.isNamedExports(clause) && allTypeOnly(clause.elements));
      if (
        !typeOnly &&
        node.moduleSpecifier &&
        ts.isStringLiteral(node.moduleSpecifier)
      ) {
        found.push(node.moduleSpecifier.text);
      }
    } else if (ts.isImportEqualsDeclaration(node)) {
      if (
        !node.isTypeOnly &&
        ts.isExternalModuleReference(node.moduleReference) &&
        ts.isStringLiteralLike(node.moduleReference.expression)
      ) {
        found.push(node.moduleReference.expression.text);
      }
    } else if (ts.isCallExpression(node)) {
      const callee = node.expression;
      const arg = node.arguments[0];
      if (
        (callee.kind === ts.SyntaxKind.ImportKeyword ||
          (ts.isIdentifier(callee) && callee.text === 'require')) &&
        arg &&
        ts.isStringLiteralLike(arg)
      ) {
        found.push(arg.text);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return found;
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

/** The expression after `extends` in a class runs when the class is defined, though the parser types it as a type node. */
function isClassExtendsExpression(node: ts.Node): boolean {
  return (
    ts.isExpressionWithTypeArguments(node) &&
    ts.isHeritageClause(node.parent) &&
    node.parent.token === ts.SyntaxKind.ExtendsKeyword &&
    ts.isClassLike(node.parent.parent)
  );
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
    if (ts.isTypeNode(node) && !isClassExtendsExpression(node)) return false;
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

/**
 * True when the identifier only names something and neither reads nor binds a
 * variable: a property after a dot, an object key, a class or interface member,
 * a qualified type name, an imported or exported name (not the local one), a
 * destructuring key, a JSX attribute. Everything else counts as a reference or
 * a binding.
 */
function isNameNotReference(id: ts.Identifier): boolean {
  const p = id.parent;
  if (ts.isPropertyAccessExpression(p) || ts.isPropertyAssignment(p)) {
    return p.name === id;
  }
  if (ts.isQualifiedName(p)) return p.right === id;
  if (
    ts.isPropertyDeclaration(p) ||
    ts.isPropertySignature(p) ||
    ts.isMethodDeclaration(p) ||
    ts.isMethodSignature(p) ||
    ts.isGetAccessorDeclaration(p) ||
    ts.isSetAccessorDeclaration(p) ||
    ts.isEnumMember(p) ||
    ts.isJsxAttribute(p)
  ) {
    return p.name === id;
  }
  if (ts.isBindingElement(p)) return p.propertyName === id;
  if (ts.isImportSpecifier(p)) return p.propertyName === id;
  if (ts.isExportSpecifier(p)) {
    const reexport = !!p.parent.parent.moduleSpecifier;
    return reexport || (!!p.propertyName && p.name === id);
  }
  return false;
}

/** True when the identifier is the name a declaration binds (any kind, any depth). */
function isBindingName(id: ts.Identifier): boolean {
  const p = id.parent;
  return (
    (ts.isVariableDeclaration(p) ||
      ts.isBindingElement(p) ||
      ts.isParameter(p) ||
      ts.isFunctionDeclaration(p) ||
      ts.isFunctionExpression(p) ||
      ts.isClassDeclaration(p) ||
      ts.isClassExpression(p) ||
      ts.isEnumDeclaration(p) ||
      ts.isModuleDeclaration(p) ||
      ts.isImportClause(p) ||
      ts.isImportSpecifier(p) ||
      ts.isNamespaceImport(p) ||
      ts.isImportEqualsDeclaration(p)) &&
    p.name === id
  );
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
 * How module names are read under one root: the one owner of resolution, of
 * the partition of names, and of what counts as a client module. The scan of
 * app/ and the check of the in-repo packages (U4) both ask it.
 */
function moduleReader(root: string) {
  const clientFile = path.join(root, CLIENT_MODULE);

  // What sits at a path under the root whose every folder and file name is
  // spelt as on disk, the link itself when it is a symbolic link; undefined
  // for nothing and for a folder (a link to a folder is a folder on the way).
  // Read from directory listings, so a spelling that only a case-insensitive
  // disk accepts (`@/Lib/Prisma`) is nothing here.
  const listings = new Map<string, ReadonlySet<string>>();
  const namesIn = (dir: string): ReadonlySet<string> => {
    let names = listings.get(dir);
    if (!names) {
      try {
        names = new Set(fs.readdirSync(dir));
      } catch {
        names = new Set();
      }
      listings.set(dir, names);
    }
    return names;
  };
  const entryAsSpelt = (file: string): fs.Stats | undefined => {
    const rel = path.relative(root, file);
    if (!rel || path.isAbsolute(rel) || rel.split(path.sep)[0] === '..') {
      return undefined;
    }
    let dir = root;
    for (const segment of rel.split(path.sep)) {
      if (!namesIn(dir).has(segment)) return undefined;
      dir = path.join(dir, segment);
    }
    if (fs.statSync(file, { throwIfNoEntry: false })?.isDirectory()) {
      return undefined;
    }
    return fs.lstatSync(file, { throwIfNoEntry: false });
  };

  // Local module name -> file: the `@/` alias, relative paths, code extensions,
  // `/index`. Null for a package name, and for a local name that is not
  // exactly one real file (V2): no candidate on disk, more than one (`x.ts`
  // beside `x.js` or `x/index.ts`), or a symbolic link.
  const resolved = new Map<string, string | null>();
  const resolveImport = (
    specifier: string,
    fromFile: string
  ): string | null => {
    if (!isLocalSpecifier(specifier)) return null;
    const base = specifier.startsWith(ALIAS_PREFIX)
      ? aliasPath(root, specifier)
      : path.resolve(path.dirname(fromFile), specifier);
    const known = resolved.get(base);
    if (known !== undefined) return known;
    // A .js-style specifier names the TypeScript file the bundler resolves it to.
    const written = path.extname(base);
    const typed = TS_FOR_JS_EXTENSION[written];
    const candidates = [
      base,
      ...(typed ? typed.map(ext => base.slice(0, -written.length) + ext) : []),
      ...CODE_EXTENSIONS.map(ext => base + ext),
      ...CODE_EXTENSIONS.map(ext => path.join(base, `index${ext}`)),
    ];
    const found = candidates.filter(c => entryAsSpelt(c) !== undefined);
    const hit =
      found.length === 1 && entryAsSpelt(found[0])?.isFile() ? found[0] : null;
    resolved.set(base, hit);
    return hit;
  };
  // The partition, asked of every module name a file loads (one owner for U1,
  // U2, V1 and V2): a local name resolves to exactly one real file, any other
  // name is a plain package name. Returns the names that are neither.
  const namesNotUnderstood = (sf: ts.SourceFile, file: string): string[] => [
    ...new Set(
      loadedSpecifiers(sf).filter(specifier =>
        isLocalSpecifier(specifier)
          ? !resolveImport(specifier, file)
          : !PACKAGE_NAME.test(specifier)
      )
    ),
  ];

  // A client module is lib/prisma.ts, or a file that re-exports from a client
  // module or exports a binding it imported from one. Asked recursively and
  // remembered, so a barrel anywhere is covered without being named. U2: a
  // file that loads a module name this guard does not understand counts as
  // one, as that name may be the client.
  const remembered = new Map<string, boolean>();
  const visiting = new Set<string>();
  let cycleSeen = false;
  const exposesClient = (file: string): boolean => {
    const sf = parse(file, false);
    if (namesNotUnderstood(sf, file).length > 0) return true;
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
    // The two closed lists again: a listed asset (css, json, an image) is not
    // code to follow, and a file on neither list cannot be read, so it counts
    // as a client module.
    const ext = path.extname(file).toLowerCase();
    if (IGNORED_EXTENSIONS.includes(ext)) return false;
    if (!CODE_EXTENSIONS.includes(ext)) return true;
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

  return { resolveImport, namesNotUnderstood, isClientModule };
}

/**
 * Scans `<root>/app` and returns one record per violation, sorted. An empty
 * list is a clean tree.
 */
function scanAppTree(root: string, register: Register): Violation[] {
  const violations: Violation[] = [];
  const gateFile = path.join(root, GATE_MODULE);
  const { resolveImport, namesNotUnderstood, isClientModule } =
    moduleReader(root);

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
    const gateImports = new Set<ts.Identifier>();
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
            element.name.text === GATE_NAME &&
            (element.propertyName ?? element.name).text === GATE_NAME
          ) {
            gateImports.add(element.name);
          }
        }
      }
    }

    const misplaced: string[] = [];
    const firstUse = new Map<FunctionNode, { name: string; start: number }>();
    let callsGateByName = false;
    const gateBindings: ts.Identifier[] = [];
    const unreadable: string[] = [];
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
        const how =
          callee.kind === ts.SyntaxKind.ImportKeyword
            ? 'a dynamic import()'
            : ts.isIdentifier(callee) && callee.text === 'require'
              ? 'require()'
              : null;
        if (how) {
          if (arg && ts.isStringLiteralLike(arg)) dynamicLoad(how, arg.text);
          if (
            !(node.arguments.length === 1 && arg && ts.isStringLiteralLike(arg))
          ) {
            unreadable.push(
              `has ${how} whose module name is not exactly one plain string literal; it may load the database client, so write the module name as a literal`
            );
          }
        }
        if (ts.isIdentifier(callee) && callee.text === GATE_NAME) {
          callsGateByName = true;
        }
      }
      // Allow-list: the name `require` may appear only as the direct callee of
      // a call (read above) or as a name that is not a reference. Any other
      // occurrence, wrapped, assigned, passed, re-bound, is not understood.
      if (
        ts.isIdentifier(node) &&
        node.text === 'require' &&
        !isNameNotReference(node) &&
        !(ts.isCallExpression(node.parent) && node.parent.expression === node)
      ) {
        unreadable.push(
          `uses the name "require" in a form this guard cannot follow (wrapped, assigned, passed, re-bound or used as a value); it may load the database client, so call require('...') directly with a literal module name`
        );
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
        node.text === GATE_NAME &&
        isBindingName(node)
      ) {
        gateBindings.push(node);
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
    // U1, V1, V2: every module name the file loads is understood.
    for (const specifier of namesNotUnderstood(sf, file)) {
      unreadable.push(
        isLocalSpecifier(specifier)
          ? `loads the local module "${specifier}", which does not resolve to exactly one real file with exactly that spelling; it may be the database client under a spelling this guard cannot follow, so name one file that exists, without a query, a fragment or another letter case, with no second file or folder index of the same name beside it, and not a symbolic link`
          : `loads the module "${specifier}", which is neither a local name (./ or ${ALIAS_PREFIX}) nor a plain package name; it may be the database client under a spelling this guard cannot follow, so write a relative path, an ${ALIAS_PREFIX} name or a package name with no query, fragment, prefix or scheme`
      );
    }

    const triggered = clientNames.size > 0 || loads.length > 0;
    if (!triggered && unreadable.length === 0) continue;
    if (triggered) triggeredFiles.add(rel);
    if (registered.has(rel)) continue;

    const action = isServerActionFile(sf)
      ? '. This is a server-action file ("use server"): a redirecting gate does not suit an action, so register the file in this guard with its own check and the reason'
      : '';
    const report = (rule: Rule, detail: string): void => {
      violations.push({ file: rel, rule, detail: detail + action });
    };

    // unclassified: a load this guard cannot read (a module name that is not a
    // plain literal, a use of `require` it cannot follow, a local name with no file).
    for (const detail of unreadable) report('unclassified', detail);

    // R1: a load whose bindings cannot be followed, or a client of the page's own.
    for (const detail of loads) report('R1', detail);

    // R2: every use sits directly in the body of a top-level function.
    for (const detail of misplaced) report('R2', detail);

    // R3: each such function awaits the gate, as a direct statement of its
    // body, before its first use of a client binding.
    const accepted = new Set([GATE_NAME]);
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

    // R4: the gate name has one binding, the named import from lib/auth/page-access.ts.
    const otherBindings = gateBindings.filter(id => !gateImports.has(id));
    if (
      otherBindings.length > 0 ||
      gateImports.size > 1 ||
      (callsGateByName && gateImports.size === 0)
    ) {
      report(
        'R4',
        `${GATE_NAME} must have exactly one binding in the file, the named import from ${GATE_MODULE}; found ${otherBindings.length} other binding(s) and ${gateImports.size} such import(s)${callsGateByName ? ' and a call by that name' : ''}. A local function, a parameter or another module's function of the same name does not count, and neither does an import under another name`
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

/**
 * The scanner maps `@/` to the root and knows no other alias, and takes every
 * other name for a package that holds no repository code (U3), bar the listed
 * in-repo packages, whose code it reads here (U4). Returns one line per way
 * `<root>/tsconfig.json`, `<root>/package.json` or those packages break that;
 * an empty list means the assumptions hold.
 */
function aliasAssumptionProblems(root: string): string[] {
  const problems: string[] = [];
  const readFile = (file: string): string | undefined =>
    fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : undefined;

  // TypeScript's own reader: it allows comments and merges `extends`. The host
  // lists no source files, so the "no inputs" notice (18003) is expected.
  const configFile = path.join(root, 'tsconfig.json');
  const read = ts.readConfigFile(configFile, readFile);
  const parsed = ts.parseJsonConfigFileContent(
    read.config ?? {},
    {
      useCaseSensitiveFileNames: true,
      readDirectory: () => [],
      fileExists: fs.existsSync,
      readFile,
    },
    root,
    undefined,
    configFile
  );
  const errors = [...(read.error ? [read.error] : []), ...parsed.errors].filter(
    error => error.code !== 18003
  );
  for (const error of errors) {
    problems.push(
      `tsconfig.json cannot be read in full, so its aliases are unknown: ${ts.flattenDiagnosticMessageText(error.messageText, ' ')}`
    );
  }
  if (errors.length === 0) {
    const { baseUrl, paths = {}, pathsBasePath } = parsed.options;
    if (baseUrl !== undefined) {
      problems.push(
        `tsconfig.json sets compilerOptions.baseUrl, so a bare module name such as "lib/prisma" can reach a repository file this guard takes for a package`
      );
    }
    if (!(`${ALIAS_PREFIX}*` in paths)) {
      problems.push(
        `tsconfig.json does not define the "${ALIAS_PREFIX}*" alias this guard resolves`
      );
    }
    const base = typeof pathsBasePath === 'string' ? pathsBasePath : root;
    for (const [alias, targets] of Object.entries(paths)) {
      const same =
        alias.startsWith(ALIAS_PREFIX) &&
        targets.length === 1 &&
        path.resolve(base, targets[0]) === aliasPath(root, alias);
      if (!same) {
        problems.push(
          `tsconfig.json maps the alias "${alias}" to ${JSON.stringify(targets)}; this guard follows only "${ALIAS_PREFIX}" names, each to the same folder under the root`
        );
      }
    }
  }

  const packageText = readFile(path.join(root, 'package.json'));
  let packageJson: unknown;
  try {
    packageJson = JSON.parse(packageText ?? '');
  } catch {
    packageJson = undefined;
  }
  if (typeof packageJson !== 'object' || packageJson === null) {
    problems.push('package.json cannot be read, so its imports are unknown');
    return problems;
  }
  const manifest = packageJson as Record<string, unknown>;
  if ('imports' in manifest) {
    problems.push(
      'package.json has an imports field, so a "#" module name can reach a repository file this guard takes for a package'
    );
  }
  for (const field of ['workspaces', 'exports']) {
    if (field in manifest) {
      problems.push(
        `package.json has the field "${field}", so a package name can reach a repository file this guard takes for a package`
      );
    }
  }

  // U4 (a): a dependency that names a place on disk is one of the listed
  // in-repo packages, at its own folder, or it is a problem.
  const present: string[] = [];
  const readVersions = (entries: unknown, where: string): void => {
    if (typeof entries !== 'object' || entries === null) return;
    for (const [name, version] of Object.entries(entries)) {
      if (typeof version !== 'string') {
        readVersions(version, `${where}.${name}`);
      } else if (LOCAL_VERSION.test(version)) {
        if (IN_REPO_PACKAGES[name] === version) present.push(name);
        else {
          problems.push(
            `package.json ${where} points "${name}" at "${version}", a place on disk, so that package name can reach a repository file this guard takes for a package; only ${Object.keys(IN_REPO_PACKAGES).join(' and ')} may, each at its own folder`
          );
        }
      }
    }
  };
  for (const field of DEPENDENCY_FIELDS) readVersions(manifest[field], field);

  // U4 (b): no code file of a listed package loads a database client, or a
  // module name the partition does not understand. Same reader as the scan.
  const reader = moduleReader(root);
  for (const name of new Set(present)) {
    const folder = path.join(
      root,
      IN_REPO_PACKAGES[name].slice('file:'.length)
    );
    const files = walk(folder, [], PACKAGE_SKIPPED_FOLDERS).filter(file =>
      CODE_EXTENSIONS.includes(path.extname(file).toLowerCase())
    );
    if (files.length === 0) {
      problems.push(
        `the in-repo package "${name}" has no code file to read under ${toPosix(path.relative(root, folder))}, so what it loads is unknown`
      );
    }
    for (const file of files) {
      const sf = parse(file, false);
      const unread = new Set(reader.namesNotUnderstood(sf, file));
      for (const specifier of new Set(loadedSpecifiers(sf))) {
        const target = reader.resolveImport(specifier, file);
        const what = unread.has(specifier)
          ? 'a module name this guard does not understand'
          : isPrismaPackage(specifier)
            ? 'the Prisma package, as a value'
            : target && reader.isClientModule(target)
              ? 'a database client module'
              : null;
        if (what) {
          problems.push(
            `${toPosix(path.relative(root, file))}, in the in-repo package "${name}", loads "${specifier}": ${what}. A page can reach this package by a plain package name, so it must not load the database client`
          );
        }
      }
    }
  }
  return problems;
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
  // The unrelated local modules the planted pages load: a local module name must resolve.
  'app/x/chart.ts': `export const chart = 1;\n`,
  'app/x/plain.ts': `export const plain = 1;\n`,
  'app/x/loader.ts': `export const loader = 1;\n`,
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

  describe('the @/ alias is the only way a module name reaches a repository file', () => {
    const ROOT_ALIAS = { '@/*': ['./*'] };
    const plantConfig = (
      tsconfig: unknown,
      packageJson: unknown,
      extra: Record<string, string> = {}
    ): string =>
      plant({
        ...(tsconfig === null
          ? {}
          : { 'tsconfig.json': JSON.stringify(tsconfig) }),
        'package.json': JSON.stringify(packageJson),
        ...extra,
      });

    it('finds no other alias in the real tsconfig.json and package.json (control)', () => {
      expect(aliasAssumptionProblems(REPO_ROOT)).toEqual([]);
    });

    it('reads a real tsconfig.json that maps @/* to the root, extends nothing and sets no baseUrl (control)', () => {
      const { config } = ts.readConfigFile(
        path.join(REPO_ROOT, 'tsconfig.json'),
        file => fs.readFileSync(file, 'utf8')
      );
      expect(config.compilerOptions.paths['@/*']).toEqual(['./*']);
      expect(config.compilerOptions).not.toHaveProperty('baseUrl');
      expect(config).not.toHaveProperty('extends');
    });

    it('reads a real package.json that has a name and no imports field (control)', () => {
      const packageJson = JSON.parse(
        fs.readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf8')
      );
      expect(packageJson).toHaveProperty('name');
      expect(packageJson).not.toHaveProperty('imports');
    });

    it('accepts a planted configuration shaped like the real one (control)', () => {
      const root = plantConfig(
        {
          compilerOptions: {
            paths: { ...ROOT_ALIAS, '@/lib/*': ['./lib/*'] },
          },
        },
        { name: 'planted' }
      );
      expect(aliasAssumptionProblems(root)).toEqual([]);
    });

    it.each([
      [
        'flags a tsconfig that sets baseUrl',
        { compilerOptions: { baseUrl: '.', paths: ROOT_ALIAS } },
        { name: 'planted' },
        {},
        'baseUrl',
      ],
      [
        'flags a tsconfig that inherits baseUrl through extends',
        {
          extends: './tsconfig.base.json',
          compilerOptions: { paths: ROOT_ALIAS },
        },
        { name: 'planted' },
        {
          'tsconfig.base.json': JSON.stringify({
            compilerOptions: { baseUrl: './lib' },
          }),
        },
        'baseUrl',
      ],
      [
        'flags a tsconfig alias that does not start with @/',
        { compilerOptions: { paths: { ...ROOT_ALIAS, '~/*': ['./*'] } } },
        { name: 'planted' },
        {},
        '"~/*"',
      ],
      [
        'flags a tsconfig @/ alias mapped to another folder',
        {
          compilerOptions: {
            paths: { ...ROOT_ALIAS, '@/lib/*': ['./src/lib/*'] },
          },
        },
        { name: 'planted' },
        {},
        '"@/lib/*"',
      ],
      [
        'flags a tsconfig @/ alias with a second target',
        { compilerOptions: { paths: { '@/*': ['./*', './src/*'] } } },
        { name: 'planted' },
        {},
        '"@/*"',
      ],
      [
        'flags a tsconfig without the @/* alias',
        { compilerOptions: { paths: { '@/lib/*': ['./lib/*'] } } },
        { name: 'planted' },
        {},
        'does not define',
      ],
      [
        'flags a tsconfig that extends a file that is missing',
        { extends: './gone.json', compilerOptions: { paths: ROOT_ALIAS } },
        { name: 'planted' },
        {},
        'tsconfig.json',
      ],
      [
        'flags a missing tsconfig.json',
        null,
        { name: 'planted' },
        {},
        'tsconfig.json',
      ],
      [
        'flags a package.json with an imports field',
        { compilerOptions: { paths: ROOT_ALIAS } },
        { name: 'planted', imports: { '#db': './lib/prisma.ts' } },
        {},
        'imports',
      ],
    ])('%s', (_title, tsconfig, packageJson, extra, needle) => {
      expect(
        aliasAssumptionProblems(plantConfig(tsconfig, packageJson, extra))
      ).toEqual([expect.stringContaining(needle)]);
    });

    const TSCONFIG = { compilerOptions: { paths: ROOT_ALIAS } };
    const BRAND = '@unite-group/brand-config';
    const BRAND_DIR = 'packages/brand-config';
    const LISTED = {
      [BRAND]: 'file:./packages/brand-config',
      '@unite-group/control-module': 'file:./packages/control-module',
    };
    const OWN_FILES = {
      'packages/brand-config/src/index.ts': `import type { Prisma } from '@prisma/client';\nexport { tone } from './tone';\nexport type Where = Prisma.CampaignWhereInput;\n`,
      'packages/brand-config/src/tone.ts': `import { z } from 'zod';\nexport const tone = z.string();\n`,
      'packages/control-module/src/index.ts': `export const control = 1;\n`,
    };

    it('reads a real package.json whose only local dependencies are the two listed packages, each with source on disk (control)', () => {
      const packageJson = JSON.parse(
        fs.readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf8')
      );
      const onDisk = Object.entries<unknown>({
        ...packageJson.dependencies,
        ...packageJson.devDependencies,
      }).filter(([, version]) =>
        /^(?:file:|link:|workspace:|\.|\/)/.test(String(version))
      );
      expect(Object.fromEntries(onDisk)).toEqual(LISTED);
      expect(packageJson).not.toHaveProperty('workspaces');
      expect(packageJson).not.toHaveProperty('exports');
      for (const folder of [
        'packages/brand-config',
        'packages/control-module',
      ]) {
        expect(
          fs.existsSync(path.join(REPO_ROOT, folder, 'src/index.ts'))
        ).toBe(true);
      }
    });

    it('accepts both listed packages when their files load only their own files and plain packages, and skips node_modules and dist (control)', () => {
      const leak = `module.exports = require('../../../lib/prisma');\n`;
      const root = plantConfig(
        TSCONFIG,
        { name: 'planted', dependencies: { zod: '4.4.3', ...LISTED } },
        {
          ...OWN_FILES,
          'packages/brand-config/dist/index.cjs': leak,
          'packages/control-module/node_modules/x/index.js': leak,
        }
      );
      expect(aliasAssumptionProblems(root)).toEqual([]);
    });

    it.each([
      [
        'flags a dependency on a local folder that is not a listed package',
        { dependencies: { 'local-thing': 'file:./lib' } },
        '"local-thing"',
      ],
      [
        'flags a dev dependency linked to a local folder',
        { devDependencies: { 'local-thing': 'link:./lib' } },
        '"local-thing"',
      ],
      [
        'flags an optional dependency on a workspace',
        { optionalDependencies: { 'local-thing': 'workspace:*' } },
        '"local-thing"',
      ],
      [
        'flags a peer dependency written as a relative path',
        { peerDependencies: { 'local-thing': '../thing' } },
        '"local-thing"',
      ],
      [
        'flags a dependency written as an absolute path',
        { dependencies: { 'local-thing': '/srv/thing' } },
        '"local-thing"',
      ],
      [
        'flags a nested override that points at a local folder',
        { overrides: { outer: { 'local-thing': 'file:./lib' } } },
        '"local-thing"',
      ],
      [
        'flags a listed package that points somewhere else',
        { dependencies: { [BRAND]: 'file:./lib' } },
        `"${BRAND}"`,
      ],
      [
        'flags a package.json with a workspaces field',
        { workspaces: ['packages/*'] },
        'workspaces',
      ],
      [
        'flags a package.json with an exports field',
        { exports: { './db': './lib/prisma.ts' } },
        'exports',
      ],
    ])('%s', (_title, fields, needle) => {
      expect(
        aliasAssumptionProblems(
          plantConfig(TSCONFIG, { name: 'planted', ...fields })
        )
      ).toEqual([expect.stringContaining(needle)]);
    });

    it.each([
      [
        'flags a listed package whose file loads the client module',
        `import { prisma } from '../../../lib/prisma';\nexport const db = prisma;\n`,
      ],
      [
        'flags a listed package whose file loads the client through the lib/db barrel',
        `export { prisma as db } from '@/lib/db';\n`,
      ],
      [
        'flags a listed package whose file requires the client module',
        `export const db = require('../../../lib/prisma').prisma;\n`,
      ],
      [
        'flags a listed package whose file loads a value from @prisma/client',
        `import { PrismaClient } from '@prisma/client';\nexport const db = new PrismaClient();\n`,
      ],
      [
        'flags a listed package whose file dynamically imports a subpath of @prisma/client',
        `export const db = import('@prisma/client/runtime/library');\n`,
      ],
      [
        'flags a listed package whose file loads a local module name that does not resolve',
        `export { prisma as db } from '../../../lib/prisma?x';\n`,
      ],
      [
        'flags a listed package whose file loads a name that is not a plain package name',
        `export { PrismaClient as db } from '@prisma/client?x';\n`,
      ],
    ])('%s', (_title, text) => {
      const root = plantConfig(
        TSCONFIG,
        { name: 'planted', dependencies: LISTED },
        { ...OWN_FILES, [`${BRAND_DIR}/src/db.ts`]: text }
      );
      expect(aliasAssumptionProblems(root)).toEqual([
        expect.stringContaining(`${BRAND_DIR}/src/db.ts`),
      ]);
    });

    it('flags a listed package whose folder holds no code file to read', () => {
      const root = plantConfig(
        TSCONFIG,
        { name: 'planted', dependencies: { [BRAND]: LISTED[BRAND] } },
        { 'packages/brand-config/dist/index.cjs': `module.exports = 1;\n` }
      );
      expect(aliasAssumptionProblems(root)).toEqual([
        expect.stringContaining(BRAND_DIR),
      ]);
    });
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

    it.each([
      ['an @ alias', `import prisma from '@/lib/prisma.js';`],
      ['a relative path', `import prisma from '../../lib/prisma.js';`],
    ])(
      'flags a client imported with a .js specifier through %s',
      (_t, line) => {
        expect(
          scanPlanted({
            [PAGE]: unguardedPage(line, 'prisma.campaign.findMany()'),
          })
        ).toEqual([{ file: PAGE, rule: 'R3' }]);
      }
    );

    it('flags a query in the extends expression of a class at module level', () => {
      const page = `${CLIENT_IMPORT}${GATE_IMPORT}
class Rows extends (prisma.campaign.findMany() as any) {}

${PAGE_OPEN}${GATE}  return { Rows, organisation };
}
`;
      expect(scanPlanted({ [PAGE]: page })).toEqual([
        { file: PAGE, rule: 'R2' },
      ]);
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

    it('flags a gate re-declared as a local const arrow function beside the real import', () => {
      const page =
        CLIENT_IMPORT +
        GATE_IMPORT +
        `export default async function Page() {
  const requireOrganisationPageAccess = async (_slug: string, _returnTo: string) => ({});
  await requireOrganisationPageAccess('x', '/x');
  return prisma.campaign.findMany();
}
`;
      expect(scanPlanted({ [PAGE]: page })).toEqual([
        { file: PAGE, rule: 'R4' },
      ]);
    });

    it('flags a gate re-declared as a function declaration nested in the page body', () => {
      const page =
        CLIENT_IMPORT +
        GATE_IMPORT +
        `export default async function Page() {
  async function requireOrganisationPageAccess(_slug: string, _returnTo: string) {
    return {};
  }
  await requireOrganisationPageAccess('x', '/x');
  return prisma.campaign.findMany();
}
`;
      expect(scanPlanted({ [PAGE]: page })).toEqual([
        { file: PAGE, rule: 'R4' },
      ]);
    });

    it('flags a gate name used as a parameter of a helper', () => {
      const page =
        CLIENT_IMPORT +
        GATE_IMPORT +
        `function helper(requireOrganisationPageAccess: unknown) {
  return requireOrganisationPageAccess;
}

export default async function Page() {
  await requireOrganisationPageAccess('x', '/x');
  return { helper, rows: await prisma.campaign.findMany() };
}
`;
      expect(scanPlanted({ [PAGE]: page })).toEqual([
        { file: PAGE, rule: 'R4' },
      ]);
    });

    it('flags a second import that binds the gate name from another module', () => {
      const page =
        CLIENT_IMPORT +
        GATE_IMPORT +
        `import { other as requireOrganisationPageAccess } from '@/lib/other-access';\n` +
        PAGE_OPEN +
        GATE +
        QUERY +
        PAGE_CLOSE;
      expect(scanPlanted({ [PAGE]: page })).toEqual([
        { file: PAGE, rule: 'R4' },
      ]);
    });

    it.each([
      [
        'a destructured const',
        `const { requireOrganisationPageAccess } = {} as any;`,
      ],
      [
        'a renamed destructured const',
        `const { gate: requireOrganisationPageAccess } = {} as any;`,
      ],
      [
        'an array pattern',
        `const [requireOrganisationPageAccess] = [] as any[];`,
      ],
      ['a var', `var requireOrganisationPageAccess = 1;`],
      ['a let', `let requireOrganisationPageAccess = 1;`],
      [
        'a destructured parameter',
        `function helper({ requireOrganisationPageAccess }: any) { return 1; }`,
      ],
      [
        'an arrow function parameter',
        `const helper = (requireOrganisationPageAccess: unknown) => 1;`,
      ],
      [
        'a named function expression',
        `const helper = function requireOrganisationPageAccess() { return 1; };`,
      ],
      [
        'a catch clause',
        `try { helper(); } catch (requireOrganisationPageAccess) { helper(); }\nfunction helper() {}`,
      ],
      ['a class declaration', `class requireOrganisationPageAccess {}`],
      ['an enum declaration', `enum requireOrganisationPageAccess { A }`],
      [
        'a namespace declaration',
        `namespace requireOrganisationPageAccess { export const a = 1; }`,
      ],
      [
        'a default import',
        `import requireOrganisationPageAccess from '@/lib/other-access';`,
      ],
      [
        'a namespace import',
        `import * as requireOrganisationPageAccess from '@/lib/other-access';`,
      ],
      [
        'an import equals require',
        `import requireOrganisationPageAccess = require('@/lib/other-access');`,
      ],
    ])('flags a gate name bound by %s', (_label, declaration) => {
      const page =
        CLIENT_IMPORT +
        GATE_IMPORT +
        declaration +
        '\n' +
        PAGE_OPEN +
        GATE +
        QUERY +
        PAGE_CLOSE;
      expect(scanPlanted({ [PAGE]: page })).toEqual([
        { file: PAGE, rule: 'R4' },
      ]);
    });

    it('does not accept the real gate imported under another local name', () => {
      const page =
        CLIENT_IMPORT +
        `import { requireOrganisationPageAccess as gate } from '@/lib/auth/page-access';\n` +
        PAGE_OPEN +
        `  const { organisation } = await gate(client, returnTo);\n` +
        QUERY +
        PAGE_CLOSE;
      expect(scanPlanted({ [PAGE]: page })).toEqual([
        { file: PAGE, rule: 'R3' },
      ]);
    });

    describe('a module name that is not a plain string cannot be classified', () => {
      const dynamicPage = (
        statement: string
      ): string => `export default async function Page() {
  ${statement}
  return db.campaign.findMany();
}
`;
      it.each([
        [
          'flags a dynamic import whose module name has a substitution',
          'const { default: db } = await import(`@/lib/${"prisma"}`);',
        ],
        [
          'flags a dynamic import whose module name is concatenated',
          `const { default: db } = await import('@/lib/' + 'prisma');`,
        ],
        [
          'flags a dynamic import whose module name is an identifier',
          `const name = '@/lib/prisma';\n  const { default: db } = await import(name);`,
        ],
        [
          'flags a dynamic import whose module name is a call',
          `const { default: db } = await import(String('@/lib/prisma'));`,
        ],
        [
          'flags a dynamic import with no module name',
          `const { default: db } = await import();`,
        ],
        [
          'flags a dynamic import with a second argument',
          `const { default: db } = await import('./chart', { with: {} });`,
        ],
        [
          'flags a require whose module name is not a literal',
          `const db = require('@/lib/' + 'prisma');`,
        ],
        [
          'flags a require whose module name is an identifier',
          `const name = '@/lib/prisma';\n  const db = require(name);`,
        ],
        ['flags a require with no module name', `const db = require();`],
        [
          'flags a require with two arguments',
          `const db = require('./chart', 'x');`,
        ],
      ])('%s', (_title, statement) => {
        expect(scanPlanted({ [PAGE]: dynamicPage(statement) })).toEqual([
          { file: PAGE, rule: 'unclassified' },
        ]);
      });

      it('flags an unreadable import in a layout too', () => {
        const layout = `export default async function Layout({ children }: { children: unknown }) {
  const { default: db } = await import(\`@/lib/\${'prisma'}\`);
  await db.campaign.count();
  return children;
}
`;
        expect(scanPlanted({ 'app/x/layout.tsx': layout })).toEqual([
          { file: 'app/x/layout.tsx', rule: 'unclassified' },
        ]);
      });
    });

    describe('a require that is not the plain call of the name cannot be classified', () => {
      const requirePage = (body: string): string =>
        `export default async function Page() {
  ${body}
  return 1;
}
`;
      it.each([
        [
          'flags a require wrapped in parentheses',
          `const db = (require)('@/lib/prisma');`,
        ],
        [
          'flags a require wrapped in an as cast',
          `const db = (require as any)('@/lib/prisma');`,
        ],
        [
          'flags a require followed by a non-null assertion',
          `const db = require!('@/lib/prisma');`,
        ],
        [
          'flags a require wrapped in a satisfies expression',
          `const db = (require satisfies unknown)('@/lib/prisma');`,
        ],
        [
          'flags a require assigned to a variable and called through it',
          `const r = require;\n  const db = r('@/lib/prisma');`,
        ],
        [
          'flags a require reached through call',
          `const db = require.call(null, '@/lib/prisma');`,
        ],
        [
          'flags a require reached through resolve',
          `const where = require.resolve('@/lib/prisma');`,
        ],
        ['flags a typeof applied to require', `const kind = typeof require;`],
        [
          'flags a require passed as an argument',
          `const out = [1].map(require);`,
        ],
        [
          'flags a require used as a shorthand property',
          `const bag = { require };`,
        ],
      ])('%s', (_title, statement) => {
        expect(scanPlanted({ [PAGE]: requirePage(statement) })).toEqual([
          { file: PAGE, rule: 'unclassified' },
        ]);
      });

      it('flags a require wrapped in an angle-bracket cast', () => {
        const page = requirePage(`const db = (<any>require)('@/lib/prisma');`);
        expect(scanPlanted({ 'app/x/page.ts': page })).toEqual([
          { file: 'app/x/page.ts', rule: 'unclassified' },
        ]);
      });

      it('flags a wrapped require in a layout too', () => {
        const layout = `export default async function Layout({ children }: { children: unknown }) {
  const db = (require)('@/lib/prisma');
  return children;
}
`;
        expect(scanPlanted({ 'app/x/layout.tsx': layout })).toEqual([
          { file: 'app/x/layout.tsx', rule: 'unclassified' },
        ]);
      });

      it('flags a parameter named require', () => {
        const page = `export default async function Page(require: unknown) {
  return 1;
}
`;
        expect(scanPlanted({ [PAGE]: page })).toEqual([
          { file: PAGE, rule: 'unclassified' },
        ]);
      });

      it('flags a function named require', () => {
        const page = `function require(name: string) {
  return name;
}

export default async function Page() {
  return require('./chart');
}
`;
        expect(scanPlanted({ [PAGE]: page })).toEqual([
          { file: PAGE, rule: 'unclassified' },
        ]);
      });

      it('flags an import binding named require', () => {
        const page = `import { require } from './loader';

export default async function Page() {
  return require('./chart');
}
`;
        expect(scanPlanted({ [PAGE]: page })).toEqual([
          { file: PAGE, rule: 'unclassified' },
        ]);
      });

      it('flags a re-bound require, and the call through it still counts as a client load', () => {
        const page = `export default async function Page() {
  const require = makeRequire();
  const db = require('@/lib/prisma');
  return db.campaign.findMany();
}
declare function makeRequire(): (name: string) => any;
`;
        expect(scanPlanted({ [PAGE]: page })).toEqual([
          { file: PAGE, rule: 'R1' },
          { file: PAGE, rule: 'unclassified' },
        ]);
      });
    });

    describe('the unreadable-load rules cover every scanned file, not only pages and layouts', () => {
      it.each([
        [
          'flags a wrapped require in a template',
          'app/a/template.tsx',
          `export default function Template() {\n  const db = (require)('@/lib/prisma');\n  return db;\n}\n`,
        ],
        [
          'flags a dynamic import with a variable module name in a helper file',
          'app/a/helpers.ts',
          `export async function load(name: string) {\n  return import(name);\n}\n`,
        ],
        [
          'flags a require assigned to a variable in a not-found file',
          'app/a/not-found.tsx',
          `export default function NotFound() {\n  const r = require;\n  return r;\n}\n`,
        ],
        [
          'flags a require with a variable module name in a client component',
          'app/a/widget.tsx',
          `'use client';\nexport function Widget(name: string) {\n  return require(name);\n}\n`,
        ],
      ])('%s', (_title, file, text) => {
        expect(scanPlanted({ [file]: text })).toEqual([
          { file, rule: 'unclassified' },
        ]);
      });

      it('leaves route handlers and files under app/api unflagged, as the scanner skips them (control)', () => {
        const text = `export async function GET(name: string) {\n  const db = (require)(name);\n  return import(name);\n}\n`;
        expect(
          scanPlanted({ 'app/y/route.ts': text, 'app/api/z/helper.ts': text })
        ).toEqual([]);
      });
    });

    describe('a local module name that does not resolve to a file cannot be classified', () => {
      const loadPage = (statement: string): string =>
        `export default async function Page() {
  ${statement}
  return db.campaign.findMany();
}
`;
      it.each([
        [
          'flags a static import with a query suffix on an @ alias',
          `import db from '@/lib/prisma?x';`,
        ],
        [
          'flags a static import with a fragment suffix on an @ alias',
          `import db from '@/lib/prisma#x';`,
        ],
        [
          'flags a static import with a query suffix on a relative path',
          `import db from '../../lib/prisma?x';`,
        ],
        [
          'flags a static import with a fragment suffix on a relative path',
          `import db from '../../lib/prisma#x';`,
        ],
        [
          'flags a static import spelt in another letter case on an @ alias',
          `import db from '@/Lib/Prisma';`,
        ],
        [
          'flags a static import spelt in another letter case on a relative path',
          `import db from '../../lib/Prisma';`,
        ],
        [
          'flags a static import with an extension that is not on disk',
          `import db from '@/lib/prisma.mts';`,
        ],
        [
          'flags a static import of a missing local module that is not the client',
          `import db from './missing';`,
        ],
        [
          'flags a static import of a module name that starts with a dot and is not a path',
          `import { PrismaClient as db } from '.prisma/client';`,
        ],
        [
          'flags a side-effect import with a query suffix',
          `import '@/lib/prisma?x';`,
        ],
        [
          'flags an import-equals require with a query suffix',
          `import db = require('@/lib/prisma?x');`,
        ],
      ])('%s', (_title, line) => {
        expect(
          scanPlanted({ [PAGE]: unguardedPage(line, 'db.campaign.findMany()') })
        ).toEqual([{ file: PAGE, rule: 'unclassified' }]);
      });

      it.each([
        [
          'flags a dynamic import with a query suffix on an @ alias',
          `const { default: db } = await import('@/lib/prisma?x');`,
        ],
        [
          'flags a dynamic import with a fragment suffix on an @ alias',
          `const { default: db } = await import('@/lib/prisma#x');`,
        ],
        [
          'flags a dynamic import with a query suffix on a relative path',
          `const { default: db } = await import('../../lib/prisma?x');`,
        ],
        [
          'flags a dynamic import with a fragment suffix on a relative path',
          `const { default: db } = await import('../../lib/prisma#x');`,
        ],
        [
          'flags a dynamic import spelt in another letter case',
          `const { default: db } = await import('@/Lib/Prisma');`,
        ],
        [
          'flags a dynamic import with a query suffix written as a template literal',
          'const { default: db } = await import(`@/lib/prisma?x`);',
        ],
        [
          'flags a dynamic import of a missing local module that is not the client',
          `const db = await import('./missing');`,
        ],
        [
          'flags a require with a query suffix on an @ alias',
          `const db = require('@/lib/prisma?x');`,
        ],
        [
          'flags a require with a fragment suffix on an @ alias',
          `const db = require('@/lib/prisma#x');`,
        ],
        [
          'flags a require with a query suffix on a relative path',
          `const db = require('../../lib/prisma?x');`,
        ],
        [
          'flags a require with a fragment suffix on a relative path',
          `const db = require('../../lib/prisma#x');`,
        ],
        [
          'flags a require spelt in another letter case',
          `const db = require('@/Lib/Prisma');`,
        ],
        [
          'flags a require of a missing local module that is not the client',
          `const db = require('./missing');`,
        ],
      ])('%s', (_title, statement) => {
        expect(scanPlanted({ [PAGE]: loadPage(statement) })).toEqual([
          { file: PAGE, rule: 'unclassified' },
        ]);
      });

      it.each([
        [
          'flags a re-export with a query suffix in a helper file under app',
          `export { default as db } from '@/lib/prisma?x';\n`,
        ],
        [
          'flags a star re-export with a fragment suffix in a helper file under app',
          `export * from '../../lib/prisma#x';\n`,
        ],
      ])('%s', (_title, text) => {
        expect(scanPlanted({ 'app/a/db.ts': text })).toEqual([
          { file: 'app/a/db.ts', rule: 'unclassified' },
        ]);
      });

      it('flags an unresolved module name once for the file, however often the file loads it', () => {
        const page = `import chart from './missing';

export default async function Page() {
  const again = await import('./missing');
  return { chart, again, more: require('./missing') };
}
`;
        expect(scanPlanted({ [PAGE]: page })).toEqual([
          { file: PAGE, rule: 'unclassified' },
        ]);
      });

      it('passes an import of an asset that exists on disk (control)', () => {
        const page = `import './styles.css';
import data from './data.json';
import logo from './logo.svg';

export default function Page() {
  return { data, logo };
}
`;
        expect(
          scanPlanted({
            [PAGE]: page,
            'app/x/styles.css': 'body {}\n',
            'app/x/data.json': '{}\n',
            'app/x/logo.svg': '<svg />\n',
          })
        ).toEqual([]);
      });

      it('passes an @ alias import of an unrelated module that exists (control)', () => {
        const page = `import { format } from '@/lib/format';

export default function Page() {
  return format('x');
}
`;
        expect(
          scanPlanted({
            [PAGE]: page,
            'lib/format.ts': `export const format = (text: string) => text;\n`,
          })
        ).toEqual([]);
      });

      it('passes a relative import of a module that exists, with and without its extension (control)', () => {
        const page = `import { chart } from './chart';
import { chart as typed } from './chart.ts';
import { chart as compiled } from './chart.js';

export default function Page() {
  return { chart, typed, compiled };
}
`;
        expect(scanPlanted({ [PAGE]: page })).toEqual([]);
      });

      it('passes a folder import that resolves to its index file (control)', () => {
        const page = `import { part } from './parts';
import { part as aliased } from '@/app/x/parts';

export default function Page() {
  return { part, aliased };
}
`;
        expect(
          scanPlanted({
            [PAGE]: page,
            'app/x/parts/index.ts': `export const part = 1;\n`,
          })
        ).toEqual([]);
      });

      it('passes package imports, which are not local module names (control)', () => {
        const page = `import Link from 'next/link';
import { useState } from 'react';
import * as fs from 'node:fs';
import { thing } from '@scope/package/part';

export default async function Page() {
  const lazy = await import('some-package');
  return { Link, useState, fs, thing, lazy, plain: require('another-package') };
}
`;
        expect(scanPlanted({ [PAGE]: page })).toEqual([]);
      });

      it('passes type-only module names that do not resolve, as a type-only import is not a load (control)', () => {
        const page = `import type { Missing } from './missing';
import { type Other } from '@/lib/missing?x';
export type { Third } from './missing#x';

type Fourth = typeof import('./missing');

export default function Page(props: { a?: Missing; b?: Other; c?: Fourth }) {
  return props.a ? 1 : 0;
}
`;
        expect(scanPlanted({ [PAGE]: page })).toEqual([]);
      });

      it('leaves an unresolved module name in a route handler and under app/api unflagged, as the scanner skips them (control)', () => {
        const text = `import db from '@/lib/prisma?x';\n\nexport async function GET() {\n  return db;\n}\n`;
        expect(
          scanPlanted({ 'app/y/route.ts': text, 'app/api/z/helper.ts': text })
        ).toEqual([]);
      });
    });

    describe('a followed module with a local module name that does not resolve counts as a client module', () => {
      const HANDOFF = 'lib/handoff.ts';
      const readerPage = unguardedPage(
        `import { db } from '@/lib/handoff';`,
        'db.campaign.findMany()'
      );
      it.each([
        [
          'flags an ungated page that reads through a re-export with a query suffix',
          `export { prisma as db } from './prisma?x';\n`,
        ],
        [
          'flags an ungated page that reads through a re-export with a fragment suffix',
          `export { prisma as db } from '@/lib/prisma#x';\n`,
        ],
        [
          'flags an ungated page that reads through a re-export spelt in another letter case',
          `export { prisma as db } from './Prisma';\n`,
        ],
        [
          'flags an ungated page that reads through an import with a query suffix that is exported again',
          `import { prisma } from './prisma?x';\nexport { prisma as db };\n`,
        ],
        [
          'flags an ungated page that reads through a require with a query suffix behind a wrapper',
          `const client = require('./prisma?x');\nexport const db = client.prisma;\n`,
        ],
        [
          'flags an ungated page that reads through a dynamic import with a query suffix',
          `export const db = import('./prisma?x');\n`,
        ],
        [
          'flags an ungated page that uses a value from a module with a missing local module name',
          `import './missing';\nexport const db = 1;\n`,
        ],
      ])('%s', (_title, text) => {
        expect(scanPlanted({ [HANDOFF]: text, [PAGE]: readerPage })).toEqual([
          { file: PAGE, rule: 'R3' },
        ]);
      });

      it('flags an ungated page that uses a value from a followed file whose type is on neither list', () => {
        const page = unguardedPage(
          `import { db } from '@/lib/handoff.data';`,
          'db.campaign.findMany()'
        );
        expect(
          scanPlanted({
            'lib/handoff.data': `export const db = 1;\n`,
            [PAGE]: page,
          })
        ).toEqual([{ file: PAGE, rule: 'R3' }]);
      });

      it('flags both the helper under app with the unresolved re-export and the ungated page that reads through it', () => {
        const page = unguardedPage(
          `import { db } from '../db';`,
          'db.campaign.findMany()'
        );
        expect(
          scanPlanted({
            'app/db.ts': `export { default as db } from '@/lib/prisma?x';\n`,
            [PAGE]: page,
          })
        ).toEqual([
          { file: 'app/db.ts', rule: 'unclassified' },
          { file: PAGE, rule: 'R3' },
        ]);
      });

      it('passes a gated page that reads through a followed module with an unresolved module name (control)', () => {
        const page =
          `import { db as prisma } from '@/lib/handoff';\n` +
          GATE_IMPORT +
          PAGE_OPEN +
          GATE +
          QUERY +
          PAGE_CLOSE;
        expect(
          scanPlanted({
            [HANDOFF]: `export { prisma as db } from './prisma?x';\n`,
            [PAGE]: page,
          })
        ).toEqual([]);
      });

      it('passes a page that uses a value from a followed module whose only unresolved module names are type-only (control)', () => {
        expect(
          scanPlanted({
            [HANDOFF]: `import type { Missing } from './missing';\nexport type { Other } from './prisma?x';\nexport const db: Missing | number = 1;\n`,
            [PAGE]: readerPage,
          })
        ).toEqual([]);
      });

      it('passes a page whose only import from such a module is type-only (control)', () => {
        const page = `import type { Db } from '@/lib/handoff';

export default function Page(props: { db?: Db }) {
  return props.db ? 1 : 0;
}
`;
        expect(
          scanPlanted({
            [HANDOFF]: `export { prisma as db } from './prisma?x';\nexport type Db = unknown;\n`,
            [PAGE]: page,
          })
        ).toEqual([]);
      });

      it('passes a page that uses a value from a followed module that loads an asset and a package (control)', () => {
        expect(
          scanPlanted({
            [HANDOFF]: `import 'server-only';\nimport data from './data.json';\nexport const db = data;\n`,
            'lib/data.json': '{}\n',
            [PAGE]: readerPage,
          })
        ).toEqual([]);
      });
    });

    describe('a module name that is neither local nor a plain package name cannot be classified', () => {
      const HANDOFF = 'lib/handoff.ts';
      const loadPage = (statement: string): string =>
        `export default async function Page() {
  ${statement}
  return db.campaign.findMany();
}
`;
      /** Scans a planted tree whose page text needs the root it is planted in. */
      const scanPageFor = (
        page: (root: string) => string
      ): Array<{ file: string; rule: Rule }> => {
        const root = plant({});
        fs.writeFileSync(path.join(root, PAGE), page(root));
        return scanAppTree(root, {}).map(({ file, rule }) => ({ file, rule }));
      };

      it.each([
        [
          'flags the package name @prisma/client with a query suffix',
          `import { PrismaClient as db } from '@prisma/client?x';`,
        ],
        [
          'flags the package name @prisma/client with a fragment suffix',
          `import { PrismaClient as db } from '@prisma/client#x';`,
        ],
        [
          'flags a module name with a ~/ prefix',
          `import db from '~/lib/prisma';`,
        ],
        [
          'flags a module name with a # prefix',
          `import db from '#lib/prisma';`,
        ],
        [
          'flags a module name with a webpack loader prefix',
          `import db from '!!raw-loader!@/lib/prisma';`,
        ],
        [
          'flags a module name with a leading space',
          `import db from ' @/lib/prisma';`,
        ],
        [
          'flags a package subpath that climbs out of the package',
          `import db from 'some-package/../../lib/prisma';`,
        ],
        [
          'flags a module name that is a web address',
          `import db from 'https://example.com/prisma.js';`,
        ],
        [
          'flags a module name with a backslash',
          `import db from 'lib\\\\prisma';`,
        ],
        ['flags an empty module name', `import db from '';`],
        [
          'flags a Node builtin name with a query suffix',
          `import db from 'node:fs?x';`,
        ],
        [
          'flags a side-effect import of a package name with a query suffix',
          `import 'server-only?x';`,
        ],
        [
          'flags an import-equals require of a package name with a query suffix',
          `import db = require('@prisma/client?x');`,
        ],
      ])('%s', (_title, line) => {
        expect(
          scanPlanted({ [PAGE]: unguardedPage(line, 'db.campaign.findMany()') })
        ).toEqual([{ file: PAGE, rule: 'unclassified' }]);
      });

      it.each([
        [
          'flags a dynamic import of a package name with a query suffix',
          `const { PrismaClient: db } = await import('@prisma/client?x');`,
        ],
        [
          'flags a dynamic import of a module name with a ~/ prefix',
          `const { default: db } = await import('~/lib/prisma');`,
        ],
        [
          'flags a require of a package name with a query suffix',
          `const { PrismaClient: db } = require('@prisma/client?x');`,
        ],
        [
          'flags a require of a module name with a # prefix',
          `const db = require('#lib/prisma');`,
        ],
      ])('%s', (_title, statement) => {
        expect(scanPlanted({ [PAGE]: loadPage(statement) })).toEqual([
          { file: PAGE, rule: 'unclassified' },
        ]);
      });

      it('flags an absolute path to the client', () => {
        expect(
          scanPageFor(root =>
            unguardedPage(
              `import db from '${toPosix(path.join(root, 'lib/prisma'))}';`,
              'db.campaign.findMany()'
            )
          )
        ).toEqual([{ file: PAGE, rule: 'unclassified' }]);
      });

      it('flags a file URL to the client', () => {
        expect(
          scanPageFor(root =>
            unguardedPage(
              `import db from 'file://${toPosix(path.join(root, 'lib/prisma.ts'))}';`,
              'db.campaign.findMany()'
            )
          )
        ).toEqual([{ file: PAGE, rule: 'unclassified' }]);
      });

      it('flags a re-export from a package name with a query suffix in a helper file under app', () => {
        expect(
          scanPlanted({
            'app/a/db.ts': `export { PrismaClient } from '@prisma/client?x';\n`,
          })
        ).toEqual([{ file: 'app/a/db.ts', rule: 'unclassified' }]);
      });

      it.each([
        [
          'flags an ungated page that reads through a re-export from a package name with a query suffix',
          `export { PrismaClient as db } from '@prisma/client?x';\n`,
        ],
        [
          'flags an ungated page that reads through an import of a ~/ name that is exported again',
          `import client from '~/lib/prisma';\nexport const db = client;\n`,
        ],
        [
          'flags an ungated page that uses a value from a module that requires an absolute path',
          `const client = require('/srv/app/lib/prisma');\nexport const db = client.prisma;\n`,
        ],
      ])('%s', (_title, text) => {
        const page = unguardedPage(
          `import { db } from '@/lib/handoff';`,
          'db.campaign.findMany()'
        );
        expect(scanPlanted({ [HANDOFF]: text, [PAGE]: page })).toEqual([
          { file: PAGE, rule: 'R3' },
        ]);
      });

      it('leaves the bare name lib/prisma to the alias check, which flags the baseUrl that would make it resolve (control)', () => {
        const root = plant({
          'tsconfig.json': JSON.stringify({
            compilerOptions: { baseUrl: '.', paths: { '@/*': ['./*'] } },
          }),
          'package.json': JSON.stringify({ name: 'planted' }),
          [PAGE]: unguardedPage(
            `import db from 'lib/prisma';`,
            'db.campaign.findMany()'
          ),
        });
        expect(scanAppTree(root, {})).toEqual([]);
        expect(aliasAssumptionProblems(root)).toEqual([
          expect.stringContaining('baseUrl'),
        ]);
      });

      it('leaves the scoped name @lib/prisma to the alias check, which flags the alias that would make it resolve (control)', () => {
        const root = plant({
          'tsconfig.json': JSON.stringify({
            compilerOptions: {
              paths: { '@/*': ['./*'], '@lib/*': ['./lib/*'] },
            },
          }),
          'package.json': JSON.stringify({ name: 'planted' }),
          [PAGE]: unguardedPage(
            `import db from '@lib/prisma';`,
            'db.campaign.findMany()'
          ),
        });
        expect(scanAppTree(root, {})).toEqual([]);
        expect(aliasAssumptionProblems(root)).toEqual([
          expect.stringContaining('"@lib/*"'),
        ]);
      });

      it('passes plain package names and Node builtins of every shape (control)', () => {
        const page = `import a from 'react';
import b from 'next/link';
import 'server-only';
import d from 'lodash.debounce';
import e from '@radix-ui/react-slot';
import f from 'date-fns/locale/en-AU';
import 'some_package/dist/styles.min.css';
import * as h from 'node:fs/promises';
import * as i from 'fs';
import j from '@scope/name.js/sub/File_Name-2.mjs';
export { k } from 'another-package/part';

export default async function Page() {
  const lazy = await import('some-package/sub');
  return { a, b, d, e, f, h, i, j, lazy, plain: require('node:path') };
}
`;
        expect(scanPlanted({ [PAGE]: page })).toEqual([]);
      });

      it('passes type-only module names that are not plain package names, as a type-only import is not a load (control)', () => {
        const page = `import type { Missing } from '~/types';
import { type Other } from 'weird?x';
export type { Third } from '#types';

type Fourth = typeof import('!loader!thing');

export default function Page(props: { a?: Missing; b?: Other; c?: Fourth }) {
  return props.a ? 1 : 0;
}
`;
        expect(scanPlanted({ [PAGE]: page })).toEqual([]);
      });

      it('still flags a value import from a subpath of @prisma/client as a client of the page (control)', () => {
        const page = unguardedPage(
          `import { Prisma } from '@prisma/client/runtime/library';`,
          'Prisma.sql'
        );
        expect(scanPlanted({ [PAGE]: page })).toEqual([
          { file: PAGE, rule: 'R1' },
        ]);
      });
    });

    describe('a local module name resolves only to exactly one real file', () => {
      const HANDOFF = 'lib/handoff.ts';
      const MODULE = `export const twin = 1;\n`;
      /** Plants the files, adds one symbolic link, and scans. */
      const scanWithLink = (
        files: Record<string, string>,
        link: string,
        target: string
      ): Array<{ file: string; rule: Rule }> => {
        const root = plant(files);
        fs.symlinkSync(path.join(root, target), path.join(root, link));
        return scanAppTree(root, {}).map(({ file, rule }) => ({ file, rule }));
      };

      it.each([
        [
          'flags a local module name with two candidate files, a .ts beside a .js',
          `import { twin as db } from './twin';`,
          { 'app/x/twin.ts': MODULE, 'app/x/twin.js': MODULE },
        ],
        [
          'flags a local module name with two candidate files, a .ts beside a .tsx',
          `import { twin as db } from '@/app/x/twin';`,
          { 'app/x/twin.ts': MODULE, 'app/x/twin.tsx': MODULE },
        ],
        [
          'flags a local module name with two candidate files, a file beside a folder index',
          `import { twin as db } from './twin';`,
          { 'app/x/twin.ts': MODULE, 'app/x/twin/index.ts': MODULE },
        ],
        [
          'flags a .js module name with both the .js file and its .ts twin on disk',
          `import { twin as db } from './twin.js';`,
          { 'app/x/twin.ts': MODULE, 'app/x/twin.js': MODULE },
        ],
        [
          'flags the client module name when a second candidate file sits beside the client',
          `import db from '@/lib/prisma';`,
          { 'lib/prisma.js': MODULE },
        ],
      ])('%s', (_title, line, files) => {
        expect(
          scanPlanted({
            ...files,
            [PAGE]: unguardedPage(line, 'db.campaign.findMany()'),
          })
        ).toEqual([{ file: PAGE, rule: 'unclassified' }]);
      });

      it('flags a dynamic import and a require of a local module name with two candidate files', () => {
        const page = `export default async function Page() {
  const lazy = await import('./twin');
  return { lazy, plain: require('./pair') };
}
`;
        expect(
          scanPlanted({
            'app/x/twin.ts': MODULE,
            'app/x/twin.mjs': MODULE,
            'app/x/pair.ts': MODULE,
            'app/x/pair/index.js': MODULE,
            [PAGE]: page,
          })
        ).toEqual([
          { file: PAGE, rule: 'unclassified' },
          { file: PAGE, rule: 'unclassified' },
        ]);
      });

      it('flags a local module name under app that is a symbolic link to the client', () => {
        expect(
          scanWithLink(
            {
              [PAGE]: unguardedPage(
                `import db from './link';`,
                'db.campaign.findMany()'
              ),
            },
            'app/x/link.ts',
            'lib/prisma.ts'
          )
        ).toEqual([{ file: PAGE, rule: 'unclassified' }]);
      });

      it('flags a local module name under lib that is a symbolic link to the client', () => {
        expect(
          scanWithLink(
            {
              [PAGE]: unguardedPage(
                `import db from '@/lib/link';`,
                'db.campaign.findMany()'
              ),
            },
            'lib/link.ts',
            'lib/prisma.ts'
          )
        ).toEqual([{ file: PAGE, rule: 'unclassified' }]);
      });

      it('flags an ungated page that reads through a followed module that re-exports from a symbolic link', () => {
        expect(
          scanWithLink(
            {
              [HANDOFF]: `export { prisma as db } from './link';\n`,
              [PAGE]: unguardedPage(
                `import { db } from '@/lib/handoff';`,
                'db.campaign.findMany()'
              ),
            },
            'lib/link.ts',
            'lib/prisma.ts'
          )
        ).toEqual([{ file: PAGE, rule: 'R3' }]);
      });

      it('flags an ungated page that reads through a followed module whose re-export has two candidate files', () => {
        expect(
          scanPlanted({
            [HANDOFF]: `export { twin as db } from './twin';\n`,
            'lib/twin.ts': MODULE,
            'lib/twin.js': MODULE,
            [PAGE]: unguardedPage(
              `import { db } from '@/lib/handoff';`,
              'db.campaign.findMany()'
            ),
          })
        ).toEqual([{ file: PAGE, rule: 'R3' }]);
      });

      it('passes a module reached through a symbolic link to a folder, as only the file itself must be real (control)', () => {
        const page = `import { twin } from '@/lib/linked/twin';
import { twin as viaIndex } from '@/lib/linked';

export default function Page() {
  return { twin, viaIndex };
}
`;
        expect(
          scanWithLink(
            {
              'lib/real/twin.ts': MODULE,
              'lib/real/index.ts': MODULE,
              [PAGE]: page,
            },
            'lib/linked',
            'lib/real'
          )
        ).toEqual([]);
      });

      it('passes a module beside a folder of the same name that has no index file (control)', () => {
        const page = `import { twin } from './twin';
import { twin as part } from './twin/part';

export default function Page() {
  return { twin, part };
}
`;
        expect(
          scanPlanted({
            'app/x/twin.ts': MODULE,
            'app/x/twin/part.ts': MODULE,
            [PAGE]: page,
          })
        ).toEqual([]);
      });

      it('passes a .js module name whose only file on disk is its .ts twin, and one whose only file is the .js itself (control)', () => {
        const page = `import { twin } from './twin.js';
import { twin as plain } from './plain-js.js';

export default function Page() {
  return { twin, plain };
}
`;
        expect(
          scanPlanted({
            'app/x/twin.ts': MODULE,
            'app/x/plain-js.js': MODULE,
            [PAGE]: page,
          })
        ).toEqual([]);
      });
    });

    describe('a module-level hand-on of the client in a helper file under app is a use outside a function', () => {
      it.each([
        [
          'still flags a client handed on through a cast in a helper file (control)',
          `export const db = prisma as any;\n`,
        ],
        [
          'still flags a client handed on through a parenthesised default export in a helper file (control)',
          `export default (prisma);\n`,
        ],
        [
          'still flags a client handed on through a local alias in a helper file (control)',
          `const d = prisma;\nexport default d;\n`,
        ],
        [
          'still flags a client handed on through destructuring in a helper file (control)',
          `export const { db } = { db: prisma };\n`,
        ],
      ])('%s', (_title, text) => {
        expect(scanPlanted({ 'app/a/db.ts': CLIENT_IMPORT + text })).toEqual([
          { file: 'app/a/db.ts', rule: 'R2' },
        ]);
      });
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

    it('passes a literal dynamic import of an unrelated module in a page with no database import', () => {
      const page = `export default async function Page() {
  const chart = await import('./chart');
  const plain = await import(\`./plain\`);
  return { chart, plain };
}
`;
      expect(scanPlanted({ [PAGE]: page })).toEqual([]);
    });

    it('passes a plain require of an unrelated module in a page with no database import', () => {
      const page = `export default async function Page() {
  const chart = require('./chart');
  const plain = require(\`./plain\`);
  return { chart, plain };
}
`;
      expect(scanPlanted({ [PAGE]: page })).toEqual([]);
    });

    it('passes an import-equals require of an unrelated module', () => {
      const page = `import chart = require('./chart');

export default function Page() {
  return chart;
}
`;
      expect(scanPlanted({ [PAGE]: page })).toEqual([]);
    });

    it('passes the word require as a property name, an object key, a member name, a string and a comment', () => {
      const page = `declare const foo: { require: boolean };

interface Needs {
  require: boolean;
  require2(): void;
}

class Holder {
  require = 1;
  require() {
    return 2;
  }
}

// require('@/lib/prisma')
export default function Page() {
  const note = "require('@/lib/prisma')";
  const bag = { require: true, other: foo.require };
  return { note, bag };
}
`;
      expect(scanPlanted({ [PAGE]: page })).toEqual([]);
    });

    it('still flags a plain require of the client as a client load (control)', () => {
      const page = `export default async function Page() {
  const db = require('@/lib/prisma');
  return db.default.campaign.findMany();
}
`;
      expect(scanPlanted({ [PAGE]: page })).toEqual([
        { file: PAGE, rule: 'R1' },
      ]);
    });

    it('still flags an import-equals require of the client as a client load (control)', () => {
      const page = `import db = require('@/lib/prisma');

export default async function Page() {
  return db.default.campaign.findMany();
}
`;
      expect(scanPlanted({ [PAGE]: page })).toEqual([
        { file: PAGE, rule: 'R1' },
      ]);
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
