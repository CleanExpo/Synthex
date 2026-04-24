/**
 * POST /api/internal/score-accuracy-matcher
 *
 * Nightly batch job that backfills outcome_value and accuracy_delta on
 * score_accuracy_events rows older than 48 hours that haven't been matched yet.
 *
 * Called by: supabase/functions/score-accuracy-matcher (Deno cron proxy)
 * Auth:      CRON_SECRET bearer token
 * SYN-670
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { createEdgeFunctionRunner } from '@/lib/pipelines/runner';
import type { ClientInput } from '@/lib/pipelines/runner';
import type { ScoreAccuracyMatcherMetadata } from '@/lib/pipelines/metadata-schemas';
import { verifyCronRequest } from '@/lib/auth/cron-auth';

// ── Types ────────────────────────────────────────────────────────────────────

interface UnmatchedEvent {
  id: string;
  client_id: string;
  score_domain: 'content' | 'geo' | 'health';
  score_value: number;
  entity_id: string;
  issued_at: string;
}

interface MatchResult {
  matched: number;
  failed: number;
}

// ── Supabase admin singleton ──────────────────────────────────────────────────

let _admin: SupabaseClient | null = null;

function getAdmin(): SupabaseClient {
  if (!_admin) {
    _admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
  }
  return _admin;
}

// ── Outcome fetchers (one per domain) ────────────────────────────────────────

/**
 * Content outcome: engagement rate from posts aggregate for the entity.
 * Returns a 0–100 normalised percentile proxy.
 */
async function fetchContentOutcome(
  entityId: string,
  issuedAt: string
): Promise<number | null> {
  const admin = getAdmin();
  const issuedDate = new Date(issuedAt);

  const { data, error } = await admin
    .from('posts')
    .select('id')
    .eq('organization_id', entityId)
    .gte('published_at', issuedDate.toISOString())
    .limit(100);

  if (error || !data) return null;

  // Simple proxy: posts published since score issued / 10, capped at 100
  // Replace with GA4 session delta once GA4 integration ships (SYN-635)
  const postCount = data.length;
  return Math.min(100, postCount * 10);
}

/**
 * GEO outcome: citation rank delta from geo_citations over 30-day window.
 * Returns null if geo_citations table doesn't exist yet (pre SYN-584 deploy).
 */
async function fetchGeoOutcome(entityId: string): Promise<number | null> {
  const admin = getAdmin();

  try {
    const thirtyDaysAgo = new Date(
      Date.now() - 30 * 24 * 60 * 60 * 1000
    ).toISOString();
    const { data, error } = await admin
      .from('geo_citations')
      .select('appeared_in_overview, position')
      .eq('client_id', entityId)
      .gte('captured_at', thirtyDaysAgo)
      .limit(200);

    if (error || !data || data.length === 0) return null;

    const overviewRate =
      data.filter(
        (r: { appeared_in_overview: boolean }) => r.appeared_in_overview
      ).length / data.length;
    const avgPosition =
      data.reduce(
        (s: number, r: { position: number }) => s + (r.position ?? 10),
        0
      ) / data.length;
    const positionScore = Math.max(0, 100 - (avgPosition - 1) * 10);

    return Math.round(overviewRate * 60 + positionScore * 0.4);
  } catch {
    // geo_citations doesn't exist yet — skip gracefully
    return null;
  }
}

/**
 * Health outcome: authority_scores delta since issued_at.
 */
async function fetchHealthOutcome(
  entityId: string,
  issuedAt: string
): Promise<number | null> {
  const admin = getAdmin();

  const { data, error } = await admin
    .from('authority_scores')
    .select('composite_score, created_at')
    .eq('organization_id', entityId)
    .gte('created_at', issuedAt)
    .order('created_at', { ascending: false })
    .limit(1);

  if (error || !data || data.length === 0) return null;
  return data[0].composite_score as number;
}

// ── Per-client match runner ───────────────────────────────────────────────────

