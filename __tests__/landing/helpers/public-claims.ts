/**
 * Shared pieces of the public-claims guard (SYN-1226).
 *
 * - publicPageFiles() / publicSourceInventory(): what counts as public. Every
 *   source file under app/ whose route is not an API route and not behind
 *   proxy.ts PROTECTED_PREFIXES, plus everything those files import,
 *   followed transitively, plus public/llms.txt.
 * - normaliseCopy(): text is judged the way a reader would see it, so trivial
 *   rewording cannot slip a claim past the patterns.
 * - BANNED_CLAIMS: patterns matched against normalised text.
 * - REMOVED_CLAIM_SEEDS: every claim this branch removed, numeric and spelled
 *   out, so the patterns are proven against the real wording.
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import path from 'path';

export const ROOT = path.join(__dirname, '../../..');
const APP = path.join(ROOT, 'app');
const SOURCE_EXT = ['.ts', '.tsx', '.js', '.jsx', '.mjs'];

export const rel = (file: string) => path.relative(ROOT, file);

// ── Normalisation ────────────────────────────────────────────────────────────

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  rsquo: "'",
  lsquo: "'",
  rdquo: '"',
  ldquo: '"',
  mdash: '—',
  ndash: '–',
  middot: '·',
};

function decodeEntities(text: string): string {
  return text.replace(
    /&(#x[0-9a-f]+|#\d+|[a-z]+);/gi,
    (whole, body: string) => {
      if (body[0] === '#') {
        const code =
          body[1] === 'x' || body[1] === 'X'
            ? parseInt(body.slice(2), 16)
            : parseInt(body.slice(1), 10);
        return Number.isFinite(code) ? String.fromCodePoint(code) : whole;
      }
      return NAMED_ENTITIES[body.toLowerCase()] ?? whole;
    }
  );
}

const UNITS: Record<string, number> = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
};
const TENS: Record<string, number> = {
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
};
const SCALES: Record<string, number> = {
  hundred: 100,
  thousand: 1000,
  million: 1_000_000,
};

// Rewrites runs of number words ("five thousand", "twenty-five", "ten") as digits.
function numberWordsToDigits(text: string): string {
  const word =
    '(?:' +
    [...Object.keys(UNITS), ...Object.keys(TENS), ...Object.keys(SCALES)].join(
      '|'
    ) +
    ')';
  const run = new RegExp(
    `\\b${word}(?:(?:[\\s-]+|\\s+and\\s+)${word})*\\b`,
    'g'
  );
  return text.replace(run, match => {
    let total = 0;
    let current = 0;
    for (const token of match.split(/[\s-]+/).filter(t => t && t !== 'and')) {
      if (token in UNITS) current += UNITS[token];
      else if (token in TENS) current += TENS[token];
      else if (token === 'hundred') current = (current || 1) * 100;
      else {
        total += (current || 1) * SCALES[token];
        current = 0;
      }
    }
    return String(total + current);
  });
}

export function normaliseCopy(raw: string): string {
  // Markup is not copy: drop tags and JSX whitespace expressions ({' '}).
  let text = decodeEntities(raw)
    .replace(/<\/?[a-z][^<>]*>/gi, '')
    .replace(/\{\s*(['"`])\s*\1\s*\}/g, ' ')
    .toLowerCase();
  text = text.replace(/[‘’`´]/g, "'").replace(/[“”]/g, '"');
  text = text.replace(/\s+/g, ' ');
  // Thousands separators: "5,000" / "1,000,000" → digits only.
  let previous: string;
  do {
    previous = text;
    text = text.replace(/(\d),(\d{3})(?!\d)/g, '$1$2');
  } while (text !== previous);
  return numberWordsToDigits(text);
}

// ── Patterns ─────────────────────────────────────────────────────────────────

export const BANNED_CLAIMS: Array<[string, RegExp]> = [
  [
    'customer-count claim',
    /\b\d{3,}\+?\s*(?:australian\s+|local\s+|small\s+)?(?:business(?:es)?|business owners|customers|users|brands|companies)\b/,
  ],
  ['money-back guarantee', /money[\s-]*back/],
  ["world's first claim", /world'?s first/],
  [
    'unsourced hours-per-week stat',
    /average (?:smb|small business\w*) spends|\d+\+?\s*(?:hrs|hours)\s*(?:\/|per|a)\s*week wasted/,
  ],
];

export function findClaims(raw: string): string[] {
  const text = normaliseCopy(raw);
  return BANNED_CLAIMS.flatMap(([label, pattern]) => {
    const match = text.match(pattern);
    return match ? [`${label} — "${match[0]}"`] : [];
  });
}

// Every claim removed on this branch, verbatim, plus spelled-out and
// entity-encoded variants. Each must be caught.
export const REMOVED_CLAIM_SEEDS: string[] = [
  'Join 5,000+ Australian businesses posting to 9 platforms automatically.',
  '5,000+ businesses across every industry trust Synthex to handle their social media.',
  'Join 5,000+ businesses that have replaced manual posting with an automated AI marketing team that works 24/7.',
  `Join <span className="text-amber-400 font-medium">5,000+</span>{' '}
        businesses automating their content`,
  'Example: "Join 10,000 businesses using Synthex" is social proof.',
  'Join 5,000+ Business Owners Using Synthex | Community',
  'Three: social proof — "join 5,000 businesses already using Synthex."',
  'Five thousand business owners are already using Synthex to automate their social media marketing.',
  'Five thousand business owners are already using Synthex for social media marketing.',
  'Join five-thousand Australian businesses using Synthex.',
  'Join 5&#44;000+ Australian businesses',
  'Every plan includes a 30-day money-back guarantee.',
  '30-day money-back guarantee · Cancel anytime',
  'Thirty day money back guarantee',
  "The world's first fully autonomous AI marketing agency.",
  'The world&#x27;s first fully autonomous AI marketing agency.',
  'The world’s first fully autonomous AI marketing agency.',
  'The average SMB spends 10+ hours per week on social media.',
  'The average SMB spends ten hours per week on social media.',
  '10+ hrs/week wasted',
];

// ── Inventory ────────────────────────────────────────────────────────────────

function protectedPrefixes(): string[] {
  const proxy = readFileSync(path.join(ROOT, 'proxy.ts'), 'utf8');
  const match = proxy.match(/PROTECTED_PREFIXES\s*=\s*\[([^\]]*)\]/);
  if (!match) throw new Error('PROTECTED_PREFIXES not found in proxy.ts');
  return [...match[1].matchAll(/'([^']+)'/g)].map(m => m[1]);
}

// URL path of an app/ file: route groups "(x)" drop out.
export function routeOf(file: string): string {
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

// Next.js route-convention files: the only files under app/ that Next serves
// by themselves. Anything else under app/ is public only if one of these
// imports it (followed in publicSourceInventory).
const ROUTE_FILES =
  /^(page|layout|template|loading|error|global-error|not-found|default|sitemap|robots|manifest|opengraph-image|twitter-image|icon|apple-icon)\.(tsx|ts|jsx|js|mjs)$/;

export function publicAppFiles(): string[] {
  const blocked = protectedPrefixes();
  return walk(APP).filter(file => {
    if (!ROUTE_FILES.test(path.basename(file))) return false;
    const route = routeOf(file);
    if (route === '/api' || route.startsWith('/api/')) return false;
    return !blocked.some(p => route === p || route.startsWith(`${p}/`));
  });
}

export function publicPageFiles(): string[] {
  return publicAppFiles()
    .filter(file => /^page\.(tsx|ts|jsx|js)$/.test(path.basename(file)))
    .sort();
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

export function publicSourceInventory(): string[] {
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
