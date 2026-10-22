/**
 * JEV route harness — call an app/api route handler in-process.
 *
 * invokeRoute() never throws: an import-time throw, a missing handler or a
 * handler throw all come back as { status: null, error }. Families record that
 * as INCONCLUSIVE, never PASS.
 */
import fs from 'fs';
import path from 'path';
import { createMockNextRequest } from '../../../helpers/mock-request';

const ROOT = path.join(__dirname, '../../../..');
// Jest injects `jest` into each test module; outside Jest it is undefined.
declare const jest: { isolateModules(fn: () => void): void } | undefined;
const HTTP_METHODS = [
  'GET',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
  'HEAD',
  'OPTIONS',
] as const;

export interface InvokeOptions {
  headers?: Record<string, string>;
  body?: object | string;
  url?: string;
  params?: Record<string, string | string[]>;
  /**
   * A ready-made request (e.g. a real NextRequest carrying a form or multipart
   * body, which the mock request cannot parse). invokeHandler only; replaces
   * headers/body/url.
   */
  request?: unknown;
}

export interface InvokeResult {
  status: number | null;
  json: unknown;
  error?: string;
  /** Response headers (lower-cased names), when a Response came back. */
  headers?: Record<string, string>;
  /** The raw body when it is not JSON (an HTML page, plain text). */
  text?: string;
}

export interface RouteInfo {
  /** Repo-relative path, e.g. app/api/posts/[id]/route.ts */
  file: string;
  /** URL path, e.g. /api/posts/[id] */
  route: string;
  methods: string[];
}

function errorText(err: unknown): string {
  return err instanceof Error ? `${err.name}: ${err.message}` : String(err);
}

/** /api/... path for a route file, with dynamic segments filled from params when given. */
function routePath(
  routeFile: string,
  params?: InvokeOptions['params']
): string {
  const rel = path.relative(
    path.join(ROOT, 'app'),
    path.resolve(ROOT, routeFile)
  );
  const segments = path
    .dirname(rel)
    .split(path.sep)
    .filter(s => !/^\(.*\)$/.test(s));
  return (
    '/' +
    segments
      .map(s => {
        const m = /^\[{1,2}(?:\.\.\.)?([^\]]+)\]{1,2}$/.exec(s);
        const value = m && params ? params[m[1]] : undefined;
        if (value === undefined) return s;
        return Array.isArray(value)
          ? value.map(encodeURIComponent).join('/')
          : encodeURIComponent(value);
      })
      .join('/')
  );
}

function loadModule(abs: string): Record<string, unknown> {
  let mod: Record<string, unknown> | undefined;
  if (typeof jest !== 'undefined') {
    jest.isolateModules(() => {
      mod = require(abs);
    });
  } else {
    mod = require(abs);
  }
  return mod ?? {};
}

/**
 * Load a route module once. An import-time throw comes back as { error },
 * never thrown. Sweeps load a module once and call its handlers many times
 * through invokeHandler; invokeRoute loads afresh on every call.
 */
export function loadRouteModule(
  routeFile: string
):
  | { mod: Record<string, unknown>; error?: undefined }
  | { mod?: undefined; error: string } {
  try {
    return { mod: loadModule(path.resolve(ROOT, routeFile)) };
  } catch (err) {
    return { error: `import failed: ${errorText(err)}` };
  }
}

