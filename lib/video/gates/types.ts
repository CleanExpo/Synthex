/**
 * Gate types — nexus-viral productionise WS3 (SYN-1075).
 *
 * Shared types for the LLM producers (runBriefGrill / runBroadcastGrill,
 * ./index.ts) and the deterministic enforcer (assertGatePassed,
 * ./assert-gate-passed.ts).
 */

import { z } from 'zod';

export type GateName = 'brief' | 'broadcast';

/**
 * Strict verdict contract both gates must return (see ./rubrics.ts
 * VERDICT_CONTRACT_INSTRUCTIONS). Fail-closed: any response that does not
 * validate against this schema is treated as a FAIL by the caller, never a
 * pass-by-default.
 */
export const GateVerdictSchema = z.object({
  pass: z.boolean(),
  score: z.number().min(0).max(100),
  failures: z.array(z.string()).default([]),
  warnings: z.array(z.string()).default([]),
  rubric_version: z.string(),
});

export type GateVerdict = z.infer<typeof GateVerdictSchema>;

export interface RunGateInput {
  organizationId: string;
  createdById: string;
  /**
   * The stable subject id this verdict judges — the run/job id for the brief
   * gate, the rendered hero video_asset id for the broadcast gate. Persisted
   * as `video_gate_verdicts.ref` and read back by assertGatePassed.
   */
  assetRef: string;
  /** Untrusted content to grade (brief JSON, transcript, caption bundle, ...). */
  candidate: unknown;
}

export interface RunGateResult {
  pass: boolean;
  verdict: GateVerdict;
  /** VideoGateVerdict.id, or null when the write failed. */
  verdictId: string | null;
  /**
   * True when the verdict row was NOT written (a DB write failure). A skipped
   * write means assertGatePassed will fail closed for this ref — a FAIL is
   * never silently upgraded to an inert pass.
   */
  persistenceSkipped: boolean;
}

/**
 * Thrown by assertGatePassed when the gate blocks. Deterministic and
 * terminal for the caller — no auto-retry loop lives here (spec §15.3).
 */
export class GateFailedError extends Error {
  readonly gate: GateName;
  readonly assetRef: string;
  readonly blockedReasons: string[];

  constructor(gate: GateName, assetRef: string, blockedReasons: string[]) {
    super(
      `Gate '${gate}' failed for asset ${assetRef}: ${
        blockedReasons.length
          ? blockedReasons.join('; ')
          : 'no passing QA report found'
      }`
    );
    this.name = 'GateFailedError';
    this.gate = gate;
    this.assetRef = assetRef;
    this.blockedReasons = blockedReasons;
  }
}
