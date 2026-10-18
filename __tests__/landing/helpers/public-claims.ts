/**
 * Shared pieces of the public-claims guard (SYN-1226).
 *
 * - publicPageFiles() / publicSourceInventory(): what counts as public. Every
 *   source file under app/ whose route is not an API route and not behind
 *   proxy.ts PROTECTED_PREFIXES, plus everything those files import,
 *   followed transitively, plus public/llms.txt.
 * - normaliseCopy(): text is judged the way a reader would see it, so trivial
 *   rewording cannot slip a claim past the patterns.
 * - TRIPWIRE_PATTERNS: patterns matched against normalised text.
 * - REMOVED_CLAIM_SEEDS: every claim this branch removed, numeric and spelled
 *   out, so the patterns are proven against the real wording.
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { createRequire } from 'module';
import path from 'path';
import ts from 'typescript';

// Under Jest (CommonJS) from this file; under `npm run copy:audit` (ESM, run
// from the package root) from the working directory.
// CLAIMS_ROOT lets the seed generator serve a Git snapshot as the tree.
export const ROOT =
  process.env.CLAIMS_ROOT ??
  (typeof __dirname === 'string'
    ? path.join(__dirname, '../../..')
    : process.cwd());
const requireFromRoot = createRequire(path.join(ROOT, 'package.json'));
const APP = path.join(ROOT, 'app');
const SOURCE_EXT = ['.ts', '.tsx', '.js', '.jsx', '.mjs'];

// Forward slashes on every platform: the suites compare against '/' paths.
export const rel = (file: string) =>
  path.relative(ROOT, file).split(path.sep).join('/');

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
  copy: '©',
  reg: '®',
  trade: '™',
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
    // A lone "one" is a determiner or pronoun ("no one", "one place"), not
    // a count; inside a compound ("one thousand", "twenty-one") it converts.
    if (match === 'one') return match;
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

export const TRIPWIRE_PATTERNS: Array<[string, RegExp]> = [
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

TRIPWIRE_PATTERNS.push(
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

// High-precision patterns: each names a claim class this branch removed and
// matches nothing in the current public copy (proven by the three suites).
TRIPWIRE_PATTERNS.push(
  ['SOC 2 claim', /\bsoc ?2\b/],
  ['ISO 27001 claim', /\biso ?27001\b/],
  [
    'privacy-law compliance claim',
    /\b(?:gdpr|ccpa|hipaa)(?: (?:&|and) privacy)?[\s-](?:compliant|certified|ready)\b|\b(?:compliant|compliance) with (?:the )?(?:gdpr|ccpa|hipaa)\b|\bfull compliance with\b/,
  ],
  [
    'Synthex certification claim',
    /\b(?:synthex|we|we're|we are|our platform)\b[^.]{0,30}\b(?:certified|accredited)\b/,
  ],
  ['uptime guarantee', /\b\d{2}(?:\.\d+)?\s?% (?:uptime|availability)\b/],
  [
    'trusted-by count',
    /\b(?:trusted|used|loved) by (?:over |more than )?\d[\d,]*\+?\s/,
  ]
);

// ── Advisory audit: numbers, credentials, competitors ────────────────────────
//
// Not blocking (npm run copy:audit). Every quantity, every certification /
// compliance / endorsement / superlative term and every competitor name in
// public copy is listed for human content review. A mechanical kind
// (copy-audit-kinds.ts) annotates the structural ones — dates, steps, prices
// equal to the pricing source — but never blesses a sentence: no rule can
// establish that natural-language copy is true.

export const QUANTITY =
  /(?:\b(?:doubl(?:e[ds]?|ing)|tripl(?:e[ds]?|ing)|quadrupl(?:e[ds]?|ing)|twice|halved)\b(?![-\s]tap)(?!-)|\$\s?\d[\d.,]*(?:[kmb](?![a-z]))?|\b\d[\d.,]*(?:[kmb](?![a-z]))?\+?(?:\s?(?:%|percent\b|x\b|×|times\b|fold\b))?|\b(?:millions?|billions?|thousands?|hundreds?|dozens?)\b)/;
const QUANTITY_ALL = new RegExp(QUANTITY.source, 'g');

export interface QuantityToken {
  text: string;
  index: number;
}

export function quantityTokens(normalised: string): QuantityToken[] {
  return (
    [...normalised.matchAll(QUANTITY_ALL)]
      // "two-factor" / "2fa" name a security method, not a quantity.
      .filter(
        m =>
          !/^[\s-]?(?:factor|fa\b)/.test(
            normalised.slice((m.index ?? 0) + m[0].length)
          )
      )
      .map(m => ({ text: m[0].trim(), index: m.index ?? 0 }))
  );
}

export const CREDENTIAL =
  /\b(?:certifi(?:ed|cation|cations|cate|cates)|compliant|compliance|accredit\w*|iso\s?\d*|soc\s?[12]?|gdpr|ccpa|hipaa|pci(?:[\s-]dss)?|award(?:s|ed|-winning)?|trusted by|used by|loved by|chosen by|relied (?:on|upon) by|preferred by|backed by|endorsed|endorsement|audited|independently (?:verified|tested|reviewed)|externally (?:reviewed|tested|audited|assessed|verified)|(?:reviewed|tested|assessed|vetted|validated|inspected|approved) by (?:an? |the )?(?:independent|external|third[\s-]party|certified|accredited|security|leading|government)|pen(?:etration)?[\s-]tested|third[\s-]party (?:verified|tested|reviewed)|verified by|verified|leading|leader in|market leader|#1|number one|no\.\s?1|best|fastest|easiest|cheapest|most (?:trusted|popular|advanced|powerful|accurate|chosen|used|loved|reliable|secure|complete)|world'?s|australia'?s|guarantee[ds]?|guaranteed|proven|industry[\s-]standard|enterprise[\s-]grade|bank[\s-]grade|military[\s-]grade|world[\s-]class|best[\s-]in[\s-]class|top[\s-]rated|state[\s-]of[\s-]the[\s-]art|unmatched|unrivalled|unrivaled)\b|#1(?![\da-f])/;

export const FIRST_PARTY =
  /\b(?:we|we're|we've|our|ours|us|synthex|restoreassist)\b/;

export interface ClaimHit {
  /** Normalised sentence that triggered the finding. */
  sentence: string;
  /** 'seed', a tripwire pattern label, or an advisory class. */
  rule: string;
  /** Source line of the copy, where known. */
  line?: number;
}

export const sentenceKey = (normalised: string) =>
  normalised.replace(/\s+/g, '');

export function splitSentences(normalised: string): string[] {
  return normalised
    .split(/(?<=[.!?])\s+|\n+/)
    .map(sentence => sentence.trim())
    .filter(Boolean);
}

/**
 * Competitors by name. Any sentence naming one is a COMPETITOR finding: a
 * judgement about another company needs evidence, and only neutral
 * comparison wording ("Synthex vs Hootsuite") passes without it.
 */
export const COMPETITOR =
  /\b(?:hootsuite|owlywriter|sprout social|sprinklr|agorapulse|loomly|metricool|socialbee|planoly|sendible|socialpilot|meltwater|brandwatch)\b/;

