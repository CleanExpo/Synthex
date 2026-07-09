/**
 * Weekly outcomes digest — Flywheel container C3.
 *
 * Aggregates the last 7 days of published-post performance per organization
 * (PlatformPost + latest PlatformMetrics, already ingested hourly by
 * analytics-sync) and closes the flywheel's two output loops:
 *   1. witness — a `content.outcomes` event per org via the Unite-Group
 *      connector (lands in agent_actions / the /empire feed)
 *   2. compound — a `Wiki/outcomes/outcomes-<ISO-week>.md` note committed to
 *      the brain-1 repo, which the next /nexus ingest reads.
 *
 * Pure aggregation/rendering here; transport in the cron route.
 */

import { prisma } from '@/lib/prisma';

export interface PlatformOutcomes {
  posts: number;
  likes: number;
  comments: number;
  shares: number;
  impressions: number;
}

export interface OrgOutcomes {
  orgSlug: string;
  postsPublished: number;
  byPlatform: Record<string, PlatformOutcomes>;
}

/** ISO-8601 week label, e.g. 2026-W28. */
export function isoWeekLabel(date: Date): string {
  const utc = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );
  const day = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  const week = Math.ceil(
    ((utc.getTime() - yearStart.getTime()) / 86400000 + 1) / 7
  );
  return `${utc.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

/** Aggregate the last 7 days of published posts + latest metrics per org. */
export async function aggregateWeeklyOutcomes(
  now: Date
): Promise<OrgOutcomes[]> {
  const since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const posts = await prisma.platformPost.findMany({
    where: { publishedAt: { gte: since }, status: 'published' },
    select: {
      publishedAt: true,
      connection: {
        select: {
          platform: true,
          organization: { select: { slug: true } },
        },
      },
      metrics: {
        orderBy: { recordedAt: 'desc' },
        take: 1,
        select: {
          likes: true,
          comments: true,
          shares: true,
          impressions: true,
        },
      },
    },
  });

  const byOrg = new Map<string, OrgOutcomes>();
  for (const post of posts) {
    const orgSlug = post.connection.organization?.slug;
    if (!orgSlug) continue;

    const org = byOrg.get(orgSlug) ?? {
      orgSlug,
      postsPublished: 0,
      byPlatform: {},
    };
    const platform = post.connection.platform;
    const bucket = org.byPlatform[platform] ?? {
      posts: 0,
      likes: 0,
      comments: 0,
      shares: 0,
      impressions: 0,
    };

    const metrics = post.metrics[0];
    bucket.posts += 1;
    bucket.likes += metrics?.likes ?? 0;
    bucket.comments += metrics?.comments ?? 0;
    bucket.shares += metrics?.shares ?? 0;
    bucket.impressions += metrics?.impressions ?? 0;

    org.byPlatform[platform] = bucket;
    org.postsPublished += 1;
    byOrg.set(orgSlug, org);
  }

  return [...byOrg.values()].sort((a, b) => a.orgSlug.localeCompare(b.orgSlug));
}

/** Render the wiki note (brain-1 content rules: dated, sourced, no filler). */
export function renderOutcomesNote(
  outcomes: OrgOutcomes[],
  isoWeek: string,
  generatedAt: Date
): string {
  const date = generatedAt.toISOString().slice(0, 10);
  const lines: string[] = [
    '---',
    'type: wiki',
    `updated: ${date}`,
    '---',
    '',
    `# Distribution outcomes — ${isoWeek}`,
    '',
    `Written by Synthex \`outcomes-digest\` on ${date} (flywheel C3). Source:`,
    'PlatformMetrics latest rows per post published in the trailing 7 days.',
    '',
  ];

  if (outcomes.length === 0) {
    lines.push('No estate posts were published in this window.');
  }

  for (const org of outcomes) {
    lines.push(`## ${org.orgSlug} — ${org.postsPublished} post(s)`);
    for (const [platform, m] of Object.entries(org.byPlatform)) {
      lines.push(
        `- ${platform}: ${m.posts} post(s), ${m.likes} likes, ${m.comments} comments, ${m.shares} shares, ${m.impressions} impressions`
      );
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Create or update the weekly note in the brain-1 repo (idempotent: re-runs
 * overwrite the same week's note). Throws on transport failure.
 */
export async function commitWikiOutcomesNote(params: {
  repo: string;
  token: string;
  isoWeek: string;
  content: string;
  fetchImpl?: typeof fetch;
}): Promise<{ path: string; updated: boolean }> {
  const { repo, token, isoWeek, content, fetchImpl = fetch } = params;
  const path = `Wiki/outcomes/outcomes-${isoWeek}.md`;
  const url = `https://api.github.com/repos/${repo}/contents/${path}`;
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };

  const existing = await fetchImpl(url, { headers });
  let sha: string | undefined;
  if (existing.ok) {
    sha = ((await existing.json()) as { sha?: string }).sha;
  } else if (existing.status !== 404) {
    throw new Error(`brain-1 read failed: ${existing.status}`);
  }

  const response = await fetchImpl(url, {
    method: 'PUT',
    headers,
    body: JSON.stringify({
      message: `outcomes: ${isoWeek} distribution digest (Synthex flywheel C3)`,
      content: Buffer.from(content, 'utf8').toString('base64'),
      ...(sha ? { sha } : {}),
    }),
  });
  if (!response.ok) {
    throw new Error(`brain-1 commit failed: ${response.status}`);
  }
  return { path, updated: Boolean(sha) };
}
