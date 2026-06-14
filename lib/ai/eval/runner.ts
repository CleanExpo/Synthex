/**
 * Runner for the AI content-generation eval harness.
 *
 * Drives the deterministic scorer against an AIProvider:
 *   - CI / default: a MockAIProvider returning fixed canned outputs (offline).
 *   - Live (opt-in): the real provider from lib/ai/providers, ONLY when the
 *     AI_EVAL_LIVE=1 env flag is set. Live mode hits the real model and costs
 *     money — it is NEVER run in CI.
 *
 * The runner embeds each case's id in the system message (CASE_MARKER) so the
 * mock provider can return the matching canned output. Real providers ignore
 * the marker harmlessly (it reads as extra system context).
 */

import type {
  AICompletionRequest,
  AIProvider,
} from '../providers/base-provider';
import { GOLDEN_CASES, GOOD_OUTPUTS } from './golden-cases';
import { MockAIProvider, CASE_MARKER } from './mock-provider';
import { scoreCase } from './scorer';
import type { CaseScore, EvalReport, GoldenCase } from './types';

/** Build the provider request for a single golden case. */
function buildRequest(
  goldenCase: GoldenCase,
  model: string
): AICompletionRequest {
  return {
    model,
    messages: [
      {
        role: 'system',
        content: `You generate platform-optimized marketing content. ${CASE_MARKER}${goldenCase.id}`,
      },
      { role: 'user', content: goldenCase.prompt },
    ],
    temperature: 0.7,
    max_tokens: 400,
  };
}

/**
 * Run the harness against a supplied provider. Pure with respect to the
 * provider: same provider + cases => same report. Used by both the mock and
 * live paths.
 */
export async function runEval(
  provider: AIProvider,
  cases: readonly GoldenCase[] = GOLDEN_CASES
): Promise<EvalReport> {
  const caseScores: CaseScore[] = [];

  for (const goldenCase of cases) {
    const request = buildRequest(goldenCase, provider.models.balanced);
    const response = await provider.complete(request);
    const output = response.choices[0]?.message?.content ?? '';
    caseScores.push(scoreCase(goldenCase, output));
  }

  const passedCases = caseScores.filter(c => c.passed).length;
  const totalCases = caseScores.length;
  const aggregateScore =
    totalCases === 0
      ? 1
      : caseScores.reduce((sum, c) => sum + c.score, 0) / totalCases;

  return {
    cases: caseScores,
    passedCases,
    totalCases,
    aggregateScore,
    passed: passedCases === totalCases,
  };
}

/**
 * CI entry point: run the harness fully offline against the canned GOOD
 * outputs. This is the regression baseline — it must always pass.
 */
export async function runMockEval(
  outputs: Record<string, string> = GOOD_OUTPUTS,
  cases: readonly GoldenCase[] = GOLDEN_CASES
): Promise<EvalReport> {
  return runEval(new MockAIProvider(outputs), cases);
}

/** True when live eval mode is explicitly enabled. Never set in CI. */
export function isLiveEvalEnabled(): boolean {
  return process.env.AI_EVAL_LIVE === '1';
}

/**
 * Live entry point: run the harness against the REAL configured provider.
 * Lazy-imports the provider factory so the real SDK never enters the module
 * graph in CI / mock runs. Throws unless AI_EVAL_LIVE=1 to prevent accidental
 * paid calls.
 */
export async function runLiveEval(
  cases: readonly GoldenCase[] = GOLDEN_CASES
): Promise<EvalReport> {
  if (!isLiveEvalEnabled()) {
    throw new Error(
      'Live eval disabled. Set AI_EVAL_LIVE=1 to run against the real provider (costs money; never in CI).'
    );
  }
  // Lazy import keeps the real provider + OpenAI SDK out of the offline path.
  const { getAIProvider } = await import('../providers');
  return runEval(getAIProvider(), cases);
}

/** Render a compact human-readable summary of a report (for CLI / live mode). */
export function formatReport(report: EvalReport): string {
  const lines: string[] = [];
  lines.push(
    `AI eval: ${report.passedCases}/${report.totalCases} cases passed ` +
      `(aggregate ${(report.aggregateScore * 100).toFixed(1)}%)`
  );
  for (const c of report.cases) {
    const status = c.passed ? 'PASS' : 'FAIL';
    lines.push(`  [${status}] ${c.caseId} — ${c.passedChecks}/${c.totalChecks} checks`);
    if (!c.passed) {
      for (const check of c.checks.filter(ch => !ch.passed)) {
        lines.push(`        ✗ ${check.name}: ${check.detail ?? 'failed'}`);
      }
    }
  }
  return lines.join('\n');
}
