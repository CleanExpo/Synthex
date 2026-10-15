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

// ── Quantified outcomes (deny by default) ────────────────────────────────────
//
// No verb list. EVERY sentence that contains a quantity and an outcome noun is
// a finding, whatever the verb ("attracted", "snagged", "pulled in", "won"…),
// unless the exact sentence is on the reviewed allow-list
// (public-claims-allowlist.ts) with a reason it is not a factual outcome
// claim. New phrasings fail until someone reviews them.

export const QUANTITY =
  /(?:\b(?:doubl(?:e[ds]?|ing)|tripl(?:e[ds]?|ing)|quadrupl(?:e[ds]?|ing)|twice|halved)\b(?!-)|\$\s?\d[\d.]*(?:k|m|b)?|\b\d[\d.]*(?:k|m|b)?\+?\s?(?:%|percent\b|x\b|×|times\b|fold\b)?|\b(?:millions?|billions?|thousands?|hundreds?|dozens?)\b)/;

export const OUTCOME_NOUN =
  /\b(?:followers?|following|subscribers?|fans?|audiences?|reach|impressions?|engagements?|likes?|views?|viewers?|clicks?|traffic|visitors?|visits|leads?|customers?|clients?|users?|businesses|business owners|members?|memberships?|sign-?ups?|registrations?|sales|orders?|purchases?|conversions?|revenue|profits?|income|earnings|roi|returns?|costs?|savings?|saving|hours?|hrs|time|minutes?|mins|growth|rates?|uplift|increases?|results?|claims?|re-?inspections?|bookings?|reservations?|enquiries|inquiries|shares|comments|downloads|installs|retention|churn|rankings?|donors?|donations?|pipeline|waitlist|footfall|foot traffic|deals?|signups|uptime|availability|accuracy|satisfaction)\b/;

const QUANTITY_ALL = new RegExp(QUANTITY.source, 'g');

// A quantity that cannot be an outcome on its own: a bare 0 or 1 ("one
// dashboard", "1 click"), or a calendar year used as a date ("July 2026",
// "in 2024", "2010–2024"). With a unit (1%, $1, 1x, 1m) they still count, and
// a year-like number anywhere else ("grew to 2000 followers") still counts.
function countsAsQuantity(text: string, match: RegExpMatchArray): boolean {
  const q = match[0].trim().replace(/\.+$/, '');
  if (/^[01]$/.test(q)) return false;
  // A list index is a position, not a quantity: "3: social proof",
  // "step 2: …", "pillar 4", "#1".
  const at0 = match.index ?? 0;
  const tail = text.slice(at0 + match[0].length, at0 + match[0].length + 2);
  const head = text.slice(Math.max(0, at0 - 10), at0);
  if (/^\d+$/.test(q) && /^\s?:/.test(tail)) return false;
  if (
    /^\d+$/.test(q) &&
    /(?:step|pillar|mistake|tip|part|scene|figure|phase|option|stage|rule|#)\s*$/.test(
      head
    )
  ) {
    return false;
  }
  // A year-like number counts only when an outcome noun follows it
  // ("2000 followers"); otherwise it is a date ("the 2024 inquiry").
  if (/^(?:19|20)\d\d$/.test(q)) {
    const rest = text.slice(at0 + match[0].length, at0 + match[0].length + 40);
    return new RegExp(
      String.raw`^\+?\s?(?:[a-z-]+\s){0,2}` +
        OUTCOME_NOUN.source.replace(/^\\b/, '')
    ).test(rest);
  }
  return true;
}

export function isQuantifiedOutcome(normalisedSentence: string): boolean {
  if (!OUTCOME_NOUN.test(normalisedSentence)) return false;
  return [...normalisedSentence.matchAll(QUANTITY_ALL)].some(m =>
    countsAsQuantity(normalisedSentence, m)
  );
}

