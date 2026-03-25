/**
 * Keyword Seeder — SYN-487
 *
 * Automatically creates KeywordTarget records for an org based on their
 * primary GBPLocation (locality + primary business category).
 *
 * Called after first GBP sync so rank tracking starts immediately without
 * requiring any manual input from the client.
 */

import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

const MAX_KEYWORD_TARGETS = 20;
const SEED_COUNT = 8; // keywords to create per org

/** Extract a clean service label from a GBP primary category display name.
 *  E.g. "Plumbing contractor" → "plumber", "Hair salon" → "hair salon"
 */
function categoryToService(displayName: string): string {
  return displayName
    .toLowerCase()
    .replace(/\bcontractor\b/g, 'er') // plumbing contractor → plumber
    .replace(/\bservice provider\b/g, 'service')
    .replace(/\bcompany\b/g, '')
    .replace(/\bbusiness\b/g, '')
    .trim()
    .replace(/\s+/g, ' ');
}

/** Build 8 localised keyword variants from a service label + suburb/state. */
function buildKeywordSet(
  service: string,
  suburb: string,
  state?: string
): string[] {
  const loc = state ? `${suburb} ${state}` : suburb;
  return [
    `${service} ${suburb}`,
    `${service} near ${suburb}`,
    `best ${service} in ${suburb}`,
    `${service} ${loc}`,
    `affordable ${service} ${suburb}`,
    `local ${service} ${suburb}`,
    `${service} services ${suburb}`,
    `${suburb} ${service}`,
  ].slice(0, SEED_COUNT);
}

interface SeedResult {
  orgId: string;
  created: number;
  skipped: number;
  reason?: string;
}

/**
 * Seed keyword targets for a single org from their primary GBP location.
 * Safe to call multiple times — uses upsert semantics (no duplicates).
 * Respects the 20-target limit.
 */
export async function seedKeywordsFromGBP(orgId: string): Promise<SeedResult> {
  const location = await prisma.gBPLocation.findFirst({
    where: { organizationId: orgId, isPrimary: true },
    select: { address: true, categories: true },
  });

  if (!location) {
    return { orgId, created: 0, skipped: 0, reason: 'no_primary_gbp_location' };
  }

  const addr = location.address as Record<string, string> | null;
  const cats = location.categories as {
    primaryCategory?: { displayName?: string };
  } | null;

  const suburb = addr?.locality?.trim();
  const state = addr?.region?.trim();
  const categoryName = cats?.primaryCategory?.displayName?.trim();

  if (!suburb || !categoryName) {
    return {
      orgId,
      created: 0,
      skipped: 0,
      reason: 'missing_suburb_or_category',
    };
  }

  const service = categoryToService(categoryName);
  const keywords = buildKeywordSet(service, suburb, state);

  // Count existing targets to respect the 20-limit
  const existingCount = await prisma.keywordTarget.count({
    where: { organizationId: orgId },
  });

  const slotsAvailable = Math.max(0, MAX_KEYWORD_TARGETS - existingCount);
  const toCreate = keywords.slice(0, slotsAvailable);

  if (toCreate.length === 0) {
    return {
      orgId,
      created: 0,
      skipped: keywords.length,
      reason: 'limit_reached',
    };
  }

  let created = 0;
  let skipped = 0;

  for (const keyword of toCreate) {
    try {
      await prisma.keywordTarget.create({
        data: {
          organizationId: orgId,
          keyword,
          location: state ? `${suburb}, ${state}` : suburb,
          autoSeeded: true,
        },
      });
      created++;
    } catch {
      // Unique constraint violation = already exists
      skipped++;
    }
  }

  logger.info('keyword-seeder:seeded', {
    orgId,
    created,
    skipped,
    suburb,
    service,
  });
  return { orgId, created, skipped };
}

/**
 * Seed keyword targets for all orgs that have a primary GBP location
 * but zero keyword targets. Used by cron and admin tooling.
 */
export async function seedAllOrgsWithoutKeywords(): Promise<SeedResult[]> {
  // Find orgs with at least one GBP location but no keyword targets
  const orgsWithGBP = await prisma.gBPLocation.findMany({
    where: { isPrimary: true },
    select: { organizationId: true },
    distinct: ['organizationId'],
  });

  const orgIds = orgsWithGBP.map(l => l.organizationId);

  const orgsWithTargets = await prisma.keywordTarget.findMany({
    where: { organizationId: { in: orgIds } },
    select: { organizationId: true },
    distinct: ['organizationId'],
  });

  const orgsWithTargetSet = new Set(orgsWithTargets.map(t => t.organizationId));
  const unseeded = orgIds.filter(id => !orgsWithTargetSet.has(id));

  const results: SeedResult[] = [];
  for (const orgId of unseeded) {
    results.push(await seedKeywordsFromGBP(orgId));
  }

  return results;
}
