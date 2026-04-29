/**
 * NRPG → DR pipeline integration handler types.
 *
 * Stitches the 9 SYN-834 children into a single subscriber on
 * ContractorOnboardedEvent. Each stage is isolated — a GBP API
 * failure does NOT stop Bing, budget commits, page generation, or
 * sitemap regen.
 *
 * @see SYN-834 (epic — final integration)
 * @see lib/nrpg-pipeline/README.md
 */

import type { ContractorOnboardedEvent } from '@/lib/contractor';
import type { LedgerEntry } from '@/lib/budget';
import type { GbpApiClient, GbpAuditSink } from '@/lib/gbp';
import type {
  BingPlacesApiClient,
  BingPlacesAuditSink,
} from '@/lib/bing-places';
import type { BrandIdentity, BuildLandingPageResult } from '@/lib/landing-page';
import type { PingResult, SitemapRegenResult } from '@/lib/sitemap';
import type { ResolveOptions } from '@/lib/postcode';

/**
 * Per-stage outcome — captured even when the stage fails so the
 * caller can audit / retry.
 */
export interface StageOutcome<T> {
  ok: boolean;
  result?: T;
  error?: string;
  /** Milliseconds the stage took (best-effort). */
  durationMs: number;
}

/**
 * Aggregate result of one pipeline run.
 */
export interface NrpgPipelineResult {
  sourceOfTruthJobId: string;
  contractorId: string;
  /** True iff the event was accepted (consent + brand) and routed to stages. */
  accepted: boolean;
  /** Reason for refusal — present iff accepted=false. */
  reason?: string;
  /** ISO timestamp when the handler started. */
  startedAt: string;
  /** ISO timestamp when the handler finished (all stages settled). */
  finishedAt: string;

  // Per-stage outcomes (only populated when accepted=true)
  postcodeResolve?: StageOutcome<{ suburbCount: number }>;
  budgetCommits?: StageOutcome<{
    committed: LedgerEntry[];
    refused: Array<{ suburb: string; reason: string }>;
  }>;
  gbp?: StageOutcome<{ added: number; skipped: number; dropped: number }>;
  bingPlaces?: StageOutcome<{
    added: number;
    skipped: number;
    dropped: number;
  }>;
  landingPages?: StageOutcome<{
    pages: BuildLandingPageResult[];
    rejected: BuildLandingPageResult[];
  }>;
  sitemap?: StageOutcome<{
    regen: SitemapRegenResult;
    pings: PingResult[];
  }>;
}

/**
 * Configuration options for the pipeline handler. Every external
 * dependency is injectable so tests run without Supabase / GBP /
 * Bing / fetch.
 */
export interface NrpgPipelineOptions {
  /** DR brand identity for landing pages + JSON-LD. Required. */
  brand: BrandIdentity;
  /** GBP location ID (single resource — L7 carve-out, DR only). */
  gbpLocationId: string;
  /** Bing Places store ID (single resource — DR only). */
  bingStoreId: string;

  /** Caller-supplied current sitemap.xml content (read by caller from disk/repo). */
  loadCurrentSitemapXml: () => Promise<string>;
  /** Caller-supplied sitemap writer (writes the new XML; commit/PR is its job). */
  saveSitemapXml?: (xml: string) => Promise<void>;
  /** Caller-supplied landing-page committer (writes one page; commit/PR is its job). */
  saveLandingPage?: (page: BuildLandingPageResult) => Promise<void>;

  // Injectable client overrides for tests
  gbpClient?: GbpApiClient;
  gbpAudit?: GbpAuditSink;
  bingClient?: BingPlacesApiClient;
  bingAudit?: BingPlacesAuditSink;

  /** Override the postcode resolver dataset (tests). */
  postcodeResolveOptions?: ResolveOptions;

  /** Override fetch for sitemap pings (tests). */
  pingFetch?: typeof fetch;

  /** Skip the Google + Bing webmaster ping (e.g. local dev). Defaults to false. */
  skipPing?: boolean;
}

/**
 * Function signature for the assembled handler.
 */
export type NrpgPipelineHandler = (
  event: ContractorOnboardedEvent
) => Promise<NrpgPipelineResult>;
