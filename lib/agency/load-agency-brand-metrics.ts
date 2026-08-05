/**
 * Load org-scoped brand canary metrics for Tier-1 snapshots (AT-005).
 *
 * GA4 is not wired yet. Proxies use the Lead table (enquiry → qualified →
 * converted) on portfolio brand organisations. Counts are real and null-safe:
 * missing brand orgs stay null; zero leads yield verified zeros / null rates.
 */

import prisma from '@/lib/prisma';
import {
  CCW_CARVE_OUT_SLUG,
  UNITE_WORKSPACE_SLUG,
} from '@/lib/agency/portfolio-brand-configs';

export type Tier1BrandKey = 'dr' | 'nrpg' | 'carsi' | 'ccw';

export interface AgencyBrandMetrics {
  dr: {
    d3Events: number | null;
    qualificationRate: number | null;
  };
  nrpg: {
    n2Applications: number | null;
    n3Acceptance: number | null;
  };
  carsi: {
    snapshotCompletion: number | null;
    firmActivations: number | null;
  };
  ccw: {
    /** No cart-add event source in-product yet — stays null until GA4/commerce lands. */
    hubToCart: number | null;
  };
}

const EMPTY: AgencyBrandMetrics = {
  dr: { d3Events: null, qualificationRate: null },
  nrpg: { n2Applications: null, n3Acceptance: null },
  carsi: { snapshotCompletion: null, firmActivations: null },
  ccw: { hubToCart: null },
};

const SLUG_TO_BRAND: Readonly<Record<string, Tier1BrandKey>> = {
  'disaster-recovery': 'dr',
  nrpg: 'nrpg',
  carsi: 'carsi',
  [CCW_CARVE_OUT_SLUG]: 'ccw',
};

type LeadRow = {
  stage: string;
  contactMethod: string;
};

function weekWindow(weekEnding: Date): { start: Date; end: Date } {
  const end = new Date(weekEnding);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 7);
  return { start, end };
}

function rate(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return Math.round((numerator / denominator) * 100);
}

function isQualified(stage: string): boolean {
  return stage === 'qualified' || stage === 'converted';
}

function isD3Contact(method: string): boolean {
  return method === 'form_submission' || method === 'phone_call';
}

/**
 * Resolve portfolio brand org ids for the reporting org.
 * Workspace (unite-group or any parent with children) → child brand orgs.
 * Brand org itself → only that brand slot.
 */
export async function resolveTier1BrandOrgIds(
  organizationId: string
): Promise<Partial<Record<Tier1BrandKey, string>>> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
      id: true,
      slug: true,
      children: { select: { id: true, slug: true } },
    },
  });

  if (!org) return {};

  const map: Partial<Record<Tier1BrandKey, string>> = {};

  if (org.slug === UNITE_WORKSPACE_SLUG || org.children.length > 0) {
    for (const child of org.children) {
      const brand = SLUG_TO_BRAND[child.slug];
      if (brand) map[brand] = child.id;
    }
    return map;
  }

  const selfBrand = SLUG_TO_BRAND[org.slug];
  if (selfBrand) map[selfBrand] = org.id;
  return map;
}

function summarizeDr(leads: LeadRow[]): AgencyBrandMetrics['dr'] {
  const d3Events = leads.filter(
    l => isQualified(l.stage) && isD3Contact(l.contactMethod)
  ).length;
  return {
    d3Events,
    qualificationRate: rate(d3Events, leads.length),
  };
}

function summarizeNrpg(leads: LeadRow[]): AgencyBrandMetrics['nrpg'] {
  const n2Applications = leads.length;
  const n3 = leads.filter(l => isQualified(l.stage)).length;
  return {
    n2Applications,
    n3Acceptance: rate(n3, n2Applications),
  };
}

function summarizeCarsi(leads: LeadRow[]): AgencyBrandMetrics['carsi'] {
  const progressed = leads.filter(l => isQualified(l.stage)).length;
  const firmActivations = leads.filter(l => l.stage === 'converted').length;
  return {
    snapshotCompletion: rate(progressed, leads.length),
    firmActivations,
  };
}

async function loadLeadsForOrg(
  organizationId: string,
  start: Date,
  end: Date
): Promise<LeadRow[]> {
  return prisma.lead.findMany({
    where: {
      organizationId,
      occurredAt: { gte: start, lte: end },
    },
    select: { stage: true, contactMethod: true },
  });
}

/**
 * Build brand canary metrics from Lead rows for portfolio brand orgs.
 * Pure counts → 'verified' in the snapshot builder; absent orgs stay null.
 */
export async function loadAgencyBrandMetrics(
  organizationId: string,
  weekEnding: Date = new Date()
): Promise<AgencyBrandMetrics> {
  const { start, end } = weekWindow(weekEnding);
  const brandOrgs = await resolveTier1BrandOrgIds(organizationId);
  const out: AgencyBrandMetrics = {
    dr: { ...EMPTY.dr },
    nrpg: { ...EMPTY.nrpg },
    carsi: { ...EMPTY.carsi },
    ccw: { ...EMPTY.ccw },
  };

  if (brandOrgs.dr) {
    out.dr = summarizeDr(await loadLeadsForOrg(brandOrgs.dr, start, end));
  }
  if (brandOrgs.nrpg) {
    out.nrpg = summarizeNrpg(await loadLeadsForOrg(brandOrgs.nrpg, start, end));
  }
  if (brandOrgs.carsi) {
    out.carsi = summarizeCarsi(
      await loadLeadsForOrg(brandOrgs.carsi, start, end)
    );
  }
  // ccw.hubToCart: no in-product cart-add source — leave null.

  return out;
}