// Allow-list keys compare without whitespace, so the same sentence matches
// whether its fragments were joined with '' or ' '.
export const sentenceKey = (normalised: string) =>
  normalised.replace(/\s+/g, '');

export function splitSentences(normalised: string): string[] {
  return normalised
    .split(/(?<=[.!?])\s+|\n+/)
    .map(sentence => sentence.trim())
    .filter(Boolean);
}

export interface ClaimHit {
  /** Normalised sentence that triggered the finding. */
  sentence: string;
  /** Hard pattern label, or 'quantified outcome'. */
  rule: string;
}

/**
 * Findings in plain text, sentence by sentence. Hard patterns are never
 * allow-listable; a quantified outcome is, by exact sentence.
 */
export function claimHits(raw: string, allow: Set<string>): ClaimHit[] {
  const hits: ClaimHit[] = [];
  const sentences = raw
    .replace(/https?:\/\/[^\s"'<>)]+/g, ' ') // URLs are addresses, not prose
    .split(/\n+/)
    .flatMap(line => splitSentences(normaliseCopy(line)));
  for (const sentence of sentences) {
    for (const [label, pattern] of BANNED_CLAIMS) {
      if (pattern.test(sentence)) hits.push({ sentence, rule: label });
    }
    if (isQuantifiedOutcome(sentence) && !allow.has(sentenceKey(sentence))) {
      hits.push({ sentence, rule: 'quantified outcome' });
    }
  }
  return hits;
}

export function findClaims(
  raw: string,
  allow: Set<string> = new Set()
): string[] {
  return claimHits(raw, allow).map(h => `${h.rule} — "${h.sentence}"`);
}

// Every claim removed on this branch, verbatim, plus spelled-out and
// entity-encoded variants. Each must be caught.
export const REMOVED_CLAIM_SEEDS: string[] = [
  'Join 5,000+ Australian businesses posting to 9 platforms automatically.',
  '5,000+ businesses across every industry trust Synthex to handle their social media.',
  'Join 5,000+ businesses that have replaced manual posting with an automated AI marketing team that works 24/7.',
  `Join <span className="text-amber-400 font-medium">5,000+</span>{' '} businesses automating their content`,
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
  // Deny by default: verbs the guard was never written for (round-4 review).
  'The account attracted 20,000 new followers',
  'The bakery snagged 3,000 subscribers in a month',
  'Synthex pulled in 450 qualified leads',
  'The shop won 120 new customers',
  'Clients netted twelve thousand new followers',
  // RestoreAssist storyboard figures removed on this branch.
  'Re-inspections run 20–30%.',
  'Each one costs $2,000–$5,000.',
  'That fragmentation costs the industry millions every year in re-inspections alone.',
  'Insurance claims teams read 50+ contractor report formats a week.',
  'Average response time: 2 hours',
  '99.99% Uptime SLA',
];

// Copy that must NOT be flagged at all: no quantity, a list index, a date,
// or a bare "one". (Anything with a quantity and an outcome noun is flagged
// and must be neutralised or allow-listed — see public-claims-allowlist.ts.)
export const NOT_CLAIMS: string[] = [
  'Reply to every comment quickly — it boosts your ranking.',
  'Step 2: define your audience.',
  'The 2024 Senate inquiry documented systemic failures in claim handling.',
  'One dashboard for all your platforms.',
  'Removing double-handling and eliminating re-inspections.',
  'Instagram, Facebook and LinkedIn in one place.',
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
// Every string fragment a file holds, in source order, read with the
// TypeScript compiler: JSX text, string and template literals, array
// elements, both arms of conditionals, and constant-folded literal joins.
// What can never reach a visitor is skipped: comments, type literals, module
// specifiers, logger/console arguments and styling/wiring JSX attributes.
//
// Fragments are judged in two streams — joined with '' and with ' ' — over
// windows of up to MAX_WINDOW adjacent fragments, so a claim split across
// .join(''), a ternary, an array or adjacent JSX expressions is contiguous in
// at least one of them. A finding is reported for the smallest window that
// produces it; its allow-list key is that window's sentence.

const NON_COPY_JSX_ATTRIBUTE =
  /^(?:class(?:Name)?|style|href|src|srcSet|id|key|type|variant|size|name|role|rel|target|method|action|htmlFor|width|height|viewBox|d|fill|stroke|xmlns|loading|sizes|data-[\w-]+|aria-(?!label)[\w-]+|as|icon|route|path|gradientVariant)$/i;
const SILENT_CALLEE = /^(?:logger|console|log)\b/;
const MAX_WINDOW = 4;

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
  // ['a', 'b'].join('') and friends.
  if (
    ts.isCallExpression(node) &&
    ts.isPropertyAccessExpression(node.expression) &&
    node.expression.name.text === 'join' &&
    ts.isArrayLiteralExpression(node.expression.expression)
  ) {
    const parts = node.expression.expression.elements.map(constantText);
    const sep = node.arguments[0] ? constantText(node.arguments[0]) : ',';
    if (sep !== null && parts.every(p => p !== null)) return parts.join(sep);
  }
  // A conditional whose condition is a literal resolves to one arm.
  if (ts.isConditionalExpression(node)) {
    const k = node.condition.kind;
    if (k === ts.SyntaxKind.TrueKeyword) return constantText(node.whenTrue);
    if (k === ts.SyntaxKind.FalseKeyword) return constantText(node.whenFalse);
  }
  return null;
}

// Wiring, not copy: identifiers, URLs, paths, MIME types, model ids, CSS
// class lists. A pure quantity ("45", "2.5x", "$5,000") or a plain word
// ("engagement") is always copy, so a claim split into ['…boosted', '2.5x']
// still joins up in the stream.
const PURE_QUANTITY = /^[$]?\d[\d.,–-]*(?:k|m|b|x|%)?\+?$/i;
const WIRING_TOKEN = /[/:._#@=?&{}<>[\]\\]|\d[a-z]|[a-z]\d|-\d|\d-/i;

// HTTP header names and multi-hyphen identifiers (x-rate-limit-remaining).
const HEADER_OR_IDENT =
  /^(?:x-[\w-]+|[a-z]+(?:-[a-z]+){2,}|content-type|user-agent|cache-control|content-length|accept-[a-z]+|set-cookie|retry-after)$/i;

export function isWiring(fragment: string): boolean {
  const text = fragment.trim();
  if (PURE_QUANTITY.test(text)) return false;
  const tokens = text.split(/\s+/);
  if (tokens.length === 1) {
    return (
      WIRING_TOKEN.test(text) ||
      HEADER_OR_IDENT.test(text) ||
      /^[A-Z][a-z]+[A-Z]\w*$/.test(text) // CamelCase identifier (TipCard)
    );
  }
  const wiring = tokens.filter(
    t => !PURE_QUANTITY.test(t) && (WIRING_TOKEN.test(t) || /-/.test(t))
  ).length;
  return tokens.length >= 3 && wiring / tokens.length >= 0.6;
}

export function extractFragments(source: string, fileName: string): string[] {
  if (!SOURCE_EXT.includes(path.extname(fileName))) return [source];
  const sf = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    false,
    fileName.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );
  const fragments: string[] = [];
  const push = (text: string) => {
    const t = text.replace(/\s*\n\s*/g, ' ');
    if (t.trim() && !isWiring(t)) fragments.push(t);
  };
  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) return;
    // 'use client' / 'use server' directives.
    if (
      ts.isExpressionStatement(node) &&
      ts.isStringLiteral(node.expression) &&
      /^use (client|server)$/.test(node.expression.text)
    ) {
      return;
    }
    if (ts.isLiteralTypeNode(node) || ts.isTypeNode(node)) return;
    if (ts.isJsxAttribute(node)) {
      if (NON_COPY_JSX_ATTRIBUTE.test(node.name.getText(sf))) return;
    }
    if (
      ts.isCallExpression(node) &&
      SILENT_CALLEE.test(node.expression.getText(sf))
    ) {
      return;
    }
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      push(node.text);
      return;
    }
    if (ts.isJsxText(node)) {
      push(node.text);
      return;
    }
    if (ts.isTemplateExpression(node)) {
      push(node.head.text);
      for (const span of node.templateSpans) {
        visit(span.expression);
        push(span.literal.text);
      }
      return;
    }
    ts.forEachChild(node, visit);
    // After its parts: the folded value of a literal join / conditional.
    if (ts.isCallExpression(node) || ts.isConditionalExpression(node)) {
      const folded = constantText(node);
      if (folded !== null) push(folded);
    }
  };
  visit(sf);
  return fragments;
}

