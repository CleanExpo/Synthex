/**
 * Generation-gate validators for the multi-tenant site generator.
 *
 * Run AFTER copy generation (deterministic OR caller/LLM-supplied) and BEFORE
 * the site is published. ANY block-level finding means the caller MUST reject.
 *
 * Universal rules (every brand, every business):
 *   1. Aid Rule (block) — copy never frames AI as the actor.
 *   2. Category claim (block unless verified) — ACL §18 superlatives need a
 *      verified data binding.
 *   3. Schema-vs-content match (block) — the visible copy must mention the
 *      hero service the JSON-LD Service node declares.
 *   4. Brand voice (block) — copy must not contain the brand's forbidden words.
 *   5. Forbidden substrings (block) — caller-supplied defence-in-depth (e.g.
 *      third-party data scraped upstream that must never surface).
 *
 * NOTE (vs lib/landing-page): the DR module blocks any phone/street-address in
 * copy because a DR page represents coverage, not a contractor. A generic
 * business site is the OPPOSITE — the business's own phone and address are
 * legitimate and expected — so those PII blocks are intentionally absent here.
 */

import {
  AI_AS_ACTOR_REGEX,
  CATEGORY_CLAIM_REGEX,
  type BusinessService,
  type SiteBrand,
  type SiteCopy,
  type ValidationFinding,
} from './types';

export interface ValidateSiteCopyInput {
  copy: SiteCopy;
  /** The hero service the JSON-LD declares — copy must mention its noun. */
  heroService: BusinessService;
  brand: SiteBrand;
  verificationGateState?: 'directional' | 'verified';
  forbiddenSubstrings?: readonly string[];
}

function collectText(copy: SiteCopy): string {
  return [
    copy.headline,
    copy.intro,
    ...copy.bodyParagraphs,
    ...copy.faqs.flatMap(f => [f.question, f.answer]),
  ].join('\n');
}

export function validateSiteCopy(
  input: ValidateSiteCopyInput
): ValidationFinding[] {
  const findings: ValidationFinding[] = [];
  const text = collectText(input.copy);

  // 1) Aid Rule — AI is never the actor.
  const actor = text.match(AI_AS_ACTOR_REGEX);
  if (actor) {
    findings.push({
      rule: 'aid-rule',
      severity: 'block',
      message: `copy frames AI as the actor (matched '${actor[0]}'). The operator is the actor; AI is the tool.`,
    });
  }

  // 2) Category claim without a verified binding (ACL §18).
  const claim = text.match(CATEGORY_CLAIM_REGEX);
  if (claim) {
    if (input.verificationGateState !== 'verified') {
      findings.push({
        rule: 'category-claim',
        severity: 'block',
        message: `copy uses superlative '${claim[0]}' without verificationGateState='verified' (ACL §18).`,
      });
    } else {
      findings.push({
        rule: 'category-claim',
        severity: 'warn',
        message: `copy uses superlative '${claim[0]}' — VG-state verified; confirm the data binding before publish.`,
      });
    }
  }

  // 3) Schema-vs-content match — copy must mention the hero service noun.
  const noun = input.heroService.label.split(' ')[0];
  if (noun && !new RegExp(`\\b${escapeRegExp(noun)}\\b`, 'i').test(text)) {
    findings.push({
      rule: 'schema-content-match',
      severity: 'block',
      message: `copy does not mention '${noun}' but JSON-LD declares serviceType='${input.heroService.label}'.`,
    });
  }

  // 4) Brand voice — no forbidden words.
  const lower = text.toLowerCase();
  for (const word of input.brand.forbiddenWords) {
    const w = word.trim().toLowerCase();
    if (w && new RegExp(`\\b${escapeRegExp(w)}\\b`).test(lower)) {
      findings.push({
        rule: 'brand-voice-forbidden-word',
        severity: 'block',
        message: `copy contains brand-forbidden word '${word}'.`,
      });
    }
  }

  // 5) Forbidden substrings — defence-in-depth.
  for (const s of input.forbiddenSubstrings ?? []) {
    if (s && text.includes(s)) {
      findings.push({
        rule: 'forbidden-substring',
        severity: 'block',
        message: `copy contains forbidden substring '${s}'.`,
      });
    }
  }

  return findings;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
