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
import ts from 'typescript';

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

// Copy split across literals reads as one string to a visitor:
//   {'Synthex gets 45'}{'% more'}  ·  'Join 5,' + '000+'  ·  `${'45'}% more`
// Join them before matching. A literal's body may hold the other quote marks
// (an apostrophe in "world's") but not its own, and never a line break.
const LITERAL = String.raw`(['"\x60])((?:(?!\1)[^\n\\])*)\1`;
const ADJACENT_EXPRESSIONS = new RegExp(
  String.raw`${LITERAL}\s*\}\s*\{\s*${LITERAL.replace('\\1', '\\3').replace('\\1', '\\3')}`,
  'g'
);
const CONCATENATION = new RegExp(
  String.raw`${LITERAL}\s*\+\s*${LITERAL.replace('\\1', '\\3').replace('\\1', '\\3')}`,
  'g'
);
const LITERAL_INTERPOLATION =
  /\$\{\s*(?:'([^'\n]*)'|"([^"\n]*)"|(\d+(?:\.\d+)?))\s*\}/g;

export function joinLiterals(source: string): string {
  let text = source;
  let previous: string;
  do {
    previous = text;
    text = text
      .replace(LITERAL_INTERPOLATION, (_m, a, b, c) => a ?? b ?? c)
      .replace(ADJACENT_EXPRESSIONS, (_m, q, x, _q2, y) => `${q}${x}${y}${q}`)
      .replace(CONCATENATION, (_m, q, x, _q2, y) => `${q}${x}${y}${q}`);
  } while (text !== previous);
  return text;
}

