/**
 * Load a campaign pack's scheduler payloads into the Synthex scheduler.
 *
 * DRY-RUN BY DEFAULT — prints the full plan (including any uniform date
 * re-anchor) and POSTs nothing. Pass --execute to load for real.
 *
 * Usage:
 *   npx tsx scripts/load-campaign-scheduler-payloads.ts \
 *     --file docs/marketing-agency/campaigns/carsi-h5-launch-2026-07-08/scheduler-payloads.json \
 *     [--platform linkedin] [--base-url https://synthex.social] [--execute]
 *
 * Auth (--execute only): set SYNTHEX_SESSION_COOKIE to the signed-in CARSI
 * org owner's cookie header value. It is sent as the Cookie header and never
 * printed.
 *
 * Acceptance is the scheduler response per post (id created), then the cron
 * publish receipt — never this script's own output.
 *
 * Spec: docs/specs/2026-07-09-carsi-linkedin-golive-spec.md (E4).
 */

import { readFileSync } from 'fs';
import {
  buildSchedulerLoadPlan,
  toSchedulerPostBody,
  type CampaignPayloadPost,
} from '../lib/scheduling/campaign-payload-loader';

interface CliOptions {
  file: string;
  platform: string;
  baseUrl: string;
  execute: boolean;
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    file: 'docs/marketing-agency/campaigns/carsi-h5-launch-2026-07-08/scheduler-payloads.json',
    platform: 'linkedin',
    baseUrl: 'https://synthex.social',
    execute: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--file') options.file = argv[++i];
    else if (arg === '--platform') options.platform = argv[++i];
    else if (arg === '--base-url') options.baseUrl = argv[++i];
    else if (arg === '--execute') options.execute = true;
    else {
      console.error(`Unknown argument: ${arg}`);
      process.exit(1);
    }
  }
  return options;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));

  const pack = JSON.parse(readFileSync(options.file, 'utf8')) as {
    campaignId?: string;
    posts?: CampaignPayloadPost[];
  };
  const posts = pack.posts ?? [];

  const plan = buildSchedulerLoadPlan({
    posts,
    platform: options.platform,
    now: new Date(),
  });

  console.log(
    `\nPlan for ${options.platform} (${plan.entries.length} posts, ${plan.skipped.length} skipped, uniform shift ${plan.shiftDays} day(s)):\n`
  );
  for (const entry of plan.entries) {
    const moved =
      entry.originalScheduledAt === entry.scheduledAt
        ? ''
        : `  (was ${entry.originalScheduledAt})`;
    console.log(
      `  ${entry.id}  ${entry.scheduledAt}${moved}  media=${entry.mediaUrls.length}  chars=${entry.content.length}`
    );
  }
  for (const skip of plan.skipped) {
    console.log(`  ${skip.id}  SKIPPED — ${skip.reason}`);
  }

  if (!options.execute) {
    console.log(
      '\nDry run — nothing was POSTed. Re-run with --execute to load these posts.'
    );
    return;
  }

  const cookie = process.env.SYNTHEX_SESSION_COOKIE;
  if (!cookie) {
    console.error(
      '\n--execute requires SYNTHEX_SESSION_COOKIE (the signed-in org owner cookie header).'
    );
    process.exit(1);
  }

  let failures = 0;
  for (const entry of plan.entries) {
    const body = toSchedulerPostBody(entry, { batchId: pack.campaignId });
    const response = await fetch(`${options.baseUrl}/api/scheduler/posts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookie,
      },
      body: JSON.stringify(body),
    });
    const result = (await response.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    if (response.ok) {
      console.log(
        `  LOADED ${entry.id} → ${JSON.stringify(result?.id ?? result?.post ?? 'ok')}`
      );
    } else {
      failures += 1;
      console.error(
        `  FAILED ${entry.id} → HTTP ${response.status}: ${JSON.stringify(result)}`
      );
    }
  }

  if (failures > 0) {
    console.error(`\n${failures} post(s) failed to load.`);
    process.exit(1);
  }
  console.log(`\nAll ${plan.entries.length} posts loaded.`);
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