/** Advisory findings in plain text, sentence by sentence. */
export function claimHits(raw: string): ClaimHit[] {
  const hits: ClaimHit[] = [];
  const sentences = raw
    .replace(/https?:\/\/[^\s"'<>)]+/g, ' ') // URLs are addresses, not prose
    .split(/\n+/)
    .flatMap(line => splitSentences(normaliseCopy(line)));
  for (const sentence of sentences) {
    for (const [label, pattern] of TRIPWIRE_PATTERNS) {
      if (pattern.test(sentence)) hits.push({ sentence, rule: label });
    }
    if (quantityTokens(sentence).length > 0) {
      hits.push({ sentence, rule: 'number' });
    }
    if (CREDENTIAL.test(sentence)) hits.push({ sentence, rule: 'credential' });
    if (COMPETITOR.test(sentence)) hits.push({ sentence, rule: 'competitor' });
  }
  return hits;
}

export function findClaims(raw: string): string[] {
  return claimHits(raw).map(h => `${h.rule} — "${h.sentence}"`);
}

// ── Mechanical kind checks ──────────────────────────────────────────────────

const MONTH =
  '(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';
const before = (s: string, t: QuantityToken, n = 14) =>
  s.slice(Math.max(0, t.index - n), t.index);
const after = (s: string, t: QuantityToken, n = 14) =>
  s.slice(t.index + t.text.length, t.index + t.text.length + n);
const digitsOf = (t: QuantityToken) => t.text.replace(/[^\d.]/g, '');

export function isDateTime(raw: string, t: QuantityToken): boolean {
  // "#" is a digit run the dynamic suites masked as data: "10/#/2026".
  const s = raw.replace(/#/g, '1');
  const b = before(s, t);
  const a = after(s, t);
  const q = t.text.replace(/\.$/, '');
  // Calendar date or time shapes around the token.
  const window = s.slice(
    Math.max(0, t.index - 12),
    t.index + t.text.length + 12
  );
  if (
    /\d{1,2}\/\d{1,2}\/\d{2,4}|\d{4}-\d{2}-\d{2}(?:t\d{2}:\d{2})?/.test(window)
  )
    return true;
  if (/^\d{1,2}$/.test(q) && (/^:\d{2}/.test(a) || /\d{1,2}:$/.test(b)))
    return true;
  // An ISO timestamp, whole: "2026-10-14t00:00:00.000z".
  for (const m of s.matchAll(
    /\d{4}-\d{2}-\d{2}t\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?z?/g
  )) {
    if (t.index >= (m.index ?? 0) && t.index < (m.index ?? 0) + m[0].length)
      return true;
  }
  if (
    /^\d+$/.test(q) &&
    /^(?:d|w|h|mo|m|y)$/.test(a.trim()) &&
    s.trim() === `${q}${a.trim()}`
  )
    return true; // "30d" range label
  if (/^\d{1,2}(?::\d{2})?$/.test(q) && /^\s?(?:am|pm)\b/.test(a)) return true;
  if (new RegExp(`(?:${MONTH})\\.?\\s$`).test(b)) return true;
  if (/^\d{1,2}$/.test(q) && new RegExp(`^\\s(?:${MONTH})\\b`).test(a))
    return true;
  if (
    /^\d{1,2}\/\d{2}$/.test(q) ||
    (/^\d{2}$/.test(q) && /(?:^|[^\d/])\d{1,2}\/$/.test(b)) ||
    (/^\d{1,2}$/.test(q) && /^\/\d{2}\b/.test(a))
  )
    return true; // mm/yy, never a score "/100"
  if (/^(?:19|20)\d\d$/.test(q)) {
    // A year used as a date: "in 2024", "the 2024 inquiry", "2010–2024".
    if (
      /(?:\bin|\bsince|\bof|\bthe|©|\bfrom|\buntil|\bby|\bbefore|\bafter|updated|\bfy|q[1-4]|\b(?:inquiry|report|census|act|edition)|–|-)\s?$/.test(
        b
      )
    )
      return true;
    if (/^\s?(?:[–-]|[)(·])/.test(a)) return true;
    if (/·\s?$/.test(b) && a.trim() === '') return true; // footer "Synthex · 2026"
    if (/,\s?$/.test(b) && /^\s?(?:[.·(]|$)/.test(a)) return true; // "(Cartwright inquiry), 2020"
  }
  // A duration used as a time frame — "last 7 days", "up to 90 days",
  // "within 90 days", "the previous 12 months", "rolling 90-day window", a
  // bare "7 day" option — never next to a saving or speed-up.
  if (
    /^\d+$/.test(q) &&
    /^[\s-]?(?:(?:business|working|calendar)\s)?(?:seconds?|minutes?|mins?|hours?|hrs?|days?|weeks?|months?|years?)\b/.test(
      a
    ) &&
    (/(?:previous|prior|last|next|within|up to|for|every|rolling|after|past|over|across)\s$/.test(
      b
    ) ||
      s.trim() === `${q} ${a.trim()}`.trim() ||
      /^\d+[\s-]?(?:day|week|month)s?$/.test(s.trim())) &&
    !/\b(?:sav(?:e|ed|es|ing)|faster|quicker|cut|reduc\w*|shorter|less)\b/.test(
      s
    )
  ) {
    return true;
  }
  // Second half of a year range ("2010–11", "2019–20").
  if (/^\d{2}$/.test(q) && /(?:19|20)\d\d\s?[–-]\s?$/.test(b)) return true;
  return false;
}

export function isOrdinalStepVersion(s: string, t: QuantityToken): boolean {
  const b = before(s, t, 18);
  const a = after(s, t);
  const q = t.text.replace(/\.$/, '');
  if (/^0\d$/.test(q)) return true; // 01, 02 … step labels
  if (/^\d+$/.test(q) && new RegExp(`^${q}\\.?$`).test(s.trim())) return true; // "4." section
  if (
    /^\d{1,2}$/.test(q) &&
    b.trim() === '' &&
    (/^\.\s?[a-z]/.test(a) || (t.text.endsWith('.') && /^\s?[a-z]/.test(a)))
  )
    return true; // "1. Connect…" list item
  if (/\bq$/.test(b)) return true; // Q1 … Q4
  // Scale denominators ("/100", "out of 5 stars") and HTTP status codes.
  if (/(?:\/\s?|out of\s)$/.test(b)) return true;
  if (
    /^(?:400|401|403|404|429|500|502|503)$/.test(q) &&
    /\b(?:error|page|not found|status|http)\b/.test(s)
  )
    return true;
  if (/^\d+$/.test(q) && /^\s?[:)]/.test(a) && b.trim() === '') return true; // "3:" "2)" opening a sentence
  if (/^\d+$/.test(q) && /^(?:st|nd|rd|th)\b/.test(a)) return true; // 2nd
  if (
    /^\d+(?:\.\d+){1,3}[a-z]?$/.test(q) &&
    /(?:\bv|version|oauth|tls|ssl|http|node|next\.js|react|ios|android|api|wcag|html|es)\s?$/.test(
      b
    )
  )
    return true;
  if (/^\d+\.\d+\.\d+$/.test(q)) return true; // semver
  // The whole token run around the number: v1.1, twitter2.0, nodejs2.0.1.
  const runStart = s.slice(0, t.index).search(/[a-z0-9.]*$/);
  const runEnd =
    t.index +
    t.text.length +
    (s.slice(t.index + t.text.length).match(/^[a-z0-9.]*/)?.[0].length ?? 0);
  const run = s.slice(runStart, runEnd).replace(/\.$/, '');
  if (
    /^v\d+(?:\.\d+)+$/.test(run) ||
    /^[a-z]{2,}\d+(?:\.\d+)+$/.test(run) ||
    /^\d+\.\d+\.\d+$/.test(run)
  )
    return true;
  if (
    /^\d+[a-z]{2,}s?$/.test(run) &&
    !/^\d+(?:mb|kb|gb|tb|ms|px|fps|mo|yrs?|mins?|hrs?|secs?|days?)$/.test(run)
  )
    return true; // 3PA-style abbreviations, not units
  // Part of a file path or file name: positioning/ra-2026-05.md.
  const pathRun =
    s.slice(0, t.index).match(/[\w./-]*$/)?.[0] +
    t.text +
    (s.slice(t.index + t.text.length).match(/^[\w./-]*/)?.[0] ?? '');
  if (/\/[\w.-]+|\.(?:md|ts|tsx|json|txt|pdf)\b/.test(pathRun)) return true;
  if (/(?:as\/nzs|nzs|as)\s?$/.test(b)) return true; // AS/NZS 4849.1
  if (
    /(?:\bstep|\bphase|\bstage|\bpart|\bscene|\bfigure|\bfig\.|\bchapter|\bwave|\btier|\blevel|\blane|\boption|\bsection|§|\bitem|\bpage|\bday|\brule|\bpillar|\bmistake|\btip|\bslide|\bepisode|\bround|\bcat|\bdirection|#|\bt\+|\bt-|[a-z]{2,}-)\s?$/.test(
      b
    )
  )
    return true;
  return false;
}

export function isContactLegal(s: string, t: QuantityToken): boolean {
  const window = s.slice(
    Math.max(0, t.index - 18),
    t.index + t.text.length + 18
  );
  // An input mask for a phone number ("+61 4xx xxx xxx").
  if (/\+\d{2}\s?\d?x{2}/.test(window)) return true;
  if (
    /\+?\d[\d ()-]{7,}\d/.test(window) &&
    /\d[\d ()-]{7,}\d/.test(s.slice(Math.max(0, t.index - 18), t.index + 22))
  ) {
    return (
      /\+\d|\(0\d\)|\b0\d[\d ]{7,}|\b1[38]00\b/.test(window) ||
      /\babn\b/.test(window)
    );
  }
  if (
    /\b(?:nsw|vic|qld|wa|sa|tas|act|nt)\s?$/.test(before(s, t, 6)) &&
    /^\d{4}$/.test(t.text)
  )
    return true;
  if (
    /^\d{1,5}$/.test(t.text) &&
    /^\s(?:[a-z]+\s){1,2}(?:street|st|road|rd|avenue|ave|lane|ln|drive|dr|place|pl|parade|pde|highway|hwy|way|crescent|cres|court|ct)\b/.test(
      after(s, t, 30)
    )
  )
    return true;
  return false;
}

export const isHypotheticalExample = (s: string) =>
  /\b(?:for example|e\.g\.|imagine|if you)\b/.test(s);

const PRICE_SOURCE_FILES = [
  'lib/stripe/config.ts',
  'app/(landing)/restoreassist/pricing/plan-data.ts',
  'app/add-ons/mcp-app-development/page.tsx',
];
const LIMIT_SOURCE_FILES = [
  'lib/stripe/config.ts',
  'app/api/stripe/checkout/route.ts', // trial_period_days
  'lib/stripe/subscription-service.ts',
  'app/(landing)/restoreassist/pricing/plan-data.ts',
];
const toNumbers = (list: string[]) =>
  new Set(list.map(v => String(Number(v.replace(/,/g, '')))));

/** Amounts declared in the pricing sources of truth. */
export function priceValues(): Set<string> {
  const values: string[] = [];
  for (const file of PRICE_SOURCE_FILES) {
    const src = readFileSync(path.join(ROOT, file), 'utf8');
    for (const m of src.matchAll(
      /\b(?:price|priceAud|PRICE_AUD|amount)\s*[:=]\s*(\d[\d,]*)/gi
    ))
      values.push(m[1]);
    // The add-on page's tier table states its quotes as strings.
    for (const m of src.matchAll(/indicative:\s*['"`]([^'"`]+)['"`]/g)) {
      for (const n of m[1].matchAll(/\d[\d,]*/g)) values.push(n[0]);
    }
  }
  // A pack's per-unit rate is its price over its size: "$1.67 per report".
  for (const file of PRICE_SOURCE_FILES) {
    const src = readFileSync(path.join(ROOT, file), 'utf8');
    for (const m of src.matchAll(/\breports:\s*(\d+),\s*priceAud:\s*(\d+)/g)) {
      values.push((Number(m[2]) / Number(m[1])).toFixed(2));
    }
  }
  // A source that declares a trial declares a free price: "$0".
  if (
    PRICE_SOURCE_FILES.some(f =>
      /TRIAL_DAYS|trial_period_days/.test(
        readFileSync(path.join(ROOT, f), 'utf8')
      )
    )
  ) {
    values.push('0');
  }
  return toNumbers(values);
}

/** Limits declared in plan configuration, each with the words of its key. */
const GENERIC_KEY_WORDS = new Set([
  'max',
  'min',
  'limit',
  'per',
  'included',
  'first',
  'total',
  'count',
  'size',
  'value',
  'period',
  'bonus',
]);
const keyWords = (key: string) =>
  key
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .split(/[\s_]+/)
    .map(w => w.replace(/s$/, ''))
    .filter(w => w && !GENERIC_KEY_WORDS.has(w));

export function limitValues(): Map<string, Set<string>> {
  const values = new Map<string, Set<string>>();
  for (const file of LIMIT_SOURCE_FILES) {
    const src = readFileSync(path.join(ROOT, file), 'utf8');
    for (const m of src.matchAll(
      /\b((?:max\w*|\w*Accounts|aiPosts|personas|aiVoiceSamples|reports|\w*_PER_\w+|\w*_DAYS|\w*_CREDITS|\w*_REPORTS|limit\w*|trial_period_days))\s*[:=]\s*(\d[\d,]*)/g
    )) {
      const v = String(Number(m[2].replace(/,/g, '')));
      const words = values.get(v) ?? new Set<string>();
      keyWords(m[1]).forEach(w => words.add(w));
      values.set(v, words);
    }
  }
  return values;
}

/** The plan limit matches when a word of its key is next to the number. */
export function limitMatches(
  sentence: string,
  token: QuantityToken,
  limits: Map<string, Set<string>>,
  before = 3
): boolean {
  const v = String(Number(token.text.replace(/[^\d.]/g, '')));
  const words = limits.get(v);
  if (!words) return false;
  const near = [
    ...sentence
      .slice(token.index + token.text.length)
      .split(/[\s-]+/)
      .slice(0, 4),
    ...sentence
      .slice(0, token.index)
      .split(/[\s-]+/)
      .slice(-before),
  ].map(w => w.replace(/[^a-z]/g, '').replace(/s$/, ''));
  return near.some(w => words.has(w));
}

/** A validation bound matches when its unit or name is next to the number. */
export function boundMatches(
  sentence: string,
  token: QuantityToken,
  bounds: Map<string, Set<string>>
): boolean {
  // A counter against an enforced bound: "0 / 2000".
  const end = token.index + token.text.length;
  const denominator = sentence.slice(end).match(/^\s?\/\s?(\d+)\b/)?.[1];
  if (denominator && bounds.has(String(Number(denominator)))) return true;
  if (
    /\d\s?\/\s?$/.test(sentence.slice(0, token.index)) &&
    bounds.has(String(Number(token.text)))
  )
    return true;
  return limitMatches(sentence, token, bounds, 5);
}

/**
 * Product constants that public copy may state, each bound to the subject it
 * counts. The value is read from the module the product itself uses, so copy
 * and behaviour cannot drift apart.
 */
export const PRODUCT_CONSTANTS: Array<{
  module: string;
  name: string;
  subject: RegExp;
}> = [
  {
    module: 'lib/opportunity-map/index.ts',
    name: 'OPPORTUNITY_DIRECTION_COUNT',
    subject: /\b(?:ranked (?:growth )?directions?|growth directions?)\b/,
  },
  {
    module: 'lib/analytics/public-benchmarks.ts',
    name: 'MIN_SAMPLE_SIZE',
    subject: /\b(?:accounts?|cohort)\b/,
  },
];

/**
 * Self-counts in a file that cannot be edited on this branch (pricing): the
 * number must equal the length of the named array literal in that file, and
 * the sentence must name its subject.
 */
export const SELF_COUNTS: Array<{
  file: string;
  array: string;
  subject: RegExp;
}> = [
  { file: 'app/pricing/page.tsx', array: 'pilotSteps', subject: /\bphases?\b/ },
  {
    file: 'app/(landing)/restoreassist/insurers/page.tsx',
    array: 'flowSteps',
    subject: /\bsteps?\b/,
  },
];

function arrayLength(file: string, name: string): number | null {
  const src = readFileSync(path.join(ROOT, file), 'utf8');
  const sf = ts.createSourceFile(
    file,
    src,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );
  let length: number | null = null;
  const visit = (n: ts.Node) => {
    if (
      ts.isVariableDeclaration(n) &&
      n.name.getText(sf) === name &&
      n.initializer &&
      ts.isArrayLiteralExpression(n.initializer)
    ) {
      length = n.initializer.elements.length;
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return length;
}

export function selfCountMatches(
  file: string,
  sentence: string,
  value: string
): boolean {
  return SELF_COUNTS.some(
    c =>
      c.file === file &&
      c.subject.test(sentence) &&
      String(arrayLength(c.file, c.array)) === value
  );
}

/** Value of a registered product constant whose subject the sentence names. */
export function productConstantMatches(
  sentence: string,
  value: string
): boolean {
  return PRODUCT_CONSTANTS.some(c => {
    const v = (
      requireFromRoot(path.join(ROOT, c.module)) as Record<string, unknown>
    )[c.name];
    return String(v) === value && c.subject.test(sentence);
  });
}

const UNIT_WORDS = [
  'character',
  'char',
  'mb',
  'kb',
  'gb',
  'byte',
  'digit',
  'word',
  'letter',
  'item',
  'file',
  'photo',
  'image',
];

/**
 * Validation bounds a file enforces — zod .min()/.max()/.length(), maxLength,
 * N * 1024 * 1024 sizes, .length comparisons, MAX_* constants — plus those of
 * the same-origin API routes it submits to, where an upload or field limit
 * is actually enforced. Each value carries the words that may name it: a
 * unit for generic bounds, the constant's own words for MAX_PHOTOS etc.
 */
export function validationBounds(file: string): Map<string, Set<string>> {
  const bounds = new Map<string, Set<string>>();
  if (!file || !existsSync(path.join(ROOT, file))) return bounds;
  const own = readFileSync(path.join(ROOT, file), 'utf8');
  const routeSources = referencedApiRoutes(own, apiRoutes()).map(r =>
    readFileSync(r, 'utf8')
  );
  const src = [own, ...routeSources].join('\n');
  const add = (v: string, words: string[]) => {
    const key = String(Number(v));
    const set = bounds.get(key) ?? new Set<string>();
    words.forEach(w => set.add(w));
    bounds.set(key, set);
  };
  for (const m of src.matchAll(
    /\.(?:min|max|length)\(\s*(\d+)|maxLength=\{?\s*(\d+)|(\d+)\s*\*\s*1024\s*\*\s*1024|\.length\s*[<>]=?\s*(\d+)/g
  )) {
    add(m[1] ?? m[2] ?? m[3] ?? m[4], UNIT_WORDS);
  }
  for (const m of src.matchAll(/\b(MAX_\w+|MIN_\w+)\s*=\s*(\d+)\b/g))
    add(m[2], keyWords(m[1]));
  return bounds;
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
  'Join 5,000+ Australian businesses using Synthex.',
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

// Copy that is no claim: the tripwire never flags it.
export const NOT_CLAIMS: string[] = [
  'Reply to every comment quickly — it boosts your ranking.',
  'One dashboard for all your platforms.',
  'Removing double-handling and eliminating re-inspections.',
  'Instagram, Facebook and LinkedIn in one place.',
  'Turn on two-factor authentication in settings.',
];

// Round-5 review mutants and the claims removed from /security and support:
// permanent positive controls.
export const ROUND_5_SEEDS: Array<
  [string, 'number' | 'credential' | 'competitor']
> = [
  ['The campaign delivered 8,200 qualified prospects.', 'number'],
  ['Synthex delivered 8,200 qualified leads.', 'number'],
  ['The campaign harvested 9,000 qualified leads.', 'number'],
  ['Cafés using Synthex netted 4,300 new regulars.', 'number'],
  ['ISO 27001 certified.', 'credential'],
  ['Synthex is independently audited for security.', 'credential'],
  ['Trusted by leading Australian brands.', 'credential'],
  ['SOC 2 Type II Certified', 'credential'],
  ['99.99% Uptime SLA', 'number'],
  [
    'Full compliance with GDPR, CCPA, and international data protection regulations.',
    'credential',
  ],
  ['GDPR Compliant', 'credential'],
  ['CCPA Compliant', 'credential'],
  ['ISO 27001 In Progress', 'credential'],
  ["We're SOC 2 compliant.", 'credential'],
  ['Enterprise-grade infrastructure baked into every plan.', 'credential'],
  [
    'Built on industry-leading platforms with multiple layers of security and redundancy.',
    'credential',
  ],
  ['The most advanced AI-powered social media platform', 'credential'],
  ["Australia's best restoration training.", 'credential'],
  // Removed Hootsuite judgements: no number or credential term in them.
  ['Hootsuite just schedules what you write manually.', 'competitor'],
  ['Limited AI — OwlyWriter generates basic captions only', 'competitor'],
  ['Is Synthex cheaper than Hootsuite?', 'competitor'],
  // A credential with no term the earlier rounds listed.
  ['Reviewed by an external security firm.', 'credential'],
  ['Penetration-tested every quarter.', 'credential'],
];

// Reviewer mutants and siblings from rounds 1–5 that are not already seeds.
export const REVIEWER_MUTANTS: string[] = [
  'The account racked up 9,000 new followers.',
  'Revenue climbed 37% after switching to Synthex.',
  'Synthex grew leads by 340%.',
  'Clients saw 340% more bookings.',
  'Synthex runs on independently audited security.',
  'Independently audited security',
  'Customers recovered 640 abandoned carts last quarter.',
  'Most businesses see 3x more reach in their first month.',
  'Unlike Sprout Social, Synthex writes the posts for you.',
  'Similar bakeries saw enquiries rise 42% with Synthex.',
];

// Claims removed or neutralised in round 5 and after the guard decision.
export const ROUND_5_REMOVED: string[] = [
  'GDPR & Privacy Compliant',
  'Multi-factor authentication (MFA) available',
  'IP-based anomaly detection',
  'Industry-leading security',
  "For most SMBs, yes. Synthex handles everything Hootsuite does (scheduling, multi-platform publishing) plus everything Hootsuite doesn't (AI content creation, brand voice, content scoring).",
  'Hootsuite is a scheduling tool — it publishes content you create manually.',
  'Hootsuite schedules what you write manually.',
  'No brand voice feature — copy/paste your own content',
  'Verified authority profile for',
  'The platform competes most directly with Hootsuite, Buffer, Later, and SocialPilot',
  'One thousand engaged followers will always beat one hundred thousand passive ones.',
  '1,000 Engaged Followers Beat 100,000 Passive Ones',
  'Most businesses operate with three to five pillars.',
  'then schedules everything automatically',
  'Planning a month of content used to take days. With Synthex, it takes minutes.',
  'Facebook posts with 250-500 characters tend to get better organic reach',
  'LinkedIn posts without paragraph breaks have lower reach',
  'Add 1-2 relevant emojis to increase visual appeal and reach',
  'Short content may have lower reach',
  'Creating content with Synthex takes seconds, not hours.',
  'Connecting Instagram to Synthex takes under a minute.',
  'The full workflow from concept to published campaign takes minutes, not days.',
  'Synthex can generate a month of on-brand content in minutes',
  'AI can generate weeks of posts in minutes.',
  'Your engagement has increased by 0% this week',
  'The observed on-page search foundation scored 0/100.',
];

/** Plain text of a seed: markup and JSX spacers dropped. */
export const seedPlainText = (seed: string) =>
  decodeEntities(seed)
    .replace(/https?:\/\/[^\s"'<>)]+/g, ' ') // matching ignores URLs too
    .replace(/\{\s*(['"`])\s*\1\s*\}/g, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/[{}]/g, ' ');
/** Normalised, whitespace-free key of a segment or seed (as the stream is). */
export const seedKeyOf = (seed: string) =>
  sentenceKey(
    normaliseCopy(seed.replace(/https?:\/\/[^\s"'<>)]+/g, ' '))
  ).replace(/[.!?:]+$/, '');

/** Normalised copy stream of a file or text: what long seeds are found in. */
export const streamKeyOf = (texts: string[]) =>
  sentenceKey(
    normaliseCopy(
      texts
        .join('\n')
        .replace(/https?:\/\/[^\s"'<>)]+/g, ' ')
        .replace(/\n+/g, ' ')
    )
  );

/** Seeds under this many words match only as an exact whole segment. */
export const SHORT_SEED_WORDS = 4;
export const seedWords = (seed: string) =>
  normaliseCopy(seed.replace(/https?:\/\/[^\s"'<>)]+/g, ' '))
    .split(/\s+/)
    .filter(Boolean).length;

/**
 * Segments of a copy stream — shared by the seed generator and the matcher,
 * so "absent at head" and "present now" mean the same thing: each sentence
 * of each fragment, plus each adjacent pair where one side is a short stat
 * value (≤ 4 words with a digit or an acronym: "99.99%" + "Uptime SLA",
 * "GDPR" + "Compliant").
 */
export function segmentTexts(fragments: string[]): string[] {
  const words = (t: string) => t.trim().split(/\s+/).filter(Boolean).length;
  const statValue = (t: string) => words(t) <= 4 && /\d|\b[A-Z]{2,}\b/.test(t);
  const pairs = fragments
    .slice(1)
    .flatMap((next, i) =>
      statValue(fragments[i]) || statValue(next)
        ? [`${fragments[i]} ${next}`]
        : []
    );
  return [...fragments, ...pairs].flatMap(f =>
    f
      .split(/(?<=[.!?])\s+|\n+/)
      .map(t => t.replace(/\s+/g, ' ').trim())
      .filter(Boolean)
  );
}

/** Hand-drafted seeds: removed claims, reviewer mutants and siblings. */
export const DRAFTED_SEEDS: string[] = [
  ...new Set([
    ...REMOVED_CLAIM_SEEDS,
    ...ROUND_5_SEEDS.map(([seed]) => seed),
    ...REVIEWER_MUTANTS,
    ...ROUND_5_REMOVED,
  ]),
];

/**
 * A committed seed. It carries no key: the guard matches on
 * seedKeyOf(text), and the completeness test derives keys the same way, so
 * an edited text can never keep an old key alive.
 */
export interface GeneratedSeed {
  text: string;
  file: string;
  firstSeen: string;
}
export const GENERATED_SEEDS_FILE =
  '__tests__/landing/helpers/tripwire-seeds.generated.json';

/**
 * Seeds generated from Git history by scripts/claims-seeds.ts: every
 * claim-bearing public-copy segment removed or rewritten since 83243588.
 * (Empty while the generator itself serves a virtual snapshot.)
 */
export const GENERATED_SEEDS: GeneratedSeed[] = (() => {
  try {
    return JSON.parse(
      readFileSync(path.join(ROOT, GENERATED_SEEDS_FILE), 'utf8')
    ).seeds;
  } catch {
    return [];
  }
})();

/**
 * Seeds retired on purpose (text + reason), e.g. copy a governance decision
 * restored. Not matched by the tripwire; the completeness and append-only
 * checks count them as accounted for. Retiring is a visible, reviewed edit.
 */
export interface RetiredSeed {
  text: string;
  reason: string;
}

/**
 * The exact-seed half of the blocking tripwire: the generated set, plus the
 * drafted seeds it does not contain (mutants, and copy outside its scope).
 */
export const TRIPWIRE_SEEDS: string[] = [
  ...new Set([
    ...GENERATED_SEEDS.map(s => s.text),
    // Drafted seeds may be written as markup; they are matched as plain text.
    ...DRAFTED_SEEDS.map(seed =>
      seedPlainText(seed).replace(/\s+/g, ' ').trim()
    ),
  ]),
];
/**
 * Seeds retired with a reason. They stay in the tripwire: a retired text that
 * is live anywhere is a finding, except inside GOVERNED_UNCHANGED_PATHS.
 */
export const RETIRED_SEEDS: RetiredSeed[] = (() => {
  try {
    return (
      JSON.parse(readFileSync(path.join(ROOT, GENERATED_SEEDS_FILE), 'utf8'))
        .retired ?? []
    );
  } catch {
    return [];
  }
})();

/**
 * The only paths where a retired seed's text may stay live: files this branch
 * must leave byte-identical to base 83243588 (pricing pages are governed
 * separately, docs/governance/CLAUDE.md:20). public-claims-seeds.test.ts
 * fails if any of them differs from base, so the exception holds only while
 * they are unchanged.
 */
export const GOVERNED_UNCHANGED_PATHS = [
  'app/(landing)/restoreassist/pricing/page.tsx',
  'app/(landing)/restoreassist/pricing/plan-data.ts',
  'app/(landing)/restoreassist/pricing/report-volume-picker.tsx',
];
export const isGovernedUnchanged = (file: string) =>
  GOVERNED_UNCHANGED_PATHS.includes(
    path.isAbsolute(file) ? rel(file) : file.split(path.sep).join('/')
  );

// Short seeds (under SHORT_SEED_WORDS words) match only an exact whole
// segment; longer ones match anywhere in the stream, found through an index
// of their first 8 characters so a stream is scanned once.
const PREFIX = 8;
function seedMatcher(seeds: string[]) {
  const entries = seeds.map(seed => ({
    seed,
    key: seedKeyOf(seed),
    short: seedWords(seed) < SHORT_SEED_WORDS,
  }));
  const short = new Map(
    entries.filter(s => s.short && s.key).map(s => [s.key, s.seed])
  );
  const index = new Map<string, typeof entries>();
  for (const entry of entries) {
    if (entry.short || entry.key.length < PREFIX) continue;
    const head = entry.key.slice(0, PREFIX);
    index.set(head, [...(index.get(head) ?? []), entry]);
  }
  // Long seeds whose key is under 8 characters (checked one by one).
  const unindexed = entries.filter(
    s => !s.short && s.key && s.key.length < PREFIX
  );
  const match = (stream: string, segments: string[]): string[] => {
    const found = new Set<string>();
    for (let i = 0; i + PREFIX <= stream.length; i++) {
      const bucket = index.get(stream.slice(i, i + PREFIX));
      for (const { seed, key } of bucket ?? []) {
        if (stream.startsWith(key, i)) found.add(seed);
      }
    }
    for (const { seed, key } of unindexed) {
      if (stream.includes(key)) found.add(seed);
    }
    for (const segment of segments) {
      const seed = short.get(seedKeyOf(segment));
      if (seed !== undefined) found.add(seed);
    }
    return [...found];
  };
  return { entries, match };
}

const ACTIVE = seedMatcher(TRIPWIRE_SEEDS);
const RETIRED = seedMatcher(RETIRED_SEEDS.map(r => r.text));

/** Seeds whose plain text is empty (markup only): they could never match. */
export const EMPTY_SEEDS = ACTIVE.entries.filter(s => !s.key).map(s => s.seed);

/**
 * Blocking tripwire over plain text, one line per segment source (a rendered
 * block, an API string): a long seed anywhere in the text (whitespace and
 * markup splits ignored), a short seed as a whole segment, or a
 * high-precision pattern in a sentence. Nothing is allow-listed. Retired
 * seeds are matched too ('retired-seed'), unless the text comes from a
 * governed unchanged path.
 */
export function tripwireHits(
  raw: string,
  segments?: string[],
  { governed = false }: { governed?: boolean } = {}
): ClaimHit[] {
  const text = raw.replace(/https?:\/\/[^\s"'<>)]+/g, ' ');
  const hits: ClaimHit[] = [];
  for (const sentence of text
    .split(/\n+/)
    .flatMap(line => splitSentences(normaliseCopy(line)))) {
    for (const [label, pattern] of TRIPWIRE_PATTERNS) {
      if (pattern.test(sentence)) hits.push({ sentence, rule: label });
    }
  }
  const stream = streamKeyOf([text]);
  const segs = segments ?? segmentTexts(text.split(/\n+/));
  for (const seed of ACTIVE.match(stream, segs)) {
    hits.push({ sentence: seed, rule: 'seed' });
  }
  if (!governed) {
    for (const seed of RETIRED.match(stream, segs)) {
      hits.push({ sentence: seed, rule: 'retired-seed' });
    }
  }
  return hits;
}

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

/**
 * A route that opens with this gate answers 404 in production: a local
 * review preview, not a public page (the rendered suite proves the gate).
 */
export const PRODUCTION_GATE =
  /if \(process\.env\.NODE_ENV === 'production'\) notFound\(\);/;

export function publicAppFiles(): string[] {
  const blocked = protectedPrefixes();
  return walk(APP).filter(file => {
    if (!ROUTE_FILES.test(path.basename(file))) return false;
    const route = routeOf(file);
    if (route === '/api' || route.startsWith('/api/')) return false;
    if (PRODUCTION_GATE.test(readFileSync(file, 'utf8'))) return false;
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
// produces it, at the line of the window's first fragment.

const NON_COPY_JSX_ATTRIBUTE =
  /^(?:class(?:Name)?|style|href|src|srcSet|id|key|type|variant|size|name|role|rel|target|method|action|htmlFor|width|height|viewBox|d|fill|stroke|xmlns|loading|sizes|data-[\w-]+|aria-(?!label)[\w-]+|as|icon|route|path|gradientVariant)$/i;
const COPY_ATTRIBUTE =
  /^(?:alt|title|aria-label|placeholder|label|description|copy|content|heading|subheading|subtitle|eyebrow|text|body|caption|summary|message|cta\w*|value|tooltip|hint|note|badge|tagline|headline|name)$/i;
const SILENT_CALLEE = /^(?:logger|console|log)\b/;
const WIRING_CALL =
  /^(?:padStart|padEnd|split|replace|replaceAll|toLocaleString|toLocaleDateString|toLocaleTimeString|startsWith|endsWith|includes|indexOf|lastIndexOf|getItem|setItem|removeItem|querySelector|querySelectorAll|getElementById|addEventListener|removeEventListener|matchMedia|get|set|has|delete|append|match|test|search|toFixed|charAt|localeCompare|format)$/;
const WIRING_KEY =
  /^(?:user-agent|content-type|cache-control|accept|authorization|x-[\w-]+|weight|style|display|subsets?|variable|range|limit|offset|unit|units|format|type|method|mode|cache|revalidate|runtime|preload|fallback|dateRange|period|interval|ttl|port|host|size|sizes|media|colou?r|background|gradient|icon|href|src|path|id|key|slug|value|status|platform|model|provider|role|variant|kind|locale|currency|timezone|\w*version|env|level|severity|code|duration|delay|timeout|max\w*|min\w*|width|height|top|left|right|bottom|x|y|z|cx|cy|r)$/i;
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
  if (/^\d{1,2}[.)]$/.test(text)) return true; // list marker "3." "2)"
  if (text === '0') return true; // zero-padding before a step index: 0{n}
  if (/^(?:19|20)\d\d(?:[–-]\d{2,4})?$/.test(text)) return true; // a bare year label is a date
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
  // CSS values and media queries ("rgba(34, 211, 238, 0.45)", "(max-width: 767px)").
  if (
    /^(?:rgba?|hsla?|calc|var|url|linear-gradient|radial-gradient)\(|^\((?:max|min)-(?:width|height)|\b\d+px\b/.test(
      text
    )
  )
    return true;
  // A list of utility classes ("h-6 w-6", "bg-black/40 backdrop-blur-xl").
  const classLike = tokens.every(
    t => /^[a-z0-9:[\]./%()#_,-]+$/.test(t) && /[-:/[\]]/.test(t)
  );
  if (tokens.length >= 2 && classLike) return true;
  return tokens.length >= 3 && wiring / tokens.length >= 0.6;
}

export interface Fragment {
  text: string;
  /** Rendered through JSX (text, child expression, copy attribute). */
  jsx: boolean;
  /** 1-based source line. */
  line: number;
}

// AI prompt text is sent to a model, never served; what the model returns
// is judged by the API-response scan.
const PROMPT_PROPERTY =
  /^(?:content|prompt|system|systemPrompt|instructions?|userPrompt)$/;
const PROMPT_CONTAINER = /^(?:messages|contents|parts)$/;
const PROMPT_VARIABLE = /prompt|instruction/i;

function isPromptText(node: ts.Node, sf: ts.SourceFile): boolean {
  for (let n: ts.Node | undefined = node.parent; n; n = n.parent) {
    if (ts.isPropertyAssignment(n)) {
      const key = n.name.getText(sf).replace(/['"]/g, '');
      if (key === 'text' || PROMPT_PROPERTY.test(key)) {
        // …inside messages[] / contents[].parts[]…
        for (let m: ts.Node | undefined = n.parent; m; m = m.parent) {
          if (ts.isPropertyAssignment(m)) {
            const k = m.name.getText(sf).replace(/['"]/g, '');
            if (PROMPT_CONTAINER.test(k)) return true;
          }
          if (ts.isSourceFile(m)) break;
        }
        // …or a top-level system / prompt / instructions field.
        if (key !== 'content' && key !== 'text') return true;
      }
    }
    if (ts.isVariableDeclaration(n) && PROMPT_VARIABLE.test(n.name.getText(sf)))
      return true;
    if (
      ts.isFunctionDeclaration(n) &&
      n.name &&
      PROMPT_VARIABLE.test(n.name.text)
    )
      return true;
    if (ts.isSourceFile(n)) break;
  }
  return false;
}

function isInJsx(node: ts.Node): boolean {
  for (let n: ts.Node | undefined = node.parent; n; n = n.parent) {
    if (
      ts.isJsxExpression(n) ||
      ts.isJsxAttribute(n) ||
      ts.isJsxElement(n) ||
      ts.isJsxFragment(n)
    )
      return true;
    if (ts.isSourceFile(n)) break;
  }
  return false;
}

export function extractFragments(source: string, fileName: string): string[] {
  return extractCopyFragments(source, fileName).map(f => f.text);
}

export function extractCopyFragments(
  source: string,
  fileName: string,
  { keepWiring = false }: { keepWiring?: boolean } = {}
): Fragment[] {
  if (!SOURCE_EXT.includes(path.extname(fileName))) {
    // Of non-source files, only text copy (llms.txt) is judged; CSS is not.
    return /\.txt$/.test(fileName)
      ? source
          .split('\n')
          .map((text, i) => ({ text, jsx: true, line: i + 1 }))
          .filter(f => f.text.trim())
      : [];
  }
  const sf = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    true, // parent pointers: prompt, JSX and wiring-key checks walk up
    fileName.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );
  const fragments: Fragment[] = [];
  let current: ts.Node = sf;
  const push = (text: string) => {
    // A leading list marker ("1. Access") is a position, not a quantity.
    const t = text
      .replace(/\s*\n\s*/g, ' ')
      .replace(/^\s*\d{1,2}[.)]\s+(?=[A-Za-z])/, '');
    if (t.trim() && (keepWiring || !isWiring(t))) {
      fragments.push({
        text: t,
        jsx: ts.isJsxText(current) || isInJsx(current),
        line: sf.getLineAndCharacterOfPosition(current.getStart(sf)).line + 1,
      });
    }
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
      const name = node.name.getText(sf);
      if (NON_COPY_JSX_ATTRIBUTE.test(name)) return;
      // Other attributes count when they carry copy: a copy-bearing name, or
      // a value with two or more words. Geometry and settings
      // (offset="75%", strokeWidth="1.5") are not copy.
      const init = node.initializer;
      const literal =
        init && ts.isStringLiteral(init)
          ? init.text
          : init && ts.isJsxExpression(init) && init.expression
            ? constantText(init.expression)
            : null;
      if (
        literal !== null &&
        !COPY_ATTRIBUTE.test(name) &&
        !/[a-z]{2,}\s+[a-z]{2,}/i.test(literal)
      ) {
        return;
      }
    }
    if (
      ts.isCallExpression(node) &&
      SILENT_CALLEE.test(node.expression.getText(sf))
    ) {
      return;
    }
    // throw new Error('…'): production serves a generic error page.
    if (ts.isThrowStatement(node)) return;
    // sql`…` and other tagged templates are code.
    if (ts.isTaggedTemplateExpression(node)) return;
    // case '12m': / status === 'published' — a value being matched, not copy.
    if (ts.isCaseClause(node)) {
      node.statements.forEach(visit);
      return;
    }
    if (
      ts.isBinaryExpression(node) &&
      [
        ts.SyntaxKind.EqualsEqualsEqualsToken,
        ts.SyntaxKind.ExclamationEqualsEqualsToken,
        ts.SyntaxKind.EqualsEqualsToken,
        ts.SyntaxKind.ExclamationEqualsToken,
      ].includes(node.operatorToken.kind)
    ) {
      return;
    }
    // obj['500'] — an element-access key.
    if (ts.isElementAccessExpression(node)) {
      visit(node.expression);
      return;
    }
    // parseInt(x || '0'), Number('…'), z.enum(['7d', '12m']) — code values.
    if (
      ts.isCallExpression(node) &&
      ((ts.isIdentifier(node.expression) &&
        /^(?:parseInt|parseFloat|Number|BigInt)$/.test(node.expression.text)) ||
        (ts.isPropertyAccessExpression(node.expression) &&
          /^(?:enum|literal|nativeEnum)$/.test(node.expression.name.text)))
    ) {
      return;
    }
    // cond ? x : '0' — a numeric fallback value, not copy.
    if (
      (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) &&
      /^[\d.,]+$/.test(node.text) &&
      node.parent &&
      (ts.isConditionalExpression(node.parent) ||
        (ts.isBinaryExpression(node.parent) &&
          [
            ts.SyntaxKind.BarBarToken,
            ts.SyntaxKind.QuestionQuestionToken,
          ].includes(node.parent.operatorToken.kind)))
    ) {
      return;
    }
    // Arguments to string and DOM utilities are wiring, not copy:
    // padStart(2, '0'), split('/'), replace(/x/, '$1'), toLocaleString('en-AU').
    if (
      (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) &&
      node.parent &&
      ts.isCallExpression(node.parent) &&
      node.parent.arguments.includes(node as ts.Expression) &&
      ts.isPropertyAccessExpression(node.parent.expression) &&
      WIRING_CALL.test(node.parent.expression.name.text)
    ) {
      return;
    }
    current = node;
    if (
      (ts.isStringLiteral(node) ||
        ts.isNoSubstitutionTemplateLiteral(node) ||
        ts.isTemplateExpression(node)) &&
      isPromptText(node, sf)
    ) {
      return;
    }
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      // A config value under a wiring key ({ weight: '400' }, { range:
      // '12m' }) is not copy unless it reads as prose.
      // (Kept in the seed stream, where a stat value such as
      // { value: '99.99%', label: 'Uptime SLA' } is part of the claim.)
      const parent = node.parent;
      if (
        !keepWiring &&
        parent &&
        ts.isPropertyAssignment(parent) &&
        parent.initializer === node &&
        WIRING_KEY.test(parent.name.getText(sf).replace(/['"]/g, '')) &&
        !/[a-z]{2,}\s+[a-z]{2,}/i.test(node.text)
      ) {
        return;
      }
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

/** Hits of `scan` in a source file's copy streams (see the section comment). */
function scanSource(
  source: string,
  fileName: string,
  scan: (text: string) => ClaimHit[]
): ClaimHit[] {
  const copy = extractCopyFragments(source, fileName);
  const fragments = copy.map(f => f.text);
  const found = new Map<string, { hit: ClaimHit; from: number; to: number }>();
  for (const sep of ['', ' ']) {
    for (let len = 1; len <= MAX_WINDOW; len++) {
      for (let i = 0; i + len <= fragments.length; i++) {
        // A fragment that ends a sentence never glues onto the next one.
        const window = fragments.slice(i, i + len);
        // A window is copy when it holds JSX-rendered words or prose; bare
        // numbers and single code words ('normal', 'localhost') are not.
        if (
          !copy
            .slice(i, i + len)
            .some(
              f =>
                (f.jsx && /[a-z]{2,}/i.test(f.text)) ||
                /[a-z]{2,}\s+[a-z]{2,}/i.test(f.text)
            )
        ) {
          continue;
        }
        const text = window
          .map(f => (/[.!?]\s*$/.test(f) ? `${f} ` : f))
          .join(sep);
        for (const hit of scan(text)) {
          const key = `${hit.rule}|${sentenceKey(hit.sentence)}`;
          if (!found.has(key)) {
            found.set(key, {
              hit: { ...hit, line: copy[i].line },
              from: i,
              to: i + len,
            });
          }
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

/** Advisory findings in a source file's copy streams, with lines. */
export function claimHitsInSource(
  source: string,
  fileName: string
): ClaimHit[] {
  return scanSource(source, fileName, claimHits);
}

export function findClaimsInSource(source: string, fileName: string): string[] {
  return claimHitsInSource(source, fileName).map(
    h => `${h.rule} — "${h.sentence}"`
  );
}

/**
 * Blocking tripwire over a source file: patterns in its copy windows, and
 * seeds anywhere in its whole copy stream (all fragments, in order).
 */
export function tripwireHitsInSource(
  source: string,
  fileName: string
): ClaimHit[] {
  const governed = isGovernedUnchanged(fileName);
  const isSeed = (h: ClaimHit) =>
    h.rule === 'seed' || h.rule === 'retired-seed';
  const patterns = scanSource(source, fileName, text =>
    tripwireHits(text).filter(h => !isSeed(h))
  );
  // Seeds are long exact phrases no class list or identifier can produce, so
  // their stream keeps every fragment, wiring-looking ones included.
  const copy = extractCopyFragments(source, fileName, { keepWiring: true });
  const texts = copy.map(f => f.text);
  const seeds = tripwireHits(texts.join('\n'), segmentTexts(texts), {
    governed,
  }).filter(isSeed);
  return [...patterns, ...seeds];
}

// Rendered markup → sentences: block-level elements end a sentence, inline
// elements (<strong>, <span>…) do not. The markup is parsed by the DOM of the
// jsdom test environment (not by regexes), so scripts and styles are
// recognised by element type.
const BLOCK_ELEMENTS = new Set([
  'p',
  'div',
  'li',
  'ul',
  'ol',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'section',
  'article',
  'header',
  'footer',
  'nav',
  'main',
  'aside',
  'td',
  'th',
  'tr',
  'table',
  'br',
  'hr',
  'button',
  'label',
  'option',
  'select',
  'figcaption',
  'blockquote',
  'dd',
  'dt',
  'form',
  'input',
  'textarea',
  'text',
  'tspan',
  'svg',
  'g',
]);
const COPY_ATTRIBUTES = [
  'alt',
  'title',
  'aria-label',
  'placeholder',
  'content',
  'value',
];

// JSON-LD: crawlers read each string value, so each becomes its own line.
// Malformed JSON-LD is an error, never scanned as raw text.
function jsonLdStrings(json: string): string {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch (error) {
    throw new Error(
      `Malformed JSON-LD in rendered markup (${(error as Error).message}): ${json.slice(0, 120)}`
    );
  }
  const out: string[] = [];
  const walkJson = (v: unknown): void => {
    if (typeof v === 'string') out.push(v);
    else if (Array.isArray(v)) v.forEach(walkJson);
    else if (v && typeof v === 'object') Object.values(v).forEach(walkJson);
  };
  walkJson(data);
  return `\n${out.join('\n')}\n`;
}

/** A script crawlers read as copy: type application/ld+json (any case, trimmed). */
const isJsonLd = (element: Element) =>
  (element.getAttribute('type') ?? '').trim().toLowerCase() ===
  'application/ld+json';

export function renderedSentencesText(markup: string): string {
  if (typeof document === 'undefined') {
    throw new Error(
      'renderedSentencesText needs a DOM: run it under the jsdom test environment'
    );
  }
  // A <template>'s content is parsed but inert: no script runs, no resource loads.
  const template = document.createElement('template');
  template.innerHTML = markup;
  const root = template.content;
  const parts: string[] = [];
  const attributes: string[] = [];
  const visit = (node: Node): void => {
    if (node.nodeType === 3 /* text */) {
      parts.push(node.nodeValue ?? '');
      return;
    }
    if (node.nodeType !== 1 /* element */) {
      node.childNodes.forEach(visit); // the fragment itself
      return;
    }
    const element = node as Element;
    const tag = element.localName.toLowerCase();
    // Only JSON-LD is copy; every other script is code, ignored by type.
    if (tag === 'script') {
      if (isJsonLd(element))
        parts.push(jsonLdStrings(element.textContent ?? ''));
      else parts.push('\n');
      return;
    }
    // Style sheets are presentation, not copy a visitor reads.
    if (tag === 'style') {
      parts.push('\n');
      return;
    }
    for (const name of COPY_ATTRIBUTES) {
      const value = element.getAttribute(name);
      if (value !== null) attributes.push(value);
    }
    const block = BLOCK_ELEMENTS.has(tag);
    if (block) parts.push('\n');
    element.childNodes.forEach(visit);
    if (block) parts.push('\n');
  };
  visit(root);
  return `${parts.join('')}\n${attributes.join('\n')}`;
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
  // A route named in a comment is not called.
  const code = source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');
  for (const [raw] of code.matchAll(API_PATH_RE)) {
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
/**
 * Copy published outside the site: the video catalogue is rendered and
 * uploaded to YouTube, so the tripwire judges it although no page bundles it.
 */
export const PUBLISHED_OFF_SITE = ['lib/remotion/educational-content.ts'];

export function publicSourceInventory({
  followApi = true,
  followRouteImports = false,
}: { followApi?: boolean; followRouteImports?: boolean } = {}): string[] {
  const routes = followApi ? apiRoutes() : [];
  const routeFiles = new Set(routes.map(r => r.file));
  const seen = new Set<string>();
  const queue = publicAppFiles();
  while (queue.length) {
    const file = queue.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    if (!SOURCE_EXT.includes(path.extname(file))) continue;
    const source = readFileSync(file, 'utf8');
    // An API route's own literals are judged (every branch it can return);
    // the server modules it imports reach a visitor only through its
    // response, which the API-response scan judges field by field.
    // With followRouteImports (tripwire only), those server modules are judged
    // too: a seed is exact enough that a wider scope cannot raise noise.
    if (followRouteImports || !routeFiles.has(file)) {
      for (const m of source.matchAll(IMPORT_RE)) {
        const resolved = resolveImport(file, m[1] ?? m[2] ?? m[3]);
        if (resolved && !seen.has(resolved)) queue.push(resolved);
      }
    }
    for (const routeFile of referencedApiRoutes(source, routes)) {
      if (!seen.has(routeFile)) queue.push(routeFile);
    }
  }
  return [...seen, path.join(ROOT, 'public/llms.txt')].sort();
}

/** Every file the source tripwire reads (also the retired-seed liveness scope). */
export function tripwireSourceInventory(): string[] {
  return [
    ...new Set([
      ...publicSourceInventory({ followRouteImports: true }),
      ...PUBLISHED_OFF_SITE.map(f => path.join(ROOT, f)),
    ]),
  ].filter(f => existsSync(f));
}

/** Same-origin API route files that public code references. */
export function publicApiRouteFiles(): string[] {
  const routes = apiRoutes();
  const files = new Set<string>();
  for (const file of publicSourceInventory({ followApi: false })) {
    if (!/\.(tsx?|jsx?|mjs)$/.test(file)) continue;
    for (const r of referencedApiRoutes(readFileSync(file, 'utf8'), routes))
      files.add(r);
  }
  return [...files].sort();
}
