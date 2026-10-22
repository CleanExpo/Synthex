/**
 * Shared types for the K3 schema packs.
 *
 * Every builder returns schema.org JSON-LD plus an honest report of whether
 * that markup can earn a Google rich result today. Markup that Google no
 * longer shows (Course, FAQPage) is still emitted, because other engines and
 * answer engines read it, but it is never reported as Google-eligible.
 */

export type JsonLd = Record<string, unknown>;

export interface GoogleRichResult {
  eligible: boolean;
  /** Google-required properties absent from the input. */
  missing: string[];
  /** Why the type cannot be eligible at all, with the date Google retired it. */
  reason?: string;
}

export interface PackOutput {
  jsonLd: JsonLd;
  googleRichResult: GoogleRichResult;
}

export interface OrganizationFacts {
  name: string;
  url: string;
  legalName?: string;
  description?: string;
  logo?: string;
  email?: string;
  telephone?: string;
  sameAs?: string[];
}

export const SCHEMA_CONTEXT = 'https://schema.org';

export function trimSlash(s: string): string {
  return s.replace(/\/+$/, '');
}

export function organizationId(url: string): string {
  return `${trimSlash(url)}#organization`;
}