export function normaliseCopy(raw: string): string {
  // Markup is not copy: a tag is replaced by its quoted attribute values
  // (alt, description, title… are copy), and JSX whitespace ({' '}) by a space.
  let text = decodeEntities(joinLiterals(raw))
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

// Growth claims, by class rather than by phrasing: a growth verb, a quantity
// and a growth object inside one short window of a single sentence, in any
// order — "grew by 10000 followers", "followers jumped 300%", "revenue rose
// 23%", "sales doubled", "saved 15 hours a week".
//
// The quantity must read as an outcome: a measure (N%, N×, $N), a number
// directly counting a growth object ("10000 instagram followers"), or a
// doubling verb. A number counting something else ("add 1-2 emojis", "7 ways
// to increase engagement") or a list index ("4: follower growth") is not one.
const GROWTH_VERB =
  /\b(?:gr[eo]w(?:s|n|ing)?|increas(?:e[ds]?|ing)|boost(?:s|ed|ing)?|gain(?:s|ed|ing)?|add(?:s|ed|ing)?|jump(?:s|ed|ing)?|doubl(?:e[ds]?|ing)|tripl(?:e[ds]?|ing)|quadrupl(?:e[ds]?|ing)|went from|r[io]se[ns]?|rising|climb(?:s|ed|ing)?|up|surg(?:e[ds]?|ing)|soar(?:s|ed|ing)?|skyrocket(?:s|ed|ing)?|spik(?:e[ds]?|ing)|sav(?:e[ds]?|ings?)|lift(?:s|ed)?)\b/g;
const DOUBLING_VERB = /^(?:doubl|tripl|quadrupl)/;
const GROWTH_OBJECT_WORD = String.raw`(?:followers?|subscribers?|fans|likes|views|leads?|customers?|clients?|sales|orders?|bookings?|enquiries|inquiries|revenue|profit|income|engagement|reach|traffic|visitors?|impressions|conversions?|sign-?ups|roi|hours?)`;
const GROWTH_OBJECT = new RegExp(String.raw`\b${GROWTH_OBJECT_WORD}\b`);
const MEASURE =
  /(?:\$\s?\d+(?:\.\d+)?(?:k|m)?|\b\d+(?:\.\d+)?\s?(?:%|percent\b|x\b|times\b|fold\b))/;
const COUNTED_OBJECT = new RegExp(
  String.raw`\b\d+(?:\.\d+)?(?:k|m)?\+? (?:[a-z-]+ ){0,2}${GROWTH_OBJECT_WORD}\b`
);
const GROWTH_WINDOW = 60; // characters either side of the verb

export function findGrowthClaims(normalised: string): string[] {
  const hits: string[] = [];
  for (const verb of normalised.matchAll(GROWTH_VERB)) {
    const at = verb.index ?? 0;
    // Stay inside the verb's sentence: a full stop followed by a space ends it.
    const before = normalised.slice(Math.max(0, at - GROWTH_WINDOW), at);
    const after = normalised.slice(at, at + verb[0].length + GROWTH_WINDOW);
    const window =
      (before.split(/[.!?;](?:\s|$)/).pop() ?? '') +
      (after.split(/[.!?;](?:\s|$)/)[0] ?? '');
    // "saving $140,000 a year" needs no growth object: the money is the result.
    if (/^sav/.test(verb[0]) && /\$\s?\d/.test(window)) {
      hits.push(`growth claim — "${window.trim()}"`);
      continue;
    }
    if (!GROWTH_OBJECT.test(window)) continue;
    const quantified =
      MEASURE.test(window) ||
      COUNTED_OBJECT.test(window) ||
      DOUBLING_VERB.test(verb[0]);
    if (quantified) hits.push(`growth claim — "${window.trim()}"`);
  }
  return hits;
}

export function findClaims(raw: string): string[] {
  const text = normaliseCopy(raw);
  const patternHits = BANNED_CLAIMS.flatMap(([label, pattern]) => {
    const match = text.match(pattern);
    return match ? [`${label} — "${match[0]}"`] : [];
  });
  return [...patternHits, ...findGrowthClaims(text)];
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
  // Growth claims by class (round-3 review mutants and siblings).
  'The bakery grew by 10,000 Instagram followers',
  'The bakery grew by ten thousand Instagram followers',
  'Followers jumped 300% in a month',
  'Revenue rose by twenty-three percent after switching',
  'We gained 5,000 new subscribers in six weeks',
  'Engagement is up 45% this quarter',
  'Sales doubled after switching to Synthex',
  'Traffic climbed from 2,000 to 9,000 visitors',
  'Synthex boosted conversions by 2.5x',
  'The account went from 800 to 42,000 followers',
  'Synthex saved our team 15 hours a week',
  'They added 120 qualified leads in a month',
  'The shop has grown to $1M in revenue',
  'Synthex gets 45% more engagement.',
  // Removed on this branch from emails and the catalogue.
  "You've joined 1000+ businesses saving $140,000+ per year",
  '$140,436/year savings vs traditional agencies',
  '2.2x engagement boost with AI optimization',
  'Posting at peak times doubles your organic reach.',
];

// Copy that must NOT be flagged: advice, formulas and counts of things that
// are not outcomes. Keeps the growth rule honest about false positives.
export const NOT_CLAIMS: string[] = [
  'Add 1-2 relevant emojis to increase visual appeal and reach',
  '7 ways to increase your social media engagement',
  'Four: follower growth rate — are you growing, stagnating, or declining?',
  'Formula: conversions divided by total visitors, multiplied by 100.',
  'Each re-inspection costs $2,000–$5,000.',
  'A post seen by 3,000 people without any boosting has a reach of 3,000.',
  'Instagram: aim for three percent or above. LinkedIn: above two percent is strong.',
  'Reply to every comment within the first hour — it boosts your ranking.',
  'Body text body-lg - 18px - gray 300 Generate viral content with AI, analyze engagement patterns',
  'Set up your account and add 3 team members.',
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

// ── Copy extraction ──────────────────────────────────────────────────────────
//
// Source files are judged on their copy, not their code: the strings and JSX
// text that can reach a visitor. Parsed with the TypeScript compiler, so
// comments, identifiers and object keys never count, while copy split across
// literals is reassembled the way a visitor reads it:
//   'Join 5,' + '000+'            → constant-folded
//   `${'45'}% more`              → template with literal spans folded
//   <p>{'Synthex gets 45'}{'% more'}</p>, <p>Join <b>5,000+</b> firms</p>
//                                 → one JSX text run per element
// A non-constant expression contributes a space, so unrelated values are not
// glued together.

const NON_COPY_JSX_ATTRIBUTE =
  /^(?:class(?:Name)?|style|href|src|srcSet|id|key|type|variant|size|name|role|rel|target|method|action|htmlFor|width|height|viewBox|d|fill|stroke|xmlns|loading|sizes|data-[\w-]+|aria-(?!label)[\w-]+|as|icon|route|path|gradientVariant)$/i;

function constantText(node: ts.Node): string | null {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return node.text;
  }
  if (ts.isNumericLiteral(node)) return node.text;
  if (ts.isParenthesizedExpression(node)) return constantText(node.expression);
  if (ts.isTemplateExpression(node)) {
    let text = node.head.text;
    for (const span of node.templateSpans) {
      const value = constantText(span.expression);
      if (value === null) return null;
      text += value + span.literal.text;
    }
    return text;
  }
  if (
    ts.isBinaryExpression(node) &&
    node.operatorToken.kind === ts.SyntaxKind.PlusToken
  ) {
    const left = constantText(node.left);
    const right = constantText(node.right);
    return left !== null && right !== null ? left + right : null;
  }
  return null;
}

// Template text with non-constant spans replaced by a space.
function templateText(node: ts.TemplateExpression): string {
  return [
    node.head.text,
    ...node.templateSpans.map(
      span => (constantText(span.expression) ?? ' ') + span.literal.text
    ),
  ].join('');
}

// JSX text collapses whitespace runs that contain a line break.
const jsxText = (raw: string) => raw.replace(/\s*\n\s*/g, ' ');

function jsxChildrenText(children: ts.NodeArray<ts.JsxChild>): string {
  return children
    .map(child => {
      if (ts.isJsxText(child)) return jsxText(child.text);
      if (ts.isJsxExpression(child)) {
        if (!child.expression) return '';
        return constantText(child.expression) ?? ' ';
      }
      if (ts.isJsxElement(child)) return jsxChildrenText(child.children);
      if (ts.isJsxFragment(child)) return jsxChildrenText(child.children);
      return ' ';
    })
    .join('');
}

export function extractCopy(source: string, fileName: string): string[] {
  if (!SOURCE_EXT.includes(path.extname(fileName))) return [source];
  const sf = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    false,
    fileName.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );
  const copy: string[] = [];
  const visit = (node: ts.Node): void => {
    // Module specifiers are wiring, not copy.
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) return;
    if (ts.isJsxElement(node) || ts.isJsxFragment(node)) {
      const text = jsxChildrenText(node.children).trim();
      if (text) copy.push(text);
    } else if (ts.isJsxAttribute(node)) {
      const name = node.name.getText(sf);
      if (NON_COPY_JSX_ATTRIBUTE.test(name)) return;
    } else {
      const folded = constantText(node);
      if (folded !== null) {
        copy.push(folded);
        return; // parts of a folded constant are already in it
      }
      if (ts.isTemplateExpression(node)) copy.push(templateText(node));
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return copy.filter(text => /[a-z]/i.test(text));
}

/** Claims in a source file's copy, each tagged with the text it came from. */
export function findClaimsInSource(source: string, fileName: string): string[] {
  return extractCopy(source, fileName).flatMap(findClaims);
}

// ── Same-origin API routes ───────────────────────────────────────────────────

export interface ApiRoute {
  file: string;
  /** URL path segments; `[name]` is a param, `[...name]` a catch-all. */
  segments: string[];
}

export function apiRoutes(): ApiRoute[] {
  return walk(path.join(APP, 'api'))
    .filter(file => /^route\.(ts|js)$/.test(path.basename(file)))
    .map(file => ({
      file,
      segments: path
        .relative(APP, path.dirname(file))
        .split(path.sep)
        .filter(s => s && !s.startsWith('(')),
    }));
}

/** The route file serving `pathname` (e.g. /api/blog/hello), with its params. */
export function matchApiRoute(
  routes: ApiRoute[],
  pathname: string
): { route: ApiRoute; params: Record<string, string | string[]> } | null {
  const parts = pathname.split('/').filter(Boolean);
  // Static segments beat dynamic ones, as in Next.
  const ranked = [...routes].sort(
    (a, b) =>
      a.segments.filter(s => s.startsWith('[')).length -
      b.segments.filter(s => s.startsWith('[')).length
  );
  for (const route of ranked) {
    const params: Record<string, string | string[]> = {};
    let ok = true;
    for (let i = 0; i < route.segments.length; i++) {
      const seg = route.segments[i];
      const catchAll = seg.match(/^\[\[?\.\.\.(\w+)\]\]?$/);
      if (catchAll) {
        params[catchAll[1]] = parts.slice(i);
        i = route.segments.length;
        break;
      }
      if (i >= parts.length) {
        ok = false;
        break;
      }
      const param = seg.match(/^\[(\w+)\]$/);
      if (param) params[param[1]] = decodeURIComponent(parts[i]);
      else if (seg !== parts[i]) ok = false;
      if (!ok) break;
    }
    const exact =
      route.segments.some(s => s.includes('...')) ||
      route.segments.length === parts.length;
    if (ok && exact) return { route, params };
  }
  return null;
}

// `/api/...` paths a source file references: fetch('/api/x'), useSWR('/api/x'),
// `${base}/api/blog/${slug}`. Interpolations stand in for one dynamic segment.
const API_PATH_RE = /\/api\/[\w\-./[\]${}]*/g;

function referencedApiRoutes(source: string, routes: ApiRoute[]): string[] {
  const files = new Set<string>();
  for (const [raw] of source.matchAll(API_PATH_RE)) {
    const pathname = raw
      .replace(/\$\{[^}]*\}/g, 'x')
      .replace(/[?#].*$/, '')
      .replace(/\/+$/, '');
    const hit = matchApiRoute(routes, pathname);
    if (hit) files.add(hit.route.file);
  }
  return [...files];
}

/**
 * Everything a public page can put in front of a visitor: route files, what
 * they import, the same-origin API routes any of those reference, and what
 * those routes import — followed to a fixpoint.
 */
export function publicSourceInventory(): string[] {
  const routes = apiRoutes();
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
    for (const routeFile of referencedApiRoutes(source, routes)) {
      if (!seen.has(routeFile)) queue.push(routeFile);
    }
  }
  return [...seen, path.join(ROOT, 'public/llms.txt')].sort();
}
