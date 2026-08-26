/**
 * Internal links must point at real routes.
 *
 * Founder brief 18/08/2026: "there are also a lot of ways to get lost". A link
 * that 404s is the most literal version of that. An audit found the `/docs` page
 * shipping six primary buttons that all lead nowhere.
 *
 * This is a ratchet, not a cleanup: the currently-known breakages live in
 * `internal-links-baseline.json`, and the test fails only when a NEW unresolvable
 * link appears. Fixing a baselined link and removing its entry is the intended
 * direction of travel.
 *
 * KNOWN LIMITATION, stated because it produced a false positive already: this
 * scans `href="..."` in source, not what renders. A component may accept an
 * `href` prop and deliberately not render a link — `SEOToolCard` in
 * `app/dashboard/seo/page.tsx` does exactly that for `comingSoon` cards, showing
 * a toast instead. Those hrefs are therefore listed in the baseline as
 * known-safe rather than as debt. Do not "fix" them by changing the route.
 */

import { readdirSync, statSync, readFileSync, existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const ROOT = join(__dirname, '..', '..', '..');
const APP = join(ROOT, 'app');
const BASELINE_PATH = join(__dirname, 'internal-links-baseline.json');

// ---------------------------------------------------------------------------
// Route discovery
// ---------------------------------------------------------------------------

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next') continue;
    const p = join(dir, name);
    let st;
    try {
      st = statSync(p);
    } catch {
      continue;
    }
    if (st.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

/** Strip route groups `(auth)` and parallel routes `@modal` — neither is in the URL. */
function urlSegments(relParts: string[]): string[] {
  return relParts
    .filter(s => !(s.startsWith('(') && s.endsWith(')')))
    .filter(s => !s.startsWith('@'));
}

function collectRoutes(appFiles: string[], base: RegExp): Set<string> {
  const routes = new Set<string>();
  for (const file of appFiles) {
    const rel = relative(APP, file).split(sep);
    if (!base.test(rel[rel.length - 1])) continue;
    const segs = urlSegments(rel.slice(0, -1));
    const route = '/' + segs.join('/');
    routes.add(route.length > 1 ? route.replace(/\/+$/, '') : '/');
  }
  return routes;
}

/** Match a concrete path against a pattern that may hold [param] or [...slug]. */
function matchesPattern(path: string, pattern: string): boolean {
  if (path === pattern) return true;
  const p = path.split('/').filter(Boolean);
  const q = pattern.split('/').filter(Boolean);
  let i = 0;
  for (; i < q.length; i++) {
    const seg = q[i];
    if (seg.startsWith('[...') || seg.startsWith('[[...')) return true;
    if (i >= p.length) return false;
    if (seg.startsWith('[') && seg.endsWith(']')) continue;
    if (seg !== p[i]) return false;
  }
  return i === p.length;
}

const appFiles = walk(APP);
const pageRoutes = collectRoutes(appFiles, /^page\.(tsx|ts|jsx|js)$/);
const handlerRoutes = collectRoutes(appFiles, /^route\.(tsx|ts|js)$/);

function resolvesToRoute(path: string): boolean {
  for (const r of pageRoutes) if (matchesPattern(path, r)) return true;
  for (const r of handlerRoutes) if (matchesPattern(path, r)) return true;
  return false;
}

// ---------------------------------------------------------------------------
// Link discovery
// ---------------------------------------------------------------------------

const HREF = /(?:href|to)=\{?["'`](\/[^"'`{}\s]*)["'`]\}?/g;
const ASSET =
  /\.(png|jpe?g|svg|webp|gif|ico|pdf|txt|xml|json|css|js|mp4|webm|woff2?)$/i;

function findUnresolvedLinks(): Map<string, string[]> {
  const files = [join(ROOT, 'app'), join(ROOT, 'components')]
    .filter(existsSync)
    .flatMap(d => walk(d))
    .filter(f => /\.(tsx|jsx)$/.test(f));

  const unresolved = new Map<string, string[]>();

  for (const file of files) {
    const lines = readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, idx) => {
      for (const m of line.matchAll(HREF)) {
        let path = m[1].split('?')[0].split('#')[0];
        if (!path || path.startsWith('//')) continue;
        if (ASSET.test(path)) continue;
        if (path.length > 1) path = path.replace(/\/+$/, '');
        if (resolvesToRoute(path)) continue;
        const where = `${relative(ROOT, file).split(sep).join('/')}:${idx + 1}`;
        if (!unresolved.has(path)) unresolved.set(path, []);
        unresolved.get(path)!.push(where);
      }
    });
  }
  return unresolved;
}

interface Baseline {
  knownUnresolved: Record<string, { reason: string; sites: string[] }>;
}

const baseline: Baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('route discovery works before we trust its verdict', () => {
  // Positive control. A scanner that resolves nothing would report every link as
  // broken; a scanner that resolves everything would report none. Both look like
  // a pass from the outside, so pin the middle.
  it('finds a substantial number of page routes', () => {
    expect(pageRoutes.size).toBeGreaterThan(150);
  });

  it('resolves a route that certainly exists', () => {
    expect(resolvesToRoute('/dashboard')).toBe(true);
  });

  it('does NOT resolve a route that certainly does not', () => {
    expect(resolvesToRoute('/definitely-not-a-real-route-xyz')).toBe(false);
  });

  it('resolves a dynamic route through its parameter', () => {
    // `/blog/[slug]` exists, so a concrete slug must match.
    expect(resolvesToRoute('/blog/some-post')).toBe(true);
  });

  it('sees through a route group, which is not part of the URL', () => {
    // app/(auth)/login/page.tsx must resolve as /login, not /(auth)/login.
    expect(resolvesToRoute('/login')).toBe(true);
  });
});

describe('internal links resolve to real routes', () => {
  const unresolved = findUnresolvedLinks();

  it('introduces no new broken internal link', () => {
    const known = new Set(Object.keys(baseline.knownUnresolved));
    const newlyBroken = [...unresolved.entries()]
      .filter(([path]) => !known.has(path))
      .map(([path, sites]) => `${path}  <- ${sites.join(', ')}`);

    expect(newlyBroken).toEqual([]);
  });

  it('keeps the baseline honest by failing when a listed link gets fixed', () => {
    // The ratchet only tightens if a fixed link is removed from the baseline.
    const stale = Object.keys(baseline.knownUnresolved).filter(
      p => !unresolved.has(p)
    );
    expect(stale).toEqual([]);
  });
});
