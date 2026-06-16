/**
 * Auto-Research System — Shared Types
 */
import type { SupportedPlatform, InsightCategory } from './apify/types';
import type { ResearchBridgeReceipt } from './research-bridge';

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
  /** Governed-opportunity bridge summary (SYN-1033) — present when org-scoped. */
  bridge?: ResearchBridgeReceipt;
  error?: string;
}
