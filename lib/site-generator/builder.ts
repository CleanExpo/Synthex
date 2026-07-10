/**
 * Multi-tenant site generator — main API.
 *
 *   generateSite(input, opts?) → { slug, canonicalUrl, copy, html, jsonLd, validations, ok }
 *
 * Pure function. No file I/O, no network, no AI. The output is everything a
 * caller needs to: inspect `validations` (reject if `ok===false`), write
 * `html` + `JSON.stringify(jsonLd)` into a Next.js page, and embed the agent
 * widget alongside it. GBP fetch, LLM copy, and deploy compose ON TOP of this.
 */

import { buildSiteJsonLd } from './jsonld';
import { buildDeterministicCopy } from './template';
import { validateSiteCopy } from './validators';
import type {
  BusinessService,
  GenerateSiteInput,
  GenerateSiteOptions,
  GenerateSiteResult,
  SiteCopy,
} from './types';

export function generateSite(
  input: GenerateSiteInput,
  opts: GenerateSiteOptions = {}
): GenerateSiteResult {
  const { brand, profile } = input;

  if (!profile.services || profile.services.length === 0) {
    throw new Error(
      'generateSite: profile.services must contain at least one service'
    );
  }

  const heroService = resolveHeroService(input);
  const baseUrl = (opts.baseUrl ?? profile.url).replace(/\/+$/, '');
  const canonicalUrl = `${baseUrl}/${heroService.slug}/`;

  const copy =
    opts.copyOverride ?? buildDeterministicCopy(profile, heroService);

  const validations = validateSiteCopy({
    copy,
    heroService,
    brand,
    verificationGateState: opts.verificationGateState,
  });
  const ok = validations.every(v => v.severity !== 'block');

  const jsonLd = buildSiteJsonLd({
    brand,
    profile,
    heroService,
    canonicalUrl,
    copy,
  });
  const html = renderHtml(copy, canonicalUrl);

  return {
    slug: heroService.slug,
    canonicalUrl,
    copy,
    html,
    jsonLd,
    validations,
    ok,
  };
}

function resolveHeroService(input: GenerateSiteInput): BusinessService {
  const { profile, serviceSlug } = input;
  if (serviceSlug) {
    const found = profile.services.find(s => s.slug === serviceSlug);
    if (!found) {
      throw new Error(
        `generateSite: serviceSlug '${serviceSlug}' not found in profile.services`
      );
    }
    return found;
  }
  return profile.services[0];
}

/** Minimal, semantic body HTML — the Next.js page supplies <html>/<head> + the agent widget. */
function renderHtml(copy: SiteCopy, canonicalUrl: string): string {
  const paras = copy.bodyParagraphs.map(p => `    <p>${esc(p)}</p>`).join('\n');
  const faqItems = copy.faqs
    .map(
      f =>
        `      <details>\n        <summary>${esc(f.question)}</summary>\n        <p>${esc(f.answer)}</p>\n      </details>`
    )
    .join('\n');

  return [
    `<article data-canonical="${esc(canonicalUrl)}">`,
    `  <header>`,
    `    <h1>${esc(copy.headline)}</h1>`,
    `    <p class="intro">${esc(copy.intro)}</p>`,
    `  </header>`,
    `  <section class="body">`,
    paras,
    `  </section>`,
    copy.faqs.length > 0
      ? `  <section class="faq" aria-label="Frequently asked questions">\n${faqItems}\n  </section>`
      : '',
    `</article>`,
  ]
    .filter(Boolean)
    .join('\n');
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
