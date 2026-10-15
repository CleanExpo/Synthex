/**
 * Allow-list for the deny-by-default public-claims guard (SYN-1226).
 *
 * Every quantity and every credential/superlative term in public copy is a
 * finding. A finding passes only through an entry here, and an entry passes
 * only if its kind's constraint holds — checked by checkEntry(), not by a
 * reason anyone wrote. Kinds:
 *
 *  NUMBER class — every quantity in the sentence must satisfy one kind:
 *   - price:                currency amount equal to a value in the pricing
 *                           sources of truth (priceValues)
 *   - date-time:            calendar date, time, year used as a date, or a
 *                           time frame ("last 7 days") never next to a saving
 *   - product-limit:        equal to a plan-config limit or a validation bound
 *                           in the same file, in a sentence stating a limit;
 *                           or a registered product constant / self-count
 *                           bound to its subject
 *   - ordinal-step-version: step/figure/scene/wave label, list index,
 *                           version, ordinal, identifier, scale denominator
 *   - contact-legal:        phone (or its input mask), ABN, postcode, street
 *                           number
 *   - hypothetical-example: the sentence says "for example", "e.g.",
 *                           "imagine" or "if you"
 *   - evidence:             needs source (repo path or URL), retrieved
 *                           (YYYY-MM-DD) and approvedBy: 'founder' — none yet
 *  CREDENTIAL class — every term must satisfy one kind:
 *   - neutral:  no first-party subject (we/our/us/Synthex/RestoreAssist)
 *               within 8 words of the term
 *   - evidence: as above
 *
 * Entries are generated from the guard's own findings and reviewed; an entry
 * that stops being needed fails the suite as stale.
 */

