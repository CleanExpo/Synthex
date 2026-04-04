/**
 * LocalBusinessSchema
 *
 * Injects a Schema.org LocalBusiness JSON-LD block into the page <head>.
 * Built for the Synthex Authority Hub (SYN-512).
 *
 * Outputs all required Google-recommended fields:
 *   name, url, telephone, address (PostalAddress), image,
 *   description, openingHoursSpecification
 *
 * SECURITY NOTE: dangerouslySetInnerHTML is safe here because:
 *   1. Content is JSON.stringify() of a server-constructed plain object.
 *   2. JSON.stringify() output cannot contain unescaped HTML.
 *   3. No user-supplied string is inserted without sanitisation — all
 *      values come from the Prisma DB query result.
 *   This is the standard Next.js pattern for JSON-LD (see Next.js docs).
 *
 * @task SYN-512
 */

import type {
  ClientProfile,
  GBPAddress,
  GBPHours,
  GBPHourPeriod,
} from '@/lib/clients/getClientBySlug';

// ── Day-of-week mapping (GBP → Schema.org) ────────────────────────────────────

const SCHEMA_ORG_DAY: Record<string, string> = {
  MONDAY: 'https://schema.org/Monday',
  TUESDAY: 'https://schema.org/Tuesday',
  WEDNESDAY: 'https://schema.org/Wednesday',
  THURSDAY: 'https://schema.org/Thursday',
  FRIDAY: 'https://schema.org/Friday',
  SATURDAY: 'https://schema.org/Saturday',
  SUNDAY: 'https://schema.org/Sunday',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildPostalAddress(
  address: GBPAddress | null
): Record<string, string> | undefined {
  if (!address) return undefined;
  const result: Record<string, string> = { '@type': 'PostalAddress' };
  const street = address.addressLines?.join(', ');
  if (street) result.streetAddress = street;
  if (address.locality) result.addressLocality = address.locality;
  if (address.region) result.addressRegion = address.region;
  if (address.postalCode) result.postalCode = address.postalCode;
  result.addressCountry = address.country ?? 'AU';
  return result;
}

function buildOpeningHours(hours: GBPHours | null): Record<string, string>[] {
  const periods = hours?.regularHours?.periods;
  if (!periods?.length) return [];
  return periods.map((p: GBPHourPeriod) => ({
    '@type': 'OpeningHoursSpecification',
    dayOfWeek: SCHEMA_ORG_DAY[p.openDay] ?? p.openDay,
    opens: p.openTime,
    closes: p.closeTime,
  }));
}

// ── Component ─────────────────────────────────────────────────────────────────

interface LocalBusinessSchemaProps {
  client: ClientProfile;
}

export function LocalBusinessSchema({ client }: LocalBusinessSchemaProps) {
  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: client.businessName,
    sameAs: [`https://synthex.social/clients/${client.slug}`],
  };

  if (client.website) schema.url = client.website;
  if (client.phone) schema.telephone = client.phone;
  if (client.logo) schema.image = client.logo;
  if (client.description) schema.description = client.description;
  if (client.industry) schema.knowsAbout = client.industry;

  const postalAddress = buildPostalAddress(client.address);
  if (postalAddress) schema.address = postalAddress;

  const openingHours = buildOpeningHours(client.hours);
  if (openingHours.length > 0) schema.openingHoursSpecification = openingHours;

  // Safe — content is JSON.stringify of a server-built plain object.
  // JSON output cannot contain unescaped HTML or executable script.
  // This is the standard Next.js pattern for JSON-LD injection.
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
