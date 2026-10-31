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
 * VERDICT PERSISTENCE (SYN-1094, Option C): each verdict is written as one
 * `video_gate_verdicts` row (prisma.videoGateVerdict) keyed on the stable
 * `ref` this gate judged — NO campaign coupling. `assertGatePassed`
 * (./assert-gate-passed.ts) reads the latest (ref, gate) row and fails closed
 * unless status == 'passed'. A DB write failure is surfaced as
 * `persistenceSkipped: true` (never a silent FAIL→pass upgrade), so the
 * fail-closed read still applies.
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { getAIProvider } from '@/lib/ai/providers';
import { structuredOutput } from '@/lib/ai/structured-output';
import { buildGradePrompt } from './prompt';
import { BRIEF_RUBRIC, BROADCAST_RUBRIC, RUBRIC_VERSION } from './rubrics';
import {
  GateVerdictSchema,
  type GateName,
  type GateVerdict,
  type RunGateInput,
  type RunGateResult,
} from './types';

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

async function callGrader(
  rubric: string,
  candidate: unknown
): Promise<GateVerdict> {
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
    logger.error('gates: provider call failed — failing closed', {
      error: err,
    });
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
 * Persist one `video_gate_verdicts` row for this verdict, keyed on the stable
 * `ref` this gate judged (SYN-1094, Option C). A DB write failure is surfaced
 * as `persistenceSkipped: true` — never a silent best-effort swallow — so
 * assertGatePassed's fail-closed read still applies when nothing was written.
 */
async function persistQaReport(
  gate: GateName,
  input: RunGateInput,
  verdict: GateVerdict
): Promise<{ verdictId: string | null; persistenceSkipped: boolean }> {
  try {
    const created = await prisma.videoGateVerdict.create({
      data: {
        organizationId: input.organizationId,
        ref: input.assetRef,
        gate,
        status: verdict.pass ? 'passed' : 'blocked',
        blockedReasons: verdict.failures,
        metadata: {
          gate,
          ref: input.assetRef,
          createdById: input.createdById,
          rubric_version: verdict.rubric_version,
          score: verdict.score,
          warnings: verdict.warnings,
        },
      },
    });
    return { verdictId: created.id, persistenceSkipped: false };
  } catch (err) {
    // Persistence failure must never silently upgrade a FAIL to inert-pass —
    // surface it as skipped so assertGatePassed's fail-closed read still applies.
    logger.error('gates: verdict persistence failed', {
      error: err,
      gate,
      assetRef: input.assetRef,
    });
    return { verdictId: null, persistenceSkipped: true };
  }
}

async function runGate(
  gate: GateName,
  rubric: string,
  input: RunGateInput
): Promise<RunGateResult> {
  const verdict = await callGrader(rubric, input.candidate);
  const { verdictId, persistenceSkipped } = await persistQaReport(
    gate,
    input,
    verdict
  );
  return { pass: verdict.pass, verdict, verdictId, persistenceSkipped };
}

/** Gate A — pre-generation brief grill. */
export async function runBriefGrill(
  input: RunGateInput
): Promise<RunGateResult> {
  return runGate('brief', BRIEF_RUBRIC, input);
}

/** Gate B — post-generation broadcast grill. */
export async function runBroadcastGrill(
  input: RunGateInput
): Promise<RunGateResult> {
  return runGate('broadcast', BROADCAST_RUBRIC, input);
}

export { GateVerdictSchema } from './types';
export type {
  GateName,
  GateVerdict,
  RunGateInput,
  RunGateResult,
} from './types';
