/**
 * J4 gap-probe detectors. Every detector reads source text under a root
 * directory (the repo, or a planted fixture for the controls) and imports
 * nothing, so a probe never depends on env, a DB or a live service.
 *
 *   exists — a candidate file is present and exports the named symbol
 *            (optionally: contains a pattern, does not import a forbidden module)
 *   rest   — an app route matches the capability and calls an auth marker
 *   mcp    — the MCP registry source defines a tool (a block with riskClass)
 *   typed  — a matched route names a response schema, or a matched tool
 *            declares outputSchema
 */
import fs from 'fs';
import path from 'path';

export type ProbeKind = 'exists' | 'rest' | 'mcp' | 'typed';

export interface ExistsTarget {
  files?: string[];
  dirs?: string[];
  symbol?: string;
  contains?: string;
  forbid_import?: string;
}
export interface RestTarget {
  route: string;
  methods?: string[];
  /** Overrides the shared auth markers for this capability. */
  auth?: string;
  /** Extra pattern the authenticated route source must contain. */
  require?: string;
}
export interface Gap {
  slug: string;
  m: string;
  spec_line: string;
  capability: string;
  exists: ExistsTarget;
  rest: RestTarget;
  mcp: { tool: string };
  typed?: { route?: string; tool?: string };
}
export interface ProbeConfig {
  mcp_registry_dir: string;
  route_root: string;
  auth_markers: string[];
  response_schema_marker: string;
}
export interface ProbeVerdict {
  passed: boolean;
  detail: string;
}

const SOURCE_EXT = /\.(ts|tsx|mjs|cjs|js|json|txt|ya?ml|md)$/;
const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

/** Remove block and line comments so a marker in a comment never counts. */
export function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');
}

function walk(dir: string, out: string[]): void {
  if (!fs.existsSync(dir)) return;
  const entries = fs
    .readdirSync(dir, { withFileTypes: true })
    .sort((a, b) => (a.name < b.name ? -1 : 1));
  for (const e of entries) {
    if (e.name === 'node_modules' || e.name.startsWith('.next')) continue;
    if (e.name === '__tests__' || /\.test\.tsx?$/.test(e.name)) continue;
    const abs = path.join(dir, e.name);
    if (e.isDirectory()) walk(abs, out);
    else if (SOURCE_EXT.test(e.name)) out.push(abs);
  }
}

/** Names a TS/JS source exports (declarations and export lists). */
export function exportedNames(src: string): string[] {
  const code = stripComments(src);
  const names = new Set<string>();
  const decl =
    /export\s+(?:default\s+)?(?:declare\s+)?(?:async\s+)?(?:function\s*\*?|const|let|var|class|interface|type|enum)\s+([A-Za-z_$][\w$]*)/g;
  for (const m of code.matchAll(decl)) names.add(m[1]);
  for (const m of code.matchAll(/export\s+(?:type\s+)?\{([^}]*)\}/g)) {
    for (const part of m[1].split(',')) {
      const name = part
        .trim()
        .split(/\s+as\s+/)
        .pop()
        ?.trim();
      if (name) names.add(name);
    }
  }
  return [...names].sort();
}

const rel = (root: string, abs: string) =>
  path.relative(root, abs).split(path.sep).join('/');

export function probeExists(root: string, t: ExistsTarget): ProbeVerdict {
  const candidates: string[] = [];
  for (const f of t.files ?? []) {
    const abs = path.join(root, f);
    if (fs.existsSync(abs) && fs.statSync(abs).isFile()) candidates.push(abs);
  }
  for (const d of t.dirs ?? []) walk(path.join(root, d), candidates);
  if (candidates.length === 0)
    return { passed: false, detail: 'no candidate file present' };
  const symbol = t.symbol ? new RegExp(t.symbol) : undefined;
  const contains = t.contains ? new RegExp(t.contains) : undefined;
  let blocked = '';
  for (const abs of candidates) {
    const src = fs.readFileSync(abs, 'utf8');
    const hit = symbol
      ? exportedNames(src).find(n => symbol.test(n))
      : path.basename(abs);
    if (!hit) continue;
    if (contains && !contains.test(stripComments(src))) continue;
    if (
      t.forbid_import &&
      src
        .split('\n')
        .some(
          l =>
            /^\s*(import|export)\b|require\(/.test(l) &&
            l.includes(t.forbid_import!)
        )
    ) {
      blocked ||= `${rel(root, abs)} exports ${hit} but imports ${t.forbid_import}`;
      continue;
    }
    return { passed: true, detail: `${rel(root, abs)} exports ${hit}` };
  }
  return {
    passed: false,
    detail:
      blocked ||
      `${candidates.length} candidate file(s), none ${symbol ? `exports /${t.symbol}/` : ''}${contains ? ` contains /${t.contains}/` : ''}`.trim(),
  };
}

export interface RouteSource {
  file: string;
  route: string;
  methods: string[];
  code: string;
}

/** Every route.ts under <root>/<route_root>, with URL path and exported methods. */
export function routeSources(root: string, cfg: ProbeConfig): RouteSource[] {
  const files: string[] = [];
  walk(path.join(root, cfg.route_root), files);
  return files
    .filter(f => /[\\/]route\.(ts|js)$/.test(f))
    .map(abs => {
      const code = stripComments(fs.readFileSync(abs, 'utf8'));
      const segments = path
        .relative(path.join(root, cfg.route_root), path.dirname(abs))
        .split(path.sep)
        .filter(s => s && !/^\(.*\)$/.test(s));
      const methods = HTTP_METHODS.filter(m =>
        new RegExp(
          `export\\s+(?:async\\s+)?(?:function\\s+|const\\s+)${m}\\b|export\\s*\\{[^}]*\\b${m}\\b[^}]*\\}`
        ).test(code)
      );
      return {
        file: rel(root, abs),
        route: '/' + segments.join('/'),
        methods,
        code,
      };
    });
}

function authCalled(code: string, markers: string[]): string | undefined {
  const body = code
    .split('\n')
    .filter(l => !/^\s*import\b/.test(l) && !/^\s*\}\s*from\s/.test(l))
    .join('\n');
  for (const m of markers) {
    const hit = new RegExp(m).exec(body);
    if (hit) return hit[0];
  }
  return undefined;
}

