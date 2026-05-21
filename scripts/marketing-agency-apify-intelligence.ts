#!/usr/bin/env npx tsx
import * as path from 'node:path';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { ApifyClient } from 'apify-client';
import {
  mapApifyRecordsToGovernedSignals,
  type ApifySignalContext,
} from '../lib/marketing-agency/intelligence/apify-signal-adapter';
import {
  convertSignalsToOpportunities,
  rankGovernedSignals,
} from '../lib/marketing-agency/intelligence/signal-ledger';
import {
  deriveApifyDesignInsights,
  normalizeApifyCreativeRecord,
  rankApifyCreativeRecords,
  type ApifyCreativeRecord,
  type ApifyResearchPlatform,
} from '../lib/marketing-agency/research/apify-intelligence';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

dotenv.config({
  path: path.join(ROOT_DIR, '.env.local'),
  override: true,
  quiet: true,
});
dotenv.config({ path: path.join(ROOT_DIR, '.env'), quiet: true });

interface ActorPlan {
  platform: ApifyResearchPlatform;
  actorId: string;
  input: Record<string, unknown>;
}

const restoreAssistSignalContext: Omit<ApifySignalContext, 'capturedAt'> = {
  business: 'Synthex',
  client: 'RestoreAssist',
  product: 'RestoreAssist reporting workflow',
  audienceSegment: 'Restoration business owners',
  narrative: 'Owners are searching for evidence-backed reporting proof',
  evidenceRefs: ['docs/marketing-agency/APIFY-LIVE-INTELLIGENCE-2026-05-16.md'],
};

const actorPlans: ActorPlan[] = [
  {
    platform: 'google',
    actorId: 'apify/google-search-scraper',
    input: {
      queries: [
        'water damage restoration software video ad',
        'field service software reporting video ad',
        'restoration estimating software LinkedIn video',
        'contractor software Facebook video ad',
      ].join('\n'),
      countryCode: 'au',
      languageCode: 'en',
      resultsPerPage: 10,
      maxPagesPerQuery: 1,
    },
  },
  {
    platform: 'linkedin',
    actorId: 'apify/linkedin-post-search-scraper',
    input: {
      searchQuery:
        'field service software restoration reporting contractor workflow video',
      resultsLimit: 25,
    },
  },
  {
    platform: 'facebook',
    actorId: 'apify/facebook-posts-scraper',
    input: {
      searchQuery:
        'field service software restoration reporting contractor workflow',
      maxPosts: 25,
    },
  },
  {
    platform: 'tiktok',
    actorId: 'apify/tiktok-scraper',
    input: {
      searchQueries: [
        'field service software',
        'contractor business software',
        'restoration business',
      ],
      resultsPerPage: 25,
      scrapeType: 'search',
    },
  },
];

async function fetchPublicActorStats(actorId: string): Promise<unknown> {
  const response = await fetch(
    `https://api.apify.com/v2/acts/${actorId.replace('/', '~')}`
  );
  if (!response.ok) {
    return { actorId, status: response.status, ok: false };
  }
  const body = (await response.json()) as {
    data?: {
      name?: string;
      username?: string;
      title?: string;
      stats?: unknown;
    };
  };
  return {
    actorId,
    name: body.data?.name,
    username: body.data?.username,
    title: body.data?.title,
    stats: body.data?.stats,
  };
}

async function runUnauthenticatedProbe(): Promise<unknown> {
  const response = await fetch(
    'https://api.apify.com/v2/acts/apify~google-search-scraper/runs?waitForFinish=10',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        queries: 'RestoreAssist.app launch video marketing',
        resultsPerPage: 1,
        maxPagesPerQuery: 1,
      }),
    }
  );

  return {
    status: response.status,
    body: await response.json().catch(() => null),
  };
}

