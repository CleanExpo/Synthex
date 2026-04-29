/**
 * NRPG → DR pipeline integration handler — the final wiring.
 *
 * Subscribes to ContractorOnboardedEvent and fans out to:
 *   1. lib/postcode      — resolve suburbs within radius
 *   2. lib/budget        — commit $55/mo per suburb (gates everything)
 *   3. lib/gbp           — PATCH DR's GBP service-area
 *   4. lib/bing-places   — PUT DR's Bing Places service-area
 *   5. lib/landing-page  — build per-(service × suburb) pages
 *   6. lib/sitemap       — regen + ping Google/Bing
 *
 * Per-stage error isolation: a GBP API failure does NOT stop Bing,
 * the budget commits stick, the page generation runs.
 *
 * Single-process, single-shot. For multi-instance fan-out, replace
 * the in-process subscribe with Postgres LISTEN/NOTIFY.
 *
 * @see SYN-834 (epic — final integration)
 * @see lib/nrpg-pipeline/README.md
 */

import { logger } from '@/lib/logger';
import type { ContractorOnboardedEvent } from '@/lib/contractor';
import { resolveSuburbsWithinRadius } from '@/lib/postcode';
import { commitLocation, type LedgerEntry } from '@/lib/budget';
import { updateGbpServiceArea } from '@/lib/gbp';
import { updateBingServiceArea } from '@/lib/bing-places';
import {
  buildLandingPage,
  type BuildLandingPageResult,
  type DrServiceCategory,
} from '@/lib/landing-page';
import {
  pingAllSearchEngines,
  regenerateSitemapForLocations,
  type LocationOpenedEvent,
} from '@/lib/sitemap';
import { mapNrpgServiceCategories } from './service-category-map';
import type {
  NrpgPipelineHandler,
  NrpgPipelineOptions,
  NrpgPipelineResult,
  StageOutcome,
} from './types';

/**
 * Build a handler bound to the supplied options. Returns a callable
 * that takes the event and runs the full pipeline once.
 */