/** Back-compat name used by older call sites. */
export const extractCopy = extractFragments;

/** Findings in a source file's copy streams (see the section comment). */
export function claimHitsInSource(
  source: string,
  fileName: string,
  allow: Set<string>
): ClaimHit[] {
  const fragments = extractFragments(source, fileName);
  const found = new Map<string, { hit: ClaimHit; from: number; to: number }>();
  for (const sep of ['', ' ']) {
    for (let len = 1; len <= MAX_WINDOW; len++) {
      for (let i = 0; i + len <= fragments.length; i++) {
        // A fragment that ends a sentence never glues onto the next one.
        const text = fragments
          .slice(i, i + len)
          .map(f => (/[.!?]\s*$/.test(f) ? `${f} ` : f))
          .join(sep);
        for (const hit of claimHits(text, allow)) {
          const key = `${hit.rule}|${sentenceKey(hit.sentence)}`;
          if (!found.has(key)) found.set(key, { hit, from: i, to: i + len });
        }
      }
    }
  }
  // Keep the smallest windows: drop a finding whose window strictly contains
  // another finding's window.
  const all = [...found.values()];
  return all
    .filter(
      a =>
        !all.some(
          b =>
            b !== a &&
            b.from >= a.from &&
            b.to <= a.to &&
            b.to - b.from < a.to - a.from
        )
    )
    .map(x => x.hit);
}

