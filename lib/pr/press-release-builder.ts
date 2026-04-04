/**
 * PR Journalist CRM — Press Release Builder (Phase 92)
 *
 * Generates AI-indexable press releases with schema.org JSON-LD markup.
 * Uses dual @type: ["NewsArticle", "PressRelease"] as per research pitfall #11.
 * ChatGPT/Perplexity/Google AI crawlers use PressRelease schema for citations.
 *
 * @module lib/pr/press-release-builder
 */

import type { PressReleaseInput } from './types';

// ---------------------------------------------------------------------------
// Output types
// ---------------------------------------------------------------------------

export interface PressReleaseOutput {
  body: string;
  jsonLd: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Main builder function
// ---------------------------------------------------------------------------

/**
 * Build a structured press release with JSON-LD schema markup.
 *
 * @param input - Press release input data
 * @param orgName - Publishing organisation name (for schema.org Publisher)
 * @param orgUrl - Publishing organisation URL (for schema.org Publisher)
 * @returns Formatted body text and JSON-LD structured data
 */
export function buildPressRelease(
  input: PressReleaseInput,
  orgName?: string,
  orgUrl?: string
): PressReleaseOutput {
  const body = formatBody(input);
  const jsonLd = buildJsonLd(input, orgName, orgUrl);

  return { body, jsonLd };
}

// ---------------------------------------------------------------------------
// JSON-LD generator
// ---------------------------------------------------------------------------

/**
 * Build schema.org JSON-LD for a press release.
 * Uses dual @type ["NewsArticle", "PressRelease"] for maximum AI engine coverage.
 * NewsArticle = Google rich results support
 * PressRelease = ChatGPT/Perplexity explicit citation signal
 */
function buildJsonLd(
  input: PressReleaseInput,
  orgName?: string,
  orgUrl?: string
): Record<string, unknown> {
  const authorOrg: Record<string, unknown> = {
    '@type': 'Organization',
    name: orgName ?? 'Unknown Organisation',
  };
  if (orgUrl) authorOrg['url'] = orgUrl;

  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': ['NewsArticle', 'PressRelease'],
    headline: input.headline,
    articleBody: input.body,
    author: authorOrg,
    publisher: authorOrg,
  };

  if (input.subheading) {
    schema['description'] = input.subheading;
  }

  if (input.datePublished) {
    schema['datePublished'] = new Date(input.datePublished).toISOString();
  }

  if (input.keywords && input.keywords.length > 0) {
    schema['keywords'] = input.keywords.join(', ');
  }

  if (input.location) {
    schema['locationCreated'] = {
      '@type': 'Place',
      name: input.location,
    };
    schema['dateline'] = input.location;
  }

  if (input.imageUrl) {
    schema['image'] = {
      '@type': 'ImageObject',
      url: input.imageUrl,
    };
  }

  if (input.category) {
    schema['articleSection'] = input.category;
  }

  // Contact information as contactPoint
  if (input.contactName || input.contactEmail) {
    const contactPoint: Record<string, unknown> = {
      '@type': 'ContactPoint',
      contactType: 'Press',
    };
    if (input.contactName) contactPoint['name'] = input.contactName;
    if (input.contactEmail) contactPoint['email'] = input.contactEmail;
    if (input.contactPhone) contactPoint['telephone'] = input.contactPhone;
    schema['contactPoint'] = contactPoint;
  }

  return schema;
}

// ---------------------------------------------------------------------------
// Body formatter
// ---------------------------------------------------------------------------

/**
 * Format the press release body with standard PR structure:
 * FOR IMMEDIATE RELEASE
 * Location — Date — Headline
 * Body
 * Boilerplate (About section)
 * Contact details
 * ###
 */
function formatBody(input: PressReleaseInput): string {
  const sections: string[] = [];

  // Standard PR header
  sections.push('FOR IMMEDIATE RELEASE');
  sections.push('');

  // Location + date line
  const dateline = [
    input.location ?? 'SYDNEY, AUSTRALIA',
    input.datePublished
      ? formatDate(input.datePublished)
      : formatDate(new Date().toISOString()),
  ].join(' — ');
  sections.push(dateline);
  sections.push('');

  // Headline
  sections.push(input.headline.toUpperCase());
  if (input.subheading) {
    sections.push('');
    sections.push(input.subheading);
  }
  sections.push('');

  // Body content
  sections.push(input.body);
  sections.push('');

  // About (boilerplate)
  if (input.boilerplate) {
    sections.push('###');
    sections.push('');
    sections.push('ABOUT');
    sections.push(input.boilerplate);
    sections.push('');
  }

  // Media contact
  if (input.contactName || input.contactEmail) {
    sections.push('MEDIA CONTACT');
    if (input.contactName) sections.push(input.contactName);
    if (input.contactEmail) sections.push(input.contactEmail);
    if (input.contactPhone) sections.push(input.contactPhone);
    sections.push('');
  }

  // End mark
  if (!input.boilerplate) {
    sections.push('###');
  }

  return sections.join('\n');
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(isoString: string): string {
  try {
    return new Date(isoString).toLocaleDateString('en-AU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return isoString;
  }
}

// ---------------------------------------------------------------------------
// Slug generator
// ---------------------------------------------------------------------------

/**
 * Generate a URL-safe slug from a headline.
 * Max 80 characters, kebab-case, lowercase.
 */
export function generateSlug(headline: string): string {
  return headline
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80)
    .replace(/-$/, '');
}
