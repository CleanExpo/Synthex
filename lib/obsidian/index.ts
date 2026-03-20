export {
  obsidianClient,
  readNote,
  writeNote,
  appendToNote,
  searchNotes,
  isEnabled,
} from './client';
export type { ObsidianNote, ObsidianSearchResult } from './client';

export {
  getClientDNA,
  syncBusinessDNA,
  updateClientInsights,
  getResearchHistory,
} from './business-dna-vault';
export type { TrendInsightRecord, BusinessDNA } from './business-dna-vault';

export {
  buildContextForGeneration,
  recordCampaignPerformance,
} from './client-knowledge-base';
export type { CampaignMetrics } from './client-knowledge-base';
