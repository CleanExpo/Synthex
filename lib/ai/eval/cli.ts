/**
 * CLI entry for the AI content-generation eval harness.
 *
 * Run via:  npm run ai:eval            (offline mock — same as CI)
 *           AI_EVAL_LIVE=1 npm run ai:eval   (real provider — costs money)
 *
 * Exits non-zero when any case fails so it can gate a manual check. Live mode
 * is opt-in and never wired into CI.
 */

import { runMockEval, runLiveEval, isLiveEvalEnabled, formatReport } from './runner';

async function main(): Promise<void> {
  const live = isLiveEvalEnabled();
  const report = live ? await runLiveEval() : await runMockEval();

  // eslint-disable-next-line no-console
  console.log(`Mode: ${live ? 'LIVE (real provider)' : 'MOCK (offline)'}`);
  // eslint-disable-next-line no-console
  console.log(formatReport(report));

  if (!report.passed) {
    process.exitCode = 1;
  }
}

main().catch((err: unknown) => {
  console.error('ai:eval failed:', err);
  process.exitCode = 1;
});
