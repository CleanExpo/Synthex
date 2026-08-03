import { z } from 'zod';
import {
  AnchoringAuditSchema,
  ContextFieldSchema,
  GoalContractSchema,
  IndependentEvaluationSchema,
  VisionMapSchema,
  type ContextField,
  type GoalContract,
} from './contracts';
import type { AcceptedVisionRecord, VisionAttemptRecord } from './engine';

const PAYLOAD_START = '<!-- intentscape-payload:start -->';
const PAYLOAD_END = '<!-- intentscape-payload:end -->';

const VisionAttemptRecordSchema = z
  .object({
    organizationId: z.string().min(1),
    workspaceId: z.string().min(1),
    contextVersion: z.number().int().positive(),
    attempt: z.number().int().min(1).max(2),
    status: z.enum(['accepted', 'rejected']),
    visionMap: VisionMapSchema.nullable(),
    deterministicAudit: AnchoringAuditSchema.nullable(),
    independentEvaluation: IndependentEvaluationSchema.nullable(),
    rejectionReasons: z.array(z.string()),
    createdAt: z.string().datetime(),
  })
  .strict();

const AcceptedVisionRecordSchema = z
  .object({
    organizationId: z.string().min(1),
    workspaceId: z.string().min(1),
    contextField: ContextFieldSchema,
    visionMap: VisionMapSchema,
    deterministicAudit: AnchoringAuditSchema,
    independentEvaluation: IndependentEvaluationSchema,
    acceptedAt: z.string().datetime(),
  })
  .strict();

export class IntentScapeMarkdownParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IntentScapeMarkdownParseError';
  }
}

function machinePayload(value: unknown): string {
  return [
    PAYLOAD_START,
    '```json',
    JSON.stringify(value, null, 2),
    '```',
    PAYLOAD_END,
  ].join('\n');
}

function parsePayload<T>(markdown: string, schema: z.ZodType<T>): T {
  const envelopeStart = `${PAYLOAD_START}\n\`\`\`json\n`;
  const envelopeEnd = `\n\`\`\`\n${PAYLOAD_END}`;
  const start = markdown.lastIndexOf(envelopeStart);
  const end = markdown.lastIndexOf(envelopeEnd);
  if (start < 0 || end <= start) {
    throw new IntentScapeMarkdownParseError(
      'Canonical machine payload markers are missing.'
    );
  }

  const payload = markdown.slice(start + envelopeStart.length, end);

  let parsed: unknown;
  try {
    parsed = JSON.parse(payload);
  } catch {
    throw new IntentScapeMarkdownParseError(
      'Canonical machine payload contains invalid JSON.'
    );
  }

  const result = schema.safeParse(parsed);
  if (!result.success) {
    throw new IntentScapeMarkdownParseError(
      `Canonical machine payload failed validation: ${result.error.issues
        .map(issue => `${issue.path.join('.') || 'root'}: ${issue.message}`)
        .join('; ')}`
    );
  }
  return result.data;
}

function markdownList(
  items: readonly string[],
  empty = '_None recorded._'
): string {
  return items.length ? items.map(item => `- ${item}`).join('\n') : empty;
}

function quote(value: string): string {
  return value
    .split('\n')
    .map(line => `> ${line}`)
    .join('\n');
}

export function renderOriginSignalMarkdown(input: {
  workspaceId: string;
  organizationId: string;
  originSignal: string;
  capturedAt: string;
  provenance: string;
}): string {
  return [
    '# Origin Signal',
    '',
    `- Workspace: \`${input.workspaceId}\``,
    `- Organisation: \`${input.organizationId}\``,
    `- Captured: ${input.capturedAt}`,
    `- Provenance: ${input.provenance}`,
    '- Goal authority: **none**',
    '- Search authority: **none**',
    '- Capability authority: **none**',
    '- Action authority: **none**',
    '',
    '_This is provenance, not the end goal._',
    '',
    quote(input.originSignal),
    '',
  ].join('\n');
}

export function renderContextFieldMarkdown(context: ContextField): string {
  const validated = ContextFieldSchema.parse(context);
  const signalSections = validated.signals
    .map(
      signal =>
        `### ${signal.label}\n\n` +
        `- Kind: \`${signal.kind}\`\n` +
        `- Evidence state: \`${signal.evidenceState}\`\n` +
        `- Provenance: ${signal.provenance}\n` +
        `${signal.sourceUrl ? `- Source: ${signal.sourceUrl}\n` : ''}\n` +
        quote(signal.content)
    )
    .join('\n\n');

  return [
    '# Context Field',
    '',
    `- Workspace: \`${validated.workspaceId}\``,
    `- Organisation: \`${validated.organizationId}\``,
    `- Version: ${validated.version}`,
    `- Created: ${validated.createdAt}`,
    '',
    '## Origin Signal — provenance only',
    '',
    '_This signal has no goal, search, capability, or action authority._',
    '',
    quote(validated.originSignal),
    '',
    '## Signals',
    '',
    signalSections,
    '',
    '## Contradictions',
    '',
    markdownList(validated.contradictions),
    '',
    '## Unknowns',
    '',
    markdownList(validated.unknowns),
    '',
    machinePayload(validated),
    '',
  ].join('\n');
}

