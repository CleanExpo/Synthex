/**
 * GEO Citation Baseline Monitor — weekly run — SYN-584 (silent dark run).
 *
 * For each active user whose organisation has a connected GBP location, generate
 * the three query variants and check Google AI Overview for a brand mention,
 * logging one `geo_citation_events` row per (user, variant). ZERO client-facing
 * output — this only accumulates data for an admin-only read view.
 *
 * The actual AI Overview fetch is a founder-gated dependency (see
 * ai-overview-adapter.ts). When no provider is configured, each row is written
 * with `error_reason` = the not-configured reason. No fabricated results.
 *
 * Rate limiting: 1 request / 30s. Backoff on 429: 1→2→4→8s, then log + skip.
 * Cost: tracked via `trackPipelineCost` (SYN-518). Weekly alert to
 * contact@unite-group.in if estimated spend exceeds AUD $5/week.
 */

import { randomUUID } from 'crypto';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { trackPipelineCost } from '@/lib/pipelines/track-cost';
import { email } from '@/lib/email/index';
import {
  extractQuerySeed,
  generateQueries,
  type GeneratedQuery,
} from './query-generator';
import {
  defaultAiOverviewFetcher,
  isAiOverviewProviderConfigured,
  type AiOverviewFetcher,
  type AiOverviewFetchResult,
} from './ai-overview-adapter';

const SEARCH_ENGINE = 'google_ai_overview';
const RATE_LIMIT_MS = 30_000; // 1 request / 30s
const BACKOFF_MS = [1_000, 2_000, 4_000, 8_000]; // exponential backoff on 429
const MAX_SNIPPET_CHARS = 500;
/** Estimated provider cost per AI Overview query (AUD). Only charged when a
 *  real provider actually returns a result — 0 in the dark run. */
const COST_PER_QUERY_AUD = 0.01;
const WEEKLY_COST_ALERT_THRESHOLD_AUD = 5;
const COST_ALERT_RECIPIENT = 'contact@unite-group.in';

const realSleep = (ms: number): Promise<void> =>
  new Promise(resolve => setTimeout(resolve, ms));

export interface RunOptions {
  /** Injectable AI Overview fetcher (default: the not-configured adapter). */
  fetcher?: AiOverviewFetcher;
  /** Injectable delay (tests pass a no-op to avoid real waits). */
  sleep?: (ms: number) => Promise<void>;
  /** Skip the inter-request rate-limit delay (tests). */
  skipRateLimit?: boolean;
}

export interface RunSummary {
  runId: string;
  usersProcessed: number;
  usersSkippedNoGbp: number;
  eventsWritten: number;
  mentions: number;
  rateLimited: number;
  errors: number;
  providerConfigured: boolean;
  estimatedCostAud: number;
  costAlertSent: boolean;
}

interface BrandDetection {
  brandMentioned: boolean;
  mentionPosition: number | null;
  rawSnippet: string | null;
}

/**
 * Case-insensitive brand detection on an AI Overview text block.
 * `mentionPosition` is the 0-based character offset of the first match.
 * `rawSnippet` is the block truncated to 500 chars (always captured when text
 * is present, so an admin can eyeball non-matches too).
 */
export function detectBrandMention(
  businessName: string,
  rawText: string | null
): BrandDetection {
  if (!rawText) {
    return { brandMentioned: false, mentionPosition: null, rawSnippet: null };
  }
  const snippet = rawText.slice(0, MAX_SNIPPET_CHARS);
  const needle = businessName.trim().toLowerCase();
  if (!needle) {
    return { brandMentioned: false, mentionPosition: null, rawSnippet: snippet };
  }
  const idx = rawText.toLowerCase().indexOf(needle);
  return idx >= 0
    ? { brandMentioned: true, mentionPosition: idx, rawSnippet: snippet }
    : { brandMentioned: false, mentionPosition: null, rawSnippet: snippet };
}

/**
 * Fetch AI Overview for a query with exponential backoff on 429.
 * Returns the final result; if still rate-limited after the last backoff,
 * the result carries statusCode 429 and the caller records `rate_limited`.
 */
async function fetchWithBackoff(
  fetcher: AiOverviewFetcher,
  queryText: string,
  sleep: (ms: number) => Promise<void>
): Promise<AiOverviewFetchResult> {
  let result = await fetcher(queryText);
  for (const delay of BACKOFF_MS) {
    if (result.statusCode !== 429) break;
    logger.warn('geo-citation: AI Overview 429 — backing off', {
      queryText,
      delayMs: delay,
    });
    await sleep(delay);
    result = await fetcher(queryText);
  }
  return result;
}

