/**
 * auth-coverage-config.ts — single source of truth for API route auth coverage.
 *
 * Consumed by BOTH scanners:
 *   - tests/auth/route-coverage.test.ts  (the blocking CI ratchet)
 *   - scripts/check-auth-coverage.ts     (the informational CLI report)
 *
 * They previously kept private copies of these lists and had already drifted:
 * the test recognised `resolveOrgFromBearer` and exempted
 * `app/api/video/webhook/fal/` + `app/api/admin/private-refs`; the script did
 * not. Local and CI answers could therefore disagree (independent review of
 * a60c9f68, P3). The values below are the test's — the blocking gate's — so
 * consolidation does not loosen the ratchet.
 *
 * Side-effect free by design: importing this must never touch the filesystem
 * or process argv.
 *
 * @task SYN-607
 */

import * as ts from 'typescript';

/**
 * Route path prefixes that are intentionally public (no user session).
 * These use an alternative guard — webhook signature, CRON_SECRET, signed
 * token — or are open by design.
 */
export const EXEMPT_PREFIXES: readonly string[] = [
  'app/api/auth/',
  'app/api/webhooks/',
  'app/api/demo/',
  'app/api/health',
  'app/api/ping',
  'app/api/internal/',
  'app/api/cron/',
  'app/api/public/',
  'app/api/contact/',
  'app/api/blog/',
  'app/api/newsletter/',
  'app/api/monitoring/',
  'app/api/affiliates/track/',
  'app/api/affiliates/webhook', // HMAC-signature-verified webhook (Stripe-style)
  'app/api/video/webhook/fal/', // FAL_WEBHOOK_SECRET token-verified webhook (fal.ai callback)
  'app/api/bio/',
  'app/api/credential-intake', // Signed-token public intake; no user session for external CCW/provider staff
  'app/api/journey/', // SYN-677 email pixels + click redirects (no session in email clients)
  'app/api/notifications/stream', // Deprecated — returns 410 to all callers
  'app/api/pr/channels', // Public static metadata catalogue
  'app/api/pr/press-releases/newsroom/', // Public newsroom for AI crawler indexing
  'app/api/reviews/google', // Public widget for landing pages (orgId in query, no PII)
  'app/api/waitlist', // Public sign-up, rate-limited via authStrict
  'app/api/opportunity-map/', // Public scan, feedback and consent-bound handoff; same-origin + rate-limited
  'app/api/v1/connections/status', // #492 Mission Control status manifest — presence-only booleans, no secrets/PII/org data
  'app/api/admin/private-refs', // #740 Signed-token ingest (x-ingest-token, timingSafeEqual, fail-closed); no user session
];

/**
 * Substring patterns that indicate a route imports a recognised auth utility.
 *
 * Substring matching is deliberately kept for the pre-existing entries — they
 * are module paths and env-var names, and tightening them is a separate change
 * with its own regression risk. New guards go in AUTH_GUARD_IMPORTS below.
 */
export const AUTH_IMPORT_PATTERNS: readonly string[] = [
  '@/lib/auth/', // New canonical auth location (jwt-utils, with-auth)
  'lib/auth/', // Relative import of canonical auth
  '@/lib/api/define-route', // defineRoute()/defineOrgRoute() — always wrap withAuth/withOrg (WS5)
  '@/lib/middleware/withAuth', // Legacy middleware pattern (pre-SYN-607)
  '@/lib/middleware/auth', // Legacy auth middleware variant
  '@/lib/middleware/require-api-key', // requireApiKey() — service-to-service API key
  '@/lib/admin/verify-admin', // verifyAdmin() — admin role gate
  '@/lib/security/api-security-checker', // APISecurityChecker — JWT + session
  '@/lib/platform/server', // createServerClient — server-side Supabase session
  'supabase.auth.getUser', // Inline Supabase token verification (header-based)
  'platformClient.auth.getUser', // JWT/platform token verification after Supabase removal
  'ADMIN_API_KEY',
  'CRON_SECRET',
  'UNITE_GROUP_EVENTS_API_KEY', // Unite-Group service API key (x-unite-group-api-key header)
  'resolveOrgFromBearer', // MCP bearer-token org resolution
];

/**
 * Guards recognised by CALL SITE rather than by import string.
 *
 * These are checked against the TypeScript AST, not the raw text: the guard
 * must be a real named import from the approved module AND that binding must
 * actually be called. Regex over source text was not enough — a route could
 * satisfy it with a commented-out call, a fully commented import-and-call, or
 * the name inside a string literal (independent review of a9b5f0e8, P2).
 * Comments and string literals do not exist in the AST, so those spoofs cannot
 * reach the recogniser at all.
 */
