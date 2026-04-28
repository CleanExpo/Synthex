/**
 * Generation-gate validators for SYN-838.
 *
 * These run AFTER copy generation (deterministic OR caller-supplied)
 * and BEFORE the page is committed to the disasterrecovery.com.au
 * repo. ANY block-level finding means the page MUST be rejected.
 *
 * Rules:
 *   1. Aid Rule (block) — copy never frames AI as the actor.
 *   2. Category-claim (block by default) — phrases like "leading",
 *      "first", "best" require an explicit `verificationGateState
 *      === 'verified'` flag from the caller. Without it, the page
 *      is rejected. Mirrors the foundation-binding pattern we use
 *      across the portfolio.
 *   3. Schema-vs-content match (block) — Q3.2.3 A4. The visible
 *      copy MUST mention the service category that the JSON-LD
 *      Service node names. If the page says "fire damage" but the
 *      JSON-LD says "water-damage", reject.
 *   4. PII leak (block) — copy must not contain a contractor name,
 *      a phone number, or a street address. The page represents
 *      DR's coverage, not any individual contractor (Q3.2.5 P10).
 *
 * @see SYN-838 (parent: SYN-834 epic)
 */

import {
  AI_AS_ACTOR_REGEX,
  CATEGORY_CLAIM_REGEX,
  SERVICE_CATEGORY_LABEL,
  type DrServiceCategory,
  type ValidationFinding,
} from './types';

interface ValidatorInput {
  copy: { headline: string; intro: string; bodyParagraphs: string[] };
  serviceCategory: DrServiceCategory;
  /**
   * Set to `'verified'` when the page is published with a verified-
   * via-data binding. Required to use category claims like "leading"
   * or "first" anywhere in the copy.
   */
  verificationGateState?: 'directional' | 'verified';
  /**
   * Optional list of strings the copy is forbidden to contain
   * verbatim — typically contractor names + phone digits collected
   * upstream. This is a defence-in-depth check; the upstream pipeline
   * SHOULD never pass them, but if it does, we block here.
   */
  forbiddenPiiSubstrings?: string[];
}

const PHONE_REGEX = /(?:\+?61|0)[\s-]?\d(?:[\s-]?\d){8}/;
const STREET_ADDRESS_REGEX =
  /\b\d+\s+[A-Z][a-z]+\s+(Street|St|Road|Rd|Avenue|Ave|Drive|Dr|Crescent|Cres|Lane|Ln|Court|Ct|Place|Pl|Way|Boulevard|Bvd|Highway|Hwy)\b/;

export function validateLandingPageCopy(
  input: ValidatorInput
): ValidationFinding[] {
  const findings: ValidationFinding[] = [];
  const allText = [
    input.copy.headline,
    input.copy.intro,
    ...input.copy.bodyParagraphs,
  ].join('\n');

  // 1) Aid Rule
  if (AI_AS_ACTOR_REGEX.test(allText)) {
    const match = allText.match(AI_AS_ACTOR_REGEX);
    findings.push({
      rule: 'aid-rule',
      severity: 'block',
      message: `copy frames AI as the actor (matched '${match?.[0]}'). Aid Rule: human is the actor, AI is the tool.`,
    });
  }

  // 2) Category claim without VG-state
  if (CATEGORY_CLAIM_REGEX.test(allText)) {
    const match = allText.match(CATEGORY_CLAIM_REGEX);
    if (input.verificationGateState !== 'verified') {
      findings.push({
        rule: 'category-claim',
        severity: 'block',
        message: `copy uses category claim '${match?.[0]}' without verificationGateState='verified'`,
      });
    } else {
      findings.push({
        rule: 'category-claim',
        severity: 'warn',
        message: `copy uses category claim '${match?.[0]}' — VG-state verified, but double-check the data binding before publish`,
      });
    }
  }

  // 3) Schema-vs-content match
  const expectedLabel = SERVICE_CATEGORY_LABEL[input.serviceCategory];
  // Match the noun ('water damage', 'fire damage', 'mould') — the suffix
  // ('restoration', 'remediation') is editorial.
  const noun = expectedLabel.split(' ')[0];
  if (!new RegExp(`\\b${noun}\\b`, 'i').test(allText)) {
    findings.push({
      rule: 'schema-content-match',
      severity: 'block',
      message: `copy does not mention '${noun}' but JSON-LD declares serviceType='${expectedLabel}' (Q3.2.3 A4)`,
    });
  }

  // 4) PII leak — phone, street address, forbidden substrings
  if (PHONE_REGEX.test(allText)) {
    findings.push({
      rule: 'pii-phone-leak',
      severity: 'block',
      message:
        'copy contains a phone-number-shaped string. The page must reference brand telephone via JSON-LD only, not inline copy.',
    });
  }
  if (STREET_ADDRESS_REGEX.test(allText)) {
    findings.push({
      rule: 'pii-address-leak',
      severity: 'block',
      message:
        'copy contains a street-address-shaped string. Per Q3.2.5 P10, contractor street addresses must never appear in generated copy.',
    });
  }
  if (input.forbiddenPiiSubstrings) {
    for (const s of input.forbiddenPiiSubstrings) {
      if (s && allText.includes(s)) {
        findings.push({
          rule: 'pii-substring-leak',
          severity: 'block',
          message: `copy contains forbidden substring '${s}'`,
        });
      }
    }
  }

  return findings;
}