export async function runWeeklyGeoCitationMonitor(
  opts: RunOptions = {}
): Promise<RunSummary> {
  const fetcher = opts.fetcher ?? defaultAiOverviewFetcher;
  const sleep = opts.sleep ?? realSleep;
  const runId = randomUUID();
  const providerConfigured =
    opts.fetcher !== undefined ? true : isAiOverviewProviderConfigured();

  const summary: RunSummary = {
    runId,
    usersProcessed: 0,
    usersSkippedNoGbp: 0,
    eventsWritten: 0,
    mentions: 0,
    rateLimited: 0,
    errors: 0,
    providerConfigured,
    estimatedCostAud: 0,
    costAlertSent: false,
  };

  // Active users whose organisation could own a GBP location.
  const users = await prisma.user.findMany({
    where: { deletedAt: null, organizationId: { not: null } },
    select: {
      id: true,
      organizationId: true,
      organization: { select: { name: true } },
    },
  });

  if (users.length === 0) {
    logger.info('geo-citation: no active users to monitor', { runId });
    return summary;
  }

  const orgIds = [
    ...new Set(users.map(u => u.organizationId).filter((v): v is string => !!v)),
  ];

  // One GBP location per org (primary preferred). Dark-run scale is small.
  const locations = await prisma.gBPLocation.findMany({
    where: { organizationId: { in: orgIds } },
    orderBy: { isPrimary: 'desc' },
    select: {
      organizationId: true,
      categories: true,
      address: true,
    },
  });
  const locationByOrg = new Map<string, (typeof locations)[number]>();
  for (const loc of locations) {
    if (!locationByOrg.has(loc.organizationId)) {
      locationByOrg.set(loc.organizationId, loc);
    }
  }

  let requestsMade = 0;

  for (const user of users) {
    const orgId = user.organizationId;
    const location = orgId ? locationByOrg.get(orgId) : undefined;
    if (!location) {
      summary.usersSkippedNoGbp += 1;
      continue;
    }

    const seed = extractQuerySeed(location.categories, location.address);
    if (!seed) {
      summary.usersSkippedNoGbp += 1;
      continue;
    }

    const businessName = user.organization?.name ?? seed.businessCategory;
    const queries: GeneratedQuery[] = generateQueries(seed);
    summary.usersProcessed += 1;

    for (const query of queries) {
      // Rate limit: 1 request / 30s between actual requests.
      if (requestsMade > 0 && !opts.skipRateLimit) {
        await sleep(RATE_LIMIT_MS);
      }
      requestsMade += 1;

      let result: AiOverviewFetchResult;
      try {
        result = await fetchWithBackoff(fetcher, query.text, sleep);
      } catch (err) {
        summary.errors += 1;
        logger.error('geo-citation: fetch failed', err, {
          runId,
          userId: user.id,
          queryText: query.text,
        });
        await writeEvent(user.id, query, {
          brandMentioned: false,
          mentionPosition: null,
          rawSnippet: null,
          errorReason: 'fetch_failed',
        });
        summary.eventsWritten += 1;
        continue;
      }

      let errorReason: string | null = null;
      let detection: BrandDetection = {
        brandMentioned: false,
        mentionPosition: null,
        rawSnippet: null,
      };

      if (result.statusCode === 429) {
        errorReason = 'rate_limited';
        summary.rateLimited += 1;
      } else if (!result.configured || result.errorReason) {
        errorReason = result.errorReason ?? 'provider_error';
      } else {
        detection = detectBrandMention(businessName, result.rawText);
        if (detection.brandMentioned) summary.mentions += 1;
        summary.estimatedCostAud += COST_PER_QUERY_AUD;
      }

      await writeEvent(user.id, query, { ...detection, errorReason });
      summary.eventsWritten += 1;
    }
  }

  // Cost tracking (SYN-518) — reuse the shared ledger.
  try {
    await trackPipelineCost({
      pipeline_name: 'geo_citation_monitor',
      client_id: null,
      run_id: runId,
      model: 'serp:google_ai_overview',
      input_tokens: 0,
      output_tokens: 0,
      cost_usd: summary.estimatedCostAud,
    });
  } catch (err) {
    logger.error('geo-citation: cost tracking failed', err, { runId });
  }

  // Weekly cost alert — only when real spend crosses the threshold.
  if (summary.estimatedCostAud > WEEKLY_COST_ALERT_THRESHOLD_AUD) {
    try {
      await email.send({
        to: COST_ALERT_RECIPIENT,
        subject: `Synthex GEO Citation Monitor — weekly spend AUD $${summary.estimatedCostAud.toFixed(2)}`,
        html:
          `<p>The GEO Citation Baseline Monitor (SYN-584) estimated weekly spend of ` +
          `<strong>AUD $${summary.estimatedCostAud.toFixed(2)}</strong>, above the ` +
          `AUD $${WEEKLY_COST_ALERT_THRESHOLD_AUD} threshold.</p>` +
          `<p>Run ${runId}: ${summary.eventsWritten} events across ` +
          `${summary.usersProcessed} users.</p>`,
        type: 'transactional',
      });
      summary.costAlertSent = true;
    } catch (err) {
      logger.error('geo-citation: cost alert email failed', err, { runId });
    }
  }

  logger.info('geo-citation: weekly run complete', { ...summary });
  return summary;
}

async function writeEvent(
  userId: string,
  query: GeneratedQuery,
  data: {
    brandMentioned: boolean;
    mentionPosition: number | null;
    rawSnippet: string | null;
    errorReason: string | null;
  }
): Promise<void> {
  await prisma.geoCitationEvent.create({
    data: {
      userId,
      queryText: query.text,
      searchEngine: SEARCH_ENGINE,
      queryVariant: query.variant,
      brandMentioned: data.brandMentioned,
      mentionPosition: data.mentionPosition,
      rawSnippet: data.rawSnippet,
      errorReason: data.errorReason,
    },
  });
}
