/**
 * Weekly outcomes digest cron — Flywheel container C3.
 *
 * GET /api/cron/outcomes-digest        — aggregate, witness, and write back
 * GET /api/cron/outcomes-digest?dry=1  — return the aggregates + note, do nothing
 *
 * Schedule: 0 22 * * 0 UTC (Monday 08:00 AEST).
 *
 * Per org: pushes a `content.outcomes` witness event (Unite-Group connector,
 * fire-and-forget). Once per run: commits Wiki/outcomes/outcomes-<week>.md to
 * brain-1 (env-gated; skipped with a logged warning when unset).
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - CRON_SECRET (auth; per-route CRON_SECRET_OUTCOMES_DIGEST optional)
 * - BRAIN1_REPO / BRAIN1_GITHUB_TOKEN (wiki write-back; contents read+write)
 * - UNITE_GROUP_EVENTS_URL / UNITE_GROUP_EVENTS_API_KEY (witness events)
 */

import { NextRequest, NextResponse } from 'next/server';

import { verifyCronRequest } from '@/lib/auth/cron-auth';
import { logger } from '@/lib/logger';
import { pushUniteGroupEvent } from '@/lib/unite-group-connector';
import {
  aggregateWeeklyOutcomes,
  commitWikiOutcomesNote,
  isoWeekLabel,
  renderOutcomesNote,
} from '@/lib/outcomes/weekly-digest';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = verifyCronRequest(request, 'OUTCOMES_DIGEST');
  if (!auth.ok) {
    return auth.response;
  }

  const dry = request.nextUrl.searchParams.get('dry') === '1';
  const now = new Date();
  const isoWeek = isoWeekLabel(now);

  const outcomes = await aggregateWeeklyOutcomes(now);
  const note = renderOutcomesNote(outcomes, isoWeek, now);

  if (dry) {
    return NextResponse.json({ dry: true, isoWeek, outcomes, note });
  }

  // Witness: one event per org, settled before the instance freezes.
  await Promise.allSettled(
    outcomes.map(org =>
      pushUniteGroupEvent({
        type: 'content.outcomes',
        orgSlug: org.orgSlug,
        isoWeek,
        postsPublished: org.postsPublished,
        byPlatform: org.byPlatform,
      })
    )
  );

  // Compound: write the note back to the brain-1 wiki.
  let wiki: { path: string; updated: boolean } | { skipped: string } = {
    skipped: 'BRAIN1_REPO/BRAIN1_GITHUB_TOKEN unset',
  };
  const repo = process.env.BRAIN1_REPO;
  const token = process.env.BRAIN1_GITHUB_TOKEN;
  if (repo && token) {
    try {
      wiki = await commitWikiOutcomesNote({
        repo,
        token,
        isoWeek,
        content: note,
      });
    } catch (error) {
      logger.error('[outcomes-digest] wiki write-back failed', { error });
      wiki = { skipped: `commit failed: ${String(error)}` };
    }
  } else {
    logger.warn('[outcomes-digest] wiki write-back skipped — env unset');
  }

  logger.info('[outcomes-digest] run complete', {
    isoWeek,
    orgs: outcomes.length,
    wiki,
  });

  return NextResponse.json({ isoWeek, orgs: outcomes.length, outcomes, wiki });
}
