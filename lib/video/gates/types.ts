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
  /** The video asset / hero id this verdict judges. Keyed into QA-row metadata. */
  assetRef: string;
  /** Untrusted content to grade (brief JSON, transcript, caption bundle, ...). */
  candidate: unknown;
  /**
   * Owning MarketingAgencyCampaign, if one exists for this run.
   *
   * SCHEMA-FIT BLOCKER (WS3a, flagged for Phill's morning decision — see
   * WS3a-PLAN.md + PR body): `MarketingAgencyQaReport.campaignId` is a
   * required FK to `MarketingAgencyCampaign` and the model has no
   * asset/video-ref column. A video gate run has no natural campaign. Per
   * the overnight guardrails, no migration/column was added to work around
   * this. When `campaignId` is omitted, QA-row persistence is skipped (see
   * `persistenceSkipped` on the result) rather than writing a row that lies
   * about which campaign owns it.
   */
  campaignId?: string;
}

export interface RunGateResult {
  pass: boolean;
  verdict: GateVerdict;
  /** MarketingAgencyQaReport.id, or null when persistence was skipped/failed. */
  reportId: string | null;
  /** True when the QA row was NOT written (schema-fit blocker — see RunGateInput.campaignId). */
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
        blockedReasons.length ? blockedReasons.join('; ') : 'no passing QA report found'
      }`
    );
    this.name = 'GateFailedError';
    this.gate = gate;
    this.assetRef = assetRef;
    this.blockedReasons = blockedReasons;
  }
}
