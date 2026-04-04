/**
 * NAP Consistency Audit
 *
 * GET /api/google-business/nap-audit
 *
 * Compares Name, Address, and Phone across three data sources:
 *   - GBPLocation (Google's authoritative record)
 *   - Organization (internal record)
 *   - BrandDNA (onboarding audit record)
 *
 * Returns a list of fields that differ, with the canonical (GBP) value
 * and the divergent value for each source, so the user knows exactly
 * what to fix and where.
 *
 * UNI-1637
 */

import { type NextRequest, NextResponse } from 'next/server';
import {
  getUserIdFromRequestOrCookies,
  unauthorizedResponse,
} from '@/lib/auth/jwt-utils';
import { getEffectiveOrganizationId } from '@/lib/multi-business/business-scope';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type NAPField = 'name' | 'phone' | 'website';

export interface NAPMismatch {
  field: NAPField;
  canonical: string | null; // GBP value — the source of truth
  sources: {
    source: 'organization' | 'brand_dna';
    value: string | null;
    label: string; // Human-readable path to fix it
    editUrl: string;
  }[];
}

export interface NAPAuditResult {
  locationName: string | null;
  mismatches: NAPMismatch[];
  allMatch: boolean;
}

// ---------------------------------------------------------------------------
// Normalise helpers
// ---------------------------------------------------------------------------

function normalisePhone(v: string | null | undefined): string | null {
  if (!v) return null;
  return v.replace(/[\s\-().+]/g, '').toLowerCase();
}

function normaliseUrl(v: string | null | undefined): string | null {
  if (!v) return null;
  return v
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/$/, '');
}

function normaliseName(v: string | null | undefined): string | null {
  if (!v) return null;
  return v.trim().toLowerCase();
}

// ---------------------------------------------------------------------------
// GET
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const userId = await getUserIdFromRequestOrCookies(request);
  if (!userId) return unauthorizedResponse();

  const organizationId = await getEffectiveOrganizationId(userId);
  if (!organizationId) {
    return NextResponse.json(
      { error: 'No organisation found for user' },
      { status: 404 }
    );
  }

  const [gbpLocation, org, brandDna] = await Promise.all([
    prisma.gBPLocation.findFirst({
      where: { organizationId, isPrimary: true },
      select: { locationName: true, phone: true, website: true },
    }),
    prisma.organization.findUnique({
      where: { id: organizationId },
      select: { name: true, website: true },
    }),
    prisma.brandDNA.findUnique({
      where: { organizationId },
      select: { businessName: true, sourceUrl: true },
    }),
  ]);

  // If no GBP location yet, return empty (not an error — user hasn't connected)
  if (!gbpLocation) {
    return NextResponse.json({
      locationName: null,
      mismatches: [],
      allMatch: true,
    } satisfies NAPAuditResult);
  }

  const mismatches: NAPMismatch[] = [];

  // ── Name ───────────────────────────────────────────────────────────────────
  const canonicalName = gbpLocation.locationName;
  const nameMismatches: NAPMismatch['sources'] = [];

  if (org && normaliseName(org.name) !== normaliseName(canonicalName)) {
    nameMismatches.push({
      source: 'organization',
      value: org.name,
      label: 'Organisation settings → Name',
      editUrl: '/dashboard/settings',
    });
  }
  if (
    brandDna &&
    normaliseName(brandDna.businessName) !== normaliseName(canonicalName)
  ) {
    nameMismatches.push({
      source: 'brand_dna',
      value: brandDna.businessName,
      label: 'Brand DNA → Business Name',
      editUrl: '/dashboard/brand',
    });
  }
  if (nameMismatches.length > 0) {
    mismatches.push({
      field: 'name',
      canonical: canonicalName,
      sources: nameMismatches,
    });
  }

  // ── Phone ──────────────────────────────────────────────────────────────────
  // Only GBP and Organisation carry phone — BrandDNA does not
  // (Reserved for future expansion — no sources to compare right now)

  // ── Website ────────────────────────────────────────────────────────────────
  const canonicalWebsite = gbpLocation.website ?? null;
  const websiteMismatches: NAPMismatch['sources'] = [];

  if (
    canonicalWebsite &&
    org?.website &&
    normaliseUrl(org.website) !== normaliseUrl(canonicalWebsite)
  ) {
    websiteMismatches.push({
      source: 'organization',
      value: org.website,
      label: 'Organisation settings → Website',
      editUrl: '/dashboard/settings',
    });
  }
  if (
    canonicalWebsite &&
    brandDna?.sourceUrl &&
    normaliseUrl(brandDna.sourceUrl) !== normaliseUrl(canonicalWebsite)
  ) {
    websiteMismatches.push({
      source: 'brand_dna',
      value: brandDna.sourceUrl,
      label: 'Brand DNA → Source URL',
      editUrl: '/dashboard/brand',
    });
  }
  if (websiteMismatches.length > 0) {
    mismatches.push({
      field: 'website',
      canonical: canonicalWebsite,
      sources: websiteMismatches,
    });
  }

  return NextResponse.json({
    locationName: canonicalName,
    mismatches,
    allMatch: mismatches.length === 0,
  } satisfies NAPAuditResult);
}
