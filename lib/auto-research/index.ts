/**
 * Auto-Research System — Public API
 */
export { runDailyTrends, runWeeklyDeep } from './orchestrator';
export {
  enqueueManualRun,
  registerScheduledJobs,
  getResearchQueue,
  ResearchQueueUnavailableError,
} from './scheduler';
export type {
  ResearchResult,
  ResearchJobInput,
  SupportedPlatform,
  InsightCategory,
} from './types';
