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

const ATTRIBUTE_RE = /([\w:-]+)\s*=\s*("[^"]*"|'[^']*'|`[^`]*`)/g;
// Attributes that carry styling, wiring or identifiers rather than copy.
const NON_COPY_ATTRIBUTE =
  /^(?:class(?:Name)?|style|href|src|srcSet|id|key|type|variant|size|name|role|rel|target|method|action|htmlFor|for|width|height|viewBox|d|fill|stroke|xmlns|loading|sizes|data-[\w-]+|aria-(?!label)[\w-]+|tw|as|icon|route|path|gradientVariant)$/i;

export function normaliseCopy(raw: string): string {
  // Markup is not copy: a tag is replaced by its quoted attribute values
  // (alt, description, title… are copy), and JSX whitespace ({' '}) by a space.
  let text = decodeEntities(raw)
    .replace(/<\/?[a-z][^<>]*>/gi, tag => {
      const values = [...tag.matchAll(ATTRIBUTE_RE)]
        .filter(([, name]) => !NON_COPY_ATTRIBUTE.test(name))
        .map(([, , value]) => value.slice(1, -1));
      return ` ${values.join(' ')} `;
    })
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
  text = numberWordsToDigits(text);
  return text
    .replace(/(\d+) point (\d+)/g, '$1.$2') // "6 point 9" → 6.9
    .replace(/\b(\d+)k\b/g, '$1000') // "10k" → 10000
    .replace(/(\d)\s*×/g, '$1x'); // "6.9×" → 6.9x
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

// A number that reads as an outcome: a percentage, a multiplier, a dollar
// amount, or a count of followers, leads, customers, sales or orders.
const GROWTH = String.raw`(?:\$\d+|\d+(?:\.\d+)?\s?(?:%|percent|x\b)|\d+\+? (?:\w+ )?(?:followers?|subscribers?|leads?|customers?|sales|orders?))`;

BANNED_CLAIMS.push(
  [
    'follower-growth claim',
    new RegExp(
      [
        String.raw`\bfrom \d+ (?:\w+ )?(?:followers?|subscribers?) to (?:over )?\d+`,
        String.raw`\bfrom \d+ to (?:over )?\d+\+? (?:\w+ )?(?:followers?|subscribers?)\b`,
        String.raw`\b(?:grew|grow|grows|growing) (?:\w+ ){0,3}to \d+\+? (?:\w+ )?(?:followers?|subscribers?)`,
        String.raw`\b\d+\+? (?:\w+ )?(?:followers?|subscribers?) in \d+ (?:days?|weeks?|months?)`,
      ].join('|')
    ),
  ],
  [
    'case-study result claim',
    new RegExp(
      String.raw`case stud(?:y|ies)[^.]{0,160}?${GROWTH}|${GROWTH}[^.]{0,160}?case stud(?:y|ies)`
    ),
  ],
  [
    'unsourced results claim',
    new RegExp(
      [
        String.raw`\b(?:users|customers|clients|early adopters) (?:\w+ ){0,2}report (?:saving|seeing|growing)`,
        String.raw`\bsaves? (?:over |up to |an average of )?\d+\+? ?(?:hours?|hrs)\b`,
        String.raw`\bincrease[sd]? (?:\w+ ){0,3}by (?:an average of |up to |over )?\d+(?:\.\d+)? ?(?:%|percent)`,
        String.raw`\b\d+(?:\.\d+)? ?(?:%|percent) (?:increase|more (?:engagement|sales|leads|reach|clicks|comments|revenue))`,
        String.raw`\b\d+(?:\.\d+)? ?(?:x|times) (?:the )?(?:roi|more (?:engagement|comments|content|reach|leads|sales)|faster|the audience)`,
        String.raw`\broi of \$?\d+`,
      ].join('|')
    ),
  ]
);

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
  '<PublicPageHero description="Join 5,000+ Australian businesses using Synthex." />',
  'Every plan includes a 30-day money-back guarantee.',
  '30-day money-back guarantee · Cancel anytime',
  'Thirty day money back guarantee',
  "The world's first fully autonomous AI marketing agency.",
  'The world&#x27;s first fully autonomous AI marketing agency.',
  'The world’s first fully autonomous AI marketing agency.',
  'The average SMB spends 10+ hours per week on social media.',
  'The average SMB spends ten hours per week on social media.',
  '10+ hrs/week wasted',
  // Follower-growth and case-study results (removed catalogue videos).
  'From 200 to 10,000 Instagram followers in 90 days — the Synthex case study.',
  'From two hundred to ten thousand Instagram followers in ninety days.',
  'How a Local Bakery Grew to 10K Instagram Followers | Synthex',
  'The result: from 200 followers to over 10,000 in ninety days.',
  'Synthex case study: five hundred qualified leads in ninety days.',
  'Online order enquiries increased by three hundred and forty percent.',
  'Optimal Time: Posts at 9 AM get 45% more engagement',
  // Time-saved, uplift and ROI numbers (removed catalogue videos and lines).
  'Early adopters report saving over ten hours per week while seeing improved engagement.',
  'At Synthex, our users report saving up to fifteen hours per week.',
  'AI Marketing Saves 10+ Hours Per Week | Synthex',
  '"save ten hours a week: start your free trial."',
  'Video content generates forty-nine percent more engagement than static images.',
  'Video Gets 49% More Engagement Than Static Posts | Synthex',
  'Businesses with a documented social media strategy see three times the ROI.',
  'Email marketing delivers an average ROI of thirty-six dollars for every one dollar spent.',
  'Consistent brand presentation increases revenue by an average of twenty-three percent.',
  'UGC Drives 6.9× More Engagement | Synthex',
  'User-generated content drives six point nine times more engagement than branded content.',
  'Businesses with documented content strategies grow three times faster than those without one.',
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