export function createNrpgPipelineHandler(
  opts: NrpgPipelineOptions
): NrpgPipelineHandler {
  return async (
    event: ContractorOnboardedEvent
  ): Promise<NrpgPipelineResult> => {
    const startedAt = new Date().toISOString();

    // Gate 1: brand
    if (event.brand !== 'NRPG') {
      return finish({
        sourceOfTruthJobId: event.sourceOfTruthJobId,
        contractorId: event.contractorId,
        accepted: false,
        reason: `brand '${event.brand}' is not handled by this pipeline (NRPG only)`,
        startedAt,
      });
    }
    // Gate 2: consent
    if (event.consentForServiceAreaListing !== true) {
      return finish({
        sourceOfTruthJobId: event.sourceOfTruthJobId,
        contractorId: event.contractorId,
        accepted: false,
        reason: 'consentForServiceAreaListing not granted',
        startedAt,
      });
    }

    const drCategories = mapNrpgServiceCategories(event.serviceCategories);
    if (drCategories.length === 0) {
      return finish({
        sourceOfTruthJobId: event.sourceOfTruthJobId,
        contractorId: event.contractorId,
        accepted: false,
        reason: 'no DR-mapped service categories in event',
        startedAt,
      });
    }

    // Stage 1: postcode resolve
    const postcodeStage = await runStage(async () => {
      const suburbs = await resolveSuburbsWithinRadius(
        { lat: event.baseLocation.lat, lng: event.baseLocation.lng },
        event.radiusKm,
        opts.postcodeResolveOptions
      );
      return { suburbs, suburbCount: suburbs.length };
    });

    if (!postcodeStage.ok || !postcodeStage.result) {
      return finish({
        sourceOfTruthJobId: event.sourceOfTruthJobId,
        contractorId: event.contractorId,
        accepted: true,
        reason: `postcode resolver failed: ${postcodeStage.error ?? 'unknown'}`,
        startedAt,
        postcodeResolve: stripSuburbs(postcodeStage),
      });
    }

    const suburbs = postcodeStage.result.suburbs;
    const distanceMap: Record<string, number> = Object.fromEntries(
      suburbs.map(s => [s.suburb, s.distanceFromBaseKm])
    );

    // Stage 2: budget commits — synthesises a coverage ID per suburb so
    // ledger commits stay idempotent (sourceOfTruthJobId + suburb).
    const budgetStage = await runStage(async () => {
      const committed: LedgerEntry[] = [];
      const refused: Array<{ suburb: string; reason: string }> = [];
      for (const s of suburbs) {
        const coverageId = synthCoverageId(event.sourceOfTruthJobId, s.suburb);
        try {
          const r = await commitLocation({
            serviceAreaCoverageId: coverageId,
            sourceOfTruthJobId: event.sourceOfTruthJobId,
            contractorId: event.contractorId,
            postcode: s.postcode,
            suburb: s.suburb,
          });
          if (r.committed && r.entry) committed.push(r.entry);
          else refused.push({ suburb: s.suburb, reason: r.reason ?? '?' });
        } catch (err) {
          refused.push({ suburb: s.suburb, reason: errMsg(err) });
        }
      }
      return { committed, refused };
    });

    // Anything past here only acts on suburbs that the budget committed.
    const committedSuburbs = (budgetStage.result?.committed ?? []).map(c => ({
      suburb: c.suburb,
      postcode: c.postcode,
      coverageId: c.serviceAreaCoverageId,
    }));

    // Stages 3 & 4: GBP + Bing — independent, fan-out in parallel.
    const [gbpStage, bingStage] = await Promise.all([
      runStage(async () => {
        const r = await updateGbpServiceArea(
          {
            locationId: opts.gbpLocationId,
            sourceOfTruthJobId: event.sourceOfTruthJobId,
            contractorId: event.contractorId,
            consentGranted: true,
            newPlaces: committedSuburbs.map(s => ({
              placeName: s.suburb,
              postcode: s.postcode,
            })),
            contractorBaseDistanceKmByPlace: distanceMap,
          },
          { client: opts.gbpClient, audit: opts.gbpAudit }
        );
        return {
          added: r.added.length,
          skipped: r.skipped.length,
          dropped: r.droppedFarFromBase.length,
        };
      }),
      runStage(async () => {
        const r = await updateBingServiceArea(
          {
            storeId: opts.bingStoreId,
            sourceOfTruthJobId: event.sourceOfTruthJobId,
            contractorId: event.contractorId,
            consentGranted: true,
            newLocalities: committedSuburbs.map(s => ({
              name: s.suburb,
              postcode: s.postcode,
            })),
            contractorBaseDistanceKmByLocality: distanceMap,
          },
          { client: opts.bingClient, audit: opts.bingAudit }
        );
        return {
          added: r.added.length,
          skipped: r.skipped.length,
          dropped: r.droppedFarFromBase.length,
        };
      }),
    ]);

    // Stage 5: landing pages — one per (drCategory × committed suburb).
    const landingStage = await runStage(async () => {
      const pages: BuildLandingPageResult[] = [];
      const rejected: BuildLandingPageResult[] = [];
      for (const cat of drCategories) {
        for (const s of committedSuburbs) {
          const page = buildLandingPage({
            sourceOfTruthJobId: event.sourceOfTruthJobId,
            serviceAreaCoverageId: s.coverageId,
            suburb: s.suburb,
            postcode: s.postcode,
            serviceCategory: cat,
            brand: opts.brand,
          });
          if (!page.ok) {
            rejected.push(page);
            continue;
          }
          if (opts.saveLandingPage) {
            try {
              await opts.saveLandingPage(page);
            } catch (err) {
              logger.warn('[nrpg-pipeline] saveLandingPage failed', {
                sourceOfTruthJobId: event.sourceOfTruthJobId,
                slug: page.slug,
                reason: errMsg(err),
              });
              rejected.push(page);
              continue;
            }
          }
          pages.push(page);
        }
      }
      return { pages, rejected };
    });

    // Stage 6: sitemap regen + ping. Only consumes pages that landed.
    const sitemapStage = await runStage(async () => {
      const currentXml = await opts.loadCurrentSitemapXml();
      const sitemapEvents: LocationOpenedEvent[] = (
        landingStage.result?.pages ?? []
      ).map(page => ({
        sourceOfTruthJobId: event.sourceOfTruthJobId,
        serviceAreaCoverageId: extractCoverageIdFromSlug(
          page.slug,
          committedSuburbs
        ),
        suburb: extractSuburbFromSlug(page.slug, committedSuburbs),
        postcode: extractPostcodeFromSlug(page.slug, committedSuburbs),
        serviceCategory: page.slug.split('/')[0] as DrServiceCategory,
        openedAt: new Date().toISOString(),
      }));
      const regen = regenerateSitemapForLocations(currentXml, sitemapEvents);
      if (opts.saveSitemapXml && regen.added.length > 0) {
        await opts.saveSitemapXml(regen.xml);
      }
      const pings =
        opts.skipPing || regen.added.length === 0
          ? []
          : await pingAllSearchEngines(
              `${opts.brand.url.replace(/\/+$/, '')}/sitemap.xml`,
              { fetchImpl: opts.pingFetch }
            );
      return { regen, pings };
    });

    return finish({
      sourceOfTruthJobId: event.sourceOfTruthJobId,
      contractorId: event.contractorId,
      accepted: true,
      startedAt,
      postcodeResolve: stripSuburbs(postcodeStage),
      budgetCommits: budgetStage,
      gbp: gbpStage,
      bingPlaces: bingStage,
      landingPages: landingStage,
      sitemap: sitemapStage,
    });
  };
}

