#!/usr/bin/env node
/**
 * gen-openapi.mjs — generate the published machine contract (spec M3, phase P3).
 *
 *   node scripts/api/gen-openapi.mjs                 write docs/api/openapi.generated.json
 *   node scripts/api/gen-openapi.mjs --check [--exempt <file>]
 *   node scripts/api/gen-openapi.mjs --control       planted negative control (risk R21)
 *
 * Inputs are read as source text: every app/api/**\/route.{ts,tsx,js} and
 * scripts/auth-coverage-config.ts. Route modules are never imported by this
 * process. Zod request schemas are converted with inputJsonSchema() from
 * lib/ai/structured-output.ts inside a child `npx tsx` process (a copy of the
 * route with an extra export line, network disabled, fixed environment,
 * per-probe timeout). Any probe
 * failure is recorded as `x-synthex-schema: unresolved` with the reason; no
 * schema is ever invented.
 *
 * --check exits 1 when (a) the committed contract differs from the regenerated
 * one, or (b) the committed path count != route.ts files - exempt entries.
 * (c) an operation whose success response is unresolved is not listed, with a
 * reason, in scripts/api/success-exceptions.json (protected), or a listed entry
 * is stale or malformed.
 * Exit 2 when an input cannot be read. Default exempt list:
 * scripts/api/exempt-routes.json (protected; growth travels as
 * proposals/P3/scripts/api/exempt-routes.json, rule B2).
 *
 * Internal flags: --root <dir> (tests / control), --probe-child <job> (child).
 */

import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

const REPO = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..'
);
const SPEC_REL = 'docs/api/openapi.generated.json';
const DEFAULT_EXEMPT = 'scripts/api/exempt-routes.json';
const DEFAULT_SUCCESS_EXCEPTIONS = 'scripts/api/success-exceptions.json';
const AUTH_CONFIG = path.join(REPO, 'scripts/auth-coverage-config.ts');
const PROBE_DIR = path.join(REPO, '.cache/gen-openapi');
/** Every route file Next.js serves, the same set gen-machine-docs reads (route.tsx and route.js included). */
export const ROUTE_FILE_RE = /^route\.(ts|tsx|js)$/;

/** TypeScript script kind for a route source path, so JSX and plain JS parse correctly. */
function scriptKindFor(rel) {
  if (rel.endsWith('x')) return ts.ScriptKind.TSX;
  if (rel.endsWith('.js')) return ts.ScriptKind.JS;
  return ts.ScriptKind.TS;
}
const PROBE_TIMEOUT_MS = 60_000;
const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];
const PARSE_FNS = new Set([
  'parse',
  'safeParse',
  'parseAsync',
  'safeParseAsync',
]);

class InputError extends Error {}

// ---------------------------------------------------------------------------
// Small utilities
// ---------------------------------------------------------------------------

function sortKeys(value) {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === 'object') {
    const out = {};
    for (const key of Object.keys(value).sort())
      out[key] = sortKeys(value[key]);
    return out;
  }
  return value;
}

export function canonical(value) {
  return JSON.stringify(sortKeys(value), null, 2) + '\n';
}

const sha = text => createHash('sha256').update(text).digest('hex');

function readText(file, what) {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch (error) {
    throw new InputError(
      `cannot read ${what} (${file}): ${error.code ?? error.message}`
    );
  }
}

function listRouteFiles(root) {
  const apiDir = path.join(root, 'app/api');
  if (!fs.existsSync(apiDir))
    throw new InputError(`cannot read app/api under ${root}`);
  const out = [];
  const walk = dir => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (ROUTE_FILE_RE.test(entry.name))
        out.push(path.relative(root, full).split(path.sep).join('/'));
    }
  };
  walk(apiDir);
  return out.sort();
}

export function readExempt(file) {
  const text = readText(file, 'exempt list');
  let data;
  try {
    data = JSON.parse(text);
  } catch (error) {
    throw new InputError(`exempt list ${file} is not JSON: ${error.message}`);
  }
  if (!Array.isArray(data))
    throw new InputError(`exempt list ${file} must be a JSON array`);
  return data.map(entry => {
    const file =
      typeof entry === 'string' ? entry : (entry?.file ?? entry?.path);
    if (typeof file !== 'string')
      throw new InputError(
        `exempt entry without a file: ${JSON.stringify(entry)}`
      );
    return file;
  });
}

// ---------------------------------------------------------------------------
// Path mapping
// ---------------------------------------------------------------------------

/** app/api/a/[id]/route.ts (or .tsx/.js) -> { path: '/api/a/{id}', params: [...] } */
export function routePathFor(rel) {
  const segments = rel
    .replace(/^app\//, '')
    .replace(/\/route\.(ts|tsx|js)$/, '')
    .split('/');
  const params = [];
  const parts = [];
  for (const segment of segments) {
    if (/^\(.*\)$/.test(segment)) continue; // route group: not part of the URL
    let match;
    if ((match = /^\[\[\.\.\.(.+)\]\]$/.exec(segment))) {
      params.push({ name: match[1], catchAll: true, optional: true });
      parts.push(`{${match[1]}}`);
    } else if ((match = /^\[\.\.\.(.+)\]$/.exec(segment))) {
      params.push({ name: match[1], catchAll: true, optional: false });
      parts.push(`{${match[1]}}`);
    } else if ((match = /^\[(.+)\]$/.exec(segment))) {
      params.push({ name: match[1], catchAll: false, optional: false });
      parts.push(`{${match[1]}}`);
    } else {
      parts.push(segment);
    }
  }
  return { path: '/' + parts.join('/'), params };
}

export function operationIdFor(method, apiPath) {
  const words = apiPath
    .replace(/^\/api\/?/, '')
    .split('/')
    .filter(Boolean)
    .map(part => (part.startsWith('{') ? `by_${part.slice(1, -1)}` : part))
    .map(part => part.replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, ''));
  return [method.toLowerCase(), ...words].join('_') || method.toLowerCase();
}

export function tagFor(apiPath) {
  const first = apiPath.replace(/^\/api\/?/, '').split('/')[0];
  return first ? first.replace(/^\{(.*)\}$/, '$1') : 'root';
}

// ---------------------------------------------------------------------------
// Auth signals — patterns are read as text from scripts/auth-coverage-config.ts
// ---------------------------------------------------------------------------

function stringsInBlock(text, name) {
  const start = text.indexOf(`export const ${name}`);
  if (start < 0) throw new InputError(`auth-coverage-config.ts has no ${name}`);
  const open = text.indexOf('[', text.indexOf('=', start));
  const close = text.indexOf('];', open);
  const body = text
    .slice(open, close)
    .split('\n')
    .map(line => line.replace(/\s\/\/.*$/, ''))
    .join('\n');
  return [...body.matchAll(/'([^']+)'/g)].map(match => match[1]);
}