export function parseContextFieldMarkdown(markdown: string): ContextField {
  return parsePayload(markdown, ContextFieldSchema);
}

export function renderVisionAttemptMarkdown(
  record: VisionAttemptRecord
): string {
  const validated = VisionAttemptRecordSchema.parse(record);
  const hypotheses = validated.visionMap?.hypotheses ?? [];
  return [
    `# Vision Expansion Attempt ${validated.attempt}`,
    '',
    `- Context version: ${validated.contextVersion}`,
    `- Status: \`${validated.status}\``,
    `- Recorded: ${validated.createdAt}`,
    '',
    '## Gate result',
    '',
    validated.deterministicAudit
      ? `- Deterministic anti-anchoring: ${validated.deterministicAudit.passed ? 'passed' : 'failed'}`
      : '- Deterministic anti-anchoring: not reached',
    validated.independentEvaluation
      ? `- Independent evaluation: ${validated.independentEvaluation.passed ? 'passed' : 'failed'} (${validated.independentEvaluation.confidence.toFixed(2)})`
      : '- Independent evaluation: not reached',
    '',
    '## Rejection reasons',
    '',
    markdownList(validated.rejectionReasons),
    '',
    '## Candidate directions',
    '',
    hypotheses.length
      ? hypotheses
          .map(
            (hypothesis, index) =>
              `### ${index + 1}. ${hypothesis.title}\n\n${hypothesis.causalMechanism}`
          )
          .join('\n\n')
      : '_No schema-valid candidate directions were produced._',
    '',
    machinePayload(validated),
    '',
  ].join('\n');
}

export function parseVisionAttemptMarkdown(
  markdown: string
): VisionAttemptRecord {
  return parsePayload(markdown, VisionAttemptRecordSchema);
}

export function renderAcceptedVisionMarkdown(
  record: AcceptedVisionRecord
): string {
  const validated = AcceptedVisionRecordSchema.parse(record);
  const lensSections = validated.visionMap.lensFindings
    .map(
      finding =>
        `### ${finding.lens}\n\n${markdownList(finding.findings)}\n\n` +
        `Evidence: ${finding.evidenceRefs.length ? finding.evidenceRefs.join(', ') : 'none'}\n\n` +
        `Unknowns:\n${markdownList(finding.unknowns)}`
    )
    .join('\n\n');
  const hypothesisSections = validated.visionMap.hypotheses
    .map(
      (hypothesis, index) =>
        `### ${index + 1}. ${hypothesis.title}\n\n` +
        `**Causal mechanism:** ${hypothesis.causalMechanism}\n\n` +
        `**Desired change:** ${hypothesis.desiredChange}\n\n` +
        `**Could be invalidated by:** ${hypothesis.invalidatingAssumption}\n\n` +
        `**Main risk:** ${hypothesis.mainRisk}\n\n` +
        `**Adjacent value:** ${hypothesis.adjacentValue}`
    )
    .join('\n\n');

  return [
    '# Accepted Vision Map',
    '',
    `- Context version: ${validated.visionMap.contextVersion}`,
    `- Accepted: ${validated.acceptedAt}`,
    `- Independent confidence: ${validated.independentEvaluation.confidence.toFixed(2)}`,
    '- Goal authority: **none**',
    '- Action authority: **none**',
    '',
    '## Seven independent lenses',
    '',
    lensSections,
    '',
    '## Competing hypotheses',
    '',
    hypothesisSections,
    '',
    '## Synthesis',
    '',
    validated.visionMap.synthesis,
    '',
    machinePayload(validated),
    '',
  ].join('\n');
}

export function parseAcceptedVisionMarkdown(
  markdown: string
): AcceptedVisionRecord {
  return parsePayload(markdown, AcceptedVisionRecordSchema);
}

export function renderGoalContractMarkdown(contract: GoalContract): string {
  const validated = GoalContractSchema.parse(contract);
  return [
    '# Approved Goal Contract',
    '',
    `- Contract: \`${validated.id}\``,
    `- Hypothesis: \`${validated.hypothesisId}@${validated.hypothesisVersion}\``,
    `- Context version: ${validated.contextVersion}`,
    `- Approved by: \`${validated.approvedBy}\``,
    `- Approved at: ${validated.approvedAt}`,
    '',
    '## Desired change',
    '',
    validated.desiredChange,
    '',
    '## Primary stakeholder',
    '',
    validated.primaryStakeholder,
    '',
    '## Acceptance criteria',
    '',
    markdownList(validated.acceptanceCriteria),
    '',
    '## Exclusions',
    '',
    markdownList(validated.exclusions),
    '',
    '## Authority boundaries',
    '',
    markdownList(validated.authorityBoundaries),
    '',
    '## Evidence references',
    '',
    markdownList(validated.evidenceRefs),
    '',
    machinePayload(validated),
    '',
  ].join('\n');
}

export function parseGoalContractMarkdown(markdown: string): GoalContract {
  return parsePayload(markdown, GoalContractSchema);
}