export function findClaimsInSource(
  source: string,
  fileName: string,
  allow: Set<string> = new Set()
): string[] {
  return claimHitsInSource(source, fileName, allow).map(
    h => `${h.rule} — "${h.sentence}"`
  );
}

// Rendered markup → sentences: block-level tags end a sentence, inline tags
// (<strong>, <span>…) do not.
const BLOCK_TAG =
  /<\/?(?:p|div|li|ul|ol|h[1-6]|section|article|header|footer|nav|main|aside|td|th|tr|table|br|hr|button|label|option|select|figcaption|blockquote|dd|dt|form|input|textarea|text|tspan|svg|g)\b[^>]*>/gi;

export function renderedSentencesText(markup: string): string {
  const attributes = [
    ...markup.matchAll(
      /\s(?:alt|title|aria-label|placeholder|content|value)="([^"]*)"/g
    ),
  ].map(m => m[1]);
  // JSON-LD: crawlers read each string value, so each becomes its own line.
  const jsonStrings = (json: string) => {
    try {
      const out: string[] = [];
      const walk = (v: unknown): void => {
        if (typeof v === 'string') out.push(v);
        else if (Array.isArray(v)) v.forEach(walk);
        else if (v && typeof v === 'object') Object.values(v).forEach(walk);
      };
      walk(JSON.parse(json));
      return `\n${out.join('\n')}\n`;
    } catch {
      return `\n${json}\n`;
    }
  };
  const text = markup
    .replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, (_m, body: string) =>
      jsonStrings(body)
    )
    .replace(BLOCK_TAG, '\n')
    .replace(/<[^>]+>/g, '');
  return `${text}\n${attributes.join('\n')}`;
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