async function runLiveApifyResearch(token: string) {
  const client = new ApifyClient({ token });
  const generatedAt = new Date().toISOString();
  const records: ApifyCreativeRecord[] = [];
  const runs: Array<{
    platform: ApifyResearchPlatform;
    actorId: string;
    status: string;
    datasetId?: string;
    itemCount?: number;
    error?: string;
  }> = [];

  for (const plan of actorPlans) {
    try {
      const run = await client.actor(plan.actorId).call(plan.input, {
        waitSecs: 180,
      });

      if (run.status !== 'SUCCEEDED') {
        runs.push({
          platform: plan.platform,
          actorId: plan.actorId,
          status: run.status ?? 'UNKNOWN',
          datasetId: run.defaultDatasetId,
        });
        continue;
      }

      const dataset = await client.dataset(run.defaultDatasetId).listItems({
        limit: 100,
      });
      const normalized = dataset.items
        .filter((item): item is Record<string, unknown> =>
          typeof item === 'object' && item !== null
        )
        .map(item => normalizeApifyCreativeRecord(plan.platform, item));

      records.push(...normalized);
      runs.push({
        platform: plan.platform,
        actorId: plan.actorId,
        status: run.status,
        datasetId: run.defaultDatasetId,
        itemCount: normalized.length,
      });
    } catch (error) {
      runs.push({
        platform: plan.platform,
        actorId: plan.actorId,
        status: 'FAILED',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const ranked = rankApifyCreativeRecords(records);
  const signalContext: ApifySignalContext = {
    ...restoreAssistSignalContext,
    capturedAt: generatedAt,
  };
  const governedSignals = mapApifyRecordsToGovernedSignals(records, signalContext);
  const rankedSignals = rankGovernedSignals(governedSignals);
  const opportunities = convertSignalsToOpportunities(governedSignals);
  const persistenceOrganizationId =
    process.env.MARKETING_AGENCY_SIGNAL_ORGANIZATION_ID?.trim() || undefined;
  const persistenceCampaignId =
    process.env.MARKETING_AGENCY_SIGNAL_CAMPAIGN_ID?.trim() || undefined;
  let persistence: unknown = {
    status: 'skipped_missing_organization_id',
    requiredEnv: 'MARKETING_AGENCY_SIGNAL_ORGANIZATION_ID',
  };

  if (persistenceOrganizationId) {
    try {
      persistence = await persistApifySignals({
        organizationId: persistenceOrganizationId,
        campaignId: persistenceCampaignId,
        rankedSignals,
        opportunities,
        generatedAt,
        actorRuns: runs,
      });
    } catch (error) {
      persistence = {
        status: 'persistence_failed',
        error: error instanceof Error ? error.message : String(error),
        campaignEnv: 'MARKETING_AGENCY_SIGNAL_CAMPAIGN_ID',
        requiredEnv: 'MARKETING_AGENCY_SIGNAL_ORGANIZATION_ID',
      };
    }
  }

  return {
    status: 'completed',
    generatedAt,
    actorRuns: runs,
    recordsPulled: records.length,
    ranked,
    designInsights: deriveApifyDesignInsights(ranked),
    governedSignals,
    rankedSignals,
    opportunities,
    persistence,
  };
}

async function persistApifySignals(input: {
  organizationId: string;
  campaignId?: string;
  rankedSignals: ReturnType<typeof rankGovernedSignals>;
  opportunities: ReturnType<typeof convertSignalsToOpportunities>;
  generatedAt: string;
  actorRuns: Array<{
    platform: ApifyResearchPlatform;
    actorId: string;
    status: string;
    datasetId?: string;
    itemCount?: number;
    error?: string;
  }>;
}) {
  const { persistGovernedSignalRun } = await import(
    '../lib/marketing-agency/intelligence/signal-persistence'
  );

  return {
    status: 'persisted',
    ...(await persistGovernedSignalRun({
      organizationId: input.organizationId,
      campaignId: input.campaignId,
      rankedSignals: input.rankedSignals,
      opportunities: input.opportunities,
      metadata: {
        source: 'marketing-agency:apify-intel',
        generatedAt: input.generatedAt,
        actorRuns: input.actorRuns,
      },
    })),
  };
}

async function withStdoutRedirectedToStderr<T>(callback: () => Promise<T>): Promise<T> {
  const originalWrite = process.stdout.write.bind(process.stdout);

  process.stdout.write = ((chunk: unknown, encodingOrCallback?: unknown, callback?: unknown) => {
    if (typeof encodingOrCallback === 'function') {
      return process.stderr.write(chunk as string | Uint8Array, encodingOrCallback);
    }

    return process.stderr.write(
      chunk as string | Uint8Array,
      encodingOrCallback as BufferEncoding | undefined,
      callback as ((error?: Error | null) => void) | undefined
    );
  }) as typeof process.stdout.write;

  try {
    return await callback();
  } finally {
    process.stdout.write = originalWrite as typeof process.stdout.write;
  }
}

async function main() {
  const token = process.env.APIFY_API_TOKEN;

  if (!token) {
    const [probe, actorStats] = await Promise.all([
      runUnauthenticatedProbe(),
      Promise.all(actorPlans.map(plan => fetchPublicActorStats(plan.actorId))),
    ]);

    process.stdout.write(
      `${JSON.stringify(
        {
          status: 'blocked_missing_apify_token',
          generatedAt: new Date().toISOString(),
          message:
            'APIFY_API_TOKEN is required before Synthex can pull live social/ad datasets, impressions, views, or influencer post analytics.',
          unauthenticatedRunProbe: probe,
          publicActorStats: actorStats,
          requiredEnv: 'APIFY_API_TOKEN',
        },
        null,
        2
      )}\n`
    );
    return;
  }

  const result = await withStdoutRedirectedToStderr(() =>
    runLiveApifyResearch(token)
  );
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

main().catch(error => {
  process.stderr.write(
    `${error instanceof Error ? error.stack ?? error.message : String(error)}\n`
  );
  process.exit(1);
});
