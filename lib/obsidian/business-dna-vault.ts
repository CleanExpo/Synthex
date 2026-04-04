/**
 * Business DNA Vault Operations
 *
 * Manages per-client Obsidian vault notes for persistent AI context.
 *
 * Vault path convention: Clients/{orgId}/
 *   business-dna.md  — Brand profile (auto-populated from Business DNA extraction)
 *   insights.md      — Auto-research insights, dated entries
 */

import { readNote, writeNote, appendToNote } from './client';

export interface TrendInsightRecord {
  platform: string;
  category: string;
  insight: string;
  confidence: number;
}

export interface BusinessDNA {
  name: string;
  industry?: string;
  tone?: string;
  targetAudience?: string;
  usp?: string;
  keywords?: string[];
  colours?: string[];
  typography?: string;
}

function clientPath(orgId: string, file: string): string {
  return `Clients/${orgId}/${file}`;
}

/**
 * Read the Business DNA profile note for a client.
 * Returns the raw markdown content of business-dna.md, or '' if absent.
 */
export async function getClientDNA(orgId: string): Promise<string> {
  return readNote(clientPath(orgId, 'business-dna.md'));
}

/**
 * Write (overwrite) the Business DNA profile for a client.
 */
export async function syncBusinessDNA(
  orgId: string,
  dna: BusinessDNA
): Promise<void> {
  const lines = [
    `# Business DNA — ${dna.name}`,
    '',
    ...(dna.industry ? [`**Industry:** ${dna.industry}`] : []),
    ...(dna.tone ? [`**Tone of Voice:** ${dna.tone}`] : []),
    ...(dna.targetAudience
      ? [`**Target Audience:** ${dna.targetAudience}`]
      : []),
    ...(dna.usp ? [`**USP:** ${dna.usp}`] : []),
    ...(dna.keywords?.length
      ? [`**Keywords:** ${dna.keywords.join(', ')}`]
      : []),
    ...(dna.colours?.length
      ? [`**Brand Colours:** ${dna.colours.join(', ')}`]
      : []),
    ...(dna.typography ? [`**Typography:** ${dna.typography}`] : []),
  ];

  await writeNote(clientPath(orgId, 'business-dna.md'), lines.join('\n'));
}

/**
 * Append trend insights to a client's insights note.
 * Prefixes each batch with an ISO date header for easy time-based filtering.
 */
export async function updateClientInsights(
  orgId: string,
  insights: TrendInsightRecord[]
): Promise<void> {
  if (insights.length === 0) return;
  const date = new Date().toISOString().slice(0, 10);
  const lines = [
    `\n## ${date}`,
    ...insights.map(
      i =>
        `- [${i.platform}] [${i.category}] ${i.insight} _(confidence: ${(i.confidence * 100).toFixed(0)}%)_`
    ),
  ];
  await appendToNote(clientPath(orgId, 'insights.md'), lines.join('\n'));
}

/**
 * Get the full insights history for a client.
 * Returns raw markdown — callers filter by ## date headers as needed.
 */
export async function getResearchHistory(
  orgId: string,
  _days: number = 7
): Promise<string> {
  return readNote(clientPath(orgId, 'insights.md'));
}