import { existsSync } from 'fs';
import path from 'path';
import {
  CREDENTIAL,
  COMPETITOR,
  FIRST_PARTY,
  ROOT,
  type AllowIndex,
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

export function allowIndex(layer: EntryBase['layer']): AllowIndex {
  const index: AllowIndex = {
    number: new Set(),
    credential: new Set(),
    competitor: new Set(),
  };
  for (const e of ALLOW_LIST) {
    if (e.layer === layer) index[e.class].add(sentenceKey(e.sentence));
  }
  return index;
}

export const ALLOW_LIST: AllowEntry[] = [
  // ── source ─────────────────────────────────────────────
  // app/(landing)/restoreassist/insurers/page.tsx
  {
    layer: 'source',
    file: 'app/(landing)/restoreassist/insurers/page.tsx',
    class: 'number',
    kinds: ['product-limit'],
    sentence: 'one claim, 5 steps, the same report at the end.',
  },
  // app/(landing)/restoreassist/pricing/page.tsx
  {
    layer: 'source',
    file: 'app/(landing)/restoreassist/pricing/page.tsx',
    class: 'number',
    kinds: ['price'],
    sentence: '$0',
  },
  {
    layer: 'source',
    file: 'app/(landing)/restoreassist/pricing/page.tsx',
    class: 'number',
    kinds: ['price'],
    sentence: '$0 report credits across',
  },
  {
    layer: 'source',
    file: 'app/(landing)/restoreassist/pricing/page.tsx',
    class: 'number',
    kinds: ['price', 'product-limit'],
    sentence:
      'a 15-day free trial with no credit card, one paid plan at $99 a month including gst, and report packs for the months that run long.',
  },
  {
    layer: 'source',
    file: 'app/(landing)/restoreassist/pricing/page.tsx',
    class: 'number',
    kinds: ['price', 'product-limit'],
    sentence:
      'restoreassist pricing in plain australian dollars: a 15-day free trial with 50 report credits and no credit card, one paid plan at $99 a month including gst, and report packs if a month runs long.',
  },
  {
    layer: 'source',
    file: 'app/(landing)/restoreassist/pricing/page.tsx',
    class: 'number',
    kinds: ['price', 'product-limit'],
    sentence: 'restoreassist pricing | $99 a month, 50 reports, gst included',
  },
  {
    layer: 'source',
    file: 'app/(landing)/restoreassist/pricing/page.tsx',
    class: 'number',
    kinds: ['price', 'product-limit'],
    sentence: 'restoreassist pricing — $99 a month, 50 reports, gst included',
  },
  {
    layer: 'source',
    file: 'app/(landing)/restoreassist/pricing/page.tsx',
    class: 'number',
    kinds: ['product-limit'],
    sentence: 'the plan includes 50 reports a month.',
  },
  // app/add-ons/mcp-app-development/page.tsx
  {
    layer: 'source',
    file: 'app/add-ons/mcp-app-development/page.tsx',
    class: 'number',
    kinds: ['date-time'],
    sentence: 'alpic does not publish public pricing as of may 2026.',
  },
  {
    layer: 'source',
    file: 'app/add-ons/mcp-app-development/page.tsx',
    class: 'number',
    kinds: ['date-time', 'ordinal-step-version'],
    sentence:
      "alpic's skybridge framework (mit-licensed, v1.0 released may 2026) is the stack we build on.",
  },
  {
    layer: 'source',
    file: 'app/add-ons/mcp-app-development/page.tsx',
    class: 'number',
    kinds: ['ordinal-step-version'],
    sentence: 'from aud 1200/month (recurring)',
  },
  {
    layer: 'source',
    file: 'app/add-ons/mcp-app-development/page.tsx',
    class: 'number',
    kinds: ['price'],
    sentence: 'from aud 2500 (one-off)',
  },
  {
    layer: 'source',
    file: 'app/add-ons/mcp-app-development/page.tsx',
    class: 'number',
    kinds: ['price'],
    sentence: 'scoped from discovery — typical aud 12000–35000',
  },
  // app/analytics/AnalyticsClient.tsx
  {
    layer: 'source',
    file: 'app/analytics/AnalyticsClient.tsx',
    class: 'credential',
    kinds: ['neutral'],
    sentence: 'your best posts based on engagement',
  },
  {
    layer: 'source',
    file: 'app/analytics/AnalyticsClient.tsx',
    class: 'number',
    kinds: ['date-time'],
    sentence: 'last 30 days',
  },
  {
    layer: 'source',
    file: 'app/analytics/AnalyticsClient.tsx',
    class: 'number',
    kinds: ['date-time'],
    sentence: 'last 7 days',
  },
  {
    layer: 'source',
    file: 'app/analytics/AnalyticsClient.tsx',
    class: 'number',
    kinds: ['date-time'],
    sentence: 'last 90 days',
  },
  // app/api-reference/page.tsx
  {
    layer: 'source',
    file: 'app/api-reference/page.tsx',
    class: 'number',
    kinds: ['ordinal-step-version'],
    sentence:
      'secure authentication with rotating api keys and oauth 2.0 support.',
  },
  // app/api/analytics/performance/route.ts
  {
    layer: 'source',
    file: 'app/api/analytics/performance/route.ts',
    class: 'credential',
    kinds: ['neutral'],
    sentence: 'enddate must be a valid iso date string',
  },
  {
    layer: 'source',
    file: 'app/api/analytics/performance/route.ts',
    class: 'credential',
    kinds: ['neutral'],
    sentence: 'startdate must be a valid iso date string',
  },
  // app/api/auth/oauth/google/callback/route.ts
  {
    layer: 'source',
    file: 'app/api/auth/oauth/google/callback/route.ts',
    class: 'credential',
    kinds: ['neutral'],
    sentence: 'google account email is not verified',
  },
  // app/api/auth/resend-verification/route.ts
  {
    layer: 'source',
    file: 'app/api/auth/resend-verification/route.ts',
    class: 'credential',
    kinds: ['neutral'],
    sentence: 'email is already verified',
  },
  // app/api/auth/reset-password/route.ts
  {
    layer: 'source',
    file: 'app/api/auth/reset-password/route.ts',
    class: 'number',
    kinds: ['product-limit'],
    sentence: 'password must be at least 8 characters',
  },
  // app/api/demo/caption/route.ts
  {
    layer: 'source',
    file: 'app/api/demo/caption/route.ts',
    class: 'credential',
    kinds: ['neutral'],
    sentence: 'another day, another personal best waiting to happen.',
  },
  {
    layer: 'source',
    file: 'app/api/demo/caption/route.ts',
    class: 'credential',
    kinds: ['neutral'],
    sentence: 'because you deserve to look and feel your best.',
  },
  {
    layer: 'source',
    file: 'app/api/demo/caption/route.ts',
    class: 'credential',
    kinds: ['neutral'],
    sentence:
      "whether you're new to the industry or levelling up your certification, carsi has the course for you.",
  },
  {
    layer: 'source',
    file: 'app/api/demo/caption/route.ts',
    class: 'number',
    kinds: ['date-time'],
    sentence: '2023-06-01bearer invalid json',
  },
  {
    layer: 'source',
    file: 'app/api/demo/caption/route.ts',
    class: 'number',
    kinds: ['date-time'],
    sentence: 'synthex demoanthropic-version2023-06-01',
  },
  // app/api/public/testimonials/[token]/route.ts
  {
    layer: 'source',
    file: 'app/api/public/testimonials/[token]/route.ts',
    class: 'number',
    kinds: ['product-limit'],
    sentence: ': file too large (max 10 mb).',
  },
  {
    layer: 'source',
    file: 'app/api/public/testimonials/[token]/route.ts',
    class: 'number',
    kinds: ['product-limit'],
    sentence: 'video: file too large (max 100 mb).',
  },
  // app/auth/reset-password/page.tsx
  {
    layer: 'source',
    file: 'app/auth/reset-password/page.tsx',
    class: 'number',
    kinds: ['product-limit'],
    sentence: 'must be at least 8 characters',
  },
  {
    layer: 'source',
    file: 'app/auth/reset-password/page.tsx',
    class: 'number',
    kinds: ['product-limit'],
    sentence: 'password must be at least 8 characters long',
  },
  {
    layer: 'source',
    file: 'app/auth/reset-password/page.tsx',
    class: 'number',
    kinds: ['product-limit'],
    sentence: 'your new password must be at least 8 characters long',
  },
  // app/auth/verify-email/page.tsx
  {
    layer: 'source',
    file: 'app/auth/verify-email/page.tsx',
    class: 'credential',
    kinds: ['neutral'],
    sentence: 'email verified successfully!',
  },
  {
    layer: 'source',
    file: 'app/auth/verify-email/page.tsx',
    class: 'credential',
    kinds: ['neutral'],
    sentence: 'email verified!',
  },
  {
    layer: 'source',
    file: 'app/auth/verify-email/page.tsx',
    class: 'credential',
    kinds: ['neutral'],
    sentence: 'your email has been successfully verified',
  },
  // app/benchmark/opengraph-image.tsx
  {
    layer: 'source',
    file: 'app/benchmark/opengraph-image.tsx',
    class: 'number',
    kinds: ['date-time'],
    sentence: 'updated every 10 min',
  },
  // app/benchmark/page.tsx
  {
    layer: 'source',
    file: 'app/benchmark/page.tsx',
    class: 'number',
    kinds: ['date-time'],
    sentence:
      'claims are computed over the rolling 90-day window ending at the time the page was last rendered.',
  },
  {
    layer: 'source',
    file: 'app/benchmark/page.tsx',
    class: 'number',
    kinds: ['product-limit'],
    sentence:
      'start your 14-day trial and see what synthex can do for your local marketing — with the same transparent measurement we use on this page.',
  },
  {
    layer: 'source',
    file: 'app/benchmark/page.tsx',
    class: 'number',
    kinds: ['date-time'],
    sentence:
      'the page revalidates every 10 minutes, so figures refresh throughout the day without changing mid-visit.',
  },
  {
    layer: 'source',
    file: 'app/benchmark/page.tsx',
    class: 'number',
    kinds: ['product-limit'],
    sentence:
      'the synthex client cohort has not yet reached our minimum disclosure threshold of 25 accounts.',
  },
  {
    layer: 'source',
    file: 'app/benchmark/page.tsx',
    class: 'number',
    kinds: ['product-limit'],
    sentence:
      'we only publish a claim once the cohort contains at least 25 active client accounts.',
  },
  // app/changelog/page.tsx
  {
    layer: 'source',
    file: 'app/changelog/page.tsx',
    class: 'number',
    kinds: ['date-time'],
    sentence: 'content scheduling improvementsnovember 2024',
  },
  {
    layer: 'source',
    file: 'app/changelog/page.tsx',
    class: 'number',
    kinds: ['date-time'],
    sentence: 'december 2024ai enhancements',
  },
  {
    layer: 'source',
    file: 'app/changelog/page.tsx',
    class: 'number',
    kinds: ['date-time'],
    sentence: 'enhanced analytics dashboarddecember 2024',
  },
  {
    layer: 'source',
    file: 'app/changelog/page.tsx',
    class: 'number',
    kinds: ['date-time'],
    sentence: 'january 2025major platform redesign',
  },
  {
    layer: 'source',
    file: 'app/changelog/page.tsx',
    class: 'number',
    kinds: ['date-time'],
    sentence: 'november 2024security updates',
  },
  {
    layer: 'source',
    file: 'app/changelog/page.tsx',
    class: 'number',
    kinds: ['date-time'],
    sentence: 'october 2024analytics & insightsreal-time analytics dashboard',
  },
  {
    layer: 'source',
    file: 'app/changelog/page.tsx',
    class: 'number',
    kinds: ['date-time'],
    sentence: 'privacy request handling improvementsoctober 2024',
  },
  // app/clients/[slug]/page.tsx
  {
    layer: 'source',
    file: 'app/clients/[slug]/page.tsx',
    class: 'number',
    kinds: ['ordinal-step-version'],
    sentence: 'composite · v1.1',
  },
  {
    layer: 'source',
    file: 'app/clients/[slug]/page.tsx',
    class: 'number',
    kinds: ['ordinal-step-version'],
    sentence: 'out of 100',
  },
  {
    layer: 'source',
    file: 'app/clients/[slug]/page.tsx',
    class: 'number',
    kinds: ['ordinal-step-version'],
    sentence: 'out of 5 stars',
  },
  // app/compare/hootsuite/page.tsx
  {
    layer: 'source',
    file: 'app/compare/hootsuite/page.tsx',
    class: 'competitor',
    kinds: ['neutral'],
    sentence: 'alongside hootsuite?',
  },
  {
    layer: 'source',
    file: 'app/compare/hootsuite/page.tsx',
    class: 'competitor',
    kinds: ['neutral'],
    sentence: 'answer synthex vs hootsuite',
  },
  {
    layer: 'source',
    file: 'app/compare/hootsuite/page.tsx',
    class: 'competitor',
    kinds: ['neutral'],
    sentence: 'considering synthex alongside hootsuite?',
  },
  {
    layer: 'source',
    file: 'app/compare/hootsuite/page.tsx',
    class: 'competitor',
    kinds: ['neutral'],
    sentence: 'hootsuite alternative australia',
  },
  {
    layer: 'source',
    file: 'app/compare/hootsuite/page.tsx',
    class: 'competitor',
    kinds: ['neutral'],
    sentence: 'synthex and hootsuite: what synthex does | synthex',
  },
  {
    layer: 'source',
    file: 'app/compare/hootsuite/page.tsx',
    class: 'competitor',
    kinds: ['neutral'],
    sentence: 'synthex vs hootsuite',
  },
  {
    layer: 'source',
    file: 'app/compare/hootsuite/page.tsx',
    class: 'competitor',
    kinds: ['neutral'],
    sentence: 'synthex vs hootsuite considering synthex',
  },
  // app/compare/page.tsx
  {
    layer: 'source',
    file: 'app/compare/page.tsx',
    class: 'competitor',
    kinds: ['neutral'],
    sentence: 'what synthex does, for teams considering hootsuite.',
  },
  // app/contact/ContactForm.tsx
  {
    layer: 'source',
    file: 'app/contact/ContactForm.tsx',
    class: 'number',
    kinds: ['date-time'],
    sentence:
      'routes to support@synthex.social for human follow-up within 1 business day.',
  },
  // app/data-deletion/page.tsx
  {
    layer: 'source',
    file: 'app/data-deletion/page.tsx',
    class: 'credential',
    kinds: ['neutral'],
    sentence:
      'a limited set of records may be retained where required for legal or security compliance, then permanently deleted.',
  },
  {
    layer: 'source',
    file: 'app/data-deletion/page.tsx',
    class: 'credential',
    kinds: ['neutral'],
    sentence: 'gdpr data',
  },
  {
    layer: 'source',
    file: 'app/data-deletion/page.tsx',
    class: 'credential',
    kinds: ['neutral'],
    sentence: 'revoke access gdpr',
  },
  {
    layer: 'source',
    file: 'app/data-deletion/page.tsx',
    class: 'number',
    kinds: ['date-time'],
    sentence: 'last updated: july 2026',
  },
  {
    layer: 'source',
    file: 'app/data-deletion/page.tsx',
    class: 'number',
    kinds: ['date-time'],
    sentence: 'up to 90 days:',
  },
  {
    layer: 'source',
    file: 'app/data-deletion/page.tsx',
    class: 'number',
    kinds: ['date-time'],
    sentence: 'within 30 days:',
  },
  // app/demo/integrations/page.tsx
  {
    layer: 'source',
    file: 'app/demo/integrations/page.tsx',
    class: 'number',
    kinds: ['date-time'],
    sentence: 'some features may require re-authentication after 30 days',
  },
  // app/demo/settings/page.tsx
  {
    layer: 'source',
    file: 'app/demo/settings/page.tsx',
    class: 'number',
    kinds: ['price'],
    sentence: '$249 unlimited social accounts',
  },
  {
    layer: 'source',
    file: 'app/demo/settings/page.tsx',
    class: 'number',
    kinds: ['date-time'],
    sentence: 'expires 12/25',
  },
  {
    layer: 'source',
    file: 'app/demo/settings/page.tsx',
    class: 'number',
    kinds: ['product-limit'],
    sentence: 'image size must be less than 5mb',
  },
  {
    layer: 'source',
    file: 'app/demo/settings/page.tsx',
    class: 'number',
    kinds: ['product-limit'],
    sentence: 'max size 5mb.',
  },
  {
    layer: 'source',
    file: 'app/demo/settings/page.tsx',
    class: 'number',
    kinds: ['price'],
    sentence: 'perfect for growing businesses $249',
  },
  {
    layer: 'source',
    file: 'app/demo/settings/page.tsx',
    class: 'number',
    kinds: ['contact-legal'],
    sentence: 'san francisco, ca+1 (555) 123-4567',
  },
  // app/docs/page.tsx
  {
    layer: 'source',
    file: 'app/docs/page.tsx',
    class: 'credential',
    kinds: ['neutral'],
    sentence: 'best practices for multi-platform posting',
  },
  {
    layer: 'source',
    file: 'app/docs/page.tsx',
    class: 'credential',
    kinds: ['neutral'],
    sentence: 'security best practices',
  },
  // app/features/ai-content/page.tsx
  {
    layer: 'source',
    file: 'app/features/ai-content/page.tsx',
    class: 'number',
    kinds: ['ordinal-step-version'],
    sentence: '01paste your website url',
  },
  {
    layer: 'source',
    file: 'app/features/ai-content/page.tsx',
    class: 'number',
    kinds: ['ordinal-step-version'],
    sentence: '02',
  },
  {
    layer: 'source',
    file: 'app/features/ai-content/page.tsx',
    class: 'number',
    kinds: ['ordinal-step-version'],
    sentence: '02ai builds your brand dna',
  },
  {
    layer: 'source',
    file: 'app/features/ai-content/page.tsx',
    class: 'number',
    kinds: ['ordinal-step-version'],
    sentence: '03',
  },
  {
    layer: 'source',
    file: 'app/features/ai-content/page.tsx',
    class: 'number',
    kinds: ['ordinal-step-version'],
    sentence: '03content generated for each platform',
  },
  {
    layer: 'source',
    file: 'app/features/ai-content/page.tsx',
    class: 'number',
    kinds: ['ordinal-step-version'],
    sentence: '04',
  },
  {
    layer: 'source',
    file: 'app/features/ai-content/page.tsx',
    class: 'number',
    kinds: ['ordinal-step-version'],
    sentence:
      '04review, approve, publishevery post goes through your approval queue.',
  },
  {
    layer: 'source',
    file: 'app/features/ai-content/page.tsx',
    class: 'number',
    kinds: ['ordinal-step-version'],
    sentence: 'brand voice ai 01',
  },
  // app/features/platforms/page.tsx
  {
    layer: 'source',
    file: 'app/features/platforms/page.tsx',
    class: 'competitor',
    kinds: ['neutral'],
    sentence: 'vs hootsuite →',
  },
  // app/integrations/page.tsx
  {
    layer: 'source',
    file: 'app/integrations/page.tsx',
    class: 'number',
    kinds: ['ordinal-step-version'],
    sentence: 'gpt-4o for fast drafting, summarisation, and creative writing.',
  },
  // app/not-found.tsx
  {
    layer: 'source',
    file: 'app/not-found.tsx',
    class: 'number',
    kinds: ['ordinal-step-version'],
    sentence:
      '404 the page you are looking for might have been removed, had its name changed, or is temporarily unavailable.',
  },
  {
    layer: 'source',
    file: 'app/not-found.tsx',
    class: 'number',
    kinds: ['ordinal-step-version'],
    sentence: 'page not found 404',
  },
  // app/opengraph-image.tsx
  {
    layer: 'source',
    file: 'app/opengraph-image.tsx',
    class: 'number',
    kinds: ['product-limit'],
    sentence: '3 ranked growth directions from your public evidence.',
  },
  // app/opportunity-map/page.tsx
  {
    layer: 'source',
    file: 'app/opportunity-map/page.tsx',
    class: 'number',
    kinds: ['product-limit'],
    sentence:
      'turn your website, social links and rough context into 3 evidence-backed growth directions and one clear next move.',
  },
  // app/page.tsx
  {
    layer: 'source',
    file: 'app/page.tsx',
    class: 'number',
    kinds: ['product-limit'],
    sentence:
      'turn your website and public evidence into 3 ranked growth directions.',
  },
  // app/pricing/page.tsx
  {
    layer: 'source',
    file: 'app/pricing/page.tsx',
    class: 'credential',
    kinds: ['neutral'],
    sentence: 'scale when the gates are proven',
  },
  {
    layer: 'source',
    file: 'app/pricing/page.tsx',
    class: 'number',
    kinds: ['product-limit'],
    sentence: '3 phases.',
  },
  // app/privacy/page.tsx
  {
    layer: 'source',
    file: 'app/privacy/page.tsx',
    class: 'number',
    kinds: ['date-time'],
    sentence: 'last updated: march 2026',
  },
  {
    layer: 'source',
    file: 'app/privacy/page.tsx',
    class: 'number',
    kinds: ['contact-legal'],
    sentence: 'synthex pty ltd · abn 62 580 077 456 · brisbane, qld, australia',
  },
  // app/roadmap/page.tsx
  {
    layer: 'source',
    file: 'app/roadmap/page.tsx',
    class: 'number',
    kinds: ['date-time'],
    sentence: 'content generation v1q2 2025',
  },
  {
    layer: 'source',
    file: 'app/roadmap/page.tsx',
    class: 'number',
    kinds: ['date-time'],
    sentence: 'enterprise security featuresq4 2025',
  },
  {
    layer: 'source',
    file: 'app/roadmap/page.tsx',
    class: 'number',
    kinds: ['date-time'],
    sentence: 'q1 2025ai persona learning',
  },
  {
    layer: 'source',
    file: 'app/roadmap/page.tsx',
    class: 'number',
    kinds: ['date-time'],
    sentence: 'q2 2025advanced viral pattern analysis',
  },
  {
    layer: 'source',
    file: 'app/roadmap/page.tsx',
    class: 'number',
    kinds: ['date-time'],
    sentence: 'q3 2025ai video content generation',
  },
  {
    layer: 'source',
    file: 'app/roadmap/page.tsx',
    class: 'number',
    kinds: ['date-time'],
    sentence: 'q4 2025white-label solution',
  },
  {
    layer: 'source',
    file: 'app/roadmap/page.tsx',
    class: 'number',
    kinds: ['date-time'],
    sentence: 'team collaboration featuresq3 2025',
  },
  // app/security/page.tsx
  {
    layer: 'source',
    file: 'app/security/page.tsx',
    class: 'number',
    kinds: ['ordinal-step-version'],
    sentence:
      'jwt tokens with secure httponly cookiesoauth 2.0 support (google, github, linkedin)',
  },
  {
    layer: 'source',
    file: 'app/security/page.tsx',
    class: 'number',
    kinds: ['ordinal-step-version'],
    sentence:
      'oauth 2.0 support (google, github, linkedin)role-based access control (rbac)',
  },
  // app/terms/page.tsx
  {
    layer: 'source',
    file: 'app/terms/page.tsx',
    class: 'number',
    kinds: ['date-time'],
    sentence: 'effective: march 2026',
  },
  {
    layer: 'source',
    file: 'app/terms/page.tsx',
    class: 'number',
    kinds: ['date-time'],
    sentence:
      'other liability is limited to the fees paid for the service in the previous 12 months, where the law allows.',
  },
  // app/testimonial/[token]/TestimonialForm.tsx
  {
    layer: 'source',
    file: 'app/testimonial/[token]/TestimonialForm.tsx',
    class: 'number',
    kinds: ['ordinal-step-version'],
    sentence: '/ 2000',
  },
  {
    layer: 'source',
    file: 'app/testimonial/[token]/TestimonialForm.tsx',
    class: 'number',
    kinds: ['product-limit'],
    sentence: 'photos (optional, up to 3)',
  },
  {
    layer: 'source',
    file: 'app/testimonial/[token]/TestimonialForm.tsx',
    class: 'number',
    kinds: ['product-limit'],
    sentence: 'please write at least 10 characters.',
  },
  {
    layer: 'source',
    file: 'app/testimonial/[token]/TestimonialForm.tsx',
    class: 'number',
    kinds: ['product-limit'],
    sentence: '— or upload an mp4 file (max 100 mb) —',
  },
  // app/welcome/page.tsx
  {
    layer: 'source',
    file: 'app/welcome/page.tsx',
    class: 'number',
    kinds: ['date-time'],
    sentence: 'no posts scheduled for the next 7 days.',
  },
  // components/StreakCounter.tsx
  {
    layer: 'source',
    file: 'components/StreakCounter.tsx',
    class: 'credential',
    kinds: ['neutral'],
    sentence: 'best streak',
  },
  // components/command-palette/commands.ts
  {
    layer: 'source',
    file: 'components/command-palette/commands.ts',
    class: 'credential',
    kinds: ['neutral'],
    sentence: 'ai indexing awards & directories — tracker',
  },
  {
    layer: 'source',
    file: 'components/command-palette/commands.ts',
    class: 'credential',
    kinds: ['neutral'],
    sentence: 'awards deadlines submission due date',
  },
  {
    layer: 'source',
    file: 'components/command-palette/commands.ts',
    class: 'credential',
    kinds: ['neutral'],
    sentence: 'best time',
  },
  {
    layer: 'source',
    file: 'components/command-palette/commands.ts',
    class: 'credential',
    kinds: ['neutral'],
    sentence: 'industry award',
  },
  {
    layer: 'source',
    file: 'components/command-palette/commands.ts',
    class: 'credential',
    kinds: ['neutral'],
    sentence:
      'track award nominations and directory listings for e-e-a-t and backlinks',
  },
  {
    layer: 'source',
    file: 'components/command-palette/commands.ts',
    class: 'credential',
    kinds: ['neutral'],
    sentence: 'view upcoming award submission deadlines within 90 days',
  },
  {
    layer: 'source',
    file: 'components/command-palette/commands.ts',
    class: 'number',
    kinds: ['date-time'],
    sentence: 'view upcoming award submission deadlines within 90 days',
  },
  // components/intentscape/demo-data.ts
  {
    layer: 'source',
    file: 'components/intentscape/demo-data.ts',
    class: 'credential',
    kinds: ['neutral'],
    sentence: 'is not yet verified.',
  },
  // components/intentscape/presentation.ts
  {
    layer: 'source',
    file: 'components/intentscape/presentation.ts',
    class: 'number',
    kinds: ['ordinal-step-version'],
    sentence: '01signal separation',
  },
  {
    layer: 'source',
    file: 'components/intentscape/presentation.ts',
    class: 'number',
    kinds: ['ordinal-step-version'],
    sentence: '02upstream causes',
  },
  {
    layer: 'source',
    file: 'components/intentscape/presentation.ts',
    class: 'number',
    kinds: ['ordinal-step-version'],
    sentence: '03downstream effects',
  },
  {
    layer: 'source',
    file: 'components/intentscape/presentation.ts',
    class: 'number',
    kinds: ['ordinal-step-version'],
    sentence: '04stakeholder shifts',
  },
  {
    layer: 'source',
    file: 'components/intentscape/presentation.ts',
    class: 'number',
    kinds: ['ordinal-step-version'],
    sentence: '05outside analogies',
  },
  {
    layer: 'source',
    file: 'components/intentscape/presentation.ts',
    class: 'number',
    kinds: ['ordinal-step-version'],
    sentence: '07adjacent value',
  },
  {
    layer: 'source',
    file: 'components/intentscape/presentation.ts',
    class: 'number',
    kinds: ['ordinal-step-version'],
    sentence: 'downstream effects stakeholder-shifts 04',
  },
  {
    layer: 'source',
    file: 'components/intentscape/presentation.ts',
    class: 'number',
    kinds: ['ordinal-step-version'],
    sentence: 'outside analogies 06',
  },
  {
    layer: 'source',
    file: 'components/intentscape/presentation.ts',
    class: 'number',
    kinds: ['ordinal-step-version'],
    sentence: 'signal separation upstream-causes 02',
  },
  {
    layer: 'source',
    file: 'components/intentscape/presentation.ts',
    class: 'number',
    kinds: ['ordinal-step-version'],
    sentence: 'stakeholder shifts outside-analogies 05',
  },
  {
    layer: 'source',
    file: 'components/intentscape/presentation.ts',
    class: 'number',
    kinds: ['ordinal-step-version'],
    sentence: 'upstream causes downstream-effects 03',
  },
  // components/landing/footer-section.tsx
  {
    layer: 'source',
    file: 'components/landing/footer-section.tsx',
    class: 'number',
    kinds: ['date-time', 'contact-legal'],
    sentence:
      '© 2026 synthex pty ltd · abn: 62 580 077 456 · brisbane, qld, australia',
  },
  // components/landing/premium/audience-lanes.tsx
  {
    layer: 'source',
    file: 'components/landing/premium/audience-lanes.tsx',
    class: 'number',
    kinds: ['product-limit'],
    sentence:
      'get 3 ranked directions, the gaps still unknown, and a brief you can take into a planning session.',
  },
  // components/landing/premium/enterprise-features.tsx
  {
    layer: 'source',
    file: 'components/landing/premium/enterprise-features.tsx',
    class: 'credential',
    kinds: ['neutral'],
    sentence: 'voice, compliance and licensing gates enforced per workspace.',
  },
  // components/landing/premium/hero-product-mock.tsx
  {
    layer: 'source',
    file: 'components/landing/premium/hero-product-mock.tsx',
    class: 'number',
    kinds: ['ordinal-step-version'],
    sentence: '01capturevoice transcript ingested',
  },
  {
    layer: 'source',
    file: 'components/landing/premium/hero-product-mock.tsx',
    class: 'number',
    kinds: ['ordinal-step-version'],
    sentence: '02researchevidence bundle assembled',
  },
  {
    layer: 'source',
    file: 'components/landing/premium/hero-product-mock.tsx',
    class: 'number',
    kinds: ['ordinal-step-version'],
    sentence: '03strategycampaign plan drafted',
  },
  {
    layer: 'source',
    file: 'components/landing/premium/hero-product-mock.tsx',
    class: 'number',
    kinds: ['ordinal-step-version'],
    sentence: '04creativeassets staged for review',
  },
  {
    layer: 'source',
    file: 'components/landing/premium/hero-product-mock.tsx',
    class: 'number',
    kinds: ['ordinal-step-version'],
    sentence: '05approvalawaiting human sign-off',
  },
  {
    layer: 'source',
    file: 'components/landing/premium/hero-product-mock.tsx',
    class: 'number',
    kinds: ['ordinal-step-version'],
    sentence: '06publishqueued for distribution',
  },
  {
    layer: 'source',
    file: 'components/landing/premium/hero-product-mock.tsx',
    class: 'number',
    kinds: ['ordinal-step-version'],
    sentence: 'assets staged for review 05',
  },
  {
    layer: 'source',
    file: 'components/landing/premium/hero-product-mock.tsx',
    class: 'number',
    kinds: ['ordinal-step-version'],
    sentence: 'awaiting human sign-off 06',
  },
  {
    layer: 'source',
    file: 'components/landing/premium/hero-product-mock.tsx',
    class: 'number',
    kinds: ['ordinal-step-version'],
    sentence: 'campaign plan drafted 04',
  },
  {
    layer: 'source',
    file: 'components/landing/premium/hero-product-mock.tsx',
    class: 'number',
    kinds: ['ordinal-step-version'],
    sentence: 'evidence bundle assembled 03',
  },
  {
    layer: 'source',
    file: 'components/landing/premium/hero-product-mock.tsx',
    class: 'number',
    kinds: ['date-time'],
    sentence: 'thu 14:00',
  },
  {
    layer: 'source',
    file: 'components/landing/premium/hero-product-mock.tsx',
    class: 'number',
    kinds: ['date-time'],
    sentence: 'transcript · 02:14',
  },
  {
    layer: 'source',
    file: 'components/landing/premium/hero-product-mock.tsx',
    class: 'number',
    kinds: ['date-time'],
    sentence: 'tue 09:00',
  },
  {
    layer: 'source',
    file: 'components/landing/premium/hero-product-mock.tsx',
    class: 'number',
    kinds: ['ordinal-step-version'],
    sentence: 'voice transcript ingested 02',
  },
  {
    layer: 'source',
    file: 'components/landing/premium/hero-product-mock.tsx',
    class: 'number',
    kinds: ['date-time'],
    sentence: 'wed 10:30',
  },
  // components/landing/premium/hero-section.tsx
  {
    layer: 'source',
    file: 'components/landing/premium/hero-section.tsx',
    class: 'number',
    kinds: ['product-limit'],
    sentence:
      'synthex returns 3 ranked growth directions, the sources used, and the gaps still unknown.',
  },
  // components/landing/premium/landing-faq-data.ts
  {
    layer: 'source',
    file: 'components/landing/premium/landing-faq-data.ts',
    class: 'number',
    kinds: ['product-limit'],
    sentence:
      'it returns 3 ranked growth directions, the evidence used, and the gaps still unknown.',
  },
  // components/landing/premium/product-walkthrough.tsx
  {
    layer: 'source',
    file: 'components/landing/premium/product-walkthrough.tsx',
    class: 'number',
    kinds: ['product-limit'],
    sentence:
      '3 ranked directions come back with sources and gaps still unknown.',
  },
  // components/landing/premium/workflow-timeline.tsx
  {
    layer: 'source',
    file: 'components/landing/premium/workflow-timeline.tsx',
    class: 'number',
    kinds: ['product-limit'],
    sentence:
      'public website, social links and notes become 3 ranked directions.',
  },
  // components/landing/public-v2.tsx
  {
    layer: 'source',
    file: 'components/landing/public-v2.tsx',
    class: 'credential',
    kinds: ['neutral'],
    sentence:
      'brand, creative, compliance, seo/aeo/geo, video and qa passes produce the next best campaign route.',
  },
  {
    layer: 'source',
    file: 'components/landing/public-v2.tsx',
    class: 'credential',
    kinds: ['neutral'],
    sentence: 'brand, evidence and compliance gates',
  },
  {
    layer: 'source',
    file: 'components/landing/public-v2.tsx',
    class: 'credential',
    kinds: ['neutral'],
    sentence:
      'consent, evidence, licensing, brand, compliance, publish and spend gates stay explicit.',
  },
  {
    layer: 'source',
    file: 'components/landing/public-v2.tsx',
    class: 'credential',
    kinds: ['neutral'],
    sentence:
      'researcher, architect, brand, compliance and contrarian passes produce a decision packet with risks and open questions.',
  },
  {
    layer: 'source',
    file: 'components/landing/public-v2.tsx',
    class: 'number',
    kinds: ['ordinal-step-version'],
    sentence: '01 researchevidence bundle',
  },
  {
    layer: 'source',
    file: 'components/landing/public-v2.tsx',
    class: 'number',
    kinds: ['ordinal-step-version'],
    sentence: '02 council',
  },
  {
    layer: 'source',
    file: 'components/landing/public-v2.tsx',
    class: 'number',
    kinds: ['ordinal-step-version'],
    sentence: '02 councilagency-grade review',
  },
  {
    layer: 'source',
    file: 'components/landing/public-v2.tsx',
    class: 'number',
    kinds: ['ordinal-step-version'],
    sentence: '03 studiocampaign build',
  },
  {
    layer: 'source',
    file: 'components/landing/public-v2.tsx',
    class: 'number',
    kinds: ['ordinal-step-version'],
    sentence: '04 learn',
  },
  {
    layer: 'source',
    file: 'components/landing/public-v2.tsx',
    class: 'number',
    kinds: ['ordinal-step-version'],
    sentence: '04 learnroi feedback',
  },
  {
    layer: 'source',
    file: 'components/landing/public-v2.tsx',
    class: 'number',
    kinds: ['date-time'],
    sentence: '© 2026 synthex pty ltd.',
  },
  // components/marketing/BenchmarkTrialForm.tsx
  {
    layer: 'source',
    file: 'components/marketing/BenchmarkTrialForm.tsx',
    class: 'number',
    kinds: ['contact-legal'],
    sentence: '+61 4xx xxx xxx',
  },
  {
    layer: 'source',
    file: 'components/marketing/BenchmarkTrialForm.tsx',
    class: 'number',
    kinds: ['product-limit'],
    sentence: '14-day trial · no credit card required · cancel anytime',
  },
  // components/marketing/MarketingLayout.tsx
  {
    layer: 'source',
    file: 'components/marketing/MarketingLayout.tsx',
    class: 'number',
    kinds: ['date-time'],
    sentence: '© 2026 synthex.',
  },
  // components/opportunity-map/OpportunityMapExperience.tsx
  {
    layer: 'source',
    file: 'components/opportunity-map/OpportunityMapExperience.tsx',
    class: 'number',
    kinds: ['ordinal-step-version'],
    sentence: '01 · sources stay visible',
  },
  {
    layer: 'source',
    file: 'components/opportunity-map/OpportunityMapExperience.tsx',
    class: 'number',
    kinds: ['ordinal-step-version'],
    sentence: '02 · unknowns stay unknown',
  },
  {
    layer: 'source',
    file: 'components/opportunity-map/OpportunityMapExperience.tsx',
    class: 'number',
    kinds: ['ordinal-step-version'],
    sentence: '03 · no account connection',
  },
  {
    layer: 'source',
    file: 'components/opportunity-map/OpportunityMapExperience.tsx',
    class: 'number',
    kinds: ['ordinal-step-version'],
    sentence: 'commercial fit / 100',
  },
  {
    layer: 'source',
    file: 'components/opportunity-map/OpportunityMapExperience.tsx',
    class: 'number',
    kinds: ['product-limit'],
    sentence:
      'synthex turns them into 3 ranked growth directions, showing what it found, what it inferred and what it still needs to learn.',
  },
  // components/seo/SynthexStructuredData.tsx
  {
    layer: 'source',
    file: 'components/seo/SynthexStructuredData.tsx',
    class: 'number',
    kinds: ['date-time'],
    sentence: '2026-05-19',
  },
  {
    layer: 'source',
    file: 'components/seo/SynthexStructuredData.tsx',
    class: 'number',
    kinds: ['date-time'],
    sentence:
      '2026-05-19organizationsynthexhow synthex plans an approval-gated campaign',
  },
  // components/strategic-marketing/PsychologyBrandGenerator.tsx
  {
    layer: 'source',
    file: 'components/strategic-marketing/PsychologyBrandGenerator.tsx',
    class: 'credential',
    kinds: ['neutral'],
    sentence: 'first items remembered best',
  },
  // components/ui/status-pill.tsx
  {
    layer: 'source',
    file: 'components/ui/status-pill.tsx',
    class: 'credential',
    kinds: ['neutral'],
    sentence: 'verified staged awaiting approval',
  },
  // lib/analytics/public-benchmarks.ts
  {
    layer: 'source',
    file: 'lib/analytics/public-benchmarks.ts',
    class: 'number',
    kinds: ['date-time'],
    sentence: 'active synthex client accounts over the prior 90 days.',
  },
  {
    layer: 'source',
    file: 'lib/analytics/public-benchmarks.ts',
    class: 'number',
    kinds: ['date-time'],
    sentence: 'posts published in the last 90 days',
  },
  {
    layer: 'source',
    file: 'lib/analytics/public-benchmarks.ts',
    class: 'number',
    kinds: ['product-limit'],
    sentence: 'public figures publish once the cohort exceeds 25 accounts.',
  },
  // lib/observability/health-dashboard.ts
  {
    layer: 'source',
    file: 'lib/observability/health-dashboard.ts',
    class: 'number',
    kinds: ['date-time'],
    sentence: 'critical errors in last 5 minutes',
  },
  {
    layer: 'source',
    file: 'lib/observability/health-dashboard.ts',
    class: 'number',
    kinds: ['date-time'],
    sentence: 'errors in last 5 minutes',
  },
  // lib/opportunity-map/index.ts
  {
    layer: 'source',
    file: 'lib/opportunity-map/index.ts',
    class: 'credential',
    kinds: ['neutral'],
    sentence:
      'this was not verified from the supplied evidence and remains editable context.',
  },
  {
    layer: 'source',
    file: 'lib/opportunity-map/index.ts',
    class: 'number',
    kinds: ['ordinal-step-version'],
    sentence: '/100 ()## brand context',
  },
  {
    layer: 'source',
    file: 'lib/opportunity-map/index.ts',
    class: 'number',
    kinds: ['ordinal-step-version'],
    sentence: '/100 across available tests.',
  },
  {
    layer: 'source',
    file: 'lib/opportunity-map/index.ts',
    class: 'number',
    kinds: ['ordinal-step-version'],
    sentence: 'commercial fit: /100 (',
  },
  // lib/remotion/help-videos.ts
  {
    layer: 'source',
    file: 'lib/remotion/help-videos.ts',
    class: 'credential',
    kinds: ['neutral'],
    sentence: "once verified, you'll be taken straight into",
  },
  {
    layer: 'source',
    file: 'lib/remotion/help-videos.ts',
    class: 'number',
    kinds: ['ordinal-step-version'],
    sentence:
      'connecting your social media accounts is step 2 of your activation checklist.',
  },
  {
    layer: 'source',
    file: 'lib/remotion/help-videos.ts',
    class: 'number',
    kinds: ['ordinal-step-version'],
    sentence:
      'step 2 of activation: connect instagram, facebook, linkedin, and your other platforms to unlock ai-powered publishing.',
  },
  {
    layer: 'source',
    file: 'lib/remotion/help-videos.ts',
    class: 'number',
    kinds: ['ordinal-step-version'],
    sentence:
      'step 3 of activation: connect your google business profile to sync reviews, insights, and local search data.',
  },
  {
    layer: 'source',
    file: 'lib/remotion/help-videos.ts',
    class: 'number',
    kinds: ['ordinal-step-version'],
    sentence: 'step 4 of activation is connecting your ai provider.',
  },
  {
    layer: 'source',
    file: 'lib/remotion/help-videos.ts',
    class: 'number',
    kinds: ['ordinal-step-version'],
    sentence:
      'step 4 of activation: connect your ai provider (openai, anthropic, gemini, or openrouter) to unlock the full content studio.',
  },
  {
    layer: 'source',
    file: 'lib/remotion/help-videos.ts',
    class: 'number',
    kinds: ['ordinal-step-version'],
    sentence: 'your google business profile is step 3 of activation.',
  },
  // lib/seo/metadata.ts
  {
    layer: 'source',
    file: 'lib/seo/metadata.ts',
    class: 'credential',
    kinds: ['neutral'],
    sentence: 'data protection gdpr',
  },
  {
    layer: 'source',
    file: 'lib/seo/metadata.ts',
    class: 'credential',
    kinds: ['neutral'],
    sentence: 'gdpr terms of service',
  },
  {
    layer: 'source',
    file: 'lib/seo/metadata.ts',
    class: 'number',
    kinds: ['product-limit'],
    sentence:
      'turn your website and public evidence into 3 ranked growth directions, then run approval-gated campaigns.',
  },
  // lib/videos/featuredProgramme.ts
  {
    layer: 'source',
    file: 'lib/videos/featuredProgramme.ts',
    class: 'credential',
    kinds: ['neutral'],
    sentence: 'best metric:',
  },
  // public/llms.txt
  {
    layer: 'source',
    file: 'public/llms.txt',
    class: 'competitor',
    kinds: ['neutral'],
    sentence: '- comparison page: /compare/hootsuite (synthex vs hootsuite).',
  },
  {
    layer: 'source',
    file: 'public/llms.txt',
    class: 'number',
    kinds: ['date-time'],
    sentence: '- last updated: 2026-05-25',
  },
  {
    layer: 'source',
    file: 'public/llms.txt',
    class: 'number',
    kinds: ['date-time'],
    sentence:
      '- support: contact form, with human follow-up within 1 business day',
  },
  // ── rendered ─────────────────────────────────────────────
  // app/(landing)/restoreassist/insurers/page.tsx
  {
    layer: 'rendered',
    file: 'app/(landing)/restoreassist/insurers/page.tsx',
    class: 'number',
    kinds: ['product-limit'],
    sentence: 'one claim, 5 steps, the same report at the end.',
  },
  {
    layer: 'rendered',
    file: 'app/(landing)/restoreassist/insurers/page.tsx',
    class: 'number',
    kinds: ['ordinal-step-version'],
    sentence: 'step 1',
  },
  {
    layer: 'rendered',
    file: 'app/(landing)/restoreassist/insurers/page.tsx',
    class: 'number',
    kinds: ['ordinal-step-version'],
    sentence: 'step 2',
  },
  {
    layer: 'rendered',
    file: 'app/(landing)/restoreassist/insurers/page.tsx',
    class: 'number',
    kinds: ['ordinal-step-version'],
    sentence: 'step 3',
  },
  {
    layer: 'rendered',
    file: 'app/(landing)/restoreassist/insurers/page.tsx',
    class: 'number',
    kinds: ['ordinal-step-version'],
    sentence: 'step 4',
  },
  {
    layer: 'rendered',
    file: 'app/(landing)/restoreassist/insurers/page.tsx',
    class: 'number',
    kinds: ['ordinal-step-version'],
    sentence: 'step 5',
  },
  // app/(landing)/restoreassist/pricing/page.tsx
  {
    layer: 'rendered',
    file: 'app/(landing)/restoreassist/pricing/page.tsx',
    class: 'number',
    kinds: ['price'],
    sentence: '$0',
  },
  {
    layer: 'rendered',
    file: 'app/(landing)/restoreassist/pricing/page.tsx',
    class: 'number',
    kinds: ['price'],
    sentence: '$1.67 per report',
  },
  {
    layer: 'rendered',
    file: 'app/(landing)/restoreassist/pricing/page.tsx',
    class: 'number',
    kinds: ['price'],
    sentence: '$100',
  },
  {
    layer: 'rendered',
    file: 'app/(landing)/restoreassist/pricing/page.tsx',
    class: 'number',
    kinds: ['price'],
    sentence: '$2.00 per report',
  },
  {
    layer: 'rendered',
    file: 'app/(landing)/restoreassist/pricing/page.tsx',
    class: 'number',
    kinds: ['price'],
    sentence: '$2.50 per report',
  },
  {
    layer: 'rendered',
    file: 'app/(landing)/restoreassist/pricing/page.tsx',
    class: 'number',
    kinds: ['price'],
    sentence: '$20',
  },
  {
    layer: 'rendered',
    file: 'app/(landing)/restoreassist/pricing/page.tsx',
    class: 'number',
    kinds: ['price'],
    sentence: '$50',
  },
  {
    layer: 'rendered',
    file: 'app/(landing)/restoreassist/pricing/page.tsx',
    class: 'number',
    kinds: ['price'],
    sentence: '$99',
  },
  {
    layer: 'rendered',
    file: 'app/(landing)/restoreassist/pricing/page.tsx',
    class: 'number',
    kinds: ['price', 'product-limit'],
    sentence: '$99 a month, gst included, 50 inspection reports.',
  },
  {
    layer: 'rendered',
    file: 'app/(landing)/restoreassist/pricing/page.tsx',
    class: 'number',
    kinds: ['price'],
    sentence: '$99 aud',
  },
  {
    layer: 'rendered',
    file: 'app/(landing)/restoreassist/pricing/page.tsx',
    class: 'number',
    kinds: ['ordinal-step-version'],
    sentence: '$99/month',
  },
  {
    layer: 'rendered',
    file: 'app/(landing)/restoreassist/pricing/page.tsx',
    class: 'number',
    kinds: ['product-limit'],
    sentence: '15 days, no credit card',
  },
  {
    layer: 'rendered',
    file: 'app/(landing)/restoreassist/pricing/page.tsx',
    class: 'number',
    kinds: ['product-limit'],
    sentence: '25 extra reports',
  },
  {
    layer: 'rendered',
    file: 'app/(landing)/restoreassist/pricing/page.tsx',
    class: 'number',
    kinds: ['product-limit'],
    sentence: '30 credits',
  },
  {
    layer: 'rendered',
    file: 'app/(landing)/restoreassist/pricing/page.tsx',
    class: 'number',
    kinds: ['product-limit'],
    sentence: '30 quick fill credits',
  },
  {
    layer: 'rendered',
    file: 'app/(landing)/restoreassist/pricing/page.tsx',
    class: 'number',
    kinds: ['ordinal-step-version'],
    sentence: '50',
  },
  {
    layer: 'rendered',
    file: 'app/(landing)/restoreassist/pricing/page.tsx',
    class: 'number',
    kinds: ['product-limit'],
    sentence: '50 credits over 15 days',
  },
  {
    layer: 'rendered',
    file: 'app/(landing)/restoreassist/pricing/page.tsx',
    class: 'number',
    kinds: ['product-limit'],
    sentence: '50 every month',
  },
  {
    layer: 'rendered',
    file: 'app/(landing)/restoreassist/pricing/page.tsx',
    class: 'number',
    kinds: ['product-limit'],
    sentence: '50 inspection report credits',
  },
  {
    layer: 'rendered',
    file: 'app/(landing)/restoreassist/pricing/page.tsx',
    class: 'number',
    kinds: ['product-limit'],
    sentence: '50 inspection reports a month',
  },
  {
    layer: 'rendered',
    file: 'app/(landing)/restoreassist/pricing/page.tsx',
    class: 'number',
    kinds: ['product-limit'],
    sentence: '50 report credits across 15 days',
  },
  {
    layer: 'rendered',
    file: 'app/(landing)/restoreassist/pricing/page.tsx',
    class: 'number',
    kinds: ['price', 'product-limit'],
    sentence:
      '50 report credits over 15 days is enough to run a real water-damage job from the site photos through to the finished report — and to decide, on your own evidence, whether what comes out the other end is worth $99 a month.',
  },
  {
    layer: 'rendered',
    file: 'app/(landing)/restoreassist/pricing/page.tsx',
    class: 'number',
    kinds: ['product-limit'],
    sentence: '50 reports a month.',
  },
  {
    layer: 'rendered',
    file: 'app/(landing)/restoreassist/pricing/page.tsx',
    class: 'number',
    kinds: ['product-limit'],
    sentence: '60 extra reports',
  },
  {
    layer: 'rendered',
    file: 'app/(landing)/restoreassist/pricing/page.tsx',
    class: 'number',
    kinds: ['price', 'product-limit'],
    sentence: '60 reports for $100 · 25 reports for $50 · 8 reports for $20.',
  },
  {
    layer: 'rendered',
    file: 'app/(landing)/restoreassist/pricing/page.tsx',
    class: 'number',
    kinds: ['product-limit'],
    sentence: '8 extra reports',
  },
  {
    layer: 'rendered',
    file: 'app/(landing)/restoreassist/pricing/page.tsx',
    class: 'number',
    kinds: ['price', 'product-limit'],
    sentence:
      'a report pack tops that up for the month it is needed — 60 reports for $100, 25 reports for $50, 8 reports for $20.',
  },
  {
    layer: 'rendered',
    file: 'app/(landing)/restoreassist/pricing/page.tsx',
    class: 'number',
    kinds: ['product-limit'],
    sentence: 'first month adds 10 reports on top',
  },
  {
    layer: 'rendered',
    file: 'app/(landing)/restoreassist/pricing/page.tsx',
    class: 'number',
    kinds: ['price'],
    sentence:
      'it is a separate usage-based amount on top of the $99, and it moves with how much gets written.',
  },
  {
    layer: 'rendered',
    file: 'app/(landing)/restoreassist/pricing/page.tsx',
    class: 'number',
    kinds: ['price'],
    sentence: 'monthly · $99',
  },
  {
    layer: 'rendered',
    file: 'app/(landing)/restoreassist/pricing/page.tsx',
    class: 'number',
    kinds: ['date-time'],
    sentence: 'pricing as published at on 06/08/2026.',
  },
  {
    layer: 'rendered',
    file: 'app/(landing)/restoreassist/pricing/page.tsx',
    class: 'number',
    kinds: ['product-limit'],
    sentence: 'start the 15-day trial',
  },
  {
    layer: 'rendered',
    file: 'app/(landing)/restoreassist/pricing/page.tsx',
    class: 'number',
    kinds: ['product-limit'],
    sentence: 'that sits exactly on the 50 reports the plan already includes.',
  },
  {
    layer: 'rendered',
    file: 'app/(landing)/restoreassist/pricing/page.tsx',
    class: 'number',
    kinds: ['product-limit'],
    sentence: 'the 15-day trial needs no credit card.',
  },
  {
    layer: 'rendered',
    file: 'app/(landing)/restoreassist/pricing/page.tsx',
    class: 'number',
    kinds: ['product-limit'],
    sentence: 'the plan includes 50 reports a month.',
  },
  {
    layer: 'rendered',
    file: 'app/(landing)/restoreassist/pricing/page.tsx',
    class: 'number',
    kinds: ['product-limit'],
    sentence: 'what happens when the 15 days are up?',
  },
  // app/about/page.tsx
  {
    layer: 'rendered',
    file: 'app/about/page.tsx',
    class: 'number',
    kinds: ['ordinal-step-version'],
    sentence: '01',
  },
  {
    layer: 'rendered',
    file: 'app/about/page.tsx',
    class: 'number',
    kinds: ['ordinal-step-version'],
    sentence: '02',
  },
  {
    layer: 'rendered',
    file: 'app/about/page.tsx',
    class: 'number',
    kinds: ['ordinal-step-version'],
    sentence: '03',
  },
  {
    layer: 'rendered',
    file: 'app/about/page.tsx',
    class: 'number',
    kinds: ['date-time'],
    sentence: '2026-05-19',
  },
  {
    layer: 'rendered',
    file: 'app/about/page.tsx',
    class: 'number',
    kinds: ['date-time'],
    sentence: '© 2026 synthex pty ltd.',
  },
  // app/add-ons/mcp-app-development/page.tsx
  {
    layer: 'rendered',
    file: 'app/add-ons/mcp-app-development/page.tsx',
    class: 'number',
    kinds: ['date-time'],
    sentence: 'alpic does not publish public pricing as of may 2026.',
  },
  {
    layer: 'rendered',
    file: 'app/add-ons/mcp-app-development/page.tsx',
    class: 'number',
    kinds: ['date-time', 'ordinal-step-version'],
    sentence:
      "alpic's skybridge framework (mit-licensed, v1.0 released may 2026) is the stack we build on.",
  },
  {
    layer: 'rendered',
    file: 'app/add-ons/mcp-app-development/page.tsx',
    class: 'number',
    kinds: ['ordinal-step-version'],
    sentence: 'from aud 1200/month (recurring)',
  },
  {
    layer: 'rendered',
    file: 'app/add-ons/mcp-app-development/page.tsx',
    class: 'number',
    kinds: ['price'],
    sentence: 'from aud 2500 (one-off)',
  },
  {
    layer: 'rendered',
    file: 'app/add-ons/mcp-app-development/page.tsx',
    class: 'number',
    kinds: ['price'],
    sentence: 'scoped from discovery — typical aud 12000–35000',
  },
  // app/agencies/page.tsx
  {
    layer: 'rendered',
    file: 'app/agencies/page.tsx',
    class: 'number',
    kinds: ['date-time', 'contact-legal'],
    sentence:
      '© 2026 synthex pty ltd · abn: 62 580 077 456 · brisbane, qld, australia',
  },
  // app/analytics/page.tsx
  {
    layer: 'rendered',
    file: 'app/analytics/page.tsx',
    class: 'credential',
    kinds: ['neutral'],
    sentence: 'your best posts based on engagement',
  },
  {
    layer: 'rendered',
    file: 'app/analytics/page.tsx',
    class: 'number',
    kinds: ['ordinal-step-version'],
    sentence: '0',
  },
  {
    layer: 'rendered',
    file: 'app/analytics/page.tsx',
    class: 'number',
    kinds: ['date-time'],
    sentence: 'last 7 days',
  },
  // app/api-reference/page.tsx
  {
    layer: 'rendered',
    file: 'app/api-reference/page.tsx',
    class: 'number',
    kinds: ['ordinal-step-version'],
    sentence:
      'secure authentication with rotating api keys and oauth 2.0 support.',
  },
  {
    layer: 'rendered',
    file: 'app/api-reference/page.tsx',
    class: 'number',
    kinds: ['date-time'],
    sentence: '© 2026 synthex.',
  },
  // app/auth/reset-password/page.tsx
  {
    layer: 'rendered',
    file: 'app/auth/reset-password/page.tsx',
    class: 'number',
    kinds: ['product-limit'],
    sentence: 'must be at least 8 characters',
  },
  {
    layer: 'rendered',
    file: 'app/auth/reset-password/page.tsx',
    class: 'number',
    kinds: ['product-limit'],
    sentence: 'your new password must be at least 8 characters long',
  },
  // app/benchmark/page.tsx
  {
    layer: 'rendered',
    file: 'app/benchmark/page.tsx',
    class: 'number',
    kinds: ['contact-legal'],
    sentence: '+61 4xx xxx xxx',
  },
  {
    layer: 'rendered',
    file: 'app/benchmark/page.tsx',
    class: 'number',
    kinds: ['product-limit'],
    sentence: '14-day trial · no credit card required · cancel anytime',
  },
  {
    layer: 'rendered',
    file: 'app/benchmark/page.tsx',
    class: 'number',
    kinds: ['date-time'],
    sentence:
      'anonymised aggregate across # active synthex client accounts over the prior 90 days.',
  },
  {
    layer: 'rendered',
    file: 'app/benchmark/page.tsx',
    class: 'number',
    kinds: ['date-time'],
    sentence:
      'based on # anonymised synthex client accounts, 16/07/2026–14/10/2026.',
  },
  {
    layer: 'rendered',
    file: 'app/benchmark/page.tsx',
    class: 'number',
    kinds: ['date-time'],
    sentence:
      'based on # anonymised synthex client accounts, distinct active platforms as of 14/10/2026.',
  },
  {
    layer: 'rendered',
    file: 'app/benchmark/page.tsx',
    class: 'number',
    kinds: ['date-time'],
    sentence:
      'claims are computed over the rolling 90-day window ending at the time the page was last rendered.',
  },
  {
    layer: 'rendered',
    file: 'app/benchmark/page.tsx',
    class: 'number',
    kinds: ['date-time'],
    sentence: 'posts published in the last 90 days',
  },
  {
    layer: 'rendered',
    file: 'app/benchmark/page.tsx',
    class: 'number',
    kinds: ['product-limit'],
    sentence:
      'start your 14-day trial and see what synthex can do for your local marketing — with the same transparent measurement we use on this page.',
  },
  {
    layer: 'rendered',
    file: 'app/benchmark/page.tsx',
    class: 'number',
    kinds: ['date-time'],
    sentence:
      'the page revalidates every 10 minutes, so figures refresh throughout the day without changing mid-visit.',
  },
  {
    layer: 'rendered',
    file: 'app/benchmark/page.tsx',
    class: 'number',
    kinds: ['product-limit'],
    sentence:
      'the synthex client cohort has not yet reached our minimum disclosure threshold of 25 accounts.',
  },
  {
    layer: 'rendered',
    file: 'app/benchmark/page.tsx',
    class: 'number',
    kinds: ['product-limit'],
    sentence:
      'we only publish a claim once the cohort contains at least 25 active client accounts.',
  },
  // app/bio/[slug]/page.tsx
  {
    layer: 'rendered',
    file: 'app/bio/[slug]/page.tsx',
    class: 'number',
    kinds: ['ordinal-step-version'],
    sentence: '404',
  },
  // app/blog/page.tsx
  {
    layer: 'rendered',
    file: 'app/blog/page.tsx',
    class: 'number',
    kinds: ['date-time'],
    sentence: '# min read14 october 2026',
  },
  // app/brand-generator/page.tsx
  {
    layer: 'rendered',
    file: 'app/brand-generator/page.tsx',
    class: 'number',
    kinds: ['ordinal-step-version'],
    sentence: '1',
  },
  {
    layer: 'rendered',
    file: 'app/brand-generator/page.tsx',
    class: 'number',
    kinds: ['ordinal-step-version'],
    sentence: '2',
  },
  {
    layer: 'rendered',
    file: 'app/brand-generator/page.tsx',
    class: 'number',
    kinds: ['ordinal-step-version'],
    sentence: '3',
  },
  {
    layer: 'rendered',
    file: 'app/brand-generator/page.tsx',
    class: 'number',
    kinds: ['ordinal-step-version'],
    sentence: '4',
  },
  // app/changelog/page.tsx
  {
    layer: 'rendered',
    file: 'app/changelog/page.tsx',
    class: 'number',
    kinds: ['date-time', 'ordinal-step-version'],
    sentence: '1.3.0featureoctober 2024',
  },
  {
    layer: 'rendered',
    file: 'app/changelog/page.tsx',
    class: 'number',
    kinds: ['date-time', 'ordinal-step-version'],
    sentence: '1.4.0securitynovember 2024',
  },
  {
    layer: 'rendered',
    file: 'app/changelog/page.tsx',
    class: 'number',
    kinds: ['date-time', 'ordinal-step-version'],
    sentence: '1.5.0featuredecember 2024',
  },
  {
    layer: 'rendered',
    file: 'app/changelog/page.tsx',
    class: 'number',
    kinds: ['date-time', 'ordinal-step-version'],
    sentence: '2.0.0majorjanuary 2025',
  },
  // app/clients/[slug]/page.tsx
  {
    layer: 'rendered',
    file: 'app/clients/[slug]/page.tsx',
    class: 'number',
    kinds: ['ordinal-step-version'],
    sentence: '# out of 5 stars',
  },
  {
    layer: 'rendered',
    file: 'app/clients/[slug]/page.tsx',
    class: 'number',
    kinds: ['date-time'],
    sentence: '#/20',
  },
  {
    layer: 'rendered',
    file: 'app/clients/[slug]/page.tsx',
    class: 'number',
    kinds: ['date-time'],
    sentence: '#:00',
  },
  {
    layer: 'rendered',
    file: 'app/clients/[slug]/page.tsx',
    class: 'number',
    kinds: ['contact-legal'],
    sentence: '+61 2 1111 1111',
  },
  {
    layer: 'rendered',
    file: 'app/clients/[slug]/page.tsx',
    class: 'number',
    kinds: ['contact-legal'],
    sentence: '1 fixture street',
  },
  {
    layer: 'rendered',
    file: 'app/clients/[slug]/page.tsx',
    class: 'number',
    kinds: ['ordinal-step-version'],
    sentence: 'authority score: # out of 100',
  },
  {
    layer: 'rendered',
    file: 'app/clients/[slug]/page.tsx',
    class: 'number',
    kinds: ['ordinal-step-version'],
    sentence: 'composite · v1.1',
  },
  {
    layer: 'rendered',
    file: 'app/clients/[slug]/page.tsx',
    class: 'number',
    kinds: ['date-time', 'contact-legal'],
    sentence:
      'fixture business name is located at 1 fixture street, fixtureville, nsw, 2000.',
  },
  {
    layer: 'rendered',
    file: 'app/clients/[slug]/page.tsx',
    class: 'number',
    kinds: ['date-time'],
    sentence: 'fixtureville, nsw, 2000',
  },
  {
    layer: 'rendered',
    file: 'app/clients/[slug]/page.tsx',
    class: 'number',
    kinds: ['date-time'],
    sentence: 'oct 2026',
  },
  {
    layer: 'rendered',
    file: 'app/clients/[slug]/page.tsx',
    class: 'number',
    kinds: ['date-time'],
    sentence: 'powered by synthexauthority hub · 2026',
  },
  {
    layer: 'rendered',
    file: 'app/clients/[slug]/page.tsx',
    class: 'number',
    kinds: ['contact-legal'],
    sentence:
      'you can reach fixture business name by phone at +61 2 1111 1111 or visit their website at',
  },
  // app/compare/hootsuite/page.tsx
  {
    layer: 'rendered',
    file: 'app/compare/hootsuite/page.tsx',
    class: 'competitor',
    kinds: ['neutral'],
    sentence: 'considering synthex alongside hootsuite?',
  },
  {
    layer: 'rendered',
    file: 'app/compare/hootsuite/page.tsx',
    class: 'competitor',
    kinds: ['neutral'],
    sentence: 'synthex vs hootsuite',
  },
  // app/compare/page.tsx
  {
    layer: 'rendered',
    file: 'app/compare/page.tsx',
    class: 'competitor',
    kinds: ['neutral'],
    sentence: 'what synthex does, for teams considering hootsuite.',
  },
  // app/credential-intake/page.tsx
  {
    layer: 'rendered',
    file: 'app/credential-intake/page.tsx',
    class: 'number',
    kinds: ['date-time'],
    sentence: 'link expires 10/#/2026, #:#:# am.',
  },
  // app/data-deletion/page.tsx
  {
    layer: 'rendered',
    file: 'app/data-deletion/page.tsx',
    class: 'credential',
    kinds: ['neutral'],
    sentence:
      'up to 90 days: a limited set of records may be retained where required for legal or security compliance, then permanently deleted.',
  },
  {
    layer: 'rendered',
    file: 'app/data-deletion/page.tsx',
    class: 'number',
    kinds: ['date-time'],
    sentence: 'last updated: july 2026',
  },
  {
    layer: 'rendered',
    file: 'app/data-deletion/page.tsx',
    class: 'number',
    kinds: ['date-time'],
    sentence:
      'up to 90 days: a limited set of records may be retained where required for legal or security compliance, then permanently deleted.',
  },
  {
    layer: 'rendered',
    file: 'app/data-deletion/page.tsx',
    class: 'number',
    kinds: ['date-time'],
    sentence:
      'within 30 days: account deletion and email requests are actioned, and personal data is permanently removed from our active systems.',
  },
  // app/demo/integrations/page.tsx
  {
    layer: 'rendered',
    file: 'app/demo/integrations/page.tsx',
    class: 'number',
    kinds: ['ordinal-step-version'],
    sentence:
      '1.each user connects their own social media accounts using their own api credentials',
  },
  {
    layer: 'rendered',
    file: 'app/demo/integrations/page.tsx',
    class: 'number',
    kinds: ['ordinal-step-version'],
    sentence: '2.click "connect" on any platform below to enter your api keys',
  },
  {
    layer: 'rendered',
    file: 'app/demo/integrations/page.tsx',
    class: 'number',
    kinds: ['ordinal-step-version'],
    sentence:
      '3.your credentials are encrypted and stored securely in your account',
  },
  {
    layer: 'rendered',
    file: 'app/demo/integrations/page.tsx',
    class: 'number',
    kinds: ['ordinal-step-version'],
    sentence: '4.posts go directly from synthex to your social media accounts',
  },
  {
    layer: 'rendered',
    file: 'app/demo/integrations/page.tsx',
    class: 'number',
    kinds: ['date-time'],
    sentence: 'some features may require re-authentication after 30 days',
  },
  // app/demo/settings/page.tsx
  {
    layer: 'rendered',
    file: 'app/demo/settings/page.tsx',
    class: 'number',
    kinds: ['price'],
    sentence: '$249',
  },
  {
    layer: 'rendered',
    file: 'app/demo/settings/page.tsx',
    class: 'number',
    kinds: ['contact-legal'],
    sentence: '+1 (555) 123-4567',
  },
  {
    layer: 'rendered',
    file: 'app/demo/settings/page.tsx',
    class: 'number',
    kinds: ['ordinal-step-version'],
    sentence: '30',
  },
  {
    layer: 'rendered',
    file: 'app/demo/settings/page.tsx',
    class: 'number',
    kinds: ['date-time'],
    sentence: 'expires 12/25',
  },
  {
    layer: 'rendered',
    file: 'app/demo/settings/page.tsx',
    class: 'number',
    kinds: ['product-limit'],
    sentence: 'max size 5mb.',
  },
  // app/design-system/page.tsx
  {
    layer: 'rendered',
    file: 'app/design-system/page.tsx',
    class: 'number',
    kinds: ['ordinal-step-version'],
    sentence: '#22c55e',
  },
  {
    layer: 'rendered',
    file: 'app/design-system/page.tsx',
    class: 'number',
    kinds: ['ordinal-step-version'],
    sentence: '100',
  },
  {
    layer: 'rendered',
    file: 'app/design-system/page.tsx',
    class: 'number',
    kinds: ['ordinal-step-version'],
    sentence: '200',
  },
  {
    layer: 'rendered',
    file: 'app/design-system/page.tsx',
    class: 'number',
    kinds: ['ordinal-step-version'],
    sentence: '300',
  },
  {
    layer: 'rendered',
    file: 'app/design-system/page.tsx',
    class: 'number',
    kinds: ['ordinal-step-version'],
    sentence: '400',
  },
  {
    layer: 'rendered',
    file: 'app/design-system/page.tsx',
    class: 'number',
    kinds: ['ordinal-step-version'],
    sentence: '500',
  },
  {
    layer: 'rendered',
    file: 'app/design-system/page.tsx',
    class: 'number',
    kinds: ['ordinal-step-version'],
    sentence: '600',
  },
  {
    layer: 'rendered',
    file: 'app/design-system/page.tsx',
    class: 'number',
    kinds: ['ordinal-step-version'],
    sentence: '700',
  },
  {
    layer: 'rendered',
    file: 'app/design-system/page.tsx',
    class: 'number',
    kinds: ['ordinal-step-version'],
    sentence: '800',
  },
  {
    layer: 'rendered',
    file: 'app/design-system/page.tsx',
    class: 'number',
    kinds: ['ordinal-step-version'],
    sentence: '900',
  },
  {
    layer: 'rendered',
    file: 'app/design-system/page.tsx',
    class: 'number',
    kinds: ['ordinal-step-version'],
    sentence: '950',
  },
  {
    layer: 'rendered',
    file: 'app/design-system/page.tsx',
    class: 'number',
    kinds: ['ordinal-step-version'],
    sentence: 'synthex design systemv4.0',
  },
  // app/docs/page.tsx
  {
    layer: 'rendered',
    file: 'app/docs/page.tsx',
    class: 'credential',
    kinds: ['neutral'],
    sentence: 'best practices for multi-platform posting',
  },
  {
    layer: 'rendered',
    file: 'app/docs/page.tsx',
    class: 'credential',
    kinds: ['neutral'],
    sentence: 'security best practices',
  },
  // app/features/ai-content/page.tsx
  {
    layer: 'rendered',
    file: 'app/features/ai-content/page.tsx',
    class: 'number',
    kinds: ['ordinal-step-version'],
    sentence: '04',
  },
  // app/features/page.tsx
  {
    layer: 'rendered',
    file: 'app/features/page.tsx',
    class: 'number',
    kinds: ['ordinal-step-version'],
    sentence: '05',
  },
  // app/features/platforms/page.tsx
  {
    layer: 'rendered',
    file: 'app/features/platforms/page.tsx',
    class: 'competitor',
    kinds: ['neutral'],
    sentence: 'ai content →for agencies →vs hootsuite →',
  },
  // app/integrations/page.tsx
  {
    layer: 'rendered',
    file: 'app/integrations/page.tsx',
    class: 'number',
    kinds: ['ordinal-step-version'],
    sentence: 'gpt-4o for fast drafting, summarisation, and creative writing.',
  },
  // app/intentscape/page.tsx
  {
    layer: 'rendered',
    file: 'app/intentscape/page.tsx',
    class: 'number',
    kinds: ['ordinal-step-version'],
    sentence: '01 / signal separation',
  },
  {
    layer: 'rendered',
    file: 'app/intentscape/page.tsx',
    class: 'number',
    kinds: ['ordinal-step-version'],
    sentence:
      '01resolve buyer uncertainty first78%incomplete comparison and usage proof prevents qualified buyers from resolving uncertainty before purchase.',
  },
  {
    layer: 'rendered',
    file: 'app/intentscape/page.tsx',
    class: 'number',
    kinds: ['ordinal-step-version'],
    sentence: '02 / upstream causes',
  },
  {
    layer: 'rendered',
    file: 'app/intentscape/page.tsx',
    class: 'number',
    kinds: ['ordinal-step-version'],
    sentence:
      '02repair offer-to-audience fit69%the active audience prioritises a different outcome, so polished creative attracts attention without intent.target buyer · product owner',
  },
  {
    layer: 'rendered',
    file: 'app/intentscape/page.tsx',
    class: 'number',
    kinds: ['ordinal-step-version'],
    sentence: '03 / downstream effects',
  },
  {
    layer: 'rendered',
    file: 'app/intentscape/page.tsx',
    class: 'number',
    kinds: ['ordinal-step-version'],
    sentence:
      '03build a creative learning system73%disconnected asset production prevents the team from learning which proof, format and audience combination changes behaviour.marketing operator · creative team',
  },
  {
    layer: 'rendered',
    file: 'app/intentscape/page.tsx',
    class: 'number',
    kinds: ['ordinal-step-version'],
    sentence: '04 / stakeholder shifts',
  },
  {
    layer: 'rendered',
    file: 'app/intentscape/page.tsx',
    class: 'number',
    kinds: ['ordinal-step-version'],
    sentence: '05 / outside analogies',
  },
  {
    layer: 'rendered',
    file: 'app/intentscape/page.tsx',
    class: 'number',
    kinds: ['ordinal-step-version'],
    sentence: '06',
  },
  {
    layer: 'rendered',
    file: 'app/intentscape/page.tsx',
    class: 'number',
    kinds: ['ordinal-step-version'],
    sentence: '06 / counterfactuals',
  },
  {
    layer: 'rendered',
    file: 'app/intentscape/page.tsx',
    class: 'number',
    kinds: ['ordinal-step-version'],
    sentence: '07',
  },
  {
    layer: 'rendered',
    file: 'app/intentscape/page.tsx',
    class: 'number',
    kinds: ['ordinal-step-version'],
    sentence: '07 / adjacent value',
  },
  {
    layer: 'rendered',
    file: 'app/intentscape/page.tsx',
    class: 'number',
    kinds: ['ordinal-step-version'],
    sentence: '1.',
  },
  {
    layer: 'rendered',
    file: 'app/intentscape/page.tsx',
    class: 'number',
    kinds: ['ordinal-step-version'],
    sentence: '2.',
  },
  {
    layer: 'rendered',
    file: 'app/intentscape/page.tsx',
    class: 'number',
    kinds: ['ordinal-step-version'],
    sentence: '3.',
  },
  {
    layer: 'rendered',
    file: 'app/intentscape/page.tsx',
    class: 'number',
    kinds: ['ordinal-step-version'],
    sentence: 'direction 01resolve buyer uncertainty first78% confidence',
  },
  {
    layer: 'rendered',
    file: 'app/intentscape/page.tsx',
    class: 'number',
    kinds: ['ordinal-step-version'],
    sentence: 'direction 02repair offer-to-audience fit69% confidence',
  },
  {
    layer: 'rendered',
    file: 'app/intentscape/page.tsx',
    class: 'number',
    kinds: ['ordinal-step-version'],
    sentence: 'direction 03build a creative learning system73% confidence',
  },
  // app/opportunity-map/page.tsx
  {
    layer: 'rendered',
    file: 'app/opportunity-map/page.tsx',
    class: 'number',
    kinds: ['ordinal-step-version'],
    sentence:
      '01 · sources stay visible02 · unknowns stay unknown03 · no account connection',
  },
  {
    layer: 'rendered',
    file: 'app/opportunity-map/page.tsx',
    class: 'number',
    kinds: ['ordinal-step-version'],
    sentence: 'direction 1',
  },
  {
    layer: 'rendered',
    file: 'app/opportunity-map/page.tsx',
    class: 'number',
    kinds: ['ordinal-step-version'],
    sentence: 'direction 2',
  },
  {
    layer: 'rendered',
    file: 'app/opportunity-map/page.tsx',
    class: 'number',
    kinds: ['ordinal-step-version'],
    sentence: 'direction 3',
  },
  {
    layer: 'rendered',
    file: 'app/opportunity-map/page.tsx',
    class: 'number',
    kinds: ['product-limit'],
    sentence:
      'synthex turns them into 3 ranked growth directions, showing what it found, what it inferred and what it still needs to learn.',
  },
  // app/page.tsx
  {
    layer: 'rendered',
    file: 'app/page.tsx',
    class: 'credential',
    kinds: ['neutral'],
    sentence: 'voice, compliance and licensing gates enforced per workspace.',
  },
  {
    layer: 'rendered',
    file: 'app/page.tsx',
    class: 'number',
    kinds: ['ordinal-step-version'],
    sentence: '01capture',
  },
  {
    layer: 'rendered',
    file: 'app/page.tsx',
    class: 'number',
    kinds: ['ordinal-step-version'],
    sentence: '02research',
  },
  {
    layer: 'rendered',
    file: 'app/page.tsx',
    class: 'number',
    kinds: ['ordinal-step-version'],
    sentence: '03strategy',
  },
  {
    layer: 'rendered',
    file: 'app/page.tsx',
    class: 'number',
    kinds: ['ordinal-step-version'],
    sentence: '04creative',
  },
  {
    layer: 'rendered',
    file: 'app/page.tsx',
    class: 'number',
    kinds: ['ordinal-step-version'],
    sentence: '05approval',
  },
  {
    layer: 'rendered',
    file: 'app/page.tsx',
    class: 'number',
    kinds: ['ordinal-step-version'],
    sentence: '06publish',
  },
  {
    layer: 'rendered',
    file: 'app/page.tsx',
    class: 'number',
    kinds: ['ordinal-step-version'],
    sentence: '08',
  },
  {
    layer: 'rendered',
    file: 'app/page.tsx',
    class: 'number',
    kinds: ['product-limit'],
    sentence:
      '3 ranked directions come back with sources and gaps still unknown.',
  },
  {
    layer: 'rendered',
    file: 'app/page.tsx',
    class: 'number',
    kinds: ['product-limit'],
    sentence:
      'get 3 ranked directions, the gaps still unknown, and a brief you can take into a planning session.',
  },
  {
    layer: 'rendered',
    file: 'app/page.tsx',
    class: 'number',
    kinds: ['ordinal-step-version'],
    sentence: 'go to stage 1',
  },
  {
    layer: 'rendered',
    file: 'app/page.tsx',
    class: 'number',
    kinds: ['ordinal-step-version'],
    sentence: 'go to stage 2',
  },
  {
    layer: 'rendered',
    file: 'app/page.tsx',
    class: 'number',
    kinds: ['ordinal-step-version'],
    sentence: 'go to stage 3',
  },
  {
    layer: 'rendered',
    file: 'app/page.tsx',
    class: 'number',
    kinds: ['ordinal-step-version'],
    sentence: 'go to stage 4',
  },
  {
    layer: 'rendered',
    file: 'app/page.tsx',
    class: 'number',
    kinds: ['ordinal-step-version'],
    sentence: 'go to stage 5',
  },
  {
    layer: 'rendered',
    file: 'app/page.tsx',
    class: 'number',
    kinds: ['ordinal-step-version'],
    sentence: 'go to stage 6',
  },
  {
    layer: 'rendered',
    file: 'app/page.tsx',
    class: 'number',
    kinds: ['product-limit'],
    sentence:
      'it returns 3 ranked growth directions, the evidence used, and the gaps still unknown.',
  },
  {
    layer: 'rendered',
    file: 'app/page.tsx',
    class: 'number',
    kinds: ['product-limit'],
    sentence:
      'public website, social links and notes become 3 ranked directions.',
  },
  {
    layer: 'rendered',
    file: 'app/page.tsx',
    class: 'number',
    kinds: ['ordinal-step-version'],
    sentence: 'rule 01',
  },
  {
    layer: 'rendered',
    file: 'app/page.tsx',
    class: 'number',
    kinds: ['ordinal-step-version'],
    sentence: 'rule 02',
  },
  {
    layer: 'rendered',
    file: 'app/page.tsx',
    class: 'number',
    kinds: ['ordinal-step-version'],
    sentence: 'rule 03',
  },
  {
    layer: 'rendered',
    file: 'app/page.tsx',
    class: 'number',
    kinds: ['ordinal-step-version'],
    sentence: 'stage 01 · capture',
  },
  {
    layer: 'rendered',
    file: 'app/page.tsx',
    class: 'number',
    kinds: ['product-limit'],
    sentence:
      'synthex returns 3 ranked growth directions, the sources used, and the gaps still unknown.',
  },
  {
    layer: 'rendered',
    file: 'app/page.tsx',
    class: 'number',
    kinds: ['date-time'],
    sentence: 'transcript · 02:14',
  },
  // app/pricing/page.tsx
  {
    layer: 'rendered',
    file: 'app/pricing/page.tsx',
    class: 'credential',
    kinds: ['neutral'],
    sentence: 'scale when the gates are proven',
  },
  {
    layer: 'rendered',
    file: 'app/pricing/page.tsx',
    class: 'number',
    kinds: ['product-limit'],
    sentence: '3 phases.',
  },
  // app/privacy/page.tsx
  {
    layer: 'rendered',
    file: 'app/privacy/page.tsx',
    class: 'number',
    kinds: ['date-time'],
    sentence: 'last updated: march 2026',
  },
  {
    layer: 'rendered',
    file: 'app/privacy/page.tsx',
    class: 'number',
    kinds: ['contact-legal'],
    sentence: 'synthex pty ltd · abn 62 580 077 456 · brisbane, qld, australia',
  },
  // app/roadmap/page.tsx
  {
    layer: 'rendered',
    file: 'app/roadmap/page.tsx',
    class: 'number',
    kinds: ['date-time'],
    sentence: 'q1 2025',
  },
  {
    layer: 'rendered',
    file: 'app/roadmap/page.tsx',
    class: 'number',
    kinds: ['date-time'],
    sentence: 'q2 2025',
  },
  {
    layer: 'rendered',
    file: 'app/roadmap/page.tsx',
    class: 'number',
    kinds: ['date-time'],
    sentence: 'q3 2025',
  },
  {
    layer: 'rendered',
    file: 'app/roadmap/page.tsx',
    class: 'number',
    kinds: ['date-time'],
    sentence: 'q4 2025',
  },
  // app/security/page.tsx
  {
    layer: 'rendered',
    file: 'app/security/page.tsx',
    class: 'number',
    kinds: ['ordinal-step-version'],
    sentence: 'jwt + oauth 2.0',
  },
  {
    layer: 'rendered',
    file: 'app/security/page.tsx',
    class: 'number',
    kinds: ['ordinal-step-version'],
    sentence: 'oauth 2.0 support (google, github, linkedin)',
  },
  // app/terms/page.tsx
  {
    layer: 'rendered',
    file: 'app/terms/page.tsx',
    class: 'number',
    kinds: ['ordinal-step-version'],
    sentence: '4.',
  },
  {
    layer: 'rendered',
    file: 'app/terms/page.tsx',
    class: 'number',
    kinds: ['ordinal-step-version'],
    sentence: '5.',
  },
  {
    layer: 'rendered',
    file: 'app/terms/page.tsx',
    class: 'number',
    kinds: ['ordinal-step-version'],
    sentence: '6.',
  },
  {
    layer: 'rendered',
    file: 'app/terms/page.tsx',
    class: 'number',
    kinds: ['date-time'],
    sentence: 'effective: march 2026',
  },
  {
    layer: 'rendered',
    file: 'app/terms/page.tsx',
    class: 'number',
    kinds: ['date-time'],
    sentence:
      'other liability is limited to the fees paid for the service in the previous 12 months, where the law allows.',
  },
  // app/testimonial/[token]/page.tsx
  {
    layer: 'rendered',
    file: 'app/testimonial/[token]/page.tsx',
    class: 'number',
    kinds: ['product-limit'],
    sentence: '0 / 2000',
  },
  {
    layer: 'rendered',
    file: 'app/testimonial/[token]/page.tsx',
    class: 'number',
    kinds: ['product-limit'],
    sentence: 'photos (optional, up to 3)',
  },
  {
    layer: 'rendered',
    file: 'app/testimonial/[token]/page.tsx',
    class: 'number',
    kinds: ['product-limit'],
    sentence: '— or upload an mp4 file (max 100 mb) —',
  },
  // app/welcome/page.tsx
  {
    layer: 'rendered',
    file: 'app/welcome/page.tsx',
    class: 'number',
    kinds: ['ordinal-step-version'],
    sentence: '#/100',
  },
  {
    layer: 'rendered',
    file: 'app/welcome/page.tsx',
    class: 'number',
    kinds: ['date-time'],
    sentence: 'fri, 16 oct, 09:00 am',
  },
  {
    layer: 'rendered',
    file: 'app/welcome/page.tsx',
    class: 'number',
    kinds: ['date-time'],
    sentence: 'no posts scheduled for the next 7 days.',
  },
  // ── api ─────────────────────────────────────────────
  // app/api/analytics/performance/route.ts
  {
    layer: 'api',
    file: 'app/api/analytics/performance/route.ts',
    class: 'number',
    kinds: ['date-time'],
    sentence: '9:00',
  },
  // app/api/analytics/route.ts
  {
    layer: 'api',
    file: 'app/api/analytics/route.ts',
    class: 'number',
    kinds: ['date-time'],
    sentence: '30d',
  },
  // app/api/auth/resend-verification/route.ts
  {
    layer: 'api',
    file: 'app/api/auth/resend-verification/route.ts',
    class: 'credential',
    kinds: ['neutral'],
    sentence: 'email is already verified',
  },
  // app/api/opportunity-map/route.ts
  {
    layer: 'api',
    file: 'app/api/opportunity-map/route.ts',
    class: 'credential',
    kinds: ['neutral'],
    sentence:
      'this was not verified from the supplied evidence and remains editable context.',
  },
  {
    layer: 'api',
    file: 'app/api/opportunity-map/route.ts',
    class: 'number',
    kinds: ['ordinal-step-version'],
    sentence: '#/100',
  },
];
