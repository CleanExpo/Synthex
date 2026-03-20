/**
 * Per-Client Knowledge Base Builder
 *
 * Assembles Obsidian vault context for injection into AI content generation.
 * Self-improving: the more the platform is used, the richer the context becomes.
 *
 * Vault structure per client:
 *   Clients/{orgId}/context.md             — Running AI context (curated or auto-updated)
 *   Clients/{orgId}/business-dna.md        — Brand profile
 *   Clients/{orgId}/insights.md            — Auto-research insights
 *   Clients/{orgId}/performance/{YYYY-MM}.md — Monthly performance snapshots
 */

import { readNote, appendToNote } from './client';
import { getResearchHistory } from './business-dna-vault';

export interface CampaignMetrics {
  impressions?: number;
  engagementRate?: number;
  clicks?: number;
  conversions?: number;
  reach?: number;
}

function clientPath(orgId: string, file: string): string {
  return `Clients/${orgId}/${file}`;
}

/**
 * Build enriched context string for AI content generation.
 * Reads context.md + business-dna.md + last 7 days of research insights.
 * Returns '' when Obsidian is disabled — generation proceeds without context.
 */
export async function buildContextForGeneration(
  orgId: string
): Promise<string> {
  const [contextNote, dna, recentInsights] = await Promise.all([
    readNote(clientPath(orgId, 'context.md')),
    readNote(clientPath(orgId, 'business-dna.md')),
    getResearchHistory(orgId, 7),
  ]);

  const parts: string[] = [];

  if (dna) {
    parts.push('## Brand Profile\n' + dna);
  }

  if (contextNote) {
    parts.push('## Client Context\n' + contextNote);
  }

  if (recentInsights) {
    // Trim to last ~2000 chars to keep prompt lean across 1M-context sessions
    const trimmed = recentInsights.slice(-2000);
    parts.push('## Recent Research Insights\n' + trimmed);
  }

  return parts.join('\n\n');
}

/**
 * Record campaign performance metrics into the client's monthly performance note.
 */
export async function recordCampaignPerformance(
  orgId: string,
  campaignId: string,
  metrics: CampaignMetrics
): Promise<void> {
  const date = new Date().toISOString().slice(0, 10);
  const month = date.slice(0, 7); // YYYY-MM

  const lines = [
    `\n### ${date} — Campaign ${campaignId}`,
    ...(metrics.impressions != null
      ? [`- Impressions: ${metrics.impressions.toLocaleString()}`]
      : []),
    ...(metrics.engagementRate != null
      ? [`- Engagement Rate: ${(metrics.engagementRate * 100).toFixed(2)}%`]
      : []),
    ...(metrics.clicks != null
      ? [`- Clicks: ${metrics.clicks.toLocaleString()}`]
      : []),
    ...(metrics.conversions != null
      ? [`- Conversions: ${metrics.conversions}`]
      : []),
    ...(metrics.reach != null
      ? [`- Reach: ${metrics.reach.toLocaleString()}`]
      : []),
  ];

  await appendToNote(
    clientPath(orgId, `performance/${month}.md`),
    lines.join('\n')
  );
}
