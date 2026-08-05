/**
 * Senior-strategist final-gate before the CEO batched-review queue (AT-004).
 *
 * After brand-voice-enforce passes, `senior-strategist` decides whether the
 * artefact may enter the CEO queue. A pass stamps `gate: 'senior-strategist'`
 * on the step output; the CEO review queue API only lists waiting_approval
 * executions that carry that stamp with pass=true.
 */

import { invokeSkill } from '@/lib/ai/skills';
import { extractDraftFromPriorOutputs } from '@/lib/agency/brand-voice-gate';

export const STRATEGIST_GATE_ID = 'senior-strategist' as const;

export type StrategistRoutingAction =
  | 'proceed'
  | 'hold'
  | 'escalate-to-ceo'
  | 're-route-to-skill'
  | 'reject-with-rework';

export interface StrategistGateStamp {
  gate: typeof STRATEGIST_GATE_ID;
  agencyTaskId: 'AT-004';
  pass: boolean;
  action: StrategistRoutingAction | 'unparseable' | 'invoke_failed';
  nextSkill: string | null;
  ceoAttentionRequired: boolean;
  reason?: string;
  skill?: string;
  model?: string;
  draftLength: number;
  decisionExcerpt?: string;
}

export interface StrategistGateInput {
  draft: string;
  organizationId?: string;
  brandVoicePassed: boolean;
}

/**
 * True when a step outputData object is a strategist clearance stamp.
 */
export function isStrategistClearance(output: unknown): boolean {
  if (!output || typeof output !== 'object') return false;
  const o = output as Record<string, unknown>;
  return (
    o.gate === STRATEGIST_GATE_ID &&
    o.pass === true &&
    o.agencyTaskId === 'AT-004'
  );
}

/**
 * Prior brand-voice-enforce step must have passed before strategist final-gate.
 */
export function priorBrandVoicePassed(
  priorOutputs: { output: unknown }[]
): boolean {
  for (let i = priorOutputs.length - 1; i >= 0; i--) {
    const out = priorOutputs[i].output;
    if (!out || typeof out !== 'object') continue;
    const o = out as Record<string, unknown>;
    if (o.gate === 'brand-voice-enforce') {
      return o.pass === true;
    }
  }
  // No brand-voice step in this run — do not invent a pass; ad-hoc workflows
  // without the mechanical gate stay blocked from the CEO queue.
  return false;
}

export function extractDraftForStrategistGate(
  priorOutputs: { output: unknown }[]
): string {
  return extractDraftFromPriorOutputs(priorOutputs);
}

/**
 * Best-effort parse of SeniorStrategistDecision from model content.
 * Fail-closed: unparseable content does not clear the CEO queue.
 */
export function parseStrategistDecision(content: string): {
  action: StrategistRoutingAction | 'unparseable';
  nextSkill: string | null;
  ceoAttentionRequired: boolean;
  reason?: string;
} {
  const json = extractJsonObject(content);
  if (!json) {
    return {
      action: 'unparseable',
      nextSkill: null,
      ceoAttentionRequired: false,
      reason: 'no_structured_decision',
    };
  }

  const routing =
    json.routing_decision && typeof json.routing_decision === 'object'
      ? (json.routing_decision as Record<string, unknown>)
      : null;

  const rawAction =
    typeof routing?.action === 'string' ? routing.action.trim() : '';
  const action = isRoutingAction(rawAction) ? rawAction : 'unparseable';

  const nextSkill =
    routing?.next_skill === null
      ? null
      : typeof routing?.next_skill === 'string'
        ? routing.next_skill
        : null;

  const ceoAttentionRequired = json.ceo_attention_required === true;
  const reason =
    typeof json.ceo_attention_reason === 'string'
      ? json.ceo_attention_reason
      : typeof routing?.rework_reason === 'string'
        ? routing.rework_reason
        : undefined;

  return { action, nextSkill, ceoAttentionRequired, reason };
}