export function loadAuthConfig(file = AUTH_CONFIG) {
  const text = readText(file, 'auth coverage config');
  const guardStart = text.indexOf('export const AUTH_GUARD_IMPORTS');
  const guardEnd = text.indexOf('];', guardStart);
  if (guardStart < 0)
    throw new InputError('auth-coverage-config.ts has no AUTH_GUARD_IMPORTS');
  const guards = [
    ...text.slice(guardStart, guardEnd).matchAll(/name:\s*'([^']+)'/g),
  ].map(m => m[1]);
  return {
    exemptPrefixes: stringsInBlock(text, 'EXEMPT_PREFIXES'),
    importPatterns: stringsInBlock(text, 'AUTH_IMPORT_PATTERNS'),
    guards,
  };
}

/** Patterns whose credential is not the user JWT (bearer or auth-token cookie). */
const PATTERN_SCHEMES = {
  CRON_SECRET: ['cronSecret'],
  '@/lib/middleware/require-api-key': ['cookieAuth'], // reads only the auth-token cookie
  resolveOrgFromBearer: ['mcpKeyBearer'],
  ADMIN_API_KEY: [], // the header it is compared with is detected below
  UNITE_GROUP_EVENTS_API_KEY: [],
};
const JWT = ['bearerAuth', 'cookieAuth'];
const SCHEME_ORDER = [
  'bearerAuth',
  'cookieAuth',
  'cronSecret',
  'mcpKeyBearer',
  'apiKeyAuth',
];

function headerSchemeName(header) {
  if (header === 'x-api-key') return 'apiKeyAuth';
  return header.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase()) + 'Header';
}

/** Source text with comments removed, so a commented-out guard is not a guard. */
function stripComments(source, rel = 'route.ts') {
  const file = ts.createSourceFile(
    rel,
    source,
    ts.ScriptTarget.Latest,
    true,
    scriptKindFor(rel)
  );
  return ts.createPrinter({ removeComments: true }).printFile(file);
}

