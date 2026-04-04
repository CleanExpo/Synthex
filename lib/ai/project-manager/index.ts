/**
 * AI Project Manager Module
 *
 * Per-client AI Senior Project Manager for Synthex.
 * Business plan only ($399/month).
 *
 * @module lib/ai/project-manager
 */

export { buildPMContext, serializeContext, type PMContext } from './context-builder';
export {
  generatePMResponse,
  extractStructuredData,
  generateWeeklyDigest,
  generateProactiveSuggestions,
  generateDashboardGreeting,
} from './pm-engine';
export {
  PM_PERSONA_PROMPT,
  WEEKLY_DIGEST_PROMPT,
  PROACTIVE_INSIGHT_PROMPT,
  EXTRACTION_PROMPT,
} from './system-prompts';