function isRoutingAction(value: string): value is StrategistRoutingAction {
  return (
    value === 'proceed' ||
    value === 'hold' ||
    value === 'escalate-to-ceo' ||
    value === 're-route-to-skill' ||
    value === 'reject-with-rework'
  );
}

function extractJsonObject(content: string): Record<string, unknown> | null {
  const trimmed = content.trim();
  if (!trimmed) return null;

  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fence?.[1]?.trim() ?? trimmed;

  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start < 0 || end <= start) return null;

  try {
    const parsed = JSON.parse(candidate.slice(start, end + 1)) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    return null;
  }
  return null;
}

export function decisionClearsCeoQueue(parsed: {
  action: StrategistRoutingAction | 'unparseable' | 'invoke_failed';
  nextSkill: string | null;
}): boolean {
  if (parsed.action === 'escalate-to-ceo') return true;
  if (parsed.action === 'proceed') {
    return (
      parsed.nextSkill === null ||
      parsed.nextSkill === 'ceo-batch-queue' ||
      parsed.nextSkill === 'ceo-immediate'
    );
  }
  return false;
}

function buildFinalGatePrompt(input: StrategistGateInput): string {
  return [
    'AT-004 final-gate review before the CEO batched-review queue.',
    'Brand-voice-enforce has already passed. Do not rewrite client-facing copy.',
    input.organizationId
      ? `Organisation ID: ${input.organizationId}`
      : 'Organisation ID: (unspecified)',
    '',
    'Decide whether this gated draft may enter the CEO batch queue.',
    'Return a complete SeniorStrategistDecision JSON object.',
    'For routine production ready for CEO batch, set:',
    '  routing_decision.action = "proceed"',
    '  routing_decision.next_skill = "ceo-batch-queue"',
    '  ceo_attention_required = false unless R-4 escalation criteria apply.',
    'Hold or reject-with-rework when the draft is not ready for CEO review.',
    '',
    'Gated draft:',
    input.draft.slice(0, 6_000),
  ].join('\n');
}

/**
 * Invoke senior-strategist and return the clearance stamp for step outputData.
 */
export async function runStrategistGate(
  input: StrategistGateInput
): Promise<StrategistGateStamp> {
  const draft = input.draft?.trim() ?? '';
  const draftLength = draft.length;

  if (!input.brandVoicePassed) {
    return {
      gate: STRATEGIST_GATE_ID,
      agencyTaskId: 'AT-004',
      pass: false,
      action: 'hold',
      nextSkill: 'brand-voice-enforce',
      ceoAttentionRequired: false,
      reason: 'brand_voice_not_passed',
      draftLength,
    };
  }

  if (!draft) {
    return {
      gate: STRATEGIST_GATE_ID,
      agencyTaskId: 'AT-004',
      pass: false,
      action: 'reject-with-rework',
      nextSkill: 'senior-copywriter',
      ceoAttentionRequired: false,
      reason: 'empty_draft',
      draftLength: 0,
    };
  }

  try {
    const result = await invokeSkill({
      skill: 'senior-strategist',
      prompt: buildFinalGatePrompt(input),
    });

    const parsed = parseStrategistDecision(result.content);
    const pass = decisionClearsCeoQueue(parsed);

    return {
      gate: STRATEGIST_GATE_ID,
      agencyTaskId: 'AT-004',
      pass,
      action: parsed.action,
      nextSkill: parsed.nextSkill,
      ceoAttentionRequired: parsed.ceoAttentionRequired,
      reason: parsed.reason,
      skill: result.skill.slug,
      model: result.model,
      draftLength,
      decisionExcerpt: result.content.slice(0, 500),
    };
  } catch (err) {
    return {
      gate: STRATEGIST_GATE_ID,
      agencyTaskId: 'AT-004',
      pass: false,
      action: 'invoke_failed',
      nextSkill: null,
      ceoAttentionRequired: false,
      reason: err instanceof Error ? err.message : 'invoke_failed',
      draftLength,
    };
  }
}