export function inferSecurity(rel, source, config) {
  const code = stripComments(source, rel);
  const schemes = new Set();
  const signals = [];
  for (const pattern of config.importPatterns) {
    if (!code.includes(pattern)) continue;
    if (pattern.includes('lib/auth/') && !hasNonCronAuthImport(code)) continue;
    signals.push(pattern);
    for (const scheme of PATTERN_SCHEMES[pattern] ?? JWT) schemes.add(scheme);
  }
  if (
    /from\s+['"]@\/lib\/auth\/cron-auth['"]/.test(code) ||
    /\bverifyCron\w*\(/.test(code)
  ) {
    schemes.add('cronSecret');
    if (!signals.includes('CRON_SECRET')) signals.push('cron-auth');
  }
  for (const guard of config.guards) {
    if (new RegExp(`\\b${guard}\\s*\\(`).test(code)) {
      signals.push(guard);
      for (const scheme of JWT) schemes.add(scheme);
    }
  }
  const headerSchemes = {};
  for (const match of code.matchAll(
    /headers\.get\(\s*['"]([A-Za-z0-9-]+)['"]\s*\)/g
  )) {
    const header = match[1].toLowerCase();
    if (/signature/.test(header)) {
      signals.push(`signature:${header}`);
    } else if (/^x-.*(key|token|secret)$/.test(header)) {
      const name = headerSchemeName(header);
      headerSchemes[name] = header;
      schemes.add(name);
      signals.push(`header:${header}`);
    }
  }
  const ordered = [...schemes].sort((a, b) => {
    const ia = SCHEME_ORDER.indexOf(a);
    const ib = SCHEME_ORDER.indexOf(b);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b);
  });
  const exemptPrefix =
    config.exemptPrefixes.find(prefix => rel.startsWith(prefix)) ?? null;
  return {
    security: ordered.map(name => ({ [name]: [] })),
    signals: [...new Set(signals)].sort(),
    exemptPrefix,
    headerSchemes,
  };
}

function hasNonCronAuthImport(code) {
  for (const match of code.matchAll(
    /from\s+['"]((?:@\/|\.\.?\/)?(?:[\w./-]*\/)?lib\/auth\/[^'"]+)['"]/g
  )) {
    if (!/cron-auth$/.test(match[1])) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Static route analysis (methods, schema candidates, status codes)
// ---------------------------------------------------------------------------

function topLevelBindings(file) {
  const values = new Map(); // name -> node (function / initializer)
  const imported = new Set();
  for (const statement of file.statements) {
    if (
      ts.isImportDeclaration(statement) &&
      statement.importClause &&
      !statement.importClause.isTypeOnly
    ) {
      const clause = statement.importClause;
      if (clause.name) imported.add(clause.name.text);
      const bindings = clause.namedBindings;
      if (bindings && ts.isNamespaceImport(bindings))
        imported.add(bindings.name.text);
      if (bindings && ts.isNamedImports(bindings)) {
        for (const element of bindings.elements)
          if (!element.isTypeOnly) imported.add(element.name.text);
      }
    } else if (ts.isFunctionDeclaration(statement) && statement.name) {
      values.set(statement.name.text, statement);
    } else if (ts.isVariableStatement(statement)) {
      for (const decl of statement.declarationList.declarations) {
        if (ts.isIdentifier(decl.name))
          values.set(decl.name.text, decl.initializer ?? decl);
      }
    }
  }
  return { values, imported };
}

function isExported(node) {
  return !!node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword);
}

/** method -> { node } (local handler) or { reexport: specifier, name } */
function exportedMethods(file) {
  const out = new Map();
  const { values } = topLevelBindings(file);
  for (const statement of file.statements) {
    if (
      ts.isFunctionDeclaration(statement) &&
      statement.name &&
      isExported(statement)
    ) {
      if (METHODS.includes(statement.name.text))
        out.set(statement.name.text, { node: statement });
    } else if (ts.isVariableStatement(statement) && isExported(statement)) {
      for (const decl of statement.declarationList.declarations) {
        if (ts.isIdentifier(decl.name) && METHODS.includes(decl.name.text)) {
          out.set(decl.name.text, { node: decl.initializer ?? decl });
        }
      }
    } else if (
      ts.isExportDeclaration(statement) &&
      !statement.isTypeOnly &&
      statement.exportClause &&
      ts.isNamedExports(statement.exportClause)
    ) {
      for (const element of statement.exportClause.elements) {
        const exportedName = element.name.text;
        if (!METHODS.includes(exportedName)) continue;
        const localName = (element.propertyName ?? element.name).text;
        if (
          statement.moduleSpecifier &&
          ts.isStringLiteral(statement.moduleSpecifier)
        ) {
          out.set(exportedName, {
            reexport: statement.moduleSpecifier.text,
            name: localName,
          });
        } else {
          out.set(exportedName, { node: values.get(localName) ?? null });
        }
      }
    }
  }
  return out;
}

/**
 * Collect handler nodes plus same-file top-level functions they reference
 * (called or passed, e.g. `withAuth(handlePost)`), transitively.
 */
function handlerScope(node, values) {
  const nodes = [];
  const seen = new Set();
  const visit = n => {
    if (!n || seen.has(n)) return;
    seen.add(n);
    nodes.push(n);
    const walk = child => {
      if (ts.isIdentifier(child)) {
        const target = values.get(child.text);
        if (
          target &&
          (ts.isFunctionDeclaration(target) ||
            ts.isArrowFunction(target) ||
            ts.isFunctionExpression(target) ||
            ts.isCallExpression(target))
        )
          visit(target);
      }
      ts.forEachChild(child, walk);
    };
    if (ts.isIdentifier(n)) walk(n);
    else ts.forEachChild(n, walk);
  };
  visit(node);
  return nodes;
}

function localDeclarations(nodes) {
  const decls = new Map();
  const walk = n => {
    if (ts.isVariableDeclaration(n)) {
      if (ts.isIdentifier(n.name))
        decls.set(n.name.text, n.initializer?.getText() ?? '');
      else if (ts.isObjectBindingPattern(n.name)) {
        for (const element of n.name.elements)
          if (ts.isIdentifier(element.name))
            decls.set(element.name.text, n.initializer?.getText() ?? '');
      }
    } else if (ts.isParameter(n) && ts.isIdentifier(n.name)) {
      decls.set(n.name.text, '');
    }
    ts.forEachChild(n, walk);
  };
  for (const node of nodes) walk(node);
  return decls;
}

function classifyInput(argText, decls, method) {
  let text = argText;
  const first = /^[A-Za-z_$][\w$]*/.exec(argText.replace(/^await\s+/, ''))?.[0];
  if (first && decls.has(first)) text += ' ' + decls.get(first);
  if (
    /\.json\(|formData\(|\.text\(\)/.test(text) ||
    /^body\b|\bbody$/.test(argText)
  )
    return 'body';
  if (/searchParams|\bquery\b|nextUrl/.test(text)) return 'query';
  if (/\bparams\b/.test(text)) return 'path';
  return ['GET', 'HEAD', 'DELETE', 'OPTIONS'].includes(method)
    ? 'query'
    : 'body';
}

function rootIdentifier(expr) {
  let e = expr;
  while (
    ts.isPropertyAccessExpression(e) ||
    ts.isCallExpression(e) ||
    ts.isParenthesizedExpression(e) ||
    ts.isNonNullExpression(e)
  ) {
    e = ts.isCallExpression(e) ? e.expression : e.expression;
  }
  return ts.isIdentifier(e) ? e.text : null;
}

/** Schema candidates used by one handler: [{ kind, expr, local? }] */
function schemaCandidates(nodes, method, bindings) {
  const decls = localDeclarations(nodes);
  const found = [];
  const add = (kind, schemaExpr) => {
    const text = schemaExpr.getText();
    const root = rootIdentifier(schemaExpr);
    const moduleLevel =
      root &&
      !decls.has(root) &&
      (bindings.values.has(root) || bindings.imported.has(root));
    found.push({
      kind,
      expr: text,
      local: !moduleLevel
        ? `schema \`${text.slice(0, 60)}\` is not a module-level binding`
        : null,
    });
  };
  const walk = n => {
    if (
      ts.isCallExpression(n) &&
      ts.isPropertyAccessExpression(n.expression) &&
      PARSE_FNS.has(n.expression.name.text)
    ) {
      const target = n.expression.expression;
      const root = rootIdentifier(target);
      const initText = root
        ? (decls.get(root) ?? bindings.values.get(root)?.getText?.() ?? '')
        : '';
      const looksZod =
        root === 'z' ||
        /schema/i.test(target.getText()) ||
        /^z\./.test(initText);
      if (
        looksZod &&
        n.arguments.length > 0 &&
        !/^JSON$/.test(target.getText())
      ) {
        add(classifyInput(n.arguments[0].getText(), decls, method), target);
      }
    }
    if (
      ts.isCallExpression(n) &&
      ts.isIdentifier(n.expression) &&
      /^define(Org)?Route$/.test(n.expression.text)
    ) {
      const options = n.arguments[0];
      if (options && ts.isObjectLiteralExpression(options)) {
        for (const prop of options.properties) {
          if (
            ts.isPropertyAssignment(prop) &&
            ts.isIdentifier(prop.name) &&
            (prop.name.text === 'body' || prop.name.text === 'query')
          ) {
            add(prop.name.text, prop.initializer);
          }
        }
      }
    }
    ts.forEachChild(n, walk);
  };
  for (const node of nodes) walk(node);
  const unique = new Map();
  for (const c of found) unique.set(`${c.kind}\u0000${c.expr}`, c);
  return [...unique.values()];
}

// The status lib/api/not-provisioned.ts answers for an unprovisioned feature, read from the source
// (never assumed). Unreadable => null, and those responses count as unresolved.
let npStatus;
function notProvisionedStatus() {
  if (npStatus !== undefined) return npStatus;
  try {
    const src = fs.readFileSync(
      path.join(REPO, 'lib/api/not-provisioned.ts'),
      'utf8'
    );
    const m = /NOT_PROVISIONED_STATUS\s*=\s*(\d{3})/.exec(src);
    npStatus = m ? m[1] : null;
  } catch {
    npStatus = null;
  }
  return npStatus;
}

// Shared response helpers whose status rule is read from their own source, never assumed: each entry
// names the file and a pattern its signature must still match. A helper whose source no longer
// matches is dropped, and its responses count as unresolved.
const RESPONSE_HELPERS = [
  {
    callee: 'APISecurityChecker.createSecureResponse',
    file: 'lib/security/api-security-checker.ts',
    signature:
      /static createSecureResponse<T>\(\s*data: T,\s*status: number = 200/,
    status: { arg: 1, default: '200' },
  },
  {
    callee: 'ResponseOptimizer.createResponse',
    file: 'lib/api/response-optimizer.ts',
    signature: /static createResponse<T>\([\s\S]{0,200}?status = 200,/,
    status: { optionsArg: 1, default: '200' },
  },
  {
    callee: 'ResponseOptimizer.createErrorResponse',
    file: 'lib/api/response-optimizer.ts',
    signature:
      /static createErrorResponse\(\s*message: string,\s*status: number = 500/,
    status: { arg: 1, default: '500' },
  },
];
let verifiedHelpers;
function responseHelpers() {
  if (verifiedHelpers) return verifiedHelpers;
  verifiedHelpers = new Map();
  for (const h of RESPONSE_HELPERS) {
    let src = '';
    try {
      src = fs.readFileSync(path.join(REPO, h.file), 'utf8');
    } catch {
      continue;
    }
    if (h.signature.test(src)) verifiedHelpers.set(h.callee, h);
  }
  return verifiedHelpers;
}

/** Every status a conditional (a ? 200 : 503, nested) can produce, or null if any branch is unknown. */
function statusesOf(expr) {
  let e = expr;
  while (e && ts.isParenthesizedExpression(e)) e = e.expression;
  if (e && ts.isConditionalExpression(e)) {
    const a = statusesOf(e.whenTrue);
    const b = statusesOf(e.whenFalse);
    return a && b ? [...new Set([...a, ...b])] : null;
  }
  const one = statusOf(e);
  return one ? [one] : null;
}

/** A status expression: numeric literal, or the not-provisioned constant; else null. */
function statusOf(expr) {
  if (!expr) return null;
  if (ts.isNumericLiteral(expr)) return expr.text;
  if (ts.isIdentifier(expr) && expr.text === 'NOT_PROVISIONED_STATUS')
    return notProvisionedStatus();
  return null;
}

/**
 * What each `return` in the handler scope answers: a status code, or 'unresolved' when the
 * returned value is not a recognised response (a helper, a variable, a callback's value). Codex
 * on P3 ba0d0871: the contract used to invent 200 for handlers with no literal success, so a
 * route that only answers 503 FEATURE_NOT_PROVISIONED was documented as succeeding.
 */
const CALLBACK_METHODS = new Set([
  'map',
  'flatMap',
  'filter',
  'reduce',
  'forEach',
  'some',
  'every',
  'find',
  'findIndex',
  'sort',
  'then',
  'catch',
  'finally',
]);
function returnOutcomes(nodes, values = new Map()) {
  const out = new Set();
  const why = new Set();
  // What an unresolved return was, for the reason recorded in the contract.
  const describe = raw => {
    let e = raw;
    while (
      e &&
      (ts.isAwaitExpression(e) ||
        ts.isParenthesizedExpression(e) ||
        ts.isAsExpression(e) ||
        ts.isNonNullExpression(e))
    )
      e = e.expression;
    if (ts.isCallExpression(e))
      return `${e.expression.getText().replace(/\s+/g, '')}()`;
    if (ts.isNewExpression(e)) return `new ${e.expression.getText()}()`;
    if (ts.isIdentifier(e)) return `variable ${e.text}`;
    return ts.SyntaxKind[e.kind];
  };
  const unwrap = e => {
    while (
      e &&
      (ts.isAwaitExpression(e) ||
        ts.isParenthesizedExpression(e) ||
        ts.isAsExpression(e) ||
        ts.isNonNullExpression(e))
    )
      e = e.expression;
    return e;
  };
  const optsStatus = arg => {
    if (!arg) return '200';
    if (!ts.isObjectLiteralExpression(arg))
      return statusesOf(arg) ?? 'unresolved';
    const prop = arg.properties.find(
      p =>
        ts.isPropertyAssignment(p) &&
        ts.isIdentifier(p.name) &&
        p.name.text === 'status'
    );
    return prop ? (statusesOf(prop.initializer) ?? 'unresolved') : '200';
  };
  const RESPONSES = ['NextResponse', 'Response'];
  const classify = raw => {
    const e = unwrap(raw);
    if (!e) return 'unresolved';
    if (ts.isCallExpression(e)) {
      const c = e.expression;
      if (ts.isIdentifier(c) && c.text === 'notProvisionedResponse')
        return notProvisionedStatus() ?? 'unresolved';
      const helper = responseHelpers().get(c.getText().replace(/\s+/g, ''));
      if (helper) {
        if (helper.status.arg !== undefined) {
          const a = e.arguments[helper.status.arg];
          return a ? (statusesOf(a) ?? 'unresolved') : helper.status.default;
        }
        const o = e.arguments[helper.status.optionsArg];
        if (!o) return helper.status.default;
        if (!ts.isObjectLiteralExpression(o)) return 'unresolved';
        const sp = o.properties.find(
          p =>
            ts.isPropertyAssignment(p) &&
            ts.isIdentifier(p.name) &&
            p.name.text === 'status'
        );
        return sp
          ? (statusesOf(sp.initializer) ?? 'unresolved')
          : helper.status.default;
      }
      // A same-file function is in the handler scope (handlerScope), so its own returns are
      // classified; the call itself adds nothing.
      if (ts.isIdentifier(c)) {
        const t = values.get(c.text);
        if (
          t &&
          (ts.isFunctionDeclaration(t) ||
            ts.isArrowFunction(t) ||
            ts.isFunctionExpression(t))
        )
          return null;
      }
      // A wrapper given the handler as a function (withRateLimit(req, async () => ...)) answers
      // with that function's returns, which are classified on their own.
      if (
        e.arguments.some(
          x => ts.isArrowFunction(x) || ts.isFunctionExpression(x)
        )
      )
        return null;
      if (
        ts.isPropertyAccessExpression(c) &&
        ts.isIdentifier(c.expression) &&
        RESPONSES.includes(c.expression.text)
      ) {
        const m = c.name.text;
        if (m === 'json') return optsStatus(e.arguments[1]);
        if (m === 'redirect')
          return e.arguments[1]
            ? (statusesOf(e.arguments[1]) ?? 'unresolved')
            : '307';
        if (m === 'next') return '200';
      }
      return 'unresolved';
    }
    if (ts.isNewExpression(e) && ts.isIdentifier(e.expression)) {
      if (e.expression.text === 'ImageResponse') return '200';
      if (RESPONSES.includes(e.expression.text))
        return optsStatus(e.arguments?.[1]);
    }
    return 'unresolved';
  };
  const walk = n => {
    const add = expr => {
      const o = classify(expr);
      if (o === null) return;
      for (const c of Array.isArray(o) ? o : [o]) out.add(c);
      if (o === 'unresolved') why.add(describe(expr));
    };
    // A callback's return value is not the handler's response: skip array/promise callbacks and
    // Promise executors (their `return x` is data, not an HTTP answer).
    if (
      (ts.isArrowFunction(n) || ts.isFunctionExpression(n)) &&
      n.parent &&
      ((ts.isCallExpression(n.parent) &&
        ts.isPropertyAccessExpression(n.parent.expression) &&
        CALLBACK_METHODS.has(n.parent.expression.name.text)) ||
        (ts.isNewExpression(n.parent) &&
          ts.isIdentifier(n.parent.expression) &&
          n.parent.expression.text === 'Promise'))
    )
      return;
    if (ts.isReturnStatement(n) && n.expression) add(n.expression);
    // An arrow with an expression body returns that expression (withAuth(async req => res(...))).
    if (ts.isArrowFunction(n) && !ts.isBlock(n.body)) add(n.body);
    ts.forEachChild(n, walk);
  };
  for (const node of nodes) walk(node);
  return { codes: [...out].sort(), why: [...why].sort() };
}

function statusCodes(nodes) {
  const codes = new Set();
  const walk = n => {
    if (
      ts.isPropertyAssignment(n) &&
      ts.isIdentifier(n.name) &&
      n.name.text === 'status' &&
      statusesOf(n.initializer)
    ) {
      for (const c of statusesOf(n.initializer)) codes.add(c);
    }
    ts.forEachChild(n, walk);
  };
  for (const node of nodes) walk(node);
  return [...codes].filter(code => /^[1-5]\d\d$/.test(code)).sort();
}

function resolveSpecifier(root, fromRel, specifier) {
  let base;
  if (specifier.startsWith('@/')) base = path.join(root, specifier.slice(2));
  else if (specifier.startsWith('.'))
    base = path.join(root, path.dirname(fromRel), specifier);
  else return null;
  for (const candidate of [base, `${base}.ts`, path.join(base, 'route.ts')]) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile())
      return path.relative(root, candidate).split(path.sep).join('/');
  }
  return null;
}

function analyseFile(root, rel, sourceCache, depth = 0) {
  const source =
    sourceCache.get(rel) ?? readText(path.join(root, rel), 'route');
  sourceCache.set(rel, source);
  const file = ts.createSourceFile(
    rel,
    source,
    ts.ScriptTarget.Latest,
    true,
    scriptKindFor(rel)
  );
  const bindings = topLevelBindings(file);
  const methods = new Map();
  for (const [method, info] of exportedMethods(file)) {
    if (info.reexport) {
      const target = resolveSpecifier(root, rel, info.reexport);
      if (target && depth < 3) {
        const inner = analyseFile(root, target, sourceCache, depth + 1);
        const innerMethod = inner.methods.get(info.name);
        if (innerMethod) {
          methods.set(method, { ...innerMethod, via: target });
          continue;
        }
      }
      methods.set(method, {
        candidates: [],
        statuses: [],
        via: info.reexport,
        unresolvedVia: true,
        sourceRel: rel,
        source,
      });
      continue;
    }
    const nodes = info.node ? handlerScope(info.node, bindings.values) : [];
    methods.set(method, {
      candidates: schemaCandidates(nodes, method, bindings),
      statuses: statusCodes(nodes),
      ...(r => ({ outcomes: r.codes, outcomesWhy: r.why }))(
        returnOutcomes(nodes, bindings.values)
      ),
      sourceRel: rel,
      source,
    });
  }
  return { source, methods };
}

// ---------------------------------------------------------------------------
// Schema probing (child process)
// ---------------------------------------------------------------------------

function sanitize(message) {
  return String(message ?? 'unknown error')
    .split('\n')[0]
    .split(REPO)
    .join('<repo>')
    .replace(/[A-Za-z]:\\[^\s'"]+|\/(?:tmp|var|private)\/[^\s'"]+/g, '<path>')
    .replace(/<repo>\/\.cache\/gen-openapi\/[^\s'"]+/g, '<probe>')
    .slice(0, 240);
}

/** Copy of the route with relative imports made absolute plus a trailing export per candidate. */
function buildProbeSource(absRoute, source, candidates) {
  const file = ts.createSourceFile(
    absRoute,
    source,
    ts.ScriptTarget.Latest,
    true,
    scriptKindFor(absRoute)
  );
  const edits = [];
  const fix = literal => {
    if (
      !literal ||
      !ts.isStringLiteralLike(literal) ||
      !literal.text.startsWith('.')
    )
      return;
    const abs = path
      .resolve(path.dirname(absRoute), literal.text)
      .split(path.sep)
      .join('/');
    edits.push([literal.getStart(), literal.getEnd(), JSON.stringify(abs)]);
  };
  const walk = n => {
    if (
      (ts.isImportDeclaration(n) || ts.isExportDeclaration(n)) &&
      n.moduleSpecifier
    )
      fix(n.moduleSpecifier);
    if (
      ts.isCallExpression(n) &&
      (n.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(n.expression) && n.expression.text === 'require'))
    )
      fix(n.arguments[0]);
    ts.forEachChild(n, walk);
  };
  walk(file);
  let out = source;
  for (const [start, end, text] of edits.sort((a, b) => b[0] - a[0]))
    out = out.slice(0, start) + text + out.slice(end);
  out += '\n// --- gen-openapi probe exports ---\n';
  candidates.forEach((candidate, index) => {
    out += `export const __synthex_probe_${index} = (() => { try { return { ok: (${candidate.expr}) }; } catch (error) { return { error: String((error && error.message) || error) }; } })();\n`;
  });
  return out;
}

function runChild(jobFile, resultFile) {
  return new Promise(resolve => {
    const env = {
      PATH: process.env.PATH,
      HOME: process.env.HOME ?? os.homedir(),
      NODE_ENV: 'test',
      TZ: 'UTC',
      NEXT_TELEMETRY_DISABLED: '1',
    };
    if (process.env.npm_config_cache)
      env.npm_config_cache = process.env.npm_config_cache;
    // Node itself with the tsx loader: no npx resolution step, and the same
    // Node binary that runs the generator (CodeRabbit on #1024).
    const child = spawn(
      process.execPath,
      [
        '--import',
        'tsx',
        fileURLToPath(import.meta.url),
        '--probe-child',
        jobFile,
        resultFile,
      ],
      {
        cwd: REPO,
        env,
        stdio: ['ignore', 'ignore', 'pipe'],
      }
    );
    let lastSize = -1;
    let idle = 0;
    const timer = setInterval(() => {
      const size = fs.existsSync(resultFile) ? fs.statSync(resultFile).size : 0;
      idle = size === lastSize ? idle + 1000 : 0;
      lastSize = size;
      if (idle >= PROBE_TIMEOUT_MS) child.kill('SIGKILL');
    }, 1000);
    let stderr = '';
    child.stderr.on('data', chunk => (stderr = (stderr + chunk).slice(-2000)));
    // A spawn failure (missing binary, EAGAIN) settles the probe as failed
    // instead of leaving the promise pending or throwing.
    let settled = false;
    const done = result => {
      if (settled) return;
      settled = true;
      clearInterval(timer);
      resolve(result);
    };
    child.on('error', error =>
      done({ code: -1, stderr: `spawn failed: ${error.message}` })
    );
    child.on('close', code => done({ code, stderr }));
  });
}

/** probes: [{ key, abs, source, candidates }] -> Map key -> [{ schema } | { error }] */
async function runProbes(probes) {
  const results = new Map();
  if (probes.length === 0) return results;
  fs.mkdirSync(PROBE_DIR, { recursive: true });
  const runDir = fs.mkdtempSync(path.join(PROBE_DIR, 'run-'));
  try {
    const jobs = probes.map((probe, index) => {
      const file = path.join(
        runDir,
        `p${index}${path.extname(probe.abs) || '.ts'}`
      );
      fs.writeFileSync(
        file,
        buildProbeSource(probe.abs, probe.source, probe.candidates)
      );
      return { key: probe.key, file, count: probe.candidates.length };
    });
    let pending = jobs;
    for (
      let attempt = 0;
      pending.length > 0 && attempt <= jobs.length;
      attempt++
    ) {
      const jobFile = path.join(runDir, `job${attempt}.json`);
      const resultFile = path.join(runDir, `result${attempt}.jsonl`);
      fs.writeFileSync(jobFile, JSON.stringify(pending));
      fs.writeFileSync(resultFile, '');
      const { stderr } = await runChild(jobFile, resultFile);
      const lines = fs
        .readFileSync(resultFile, 'utf8')
        .split('\n')
        .filter(Boolean)
        .map(line => JSON.parse(line));
      let started = null;
      for (const line of lines) {
        if (line.start) started = line.start;
        else {
          results.set(line.key, line.results);
          started = null;
        }
      }
      const rest = pending.filter(job => !results.has(job.key));
      if (rest.length === 0) break;
      const stuck = started ?? rest[0].key;
      const reason = started
        ? `import did not finish within ${PROBE_TIMEOUT_MS / 1000}s or crashed the probe`
        : `probe process failed: ${sanitize(stderr.trim().split('\n').pop())}`;
      const job = rest.find(j => j.key === stuck) ?? rest[0];
      results.set(
        job.key,
        Array.from({ length: job.count }, () => ({ error: reason }))
      );
      pending = rest.filter(j => j.key !== job.key);
    }
  } finally {
    fs.rmSync(runDir, { recursive: true, force: true });
  }
  return results;
}

async function probeChild(jobFile, resultFile) {
  // No live external service: block outbound network before any route code runs.
  const net = await import('node:net');
  const blocked = () => {
    throw new Error('network disabled in gen-openapi probe');
  };
  net.Socket.prototype.connect = blocked;
  globalThis.fetch = async () => blocked();
  const write = obj =>
    fs.appendFileSync(resultFile, JSON.stringify(obj) + '\n');
  const helper = await import(
    pathToFileURL(path.join(REPO, 'lib/ai/structured-output.ts')).href
  );
  const inputJsonSchema =
    helper.inputJsonSchema ?? helper.default?.inputJsonSchema;
  process.on('unhandledRejection', () => {});
  for (const job of JSON.parse(fs.readFileSync(jobFile, 'utf8'))) {
    write({ start: job.key });
    let results;
    try {
      const mod = await import(pathToFileURL(job.file).href);
      results = [];
      for (let i = 0; i < job.count; i++) {
        const entry =
          mod[`__synthex_probe_${i}`] ?? mod.default?.[`__synthex_probe_${i}`];
        if (!entry || entry.error) {
          results.push({
            error: `schema expression failed: ${sanitize(entry?.error ?? 'export missing')}`,
          });
          continue;
        }
        try {
          if (!entry.ok || typeof entry.ok.safeParse !== 'function')
            throw new Error('expression is not a Zod schema');
          const { $schema, ...schema } = inputJsonSchema(entry.ok);
          results.push({ schema });
        } catch (error) {
          results.push({
            error: `schema conversion failed: ${sanitize(error?.message ?? error)}`,
          });
        }
      }
    } catch (error) {
      results = Array.from({ length: job.count }, () => ({
        error: `route import failed: ${sanitize(error?.message ?? error)}`,
      }));
    }
    write({ key: job.key, results });
  }
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Spec assembly
// ---------------------------------------------------------------------------

const ERROR_TEXT = {
  400: 'Invalid request',
  401: 'Authentication required',
  402: 'Payment or configuration required',
  403: 'Forbidden',
  404: 'Not found',
  409: 'Conflict',
  410: 'Gone',
  413: 'Payload too large',
  422: 'Unprocessable entity',
  429: 'Rate limited',
  500: 'Internal server error',
  501: 'Not implemented',
  502: 'Upstream error',
  503: 'Service unavailable',
  504: 'Upstream timeout',
};

function baseSpec() {
  return {
    openapi: '3.1.0',
    info: {
      title: 'Synthex API',
      version: 'generated',
      description:
        'Generated by scripts/api/gen-openapi.mjs from app/api/**/route.{ts,tsx,js}. Do not edit by hand; run `npm run api:openapi`. Security is inferred per route file from its auth helpers; `x-synthex-schema` records whether a request schema was converted from Zod (resolved), not found (none) or could not be converted (unresolved, with reason).',
    },
    paths: {},
    components: {
      schemas: {
        Error: {
          type: 'object',
          required: ['error'],
          properties: {
            error: { type: 'string' },
            code: { type: 'string' },
            message: { type: 'string' },
            details: {},
          },
        },
      },
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Synthex session JWT in the Authorization header.',
        },
        cookieAuth: {
          type: 'apiKey',
          in: 'cookie',
          name: 'auth-token',
          description: 'Synthex session JWT in the httpOnly auth-token cookie.',
        },
        cronSecret: {
          type: 'http',
          scheme: 'bearer',
          description:
            'CRON_SECRET (or the per-route cron secret) as a bearer token.',
        },
        mcpKeyBearer: {
          type: 'http',
          scheme: 'bearer',
          description: 'Synthex MCP API key as a bearer token.',
        },
        apiKeyAuth: { type: 'apiKey', in: 'header', name: 'x-api-key' },
      },
    },
  };
}

function errorResponse(code) {
  return {
    description: ERROR_TEXT[code] ?? 'Error',
    content: {
      'application/json': { schema: { $ref: '#/components/schemas/Error' } },
    },
  };
}

function buildOperation(method, apiPath, params, analysis, auth, probeResults) {
  const op = {
    operationId: operationIdFor(method, apiPath),
    tags: [tagFor(apiPath)],
    security: auth.security,
    'x-synthex-auth': auth.signals.length ? auth.signals : ['none-detected'],
    responses: {},
  };
  if (auth.exemptPrefix) op['x-synthex-auth-exempt-prefix'] = auth.exemptPrefix;
  if (analysis.via) op['x-synthex-handler'] = analysis.via;
  const parameters = params.map(p => ({
    name: p.name,
    in: 'path',
    required: true,
    schema: { type: 'string' },
    ...(p.catchAll
      ? {
          description: `Catch-all segment${p.optional ? ' (optional in Next.js)' : ''}; slash-separated.`,
        }
      : {}),
  }));

  const resolved = { body: [], query: [] };
  const reasons = [];
  analysis.candidates.forEach((candidate, index) => {
    if (candidate.kind === 'path') return;
    const result = candidate.local
      ? { error: candidate.local }
      : probeResults?.[index];
    if (result?.schema) resolved[candidate.kind].push(result.schema);
    else reasons.push(`${candidate.kind}: ${result?.error ?? 'not probed'}`);
  });
  const relevant = analysis.candidates.filter(c => c.kind !== 'path');
  if (analysis.unresolvedVia) {
    op['x-synthex-schema'] = 'unresolved';
    op['x-synthex-schema-reason'] =
      `handler re-exported from ${analysis.via} could not be analysed`;
  } else if (relevant.length === 0) {
    op['x-synthex-schema'] = 'none';
  } else if (reasons.length === 0) {
    op['x-synthex-schema'] = 'resolved';
  } else {
    op['x-synthex-schema'] = 'unresolved';
    op['x-synthex-schema-reason'] = reasons.join('; ');
  }
  if (resolved.body.length > 0) {
    const schema =
      resolved.body.length === 1 ? resolved.body[0] : { oneOf: resolved.body };
    op.requestBody = {
      required: true,
      content: { 'application/json': { schema } },
    };
  }
  const queryNames = new Set();
  for (const schema of resolved.query) {
    for (const [name, prop] of Object.entries(schema?.properties ?? {})) {
      if (queryNames.has(name)) continue;
      queryNames.add(name);
      parameters.push({
        name,
        in: 'query',
        required: (schema.required ?? []).includes(name),
        schema: prop,
      });
    }
  }
  if (parameters.length) op.parameters = parameters;

  const outcomes = analysis.outcomes ?? ['unresolved'];
  const all = [...new Set([...analysis.statuses, ...outcomes])];
  const success = all.filter(
    code => code.startsWith('2') || code.startsWith('3')
  );
  for (const code of success.sort())
    op.responses[code] = {
      description: code.startsWith('3') ? 'Redirect' : 'Success',
    };
  // No success status found: never invent one. If some return could not be followed, say the
  // outcome is unresolved; if every return is an error response, document no success at all.
  if (!success.length) {
    if (outcomes.includes('unresolved') || outcomes.length === 0) {
      op['x-synthex-success'] = 'unresolved';
      op['x-synthex-success-reason'] = analysis.unresolvedVia
        ? `handler re-exported from ${analysis.via} could not be analysed`
        : analysis.outcomesWhy?.length
          ? `returns ${analysis.outcomesWhy.slice(0, 6).join(', ')}`
          : 'no return statement found in the handler scope';
      op.responses.default = {
        description:
          'Unresolved: the generator could not determine a success response for this handler',
      };
    } else op['x-synthex-success'] = 'none';
  }
  const errors = new Set(all.filter(code => /^[45]/.test(code)));
  if (resolved.body.length || resolved.query.length || relevant.length)
    errors.add('400');
  if (auth.security.length) errors.add('401');
  errors.add('500');
  for (const code of [...errors].sort())
    op.responses[code] = errorResponse(code);
  return op;
}

/**
 * Build the contract for `root`. `cache` (Map) memoises probe results by
 * route-content hash so the planted control reuses the real tree's results.
 */
export async function generate({
  root = REPO,
  exemptFile,
  cache = new Map(),
} = {}) {
  const config = loadAuthConfig();
  const exempt = exemptFile ? readExempt(exemptFile) : [];
  const allRoutes = listRouteFiles(root);
  const missingExempt = exempt.filter(file => !allRoutes.includes(file));
  const routes = allRoutes.filter(file => !exempt.includes(file));
  const sourceCache = new Map();
  const entries = [];
  const probes = [];
  for (const rel of routes) {
    const analysis = analyseFile(root, rel, sourceCache);
    for (const [method, info] of analysis.methods) {
      const probeable = info.candidates.filter(
        c => c.kind !== 'path' && !c.local
      );
      if (probeable.length === 0) continue;
      const key = sha(
        `${info.sourceRel}\u0000${info.source}\u0000${JSON.stringify(info.candidates)}`
      );
      info.probeKey = key;
      if (!cache.has(key) && !probes.some(p => p.key === key)) {
        probes.push({
          key,
          abs: path.join(root, info.sourceRel),
          source: info.source,
          candidates: info.candidates,
        });
      }
    }
    entries.push({ rel, analysis });
  }
  for (const [key, value] of await runProbes(probes)) cache.set(key, value);

  const spec = baseSpec();
  const operationIds = new Set();
  const duplicates = [];
  for (const { rel, analysis } of entries) {
    const { path: apiPath, params } = routePathFor(rel);
    if (spec.paths[apiPath]) duplicates.push(`${rel} -> ${apiPath}`);
    const item = { 'x-synthex-route-file': rel };
    for (const method of METHODS) {
      const info = analysis.methods.get(method);
      if (!info) continue;
      const authSource =
        info.via && !info.unresolvedVia
          ? sourceCache.get(info.sourceRel)
          : analysis.source;
      const auth = inferSecurity(
        info.via && !info.unresolvedVia ? info.sourceRel : rel,
        authSource,
        config
      );
      for (const [name, header] of Object.entries(auth.headerSchemes)) {
        spec.components.securitySchemes[name] ??= {
          type: 'apiKey',
          in: 'header',
          name: header,
        };
      }
      const op = buildOperation(
        method,
        apiPath,
        params,
        info,
        auth,
        info.probeKey ? cache.get(info.probeKey) : null
      );
      let id = op.operationId;
      for (let n = 2; operationIds.has(id); n++) id = `${op.operationId}_${n}`;
      op.operationId = id;
      operationIds.add(id);
      item[method.toLowerCase()] = op;
    }
    if (analysis.methods.size === 0)
      item['x-synthex-methods'] = 'none-exported';
    spec.paths[apiPath] = item;
  }
  return {
    spec: sortKeys(spec),
    routeCount: allRoutes.length,
    exempt,
    missingExempt,
    duplicates,
  };
}

// ---------------------------------------------------------------------------
// Check and control
// ---------------------------------------------------------------------------

/**
 * Operations whose success response the generator cannot resolve must be listed, with a reason, in
 * scripts/api/success-exceptions.json (protected). Codex on P3 103eef14: --check accepted 236
 * operations with no usable success contract. Returns what is unlisted, stale or malformed.
 */
export function successExceptionCheck(spec, file) {
  let listed = [];
  if (fs.existsSync(file)) {
    try {
      listed = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (error) {
      throw new InputError(
        `success exceptions ${file} are not JSON: ${error.message}`
      );
    }
    if (!Array.isArray(listed))
      throw new InputError(`success exceptions ${file} must be a JSON array`);
  }
  const unresolved = [];
  for (const [p, item] of Object.entries(spec.paths ?? {}))
    for (const [m, op] of Object.entries(item))
      if (
        METHODS.includes(m.toUpperCase()) &&
        op['x-synthex-success'] === 'unresolved'
      )
        unresolved.push(`${m.toUpperCase()} ${p}`);
  const names = new Set(listed.map(e => e?.operation));
  const malformed = listed
    .filter(
      e =>
        !e ||
        typeof e.operation !== 'string' ||
        typeof e.reason !== 'string' ||
        e.reason.trim().length < 10
    )
    .map(e => JSON.stringify(e));
  const unlisted = unresolved.filter(o => !names.has(o));
  const stale = [...names].filter(o => o && !unresolved.includes(o));
  return {
    unresolved: unresolved.length,
    listed: listed.length,
    unlisted,
    stale,
    malformed,
    fail: unlisted.length > 0 || stale.length > 0 || malformed.length > 0,
  };
}

export async function check({
  root = REPO,
  exemptFile,
  cache,
  successExceptionsFile = path.join(root, DEFAULT_SUCCESS_EXCEPTIONS),
} = {}) {
  const specFile = path.join(root, SPEC_REL);
  const committedText = readText(specFile, 'committed contract');
  let committed;
  try {
    committed = JSON.parse(committedText);
  } catch (error) {
    throw new InputError(`${SPEC_REL} is not JSON: ${error.message}`);
  }
  const result = await generate({ root, exemptFile, cache });
  const committedPaths = Object.keys(committed.paths ?? {}).length;
  const expectedPaths = result.routeCount - result.exempt.length;
  const drift = canonical(committed) !== canonical(result.spec);
  const countMismatch =
    committedPaths !== expectedPaths ||
    result.missingExempt.length > 0 ||
    result.duplicates.length > 0;
  const success = successExceptionCheck(result.spec, successExceptionsFile);
  return {
    drift,
    countMismatch,
    success,
    committedPaths,
    expectedPaths,
    generatedPaths: Object.keys(result.spec.paths).length,
    ...result,
  };
}

function report(r, log = console.log) {
  log(
    `[gen-openapi] route files: ${r.routeCount}; exempt entries: ${r.exempt.length}; expected paths: ${r.expectedPaths}`
  );
  log(
    `[gen-openapi] committed spec paths: ${r.committedPaths}; regenerated paths: ${r.generatedPaths}`
  );
  if (r.missingExempt.length)
    log(
      `[gen-openapi] exempt entries with no route file: ${r.missingExempt.join(', ')}`
    );
  if (r.duplicates.length)
    log(
      `[gen-openapi] route files colliding on one path: ${r.duplicates.join(', ')}`
    );
  if (r.drift)
    log(
      `[gen-openapi] FAIL (a): ${SPEC_REL} differs from the regenerated contract; run npm run api:openapi`
    );
  if (r.countMismatch)
    log(
      '[gen-openapi] FAIL (b): committed path count != route files - exempt entries'
    );
  if (r.success) {
    log(
      `[gen-openapi] unresolved success responses: ${r.success.unresolved}; listed exceptions: ${r.success.listed}`
    );
    if (r.success.fail)
      log(
        `[gen-openapi] FAIL (c): success exceptions out of date — unlisted: ${r.success.unlisted.slice(0, 5).join('; ') || 'none'}; stale: ${r.success.stale.slice(0, 5).join('; ') || 'none'}; malformed: ${r.success.malformed.length}`
      );
  }
  if (!r.drift && !r.countMismatch && !r.success?.fail)
    log('[gen-openapi] PASS');
}

function copyTree(root, dest) {
  for (const rel of listRouteFiles(root)) {
    fs.mkdirSync(path.join(dest, path.dirname(rel)), { recursive: true });
    fs.copyFileSync(path.join(root, rel), path.join(dest, rel));
  }
  fs.mkdirSync(path.join(dest, path.dirname(SPEC_REL)), { recursive: true });
  fs.copyFileSync(path.join(root, SPEC_REL), path.join(dest, SPEC_REL));
}

export async function control({ root = REPO, exemptFile } = {}) {
  const cache = new Map();
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gen-openapi-control-'));
  const outcomes = [];
  try {
    const baseline = await check({ root, exemptFile, cache });
    outcomes.push({
      name: 'baseline (unchanged copy passes)',
      ok: !baseline.drift && !baseline.countMismatch,
      r: baseline,
    });

    const planted = path.join(tmp, 'planted');
    copyTree(root, planted);
    const plantRel = 'app/api/__gen_openapi_control__/planted/route.ts';
    fs.mkdirSync(path.join(planted, path.dirname(plantRel)), {
      recursive: true,
    });
    fs.writeFileSync(
      path.join(planted, plantRel),
      "export async function GET() {\n  return new Response('planted');\n}\n"
    );
    const r1 = await check({ root: planted, exemptFile, cache });
    outcomes.push({
      name: 'planted route without a spec entry',
      ok: r1.drift && r1.countMismatch,
      r: r1,
    });

    const deleted = path.join(tmp, 'deleted');
    copyTree(root, deleted);
    const specFile = path.join(deleted, SPEC_REL);
    const spec = JSON.parse(fs.readFileSync(specFile, 'utf8'));
    const victim = Object.keys(spec.paths ?? {}).sort()[0];
    if (victim) delete spec.paths[victim];
    fs.writeFileSync(specFile, canonical(spec));
    const r2 = await check({ root: deleted, exemptFile, cache });
    outcomes.push({
      name: `deleted spec entry ${victim ?? '(none to delete)'}`,
      ok: !!victim && r2.drift && r2.countMismatch,
      r: r2,
    });
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  for (const o of outcomes) {
    console.log(
      `[gen-openapi --control] ${o.ok ? 'CAUGHT/OK' : 'MISSED'}: ${o.name} (drift=${o.r.drift}, count=${o.r.committedPaths}/${o.r.expectedPaths})`
    );
  }
  return outcomes.every(o => o.ok);
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function argValue(args, flag) {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
}

async function main(args) {
  if (args[0] === '--probe-child') return probeChild(args[1], args[2]);
  const root = path.resolve(argValue(args, '--root') ?? REPO);
  const exemptArg = argValue(args, '--exempt');
  const exemptFile = exemptArg
    ? path.resolve(exemptArg)
    : path.join(root, DEFAULT_EXEMPT);
  try {
    if (args.includes('--control')) {
      const ok = await control({ root, exemptFile });
      console.log(
        `[gen-openapi --control] ${ok ? 'PASS: every plant was caught' : 'FAIL'}`
      );
      process.exit(ok ? 0 : 1);
    }
    if (args.includes('--check')) {
      const r = await check({ root, exemptFile });
      report(r);
      process.exit(r.drift || r.countMismatch || r.success?.fail ? 1 : 0);
    }
    const r = await generate({ root, exemptFile });
    fs.mkdirSync(path.join(root, path.dirname(SPEC_REL)), { recursive: true });
    fs.writeFileSync(path.join(root, SPEC_REL), canonical(r.spec));
    const ops = Object.values(r.spec.paths).flatMap(item =>
      Object.keys(item)
        .filter(k => METHODS.includes(k.toUpperCase()))
        .map(k => item[k])
    );
    const tally = ops.reduce(
      (acc, op) => (
        (acc[op['x-synthex-schema']] = (acc[op['x-synthex-schema']] ?? 0) + 1),
        acc
      ),
      {}
    );
    console.log(
      `[gen-openapi] wrote ${SPEC_REL}: ${Object.keys(r.spec.paths).length} paths, ${ops.length} operations, schema ${JSON.stringify(sortKeys(tally))}`
    );
    if (r.missingExempt.length || r.duplicates.length) {
      console.log(
        `[gen-openapi] warning: missing exempt files ${JSON.stringify(r.missingExempt)}; collisions ${JSON.stringify(r.duplicates)}`
      );
    }
  } catch (error) {
    if (error instanceof InputError) {
      console.error(`[gen-openapi] cannot read inputs: ${error.message}`);
      process.exit(2);
    }
    throw error;
  }
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main(process.argv.slice(2)).catch(error => {
    console.error(error);
    process.exit(1);
  });
}