export const AUTH_GUARD_IMPORTS: readonly { name: string; module: RegExp }[] = [
  {
    // IntentScape gate — wraps APISecurityChecker.check(AUTHENTICATED_READ|WRITE)
    // + getEffectiveOrganizationId(), 401/403 fail-closed (lib/intentscape/api.ts).
    name: 'authenticateIntentScapeRequest',
    module: /(^|\/)lib\/intentscape\/api$/,
  },
];

/**
 * True when `content` really imports one of AUTH_GUARD_IMPORTS from its
 * approved module and calls the imported binding.
 */
export function hasAstAuthGuard(content: string): boolean {
  const FILE = '/__auth-coverage__/route.ts';

  const host: ts.CompilerHost = {
    fileExists: name => name === FILE,
    readFile: name => (name === FILE ? content : undefined),
    getSourceFile: (name, languageVersion) =>
      name === FILE
        ? ts.createSourceFile(
            name,
            content,
            languageVersion,
            true,
            ts.ScriptKind.TS
          )
        : undefined,
    getDefaultLibFileName: () => 'lib.d.ts',
    writeFile: () => undefined,
    getCurrentDirectory: () => '/',
    getCanonicalFileName: name => name,
    useCaseSensitiveFileNames: () => true,
    getNewLine: () => '\n',
  };

  // `noResolve` keeps this to a single in-memory file — the guard module is
  // never loaded. Binding resolution inside the file still works, which is all
  // the checker is asked for below.
  const program = ts.createProgram(
    [FILE],
    { noResolve: true, noLib: true },
    host
  );
  const source = program.getSourceFile(FILE);
  if (!source) return false;
  const checker = program.getTypeChecker();

  // The exact ImportSpecifier nodes that bring an approved guard into scope.
  const guardSpecifiers = new Set<ts.ImportSpecifier>();

  for (const statement of source.statements) {
    if (!ts.isImportDeclaration(statement)) continue;
    if (!ts.isStringLiteral(statement.moduleSpecifier)) continue;
    const clause = statement.importClause;
    // A type-only import contributes no runtime binding, so it cannot gate.
    if (!clause || clause.isTypeOnly) continue;
    if (!clause.namedBindings || !ts.isNamedImports(clause.namedBindings))
      continue;

    const specifier = statement.moduleSpecifier.text.replace(/^@\//, '');
    for (const element of clause.namedBindings.elements) {
      if (element.isTypeOnly) continue;
      const importedName = (element.propertyName ?? element.name).text;
      const matches = AUTH_GUARD_IMPORTS.some(
        guard => guard.name === importedName && guard.module.test(specifier)
      );
      if (matches) guardSpecifiers.add(element);
    }
  }

  if (guardSpecifiers.size === 0) return false;

  // Resolve each callee to its declaration rather than comparing names. A
  // parameter or local that shadows the imported name resolves to that local
  // declaration, not to the ImportSpecifier, so shadowed calls do not count
  // (independent review of 91be30ac, P2).
  // Traversal stops at nested function boundaries. Descending into them let an
  // uncalled helper *inside* the handler certify it — the same unused-helper
  // class as before, one scope deeper (independent review of 036128fb, P2).
  const callsGuard = (body: ts.Node): boolean => {
    let found = false;
    const visit = (node: ts.Node): void => {
      if (found) return;
      if (isFunctionScope(node)) return;
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
        const symbol = checker.getSymbolAtLocation(node.expression);
        const declarations = symbol?.declarations ?? [];
        if (
          declarations.some(
            declaration =>
              ts.isImportSpecifier(declaration) &&
              guardSpecifiers.has(declaration)
          )
        ) {
          found = true;
          return;
        }
      }
      ts.forEachChild(node, visit);
    };
    ts.forEachChild(body, visit);
    return found;
  };

  // EVERY exported HTTP handler must call the guard in its own body. Scanning
  // the whole file was not enough: a call in an unused helper, in module
  // initialisation, or in one handler while a sibling export went unguarded
  // still certified the route (independent review of 14837749, P2).
  const handlers = exportedHandlerBodies(source, checker);
  if (handlers.length === 0) return false;
  // An unresolved handler body is not a proven one.
  return handlers.every(body => body !== undefined && callsGuard(body));
}