async function matchClientEvents(
  clientId: string,
  events: UnmatchedEvent[]
): Promise<MatchResult> {
  const admin = getAdmin();
  let matched = 0;
  let failed = 0;

  for (const event of events) {
    try {
      let outcomeValue: number | null = null;

      if (event.score_domain === 'content') {
        outcomeValue = await fetchContentOutcome(
          event.entity_id,
          event.issued_at
        );
      } else if (event.score_domain === 'geo') {
        outcomeValue = await fetchGeoOutcome(event.entity_id);
      } else if (event.score_domain === 'health') {
        outcomeValue = await fetchHealthOutcome(
          event.entity_id,
          event.issued_at
        );
      }

      if (outcomeValue === null) {
        failed++;
        continue;
      }

      // accuracy_delta = ABS(issued_score - outcome) / 100, clamped 0–1
      const accuracyDelta = Math.min(
        1,
        Math.abs(event.score_value - outcomeValue) / 100
      );

      const { error } = await admin
        .from('score_accuracy_events')
        .update({
          outcome_value: outcomeValue,
          outcome_measured_at: new Date().toISOString(),
          accuracy_delta: accuracyDelta,
        })
        .eq('id', event.id);

      if (error) {
        failed++;
      } else {
        matched++;
      }
    } catch {
      failed++;
    }
  }

  return { matched, failed };
}

// ── Main handler ─────────────────────────────────────────────────────────────

const matcherRunner = createEdgeFunctionRunner<UnmatchedEvent[], MatchResult>(
  'score-accuracy-matcher',
  async (events: UnmatchedEvent[], clientId: string) => {
    return matchClientEvents(clientId, events);
  },
  (output: MatchResult) => {
    // Flag as invalid if failure rate > 50%
    const total = output.matched + output.failed;
    const valid = total === 0 || output.matched / total >= 0.5;
    return {
      valid,
      metadata: { matched: output.matched, failed: output.failed },
    };
  }
);

export async function POST(req: NextRequest): Promise<NextResponse> {
  // Auth guard
  const auth = verifyCronRequest(req, 'SCORE_ACCURACY_MATCHER');
  if (!auth.ok) return auth.response;

  const admin = getAdmin();
  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

  // Fetch all unmatched events older than 48 hours
  const { data: unmatchedRows, error: fetchError } = await admin
    .from('score_accuracy_events')
    .select('id, client_id, score_domain, score_value, entity_id, issued_at')
    .is('outcome_value', null)
    .lt('issued_at', cutoff)
    .order('issued_at', { ascending: true })
    .limit(500);

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  if (!unmatchedRows || unmatchedRows.length === 0) {
    return NextResponse.json({
      ok: true,
      eventsQueued: 0,
      message: 'Nothing to match',
    });
  }

  // Group by client_id
  const byClient = new Map<string, UnmatchedEvent[]>();
  for (const row of unmatchedRows as UnmatchedEvent[]) {
    const existing = byClient.get(row.client_id) ?? [];
    existing.push(row);
    byClient.set(row.client_id, existing);
  }

  const inputs: ClientInput<UnmatchedEvent[]>[] = Array.from(
    byClient.entries()
  ).map(([clientId, events]) => ({ clientId, input: events }));

  const result = await matcherRunner.run(inputs);

  // Aggregate totals
  let totalMatched = 0;
  let totalFailed = 0;
  const domainBreakdown: Record<string, number> = {
    content: 0,
    geo: 0,
    health: 0,
  };

  for (const item of result.outputs) {
    if (item.output) {
      totalMatched += item.output.matched;
      totalFailed += item.output.failed;
    }
  }

  // Count domain breakdown from original events
  for (const row of unmatchedRows as UnmatchedEvent[]) {
    domainBreakdown[row.score_domain] =
      (domainBreakdown[row.score_domain] ?? 0) + 1;
  }

  const metadata: ScoreAccuracyMatcherMetadata = {
    events_queued: unmatchedRows.length,
    events_matched: totalMatched,
    match_failures: totalFailed,
    domain_breakdown: domainBreakdown,
  };

  // Slack alert if failure rate > 10%
  const failureRate =
    unmatchedRows.length > 0 ? totalFailed / unmatchedRows.length : 0;
  if (failureRate > 0.1 && process.env.PIPELINE_SLACK_WEBHOOK) {
    const msg = `[score-accuracy-matcher] High failure rate: ${(failureRate * 100).toFixed(1)}% (${totalFailed}/${unmatchedRows.length} events)`;
    fetch(process.env.PIPELINE_SLACK_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: msg }),
    }).catch(() => undefined);
  }

  return NextResponse.json({
    ok: result.status !== 'failed',
    ...metadata,
    runnerStatus: result.status,
    durationMs: result.durationMs,
  });
}
