/**
 * AI content-generation eval harness — public barrel.
 *
 * Deterministic, offline regression harness for AI-generated content. In CI it
 * runs against a mocked AIProvider (no real model, no network, no cost). A
 * live mode (AI_EVAL_LIVE=1) drives the real provider for manual checks.
 *
 * NODE-ONLY: not reachable from instrumentation.ts / the edge bundle.
 */

export type {
  EvalPlatform,
  CaseExpectations,
  GoldenCase,
  CheckResult,
  CaseScore,
  EvalReport,
} from './types';

export { BANNED_PHRASES, runChecks, scoreCase } from './scorer';
export {
  GOLDEN_CASES,
  GOOD_OUTPUTS,
  BAD_OUTPUTS,
} from './golden-cases';
export {
  MockAIProvider,
  CASE_MARKER,
  resolveCaseId,
} from './mock-provider';
export {
  runEval,
  runMockEval,
  runLiveEval,
  isLiveEvalEnabled,
  formatReport,
} from './runner';
