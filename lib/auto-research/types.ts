/**
 * Auto-Research System — Shared Types
 */
import type { SupportedPlatform, InsightCategory } from './apify/types';

export type { SupportedPlatform, InsightCategory };

export interface ResearchJobInput {
  platforms: SupportedPlatform[];
  depth: 'quick' | 'deep';
  orgId?: string;
  runId: string; // AutoResearchRun.id
}

export interface ResearchResult {
  runId: string;
  insightsExtracted: number;
  promptsUpdated: number;
  platformsScraped: SupportedPlatform[];
  error?: string;
}
