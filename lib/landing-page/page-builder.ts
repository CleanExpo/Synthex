/**
 * Per-suburb landing-page builder — main API for SYN-838 foundation.
 *
 *   buildLandingPage(input, opts?) → { slug, canonicalUrl, html, jsonLd, validations, ok }
 *
 * Pure function. No file I/O, no AI, no cross-repo deploy. The output
 * is everything the caller needs to:
 *   1. Inspect `validations` — reject the page if `ok===false`
 *   2. Write `html` + `JSON.stringify(jsonLd)` to a Next.js page
 *   3. Pipe the audit trail through the source-of-truth job ID
 *
 * @see SYN-838 (parent: SYN-834 epic)
 * @see lib/landing-page/README.md
 */

import { logger } from '@/lib/logger';
import { slugifySuburb } from '@/lib/sitemap';
import { buildLandingPageJsonLd } from './jsonld-builder';
import { buildDeterministicCopy } from './template';
import { validateLandingPageCopy } from './validators';
import {
  DR_SERVICE_CATEGORIES,
  type BuildLandingPageInput,
  type BuildLandingPageOptions,
  type BuildLandingPageResult,
} from './types';

const DEFAULT_BASE_URL = 'https://disasterrecovery.com.au';

export function buildLandingPage(
  input: BuildLandingPageInput,
  opts: BuildLandingPageOptions = {}
): BuildLandingPageResult {
  validateInput(input);

  const baseUrl = (opts.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '');
  const suburbSlug = slugifySuburb(input.suburb);
  const slug = `${input.serviceCategory}/${suburbSlug}`;
  const canonicalUrl = `${baseUrl}/${slug}/`;

  // Copy: deterministic by default, caller can override (future AI hook).
  const copy =
    opts.copyOverride ??
    buildDeterministicCopy({
      brandName: input.brand.name,
      serviceCategory: input.serviceCategory,
      suburb: input.suburb,
      postcode: input.postcode,
    });

  // Validators
  const validations = validateLandingPageCopy({
    copy,
    serviceCategory: input.serviceCategory,
  });
  const ok = validations.every(v => v.severity !== 'block');

  // JSON-LD
  const jsonLd = buildLandingPageJsonLd({
    brand: input.brand,
    serviceCategory: input.serviceCategory,
    suburb: input.suburb,
    postcode: input.postcode,
    canonicalUrl,
  });

  // HTML body
  const html = renderHtml({
    headline: copy.headline,
    intro: copy.intro,
    bodyParagraphs: copy.bodyParagraphs,
    sourceOfTruthJobId: input.sourceOfTruthJobId,
  });

  if (!ok) {
    logger.warn('[landing-page] validation failed — caller MUST reject', {
      sourceOfTruthJobId: input.sourceOfTruthJobId,
      slug,
      blockCount: validations.filter(v => v.severity === 'block').length,
    });
  }

  return {
    slug,
    canonicalUrl,
    html,
    jsonLd,
    validations,
    ok,
  };
}

function validateInput(input: BuildLandingPageInput): void {
  if (!input || typeof input !== 'object') {
    throw new Error('buildLandingPage: input required');
  }
  if (!input.sourceOfTruthJobId) {
    throw new Error(
      'buildLandingPage: sourceOfTruthJobId required (Q3.2.4 H8)'
    );
  }
  if (!input.serviceAreaCoverageId) {
    throw new Error('buildLandingPage: serviceAreaCoverageId required');
  }
  if (!input.suburb) {
    throw new Error('buildLandingPage: suburb required');
  }
  if (!input.postcode) {
    throw new Error('buildLandingPage: postcode required');
  }
  if (!DR_SERVICE_CATEGORIES.includes(input.serviceCategory)) {
    throw new Error(
      `buildLandingPage: serviceCategory must be water-damage, fire, or mould (got '${input.serviceCategory}')`
    );
  }
  if (!input.brand?.name || !input.brand?.url) {
    throw new Error('buildLandingPage: brand.name and brand.url required');
  }
}

function renderHtml(args: {
  headline: string;
  intro: string;
  bodyParagraphs: string[];
  sourceOfTruthJobId: string;
}): string {
  const escape = (s: string) =>
    s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const paragraphs = args.bodyParagraphs
    .map(p => `  <p>${escape(p)}</p>`)
    .join('\n');

  return [
    `<!-- source-of-truth-job-id: ${escape(args.sourceOfTruthJobId)} -->`,
    `<article class="landing-page">`,
    `  <h1>${escape(args.headline)}</h1>`,
    `  <p class="intro">${escape(args.intro)}</p>`,
    paragraphs,
    `</article>`,
  ].join('\n');
}
