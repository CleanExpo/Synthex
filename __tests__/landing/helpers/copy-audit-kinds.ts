/**
 * Mechanical kinds for the advisory copy audit (npm run copy:audit).
 *
 * The audit lists every quantity, credential/superlative term and competitor
 * name in public copy for human review. A kind annotates a finding whose
 * shape a rule can check — it never removes the finding from the review
 * queue, and nothing here blocks a test. classify() returns the kinds whose
 * constraint holds, checked by checkEntry():
 *
 *  NUMBER — every quantity must satisfy one kind:
 *   - price:                equals a value in the pricing sources of truth
 *   - date-time:            date, time, year as a date, or a time frame
 *   - product-limit:        equals a plan-config limit, a validation bound the
 *                           file enforces, or a registered product constant /
 *                           self-count bound to its subject
 *   - ordinal-step-version: step/figure/version/ID/list index/scale
 *   - contact-legal:        phone, ABN, postcode, street number
 *   - hypothetical-example: "for example", "e.g.", "imagine", "if you"
 *   - evidence:             source + retrieved date + approvedBy 'founder'
 *  CREDENTIAL / COMPETITOR — neutral (a listed non-claim role) or evidence.
 *
 * A sentence with no kind is "needs review"; a kind is not a verdict that
 * the copy is true.
 */

import { existsSync } from 'fs';
import path from 'path';
import {
  CREDENTIAL,
  COMPETITOR,
  FIRST_PARTY,
  ROOT,
  isContactLegal,
  isDateTime,
  isHypotheticalExample,
  isOrdinalStepVersion,
  boundMatches,
  limitMatches,
  limitValues,
  priceValues,
  productConstantMatches,
  quantityTokens,
  selfCountMatches,
  sentenceKey,
  validationBounds,
} from './public-claims';

export type NumberKind =
  | 'price'
  | 'date-time'
  | 'product-limit'
  | 'ordinal-step-version'
  | 'contact-legal'
  | 'hypothetical-example'
  | 'evidence';
export type CredentialKind = 'neutral' | 'evidence';
export type CompetitorKind = 'neutral' | 'evidence';

interface EntryBase {
  /** Exact normalised sentence (whitespace is ignored when matching). */
  sentence: string;
  layer: 'source' | 'rendered' | 'api';
  /** File the copy comes from (source), page (rendered) or route (api). */
  file: string;
  source?: string;
  retrieved?: string;
  approvedBy?: 'founder';
}
export type AllowEntry =
  | (EntryBase & { class: 'number'; kinds: NumberKind[] })
  | (EntryBase & { class: 'credential'; kinds: CredentialKind[] })
  | (EntryBase & { class: 'competitor'; kinds: CompetitorKind[] });

let prices: Set<string> | null = null;
let limits: Map<string, Set<string>> | null = null;
const numberValue = (text: string) =>
  String(Number(text.replace(/[^\d.]/g, '')));

