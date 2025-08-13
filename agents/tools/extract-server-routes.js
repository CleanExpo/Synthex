const fs = require('fs');
const path = require('path');

/**
 * Recursively walk a directory and return all file paths
 */
function walk(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

/**
 * Normalize Next.js App Router dynamic segments to a display form
 * - [id] -> :id
 * - [...slug] -> :slug+
 * - [[...slug]] -> :slug*
 */
function appPathToDisplay(relDir) {
  let p = relDir.replace(/\\/g, '/');
  p = p.replace(/\[\[\.\.\.([^\]]+)\]\]/g, ':$1*'); // optional catch-all
  p = p.replace(/\[\.\.\.([^\]]+)\]/g, ':$1+');     // catch-all
  p = p.replace(/\[([^\]]+)\]/g, ':$1');            // dynamic
  if (!p.startsWith('/')) p = '/' + p;
  return p;
}

/**
 * Convert display path with :params back to regex for matching
 */
function displayPathToRegex(displayPath) {
  let re = '^' + displayPath
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')           // escape regex chars
    .replace(/\\:([a-zA-Z0-9_]+)\+/g, '([^/]+(?:/[^/]+)*)') // :param+  -> one or more segments
    .replace(/\\:([a-zA-Z0-9_]+)\*/g, '(?:.*)?')           // :param*  -> optional any
    .replace(/\\:([a-zA-Z0-9_]+)/g, '([^/]+)');            // :param   -> single segment
  re += '$';
  return new RegExp(re);
}

/**
 * Extract HTTP methods from an App Router route.ts/route.js file
 */
function extractMethodsFromAppRoute(src) {
  const methods = new Set();
  const patterns = [
    /export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE)\s*\(/g,
    /export\s+function\s+(GET|POST|PUT|PATCH|DELETE)\s*\(/g,
    /export\s+const\s+(GET|POST|PUT|PATCH|DELETE)\s*=\s*async\s*\(/g,
    /export\s+const\s+(GET|POST|PUT|PATCH|DELETE)\s*=\s*\(/g,
  ];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(src)) !== null) {
      methods.add(m[1].toUpperCase());
    }
  }
  // If no explicit method export found, some handlers export a single method as default with named export "handler"
  // We won't try to infer those; return empty and mark unknown
  return Array.from(methods);
}

/**
 * Extract methods from a Pages Router API (handler switch on req.method) loosely
 */
function extractMethodsFromPagesApi(src) {
  const methods = new Set();
  const m1 = src.match(/req\.method\s*===\s*["'`](GET|POST|PUT|PATCH|DELETE)["'`]/g);
  if (m1) {
    for (const m of m1) {
      const mm = m.match(/(GET|POST|PUT|PATCH|DELETE)/);
      if (mm) methods.add(mm[1].toUpperCase());
    }
  }
  const m2 = src.match(/switch\s*\(\s*req\.method\s*\)[\s\S]*?\}/g);
  if (m2) {
    const branchMethods = m2.join('\n').match(/case\s+["'`](GET|POST|PUT|PATCH|DELETE)["'`]\s*:/g);
    if (branchMethods) {
      for (const b of branchMethods) {
        const mm = b.match(/(GET|POST|PUT|PATCH|DELETE)/);
        if (mm) methods.add(mm[1].toUpperCase());
      }
    }
  }
  return Array.from(methods);
}

function main() {
  const outDir = path.resolve('agents/reports');
  const outPath = path.join(outDir, 'server-routes.json');
  fs.mkdirSync(outDir, { recursive: true });

  const appDir = path.resolve('app');
  const pagesDir = path.resolve('pages/api');
  const srcPagesDir = path.resolve('src/pages/api');
  const legacyApiDir = path.resolve('api'); // project-specific API dir (if any)

  const routes = [];

  // Next.js App Router: app/**/route.ts|js|mjs
  if (fs.existsSync(appDir)) {
    const files = walk(appDir).filter(f => /[\\\/]route\.(ts|js|mjs)$/.test(f));
    for (const file of files) {
      const relDir = path.relative(appDir, path.dirname(file));
      // Build display path like /api/v2/teams/invite
      const displayPath = appPathToDisplay(relDir);
      const src = fs.readFileSync(file, 'utf8');
      const methods = extractMethodsFromAppRoute(src);
      routes.push({
        source: path.relative(process.cwd(), file),
        path: displayPath,
        methods: methods.length ? methods : ['UNKNOWN'],
        regex: displayPathToRegex(displayPath).toString()
      });
    }
  }

  function addPagesApiRoutes(baseDir) {
    if (!fs.existsSync(baseDir)) return;
    const files = walk(baseDir).filter(f => /\.(ts|js|mjs)$/.test(f));
    for (const file of files) {
      const rel = path.relative(baseDir, file).replace(/\\/g, '/');
      let p = '/' + rel.replace(/\.(ts|js|mjs)$/, '');
      p = p.replace(/\/index$/, ''); // pages/api/foo/index -> /foo
      // Pages dynamic files: [id].ts -> :id ; [...slug] -> :slug+
      p = p.replace(/\[\.\.\.([^\]]+)\]/g, ':$1+');
      p = p.replace(/\[([^\]]+)\]/g, ':$1');
      const fullPath = '/api' + p; // pages/api maps to /api/*
      const src = fs.readFileSync(file, 'utf8');
      const methods = extractMethodsFromPagesApi(src);
      routes.push({
        source: path.relative(process.cwd(), file),
        path: fullPath,
        methods: methods.length ? methods : ['UNKNOWN'],
        regex: displayPathToRegex(fullPath).toString()
      });
    }
  }

  // Pages Router API (if present)
  addPagesApiRoutes(pagesDir);
  addPagesApiRoutes(srcPagesDir);

  // Project-specific legacy API dir (heuristic)
  if (fs.existsSync(legacyApiDir)) {
    const files = walk(legacyApiDir).filter(f => /\.(ts|js|mjs)$/.test(f));
    for (const file of files) {
      const rel = path.relative(legacyApiDir, file).replace(/\\/g, '/');
      let p = '/' + rel.replace(/\.(ts|js|mjs)$/, '');
      p = p.replace(/\/index$/, '');
      p = p.replace(/\[\.\.\.([^\]]+)\]/g, ':$1+');
      p = p.replace(/\[([^\]]+)\]/g, ':$1');
      const fullPath = '/' + rel.split('/')[0] + p; // best-effort; will often duplicate first segment
      const src = fs.readFileSync(file, 'utf8');
      const methods = extractMethodsFromPagesApi(src);
      routes.push({
        source: path.relative(process.cwd(), file),
        path: fullPath,
        methods: methods.length ? methods : ['UNKNOWN'],
        regex: displayPathToRegex(fullPath).toString(),
        note: 'legacyApiHeuristic'
      });
    }
  }

  // Deduplicate by path+methods set
  const byKey = new Map();
  for (const r of routes) {
    const key = `${r.path}|${r.methods.sort().join(',')}`;
    if (!byKey.has(key)) byKey.set(key, r);
  }
  const unique = Array.from(byKey.values()).sort((a, b) => a.path.localeCompare(b.path));

  const report = {
    generatedAt: new Date().toISOString(),
    routes: unique,
    count: unique.length
  };

  fs.writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf8');
  console.log(`Wrote server routes report to ${path.relative(process.cwd(), outPath)} (${unique.length} routes)`);
}

main();
