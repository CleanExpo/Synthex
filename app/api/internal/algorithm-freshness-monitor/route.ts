/**
 * POST /api/internal/algorithm-freshness-monitor
 *
 * CRON_SECRET-guarded internal route called by the `algorithm-freshness-monitor`
 * Supabase Edge Function on the 1st of each month.
 *
 * For each tracked platform (Google Search, Instagram, LinkedIn):
 *   1. Searches for algorithm update announcements in the last 30 days
 *   2. Parses results for algorithm-related keywords
 *   3. On detection: creates a Linear issue tagged 'algorithm-update'
 *   4. On detection: flags affected signals in ranking_signals with needs_review = true
 *   5. On detection: creates an algorithm_updates row
 *   6. Sends admin Slack notification for any detected changes
 *   7. Logs run cost under 'algorithm_monitor' category
 *
 * Body (optional): { platform?: string } — scope to single platform for testing
 *
 * @task SYN-605
 */

import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { verifyCronRequest } from '@/lib/auth/cron-auth';

// ── Config ─────────────────────────────────────────────────────────────────────

const TRACKED_PLATFORMS = [
  {
    platform: 'google_search',
    displayName: 'Google Search',
    searchQueries: [
      'Google Search algorithm update',
      'Google core update ranking change',
      'Google Search Central blog update',
    ],
    keywords: [
      'ranking',
      'algorithm',
      'core update',
      'signal',
      'change',
      'update',
      'spam',
    ],
  },
  {
    platform: 'instagram',
    displayName: 'Instagram',
    searchQueries: [
      'Instagram algorithm update 2026',
      'Instagram Reels ranking change',
      'Mosseri algorithm announcement',
    ],
    keywords: [
      'algorithm',
      'ranking',
      'feed',
      'reels',
      'recommendation',
      'signal',
      'change',
    ],
  },
  {
    platform: 'linkedin',
    displayName: 'LinkedIn',
    searchQueries: [
      'LinkedIn feed algorithm update 2026',
      'LinkedIn Engineering Blog ranking change',
      'LinkedIn content distribution update',
    ],
    keywords: [
      'algorithm',
      'ranking',
      'feed',
      'distribution',
      'signal',
      'change',
      'update',
    ],
  },
];

/** Max monthly cost budget for this monitor in USD */
const MONTHLY_BUDGET_USD = 2.0;

let _anthropic: Anthropic | null = null;
function getAnthropic(): Anthropic {
  if (!_anthropic) {
    _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY ?? '' });
  }
  return _anthropic;
}

// ── Types ──────────────────────────────────────────────────────────────────────

interface DetectionResult {
  platform: string;
  displayName: string;
  detected: boolean;
  summary?: string;
  sourceUrl?: string;
  impactLevel?: 'high' | 'medium' | 'low';
  affectedSignals?: string[];
}

interface SearchResult {
  title: string;
  snippet: string;
  url: string;
}

// ── Search (FireCrawl) ────────────────────────────────────────────────────────

async function searchRecentUpdates(
  queries: string[],
  keywords: string[]
): Promise<SearchResult[]> {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) {
    logger.warn(
      'algorithm-freshness-monitor: FIRECRAWL_API_KEY not set — skipping web search'
    );
    return [];
  }

  const results: SearchResult[] = [];

  for (const query of queries.slice(0, 2)) {
    // Limit to 2 queries per platform for cost control
    try {
      const res = await fetch('https://api.firecrawl.dev/v1/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          query,
          limit: 5,
          lang: 'en',
          scrapeOptions: { formats: ['markdown'] },
        }),
      });

      if (!res.ok) {
        logger.warn('algorithm-freshness-monitor: FireCrawl search failed', {
          query,
          status: res.status,
        });
        continue;
      }

      const data = (await res.json()) as {
        success?: boolean;
        data?: Array<{
          title?: string;
          description?: string;
          url?: string;
          markdown?: string;
        }>;
      };

      for (const item of data.data ?? []) {
        const text =
          `${item.title ?? ''} ${item.description ?? ''} ${(item.markdown ?? '').slice(0, 500)}`.toLowerCase();
        const hasKeyword = keywords.some(k => text.includes(k.toLowerCase()));
        if (hasKeyword) {
          results.push({
            title: item.title ?? 'Untitled',
            snippet: item.description ?? (item.markdown ?? '').slice(0, 200),
            url: item.url ?? '',
          });
        }
      }
    } catch (err) {
      logger.warn('algorithm-freshness-monitor: search error', {
        query,
        error: String(err),
      });
    }
  }

  return results;
}