function hasEvidence(e: EntryBase): boolean {
  const sourceOk =
    !!e.source &&
    (/^https?:\/\//.test(e.source) || existsSync(path.join(ROOT, e.source)));
  return (
    sourceOk &&
    /^\d{4}-\d{2}-\d{2}$/.test(e.retrieved ?? '') &&
    e.approvedBy === 'founder'
  );
}

// The quantity itself is a currency amount: "$49", "AUD 2,500", "2,500 AUD",
// or the far end of a currency range ("AUD 12,000–35,000").
function isCurrency(s: string, t: { text: string; index: number }): boolean {
  if (t.text.startsWith('$')) return true;
  const before = s.slice(Math.max(0, t.index - 8), t.index);
  const after = s.slice(t.index + t.text.length, t.index + t.text.length + 5);
  if (/(?:\baud|\busd|a\$)\s?$/.test(before) || /^\s?(?:aud|usd)\b/.test(after))
    return true;
  return /(?:\$|aud\s?|usd\s?)[\d.,]+\s?[–-]\s?$/.test(
    s.slice(Math.max(0, t.index - 20), t.index)
  );
}

/**
 * Non-claim roles a credential term may play, each checked on the text
 * around the term. Deny by default: any use not listed here needs evidence.
 *  - a format or a reader's own result: "valid ISO date", "your best posts",
 *    "best time", "best practices", "personal best";
 *  - another body's credential, named: "IICRC certification";
 *  - a regulation named as a topic or keyword, never with compliant/certified;
 *  - a review gate or pass the product runs: "brand, compliance and SEO passes";
 *  - a retention or legal ground: "required for legal or security compliance";
 *  - awards as a tracked topic: "award submission deadlines";
 *  - a condition, not a result: "when the gates are proven";
 *  - a workflow state among its siblings: "verified · staged";
 *  - an account step: "email verified", "not yet verified".
 */
export const NEUTRAL_USES: RegExp[] = [
  /\biso (?:date|8601|format|string|timestamp)/,
  /\b(?:your|personal|next) best\b|\bbest (?:practices?|times?|streak|posts?|metric)\b|\bremembered best\b/,
  /\b(?:iicrc|carsi)\b[^.]{0,80}certif|\bcertif\w*[^.]{0,40}\(iicrc\)|\byour certification\b/,
  /\b(?:gdpr|ccpa)\b(?![^.]{0,20}(?:complian|certif|approved|ready))/,
  /\b(?:brand|voice|evidence|consent|licensing|creative|contrarian),? (?:and )?compliance\b|\bcompliance(?:,| and) (?:licensing|contrarian|publish|seo|evidence)/,
  /\b(?:legal|regulatory|security) compliance\b/,
  /\b(?:industry )?awards? (?:nominations?|submissions?|deadlines?|&)|\bindustry award\b|\bawards deadlines\b/,
  /\b(?:when|once|until|if)\b[^.]{0,40}\bproven\b/,
  /\bverified (?:staged|grounded|queued|draft|approved|published)\b|\b(?:staged|grounded|queued|draft|approved|intake) verified\b/,
  /\bemail\b[^.]{0,30}\bverified\b|\bverified email\b|\bonce verified\b|\b(?:not|not yet|already) verified\b/,
];

/**
 * Neutral comparison wording about a competitor: the roles a name may play
 * without evidence. Once they are removed, no evaluative word may remain.
 */
const COMPETITOR_NAME = COMPETITOR.source.replace(/^\\b|\\b$/g, '');
export const COMPETITOR_ROLES: RegExp[] = [
  `\\bsynthex (?:vs\\.?|versus|and|alongside) ${COMPETITOR_NAME}\\b`,
  `\\bvs\\.? ${COMPETITOR_NAME}\\b`,
  `\\b${COMPETITOR_NAME} alternative\\b`,
  `\\b(?:teams |for teams )?considering ${COMPETITOR_NAME}\\b`,
  `\\balongside ${COMPETITOR_NAME}\\b`,
  `\\/compare\\/${COMPETITOR_NAME}\\b`,
].map(r => new RegExp(r, 'g'));
export const EVALUATIVE =
  /\b(?:only|just|manual(?:ly)?|limited|basic|lacks?|no|not|doesn'?t|does not|can'?t|cannot|requires?|expensive|cheap(?:er)?|costl(?:y|ier)|better|worse|slow(?:er)?|outdated|clunky|switch(?:es|ing)?|replaces?|beats?|wins?|more|less|fewer|instead)\b/;

/** Why an entry fails its kinds, or null when every constraint holds. */
export function checkEntry(e: AllowEntry): string | null {
  const s = e.sentence;
  if (e.class === 'number') {
    prices ??= priceValues();
    limits ??= limitValues();
    const tokens = quantityTokens(s);
    if (tokens.length === 0) return 'no quantity in the sentence';
    for (const t of tokens) {
      const v = numberValue(t.text);
      const ok = e.kinds.some(kind => {
        switch (kind) {
          case 'date-time':
            return isDateTime(s, t);
          case 'ordinal-step-version':
            return isOrdinalStepVersion(s, t);
          case 'contact-legal':
            return isContactLegal(s, t);
          case 'hypothetical-example':
            return isHypotheticalExample(s);
          case 'price':
            return isCurrency(s, t) && prices!.has(v);
          case 'product-limit':
            return (
              limitMatches(s, t, limits!) ||
              boundMatches(s, t, validationBounds(e.file)) ||
              productConstantMatches(s, v) ||
              selfCountMatches(e.file, s, v)
            );
          case 'evidence':
            return hasEvidence(e);
        }
      });
      if (!ok) return `"${t.text}" satisfies none of ${e.kinds.join(', ')}`;
    }
    return null;
  }
  if (e.class === 'competitor') {
    if (e.kinds.includes('evidence') && hasEvidence(e)) return null;
    if (!e.kinds.includes('neutral')) return 'no competitor kind satisfied';
    const rest = COMPETITOR_ROLES.reduce((t, role) => t.replace(role, ' '), s);
    if (COMPETITOR.test(rest))
      return 'names a competitor outside a neutral comparison role';
    if (EVALUATIVE.test(rest)) return 'judges a competitor without evidence';
    return null;
  }
  const terms = [...s.matchAll(new RegExp(CREDENTIAL.source, 'g'))];
  if (terms.length === 0) return 'no credential term in the sentence';
  for (const term of terms) {
    const ok = e.kinds.some(kind => {
      if (kind === 'evidence') return hasEvidence(e);
      // neutral: no first-party subject within 8 words of the term, and
      // the term is in a recognised non-claim role. A bare badge such as
      // "ISO 27001 certified." has no role, so it never passes.
      const at = term.index ?? 0;
      const before = s.slice(0, at).split(/\s+/).slice(-8).join(' ');
      const after = s
        .slice(at + term[0].length)
        .split(/\s+/)
        .slice(0, 9)
        .join(' ');
      if (FIRST_PARTY.test(`${before} ${after}`)) return false;
      return NEUTRAL_USES.some(use =>
        use.test(s.slice(Math.max(0, at - 60), at + term[0].length + 60))
      );
    });
    if (!ok) return `"${term[0]}" satisfies none of ${e.kinds.join(', ')}`;
  }
  return null;
}

const NUMBER_KINDS: NumberKind[] = [
  'date-time',
  'ordinal-step-version',
  'contact-legal',
  'price',
  'product-limit',
  'hypothetical-example',
];

/**
 * The smallest set of mechanical kinds that covers a finding, or [] when
 * none does (the sentence needs human review).
 */
export function classify(
  sentence: string,
  file: string,
  cls: 'number' | 'credential' | 'competitor'
): string[] {
  const base = { sentence, layer: 'source' as const, file };
  if (cls !== 'number') {
    const e = { ...base, class: cls, kinds: ['neutral'] } as AllowEntry;
    return checkEntry(e) ? [] : ['neutral'];
  }
  const combos: NumberKind[][] = NUMBER_KINDS.map(k => [k]);
  for (let i = 0; i < NUMBER_KINDS.length; i++) {
    for (let j = i + 1; j < NUMBER_KINDS.length; j++) {
      combos.push([NUMBER_KINDS[i], NUMBER_KINDS[j]]);
      for (let k = j + 1; k < NUMBER_KINDS.length; k++) {
        combos.push([NUMBER_KINDS[i], NUMBER_KINDS[j], NUMBER_KINDS[k]]);
      }
    }
  }
  for (const kinds of combos) {
    if (!checkEntry({ ...base, class: 'number', kinds })) return kinds;
  }
  return [];
}
