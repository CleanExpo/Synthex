/**
 * Gate producers — runBriefGrill / runBroadcastGrill — nexus-viral
 * productionise WS3a (SYN-1075, spec §9 WS3 / §12).
 *
 * LLM producers via getAIProvider().complete(): judge the candidate content
 * against a versioned rubric (./rubrics.ts) using a data-fenced prompt
 * (./prompt.ts, prompt-injection hardening), returning a structured JSON
 * verdict (./types.ts GateVerdictSchema). Any unparseable/missing verdict is
 * treated as a FAIL — never a pass-by-default.
 *
 * QA-ROW PERSISTENCE — SCHEMA-FIT BLOCKER (flagged for Phill, see PR body):
 * `MarketingAgencyQaReport.campaignId` is a required FK to
 * `MarketingAgencyCampaign` and the model has no asset/video-ref column. A
 * video gate run has no natural campaign. Per the overnight hard-stop
 * guardrails, NO migration/column was added. When the caller does not pass a
 * real `campaignId`, persistence is skipped (not faked) and the result flags
 * `persistenceSkipped: true`. `assertGatePassed` (./assert-gate-passed.ts)
 * fails closed on a missing row, so until this is resolved every gate call
 * without a campaignId is effectively unenforceable via the QA-row path —
 * this is a known, documented limitation of the current schema, not a bug.
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { getAIProvider } from '@/lib/ai/providers';
import { structuredOutput } from '@/lib/ai/structured-output';
import { buildGradePrompt } from './prompt';
import { BRIEF_RUBRIC, BROADCAST_RUBRIC, RUBRIC_VERSION } from './rubrics';
import { GateVerdictSchema, type GateName, type GateVerdict, type RunGateInput, type RunGateResult } from './types';

const outputFormat = structuredOutput(GateVerdictSchema);

/** Fail-closed verdict used whenever the LLM response is missing/malformed/errored. */
function failClosedVerdict(reason: string): GateVerdict {
  return {
    pass: false,
    score: 0,
    failures: [`gate_producer_fail_closed: ${reason}`],
    warnings: [],
    rubric_version: RUBRIC_VERSION,
  };
}

async function callGrader(rubric: string, candidate: unknown): Promise<GateVerdict> {
  const ai = getAIProvider();
  const messages = buildGradePrompt({ rubric, candidate });

  let raw: unknown;
  try {
    const res = await ai.complete({
      model: ai.models.balanced,
      messages,
      temperature: 0,
      outputFormat,
    });
    raw = res.parsed;
  } catch (err) {
    logger.error('gates: provider call failed — failing closed', { error: err });
    return failClosedVerdict(err instanceof Error ? err.message : String(err));
  }

  const parsed = GateVerdictSchema.safeParse(raw);
  if (!parsed.success) {
    logger.error('gates: malformed/missing verdict — failing closed', {
      issues: parsed.error.issues.slice(0, 5),
    });
    return failClosedVerdict('malformed_or_missing_verdict');
  }

  return parsed.data;
}

/**
 * Persist a MarketingAgencyQaReport row for this verdict, or skip (flagged)
 * when no real campaignId is available. See the schema-fit blocker note
 * above — this is intentionally NOT a silent best-effort write; the skip is
 * always surfaced on the result so callers/tests can assert on it.
 */
async function persistQaReport(
  gate: GateName,
  input: RunGateInput,
  verdict: GateVerdict
): Promise<{ reportId: string | null; persistenceSkipped: boolean }> {
  if (!input.campaignId) {
    logger.warn('gates: QA-row persistence skipped — schema-fit blocker (no campaignId)', {
      gate,
      assetRef: input.assetRef,
      organizationId: input.organizationId,
    });
    return { reportId: null, persistenceSkipped: true };
  }

  try {
    const created = await prisma.marketingAgencyQaReport.create({
      data: {
        organizationId: input.organizationId,
        createdById: input.createdById,
        campaignId: input.campaignId,
        status: verdict.pass ? 'passed' : 'blocked',
        blockedReasons: verdict.failures,
        warnings: verdict.warnings,
        checks: [{ gate, score: verdict.score, pass: verdict.pass }],
        metadata: {
          gate,
          assetRef: input.assetRef,
          rubric_version: verdict.rubric_version,
          score: verdict.score,
        },
      },
    });
    return { reportId: created.id, persistenceSkipped: false };
  } catch (err) {
    // Persistence failure must never silently upgrade a FAIL to inert-pass —
    // surface it as skipped so assertGatePassed's fail-closed read still applies.
    logger.error('gates: QA-row persistence failed', { error: err, gate, assetRef: input.assetRef });
    return { reportId: null, persistenceSkipped: true };
  }
}

async function runGate(gate: GateName, rubric: string, input: RunGateInput): Promise<RunGateResult> {
  const verdict = await callGrader(rubric, input.candidate);
  const { reportId, persistenceSkipped } = await persistQaReport(gate, input, verdict);
  return { pass: verdict.pass, verdict, reportId, persistenceSkipped };
}

/** Gate A — pre-generation brief grill. */
export async function runBriefGrill(input: RunGateInput): Promise<RunGateResult> {
  return runGate('brief', BRIEF_RUBRIC, input);
}

/** Gate B — post-generation broadcast grill. */
export async function runBroadcastGrill(input: RunGateInput): Promise<RunGateResult> {
  return runGate('broadcast', BROADCAST_RUBRIC, input);
}

export { GateVerdictSchema } from './types';
export type { GateName, GateVerdict, RunGateInput, RunGateResult } from './types';