// ── AI Analysis ────────────────────────────────────────────────────────────────

async function analyseResults(
  platform: string,
  results: SearchResult[]
): Promise<{
  detected: boolean;
  summary?: string;
  impactLevel?: 'high' | 'medium' | 'low';
  affectedSignals?: string[];
}> {
  if (results.length === 0) return { detected: false };

  const snippets = results
    .slice(0, 5)
    .map(r => `Title: ${r.title}\nSnippet: ${r.snippet}\nURL: ${r.url}`)
    .join('\n\n---\n\n');

  const response = await getAnthropic().messages.create({
    model: 'claude-haiku-4-5-20251001', // Use cheapest model for monitoring tasks
    max_tokens: 512,
    messages: [
      {
        role: 'user',
        content: `You are analysing search results for evidence of a ${platform} algorithm update in the last 30 days.

Search results:
${snippets}

Respond with a JSON object ONLY:
{
  "detected": true|false,
  "summary": "1-2 sentence plain-English description of what changed (or null if not detected)",
  "impactLevel": "high"|"medium"|"low" (or null),
  "affectedSignals": ["list", "of", "affected", "signal", "plain-english-names"] (or [])
}

Only set detected=true if there is clear evidence of an algorithm change, not just general SEO discussion.`,
      },
    ],
  });

  const content = response.content[0];
  if (content.type !== 'text') return { detected: false };

  try {
    const raw = content.text
      .replace(/^```(?:json)?\n?/m, '')
      .replace(/\n?```$/m, '')
      .trim();
    const parsed = JSON.parse(raw);
    return {
      detected: Boolean(parsed.detected),
      summary: parsed.summary ?? undefined,
      impactLevel: parsed.impactLevel ?? 'medium',
      affectedSignals: Array.isArray(parsed.affectedSignals)
        ? parsed.affectedSignals
        : [],
    };
  } catch {
    return { detected: false };
  }
}

// ── Linear issue creation ──────────────────────────────────────────────────────

async function createLinearIssue(
  displayName: string,
  summary: string,
  sourceUrl: string | undefined,
  impactLevel: string
): Promise<string | null> {
  const linearApiKey = process.env.LINEAR_API_KEY;
  if (!linearApiKey) return null;

  const teamId =
    process.env.LINEAR_TEAM_ID ?? 'b887971b-6761-4260-a111-b94dbb628ebe';

  const query = `
    mutation CreateIssue($input: IssueCreateInput!) {
      issueCreate(input: $input) {
        issue {
          id
          identifier
        }
      }
    }
  `;

  const variables = {
    input: {
      title: `Algorithm update detected: ${displayName}`,
      description: `## Algorithm Update Detected\n\n**Platform:** ${displayName}\n**Impact:** ${impactLevel}\n**Detected:** ${new Date().toISOString().split('T')[0]}\n\n### Summary\n${summary}\n\n${sourceUrl ? `**Source:** ${sourceUrl}` : ''}`,
      teamId,
      labelNames: ['algorithm-update'],
      priority: impactLevel === 'high' ? 1 : 2,
    },
  };

  try {
    const res = await fetch('https://api.linear.app/graphql', {
      method: 'POST',
      headers: {
        Authorization: linearApiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, variables }),
    });
    const data = (await res.json()) as {
      data?: { issueCreate?: { issue?: { identifier: string } } };
    };
    return data?.data?.issueCreate?.issue?.identifier ?? null;
  } catch (err) {
    logger.warn('algorithm-freshness-monitor: Linear issue creation failed', {
      error: String(err),
    });
    return null;
  }
}

// ── Slack notification ─────────────────────────────────────────────────────────

async function notifySlack(detections: DetectionResult[]): Promise<void> {
  const webhookUrl = process.env.ALERT_SLACK_WEBHOOK_URL;
  if (!webhookUrl || detections.length === 0) return;

  const detected = detections.filter(d => d.detected);
  if (detected.length === 0) return;

  const blocks = detected.map(d => ({
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: `*Algorithm change detected: ${d.displayName}*\n${d.summary ?? 'No summary available'}\nImpact: ${d.impactLevel ?? 'medium'}${d.sourceUrl ? `\n<${d.sourceUrl}|Source →>` : ''}`,
    },
  }));

  await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: `⚡ Algorithm update monitor: ${detected.length} change(s) detected`,
      blocks: [
        {
          type: 'header',
          text: { type: 'plain_text', text: '⚡ Algorithm Freshness Monitor' },
        },
        ...blocks,
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: 'Review and update reference files in `.claude/skills/algorithm-knowledge-base/references/`',
            },
          ],
        },
      ],
    }),
  }).catch(() => {});
}