/**
 * A node that opens a new function scope — traversal must not cross it.
 *
 * `ts.isFunctionLike` rather than an enumerated list: the enumerated version
 * omitted get/set accessors, so an unused object getter calling the guard still
 * certified its handler (independent review of 610f5a4f, P2). Enumerating node
 * kinds is exactly how that gap appeared; ask TypeScript instead.
 *
 * Known conservative false negative: a guard called inside a directly-invoked
 * IIFE is not counted. Recognising only *provably* invoked callbacks is the
 * safe direction for a gate, and no route in the repo uses that shape.
 */
function isFunctionScope(node: ts.Node): boolean {
  return (
    ts.isFunctionLike(node) ||
    ts.isClassDeclaration(node) ||
    ts.isClassExpression(node)
  );
}

const HTTP_METHODS = new Set([
  'GET',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
  'HEAD',
  'OPTIONS',
]);

function isExported(node: ts.Node): boolean {
  return (
    ts.canHaveModifiers(node) &&
    (ts.getModifiers(node) ?? []).some(
      modifier => modifier.kind === ts.SyntaxKind.ExportKeyword
    )
  );
}

/**
 * Bodies of the file's exported GET/POST/... route handlers.
 *
 * Returns the function BODY, never the whole initializer expression: an
 * initializer would drag in anything evaluated while constructing the handler,
 * which is module-initialisation work, not handler work.
 *
 * `undefined` for a handler whose implementation this resolver cannot reach —
 * a call to a wrapper, a cross-file re-export. Those are unresolved, not
 * proven, and the caller must treat them as such.
 */
function handlerBody(
  node: ts.Node | undefined,
  checker: ts.TypeChecker
): ts.Node | undefined {
  if (!node) return undefined;
  if (ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node)) {
    return node.body;
  }
  if (ts.isArrowFunction(node)) return node.body;
  // `export const GET = handle` / `export { handle as GET }` — follow the
  // local binding to its declaration (independent review of 036128fb, P3).
  if (ts.isIdentifier(node)) {
    let symbol = checker.getSymbolAtLocation(node);
    // `export { GET }` resolves to the ExportSpecifier alias, not the function
    // it re-exports (independent review of 610f5a4f, P3).
    if (symbol && symbol.flags & ts.SymbolFlags.Alias) {
      try {
        symbol = checker.getAliasedSymbol(symbol);
      } catch {
        // Unresolvable alias — leave it unproven rather than guessing.
      }
    }
    for (const declaration of symbol?.declarations ?? []) {
      if (ts.isFunctionDeclaration(declaration)) return declaration.body;
      if (ts.isVariableDeclaration(declaration)) {
        return handlerBody(declaration.initializer, checker);
      }
    }
  }
  return undefined;
}

function exportedHandlerBodies(
  source: ts.SourceFile,
  checker: ts.TypeChecker
): (ts.Node | undefined)[] {
  const bodies: (ts.Node | undefined)[] = [];

  for (const statement of source.statements) {
    if (
      ts.isFunctionDeclaration(statement) &&
      statement.name &&
      HTTP_METHODS.has(statement.name.text) &&
      isExported(statement) &&
      statement.body
    ) {
      bodies.push(statement.body);
      continue;
    }

    if (ts.isVariableStatement(statement) && isExported(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (
          ts.isIdentifier(declaration.name) &&
          HTTP_METHODS.has(declaration.name.text)
        ) {
          bodies.push(handlerBody(declaration.initializer, checker));
        }
      }
      continue;
    }

    // `export { handle as GET }`
    if (
      ts.isExportDeclaration(statement) &&
      !statement.moduleSpecifier &&
      statement.exportClause &&
      ts.isNamedExports(statement.exportClause)
    ) {
      for (const element of statement.exportClause.elements) {
        if (!HTTP_METHODS.has(element.name.text)) continue;
        bodies.push(handlerBody(element.propertyName ?? element.name, checker));
      }
    }
  }

  return bodies;
}

/** True when the file content shows a recognised auth guard. */
export function hasAuthGuard(content: string): boolean {
  if (AUTH_IMPORT_PATTERNS.some(pattern => content.includes(pattern))) {
    return true;
  }
  return hasAstAuthGuard(content);
}

/** True when the route path is on the intentionally-public allowlist. */
export function isExemptPath(relPath: string): boolean {
  const normalised = relPath.replace(/\\/g, '/');
  return EXEMPT_PREFIXES.some(prefix => normalised.includes(prefix));
}
