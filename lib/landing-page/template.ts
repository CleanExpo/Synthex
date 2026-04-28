/**
 * Deterministic copy template for DR per-suburb landing pages.
 *
 * No AI here — the foundation ships a brand-voice-safe template that
 * the gating validators can verify deterministically. A future ticket
 * will plug AI-generated variants into the `copyOverride` slot
 * exposed by `BuildLandingPageOptions`, with the same validators
 * applied.
 *
 * Aid Rule binding: the human restorer is always the actor; AI is a
 * tool. Copy uses third-person ("Disaster Recovery technicians") not
 * "AI restores".
 *
 * @see SYN-838 (parent: SYN-834 epic)
 */

import { SERVICE_CATEGORY_LABEL, type DrServiceCategory } from './types';

interface TemplateInput {
  brandName: string;
  serviceCategory: DrServiceCategory;
  suburb: string;
  postcode: string;
}

export function buildDeterministicCopy(input: TemplateInput): {
  headline: string;
  intro: string;
  bodyParagraphs: string[];
} {
  const { brandName, serviceCategory, suburb, postcode } = input;
  const serviceLabel = SERVICE_CATEGORY_LABEL[serviceCategory];

  const headline = `${capitalise(serviceLabel)} in ${suburb} (${postcode})`;

  const intro =
    `${brandName} provides ${serviceLabel} across ${suburb} ${postcode}. ` +
    'IICRC-aligned technicians respond to local jobs and document each step ' +
    'against the IICRC S500 / S520 reference standard.';

  const bodyParagraphs = [
    `Technicians attending ${suburb} jobs follow the IICRC S500 reference ` +
      `standard for ${serviceLabel}: assessment, documented moisture readings, ` +
      'controlled drying, and a final clearance report. Each job is logged ' +
      'against a source-of-truth identifier so the reporting trail can be ' +
      'reconstructed if a claim is disputed.',
    `${suburb} sits within the contractor service-area coverage for this ` +
      'category. Coverage is verified weekly against the SYN-834 service-area ' +
      'ledger before any new work is scheduled.',
    `If you are unsure whether ${suburb} ${postcode} is currently covered, ` +
      `phone ${brandName} on the number listed on this page. The technician ` +
      'who attends will confirm coverage on arrival; coverage gaps are ' +
      'declined upfront so there is no surprise on-site.',
  ];

  return { headline, intro, bodyParagraphs };
}

function capitalise(s: string): string {
  return s.length === 0 ? s : s[0].toUpperCase() + s.slice(1);
}