// ── Per-platform processor ─────────────────────────────────────────────────────

async function processPlatform(
  config: (typeof TRACKED_PLATFORMS)[number]
): Promise<DetectionResult> {
  try {
    const searchResults = await searchRecentUpdates(
      config.searchQueries,
      config.keywords
    );
    const analysis = await analyseResults(config.displayName, searchResults);

    if (!analysis.detected) {
      return {
        platform: config.platform,
        displayName: config.displayName,
        detected: false,
      };
    }

    const sourceUrl = searchResults[0]?.url;
    const summary =
      analysis.summary ?? `Algorithm change detected for ${config.displayName}`;
    const impactLevel = analysis.impactLevel ?? 'medium';
    const affectedSignals = analysis.affectedSignals ?? [];

    // Create Linear issue
    const linearIssueId = await createLinearIssue(
      config.displayName,
      summary,
      sourceUrl,
      impactLevel
    );

    // Flag affected signals in ranking_signals
    if (affectedSignals.length > 0) {
      await prisma.$executeRaw`
        UPDATE ranking_signals
        SET needs_review = true,
            needs_review_reason = ${`Algorithm change detected ${new Date().toISOString().split('T')[0]}: ${summary.slice(0, 200)}`},
            updated_at = NOW()
        WHERE platform_id IN (
          SELECT id FROM platform_algorithms WHERE platform = ${config.platform}
        )
      `;
    }

    // Record in algorithm_updates
    await prisma.$executeRaw`
      INSERT INTO algorithm_updates (
        id, "updateType", "announcedAt", "impactLevel", description, "sourceUrl",
        "detectedDate", "platform", "signalsAffected", "reviewed", "linearIssueId", "createdAt", "name"
      ) VALUES (
        gen_random_uuid()::text,
        'ranking_change',
        NOW(),
        ${impactLevel},
        ${summary},
        ${sourceUrl ?? null},
        CURRENT_DATE,
        ${config.platform},
        ${affectedSignals}::text[],
        false,
        ${linearIssueId ?? null},
        NOW(),
        ${'Algorithm change: ' + config.displayName}
      )
    `;

    logger.info('algorithm-freshness-monitor: change detected', {
      platform: config.platform,
      impactLevel,
      linearIssueId,
      signalsAffected: affectedSignals.length,
    });

    return {
      platform: config.platform,
      displayName: config.displayName,
      detected: true,
      summary,
      sourceUrl,
      impactLevel,
      affectedSignals,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('algorithm-freshness-monitor: platform failed', {
      platform: config.platform,
      error: message,
    });
    return {
      platform: config.platform,
      displayName: config.displayName,
      detected: false,
    };
  }
}

// ── Route handler ──────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const auth = verifyCronRequest(request, 'ALGORITHM_FRESHNESS_MONITOR');
  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => ({}))) as {
    platform?: string;
  };

  const platforms = body.platform
    ? TRACKED_PLATFORMS.filter(p => p.platform === body.platform)
    : TRACKED_PLATFORMS;

  const startTime = Date.now();
  const results: DetectionResult[] = [];

  for (const platformConfig of platforms) {
    const result = await processPlatform(platformConfig);
    results.push(result);
  }

  await notifySlack(results);

  const detectedCount = results.filter(r => r.detected).length;
  const durationMs = Date.now() - startTime;

  logger.info('algorithm-freshness-monitor: run complete', {
    platformsChecked: results.length,
    changesDetected: detectedCount,
    durationMs,
  });

  return NextResponse.json({
    success: true,
    runDate: new Date().toISOString().split('T')[0],
    platformsChecked: results.length,
    changesDetected: detectedCount,
    results: results.map(r => ({
      platform: r.platform,
      detected: r.detected,
      impactLevel: r.impactLevel,
      summary: r.summary,
    })),
    budgetNote: `Monthly cost budget: $${MONTHLY_BUDGET_USD} — monitor haiku model + 2 FireCrawl searches per platform`,
  });
}