export function probeRest(
  root: string,
  cfg: ProbeConfig,
  t: RestTarget
): ProbeVerdict {
  const re = new RegExp(t.route);
  const matched = routeSources(root, cfg).filter(
    r =>
      re.test(r.route) &&
      (!t.methods || t.methods.some(m => r.methods.includes(m)))
  );
  if (matched.length === 0)
    return {
      passed: false,
      detail: `no route matches /${t.route}/${t.methods ? ` with ${t.methods.join('|')}` : ''}`,
    };
  const markers = t.auth ? [t.auth] : cfg.auth_markers;
  const notes: string[] = [];
  for (const r of matched) {
    const marker = authCalled(r.code, markers);
    if (!marker) {
      notes.push(`${r.route} has no auth marker`);
      continue;
    }
    if (t.require && !new RegExp(t.require).test(r.code)) {
      notes.push(
        `${r.route} authenticated (${marker}) but lacks /${t.require}/`
      );
      continue;
    }
    return { passed: true, detail: `${r.route} authenticated by ${marker}` };
  }
  return { passed: false, detail: notes.join('; ') };
}

export interface ToolDef {
  name: string;
  file: string;
  outputSchema: boolean;
}

/** Tools defined in the MCP registry source: a `name: '...'` block carrying riskClass. */
export function registryTools(root: string, cfg: ProbeConfig): ToolDef[] {
  const files: string[] = [];
  walk(path.join(root, cfg.mcp_registry_dir), files);
  const out: ToolDef[] = [];
  for (const abs of files.filter(f => /\.ts$/.test(f))) {
    const code = stripComments(fs.readFileSync(abs, 'utf8'));
    const starts = [...code.matchAll(/\bname:\s*'([a-z][a-z0-9_]*)'/g)];
    starts.forEach((m, i) => {
      const block = code.slice(m.index, starts[i + 1]?.index ?? code.length);
      if (!/\briskClass:/.test(block)) return;
      out.push({
        name: m[1],
        file: rel(root, abs),
        outputSchema: /\boutputSchema\s*[:,]/.test(block),
      });
    });
  }
  return out.sort((a, b) => (a.name < b.name ? -1 : 1));
}

export function probeMcp(
  root: string,
  cfg: ProbeConfig,
  t: { tool: string }
): ProbeVerdict {
  const re = new RegExp(t.tool);
  const tools = registryTools(root, cfg);
  const hit = tools.filter(x => re.test(x.name));
  return hit.length
    ? { passed: true, detail: `registered: ${hit.map(x => x.name).join(', ')}` }
    : {
        passed: false,
        detail: `no tool among ${tools.length} matches /${t.tool}/`,
      };
}

export function probeTyped(
  root: string,
  cfg: ProbeConfig,
  t: { route?: string; tool?: string }
): ProbeVerdict {
  const notes: string[] = [];
  if (t.tool) {
    const re = new RegExp(t.tool);
    const tools = registryTools(root, cfg).filter(x => re.test(x.name));
    const typed = tools.find(x => x.outputSchema);
    if (typed)
      return {
        passed: true,
        detail: `tool ${typed.name} declares outputSchema`,
      };
    notes.push(
      tools.length
        ? `tool(s) ${tools.map(x => x.name).join(', ')} declare no outputSchema`
        : 'no matching tool'
    );
  }
  if (t.route) {
    const re = new RegExp(t.route);
    const marker = new RegExp(cfg.response_schema_marker);
    const routes = routeSources(root, cfg).filter(r => re.test(r.route));
    const typed = routes.find(r => marker.test(r.code));
    if (typed)
      return {
        passed: true,
        detail: `route ${typed.route} names ${marker.exec(typed.code)![0]}`,
      };
    notes.push(
      routes.length
        ? `route(s) ${routes.map(r => r.route).join(', ')} name no response schema`
        : 'no matching route'
    );
  }
  return { passed: false, detail: notes.join('; ') || 'no surface to type' };
}

export function runProbe(
  root: string,
  cfg: ProbeConfig,
  gap: Gap,
  kind: ProbeKind
): ProbeVerdict {
  switch (kind) {
    case 'exists':
      return probeExists(root, gap.exists);
    case 'rest':
      return probeRest(root, cfg, gap.rest);
    case 'mcp':
      return probeMcp(root, cfg, gap.mcp);
    case 'typed':
      return probeTyped(
        root,
        cfg,
        gap.typed ?? { route: gap.rest.route, tool: gap.mcp.tool }
      );
  }
}