// ─── HELPERS ─────────────────────────────────────────────────────────────

async function runStage<T>(fn: () => Promise<T>): Promise<StageOutcome<T>> {
  const start = Date.now();
  try {
    const result = await fn();
    return { ok: true, result, durationMs: Date.now() - start };
  } catch (err) {
    return {
      ok: false,
      error: errMsg(err),
      durationMs: Date.now() - start,
    };
  }
}

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function finish(
  partial: Omit<NrpgPipelineResult, 'finishedAt'>
): NrpgPipelineResult {
  return { ...partial, finishedAt: new Date().toISOString() };
}

function stripSuburbs(
  stage: StageOutcome<{ suburbs?: unknown; suburbCount: number }>
): StageOutcome<{ suburbCount: number }> {
  if (!stage.result) {
    return {
      ok: stage.ok,
      error: stage.error,
      durationMs: stage.durationMs,
    };
  }
  return {
    ok: stage.ok,
    result: { suburbCount: stage.result.suburbCount },
    durationMs: stage.durationMs,
  };
}

/**
 * Synthesise a deterministic coverage ID from (sourceOfTruthJobId,
 * suburb). Idempotent — re-running the same event produces the same
 * IDs, so the budget ledger's idempotency does the de-dupe.
 */
function synthCoverageId(jobId: string, suburb: string): string {
  return `cov_${jobId}__${suburb.toLowerCase().replace(/\s+/g, '-')}`;
}

function extractSuburbFromSlug(
  slug: string,
  committed: ReadonlyArray<{
    suburb: string;
    postcode: string;
    coverageId: string;
  }>
): string {
  const suburbSlug = slug.split('/')[1] ?? '';
  return (
    committed.find(
      c => c.suburb.toLowerCase().replace(/\s+/g, '-') === suburbSlug
    )?.suburb ?? suburbSlug
  );
}

function extractPostcodeFromSlug(
  slug: string,
  committed: ReadonlyArray<{
    suburb: string;
    postcode: string;
    coverageId: string;
  }>
): string {
  const suburbSlug = slug.split('/')[1] ?? '';
  return (
    committed.find(
      c => c.suburb.toLowerCase().replace(/\s+/g, '-') === suburbSlug
    )?.postcode ?? ''
  );
}

function extractCoverageIdFromSlug(
  slug: string,
  committed: ReadonlyArray<{
    suburb: string;
    postcode: string;
    coverageId: string;
  }>
): string {
  const suburbSlug = slug.split('/')[1] ?? '';
  return (
    committed.find(
      c => c.suburb.toLowerCase().replace(/\s+/g, '-') === suburbSlug
    )?.coverageId ?? ''
  );
}
