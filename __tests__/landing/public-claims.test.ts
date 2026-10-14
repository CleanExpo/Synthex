/**
 * Unsupported marketing claims must not return to public copy.
 *
 * None of these is backed by anything in the repo: there is no customer count
 * behind "5,000+ businesses", no refund policy behind a "money-back guarantee",
 * and nothing that substantiates "world's first fully autonomous". /case-studies
 * itself says case studies are still being prepared. Copy that states them on a
 * public page is an Australian Consumer Law exposure.
 *
 * The guard is driven by an inventory, not a hand-kept file list: every source
 * file under app/ that is not an API route or behind PROTECTED_PREFIXES, plus
 * everything those files import, followed transitively. A new public page (or a
 * component it renders) is covered the moment it exists.
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import path from 'path';

const ROOT = path.join(__dirname, '../..');
const APP = path.join(ROOT, 'app');
const SOURCE_EXT = ['.ts', '.tsx', '.js', '.jsx', '.mjs'];

const BANNED_CLAIMS: Array<[string, RegExp]> = [
  ['customer-count claim', /\b\d{1,3}(,\d{3})\+\s*(Australian\s+)?business/i],
  ['money-back guarantee', /money[- ]back/i],
  ["world's first claim", /world['’]s first/i],
  ['unsourced hours-per-week stat', /average SMB spends/i],
];

// Route prefixes the proxy keeps behind auth (proxy.ts PROTECTED_PREFIXES).
function protectedPrefixes(): string[] {
  const proxy = readFileSync(path.join(ROOT, 'proxy.ts'), 'utf8');
  const match = proxy.match(/PROTECTED_PREFIXES\s*=\s*\[([^\]]*)\]/);
  if (!match) throw new Error('PROTECTED_PREFIXES not found in proxy.ts');
  return [...match[1].matchAll(/'([^']+)'/g)].map(m => m[1]);
}

// URL path of an app/ file: route groups "(x)" and private "_x" folders drop out.
function routeOf(file: string): string {
  const segments = path
    .relative(APP, path.dirname(file))
    .split(path.sep)
    .filter(s => s && !s.startsWith('('));
  return `/${segments.join('/')}`;
}

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return walk(full);
    return SOURCE_EXT.includes(path.extname(full)) ? [full] : [];
  });
}

function publicAppFiles(): string[] {
  const blocked = protectedPrefixes();
  return walk(APP).filter(file => {
    const route = routeOf(file);
    if (route === '/api' || route.startsWith('/api/')) return false;
    return !blocked.some(p => route === p || route.startsWith(`${p}/`));
  });
}

function resolveImport(from: string, spec: string): string | null {
  let base: string;
  if (spec.startsWith('@/')) base = path.join(ROOT, spec.slice(2));
  else if (spec.startsWith('.')) base = path.resolve(path.dirname(from), spec);
  else return null; // package import — not our copy
  const candidates = [
    base,
    ...SOURCE_EXT.map(ext => base + ext),
    ...SOURCE_EXT.map(ext => path.join(base, `index${ext}`)),
  ];
  return candidates.find(c => existsSync(c) && statSync(c).isFile()) ?? null;
}

const IMPORT_RE =
  /(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)|import\s+['"]([^'"]+)['"]/g;

function publicSourceInventory(): string[] {
  const seen = new Set<string>();
  const queue = publicAppFiles();
  while (queue.length) {
    const file = queue.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    if (!SOURCE_EXT.includes(path.extname(file))) continue;
    const source = readFileSync(file, 'utf8');
    for (const m of source.matchAll(IMPORT_RE)) {
      const resolved = resolveImport(file, m[1] ?? m[2] ?? m[3]);
      if (resolved && !seen.has(resolved)) queue.push(resolved);
    }
  }
  return [...seen, path.join(ROOT, 'public/llms.txt')].sort();
}

const inventory = publicSourceInventory();
const rel = (file: string) => path.relative(ROOT, file);

describe('public copy — inventory', () => {
  it.each([
    'app/compare/page.tsx',
    'app/compare/hootsuite/page.tsx',
    'app/add-ons/page.tsx',
    'app/add-ons/mcp-app-development/page.tsx',
    'app/agencies/page.tsx',
    'components/marketing/MarketingLayout.tsx',
    'components/demo/CaptionDemo.tsx',
    'lib/seo/metadata.ts',
    'public/llms.txt',
  ])('covers %s', file => {
    expect(inventory.map(rel)).toContain(file);
  });

  // Seeds are routes the proxy serves without auth. Files they import are
  // public by reach even when they live under app/dashboard (e.g. the
  // /vision-board-preview panels), so the closure is not filtered.
  it('seeds no API route or auth-protected route', () => {
    const stray = publicAppFiles()
      .map(rel)
      .filter(f =>
        /^app\/(\([^/]+\)\/)*(api|dashboard|onboarding|admin)\//.test(f)
      );
    expect(stray).toEqual([]);
  });
});

describe('public copy — unsupported claims', () => {
  it('no public page or anything it imports carries a banned claim', () => {
    const hits = inventory.flatMap(file => {
      const source = readFileSync(file, 'utf8');
      return BANNED_CLAIMS.flatMap(([label, pattern]) => {
        const match = source.match(pattern);
        return match ? [`${rel(file)}: ${label} — "${match[0]}"`] : [];
      });
    });
    expect(hits).toEqual([]);
  });

  it('the patterns still catch the original wording', () => {
    const original = [
      'Join 5,000+ Australian businesses posting to 9 platforms',
      '30-day money-back guarantee · Cancel anytime',
      "The world's first fully autonomous AI marketing agency.",
      'The average SMB spends 10+ hours per week on social media.',
    ];
    original.forEach((line, i) => {
      expect(BANNED_CLAIMS[i][1].test(line)).toBe(true);
    });
  });
});