/** Call one exported handler of an already-loaded route module. Never throws. */
export async function invokeHandler(
  mod: Record<string, unknown>,
  routeFile: string,
  method: string,
  opts: InvokeOptions = {}
): Promise<InvokeResult> {
  const handler = mod[method.toUpperCase()];
  if (typeof handler !== 'function') {
    return {
      status: null,
      json: null,
      error: `no ${method.toUpperCase()} export in ${routeFile}`,
    };
  }

  const request =
    opts.request ??
    createMockNextRequest({
      method: method.toUpperCase(),
      headers: opts.headers,
      body: opts.body,
      url:
        opts.url ?? `http://localhost:3000${routePath(routeFile, opts.params)}`,
    });

  let response: unknown;
  try {
    response = await handler(request, {
      params: Promise.resolve(opts.params ?? {}),
    });
  } catch (err) {
    return {
      status: null,
      json: null,
      error: `handler threw: ${errorText(err)}`,
    };
  }

  const res = response as {
    status?: unknown;
    text?: () => Promise<string>;
    headers?: { forEach?(fn: (value: string, key: string) => void): void };
  } | null;
  if (!res || typeof res.status !== 'number') {
    return {
      status: null,
      json: null,
      error: 'handler did not return a Response',
    };
  }
  const headers: Record<string, string> = {};
  res.headers?.forEach?.((value, key) => {
    headers[key.toLowerCase()] = value;
  });
  let text = '';
  try {
    text = typeof res.text === 'function' ? await res.text() : '';
  } catch (err) {
    return {
      status: res.status,
      json: null,
      headers,
      error: `body read failed: ${errorText(err)}`,
    };
  }
  if (!text) return { status: res.status, json: null, headers };
  try {
    return { status: res.status, json: JSON.parse(text), headers };
  } catch {
    return {
      status: res.status,
      json: null,
      headers,
      text,
      error: 'response body is not JSON',
    };
  }
}

export async function invokeRoute(
  routeFile: string,
  method: string,
  opts: InvokeOptions = {}
): Promise<InvokeResult> {
  const loaded = loadRouteModule(routeFile);
  if (!loaded.mod) return { status: null, json: null, error: loaded.error };
  return invokeHandler(loaded.mod, routeFile, method, opts);
}

/**
 * Call a route the way Next does: proxy.ts first, then the handler when the
 * proxy passes the request on (NextResponse.next()). A proxy answer is the
 * result; a proxy throw is { status: null }.
 */
export async function invokeThroughProxy(
  routeFile: string,
  method: string,
  opts: InvokeOptions = {}
): Promise<InvokeResult & { answeredBy: 'proxy' | 'route' }> {
  let res: { status: number; headers: Headers; text(): Promise<string> };
  try {
    const mod = loadModule(path.join(ROOT, 'proxy.ts')) as {
      proxy(r: unknown): Promise<typeof res>;
    };
    res = await mod.proxy(
      createMockNextRequest({
        method: method.toUpperCase(),
        headers: opts.headers,
        body: opts.body,
        url:
          opts.url ??
          `http://localhost:3000${routePath(routeFile, opts.params)}`,
      })
    );
  } catch (err) {
    return {
      status: null,
      json: null,
      error: `proxy threw: ${errorText(err)}`,
      answeredBy: 'proxy',
    };
  }
  if (res.headers.get('x-middleware-next') !== '1') {
    const text = await res.text();
    let json: unknown = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      // non-JSON proxy answer; status still recorded
    }
    return { status: res.status, json, answeredBy: 'proxy' };
  }
  return {
    ...(await invokeRoute(routeFile, method, opts)),
    answeredBy: 'route',
  };
}

/** Exported HTTP methods of a route file, read from its source text (no import). */
function exportedMethods(source: string): string[] {
  const found = new Set<string>();
  const direct =
    /export\s+(?:async\s+)?(?:function\s*\*?|const|let|var)\s+([A-Z]+)\b/g;
  for (const m of source.matchAll(direct)) found.add(m[1]);
  const lists = /export\s+(?:const|let|var)?\s*\{([^}]*)\}/g;
  for (const m of source.matchAll(lists)) {
    for (const part of m[1].split(',')) {
      const name = part
        .trim()
        .split(/\s+as\s+/)
        .pop()
        ?.split(':')
        .pop()
        ?.trim();
      if (name) found.add(name);
    }
  }
  return HTTP_METHODS.filter(verb => found.has(verb));
}

/** Every app/api/**\/route.ts with its exported HTTP methods, sorted by file. */
export function listRoutes(): RouteInfo[] {
  const out: RouteInfo[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(abs);
      else if (entry.name === 'route.ts') {
        const file = path.relative(ROOT, abs).split(path.sep).join('/');
        out.push({
          file,
          route: routePath(file),
          methods: exportedMethods(fs.readFileSync(abs, 'utf8')),
        });
      }
    }
  };
  walk(path.join(ROOT, 'app/api'));
  return out.sort((a, b) => (a.file < b.file ? -1 : a.file > b.file ? 1 : 0));
}
