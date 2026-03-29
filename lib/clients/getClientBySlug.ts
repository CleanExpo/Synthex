/**
 * getClientBySlug — lib/clients/getClientBySlug.ts
 *
 * Server-only data fetch for the Authority Hub public profile pages.
 * Queries the Organisation record by slug, pulling in BrandDNA and
 * GBP location data (address, phone, hours, top reviews).
 *
 * @task SYN-512
 */

import prisma from '@/lib/prisma';

// ── Address / Hours types (GBP JSON shapes) ───────────────────────────────────

export interface GBPAddress {
  addressLines?: string[];
  locality?: string;
  region?: string;
  postalCode?: string;
  country?: string;
}

export interface GBPHourPeriod {
  openDay: string; // 'MONDAY' | 'TUESDAY' | ...
  openTime: string; // 'HH:MM'
  closeDay?: string;
  closeTime: string; // 'HH:MM'
}

export interface GBPHours {
  regularHours?: {
    periods?: GBPHourPeriod[];
  };
}

// ── Exported profile type ─────────────────────────────────────────────────────

export interface ClientReview {
  id: string;
  reviewerName: string | null;
  rating: number; // 1–5
  comment: string | null;
  reviewTime: Date;
  isFeatured: boolean;
}

export interface ClientProfile {
  // Identity
  slug: string;
  name: string; // Organisation.name
  businessName: string; // BrandDNA.businessName ?? name
  description: string | null;
  website: string | null;
  industry: string | null;
  vertical: string | null; // BrandDNA.vertical
  voiceTone: string | null; // BrandDNA.brandVoice.tone
  logo: string | null;
  primaryColor: string | null;
  // Contact (from GBPLocation or Organisation fallback)
  phone: string | null;
  address: GBPAddress | null;
  hours: GBPHours | null;
  // Social proof
  reviews: ClientReview[];
}

// ── Queries ───────────────────────────────────────────────────────────────────

/**
 * Fetch a single active client profile by slug.
 * Returns null for unknown or inactive slugs (caller should call notFound()).
 */
export async function getClientBySlug(
  slug: string
): Promise<ClientProfile | null> {
  const org = await prisma.organization.findUnique({
    where: { slug, status: 'active' },
    select: {
      slug: true,
      name: true,
      description: true,
      website: true,
      industry: true,
      phoneNumber: true,
      logo: true,
      primaryColor: true,
      brandDna: {
        select: {
          businessName: true,
          vertical: true,
          brandVoice: true,
        },
      },
      gbpLocations: {
        where: { isPrimary: true },
        take: 1,
        select: {
          address: true,
          phone: true,
          hours: true,
          reviews: {
            where: { status: 'approved', displayOnWidget: true },
            orderBy: [{ isFeatured: 'desc' }, { rating: 'desc' }],
            take: 3,
            select: {
              id: true,
              reviewerName: true,
              rating: true,
              comment: true,
              reviewTime: true,
              isFeatured: true,
            },
          },
        },
      },
    },
  });

  if (!org) return null;

  const location = org.gbpLocations[0] ?? null;
  const brandVoice = org.brandDna?.brandVoice as
    | { tone?: string }
    | null
    | undefined;

  return {
    slug: org.slug,
    name: org.name,
    businessName: org.brandDna?.businessName ?? org.name,
    description: org.description,
    website: org.website,
    industry: org.industry,
    vertical: org.brandDna?.vertical ?? null,
    voiceTone: brandVoice?.tone ?? null,
    logo: org.logo,
    primaryColor: org.primaryColor,
    phone: location?.phone ?? org.phoneNumber ?? null,
    address: (location?.address as GBPAddress | null) ?? null,
    hours: (location?.hours as GBPHours | null) ?? null,
    reviews: (location?.reviews ?? []).map(r => ({
      id: r.id,
      reviewerName: r.reviewerName,
      rating: r.rating,
      comment: r.comment,
      reviewTime: r.reviewTime,
      isFeatured: r.isFeatured,
    })),
  };
}

/**
 * Return all active org slugs for generateStaticParams at build time.
 */
export async function getAllClientSlugs(): Promise<string[]> {
  const orgs = await prisma.organization.findMany({
    where: { status: 'active' },
    select: { slug: true },
  });
  return orgs.map(o => o.slug);
}
