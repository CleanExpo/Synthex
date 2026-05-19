import type { BoardInput } from '../intake/board-input.schema';
import type {
  ResearchCouncilFinding,
  ResearchCouncilPacket,
  ResearchCouncilRole,
  ResearchEvidenceRef,
} from './research-council.schema';

const DEFAULT_RESEARCH_ROUTE: ResearchCouncilRole[] = [
  'market-researcher',
  'technical-architect',
  'brand-strategist',
  'contrarian-reviewer',
  'chair',
];

export interface BuildResearchCouncilPacketRequest {
  boardInput: BoardInput;
  sourceRefs?: ResearchEvidenceRef[];
  idFactory?: () => string;
}

export function buildResearchCouncilPacket(
  request: BuildResearchCouncilPacketRequest
): ResearchCouncilPacket {
  const sourceRefs = normalizeEvidenceRefs(
    request.sourceRefs,
    request.boardInput.evidenceRefs
  );
  const findings = buildFindings(request.boardInput, sourceRefs);
  const confidence = average(findings.map(finding => finding.confidence));
  const openQuestions = buildOpenQuestions(request.boardInput, findings);

  return {
    id: request.idFactory?.() ?? crypto.randomUUID(),
    boardInputId: request.boardInput.id,
    question: request.boardInput.cleanedText,
    councilRoute: DEFAULT_RESEARCH_ROUTE,
    findings,
    synthesis: {
      decision: buildDecision(confidence, openQuestions.length),
      confidence,
      openQuestions,
    },
    approvalGate:
      confidence >= 0.72 && openQuestions.length === 0
        ? 'human_review'
        : 'production_blocked',
    learningLoop: {
      metric: 'evidence_backed_decision_quality',
      keepCriteria:
        'Keep the packet when source-backed findings reduce open questions and improve command accuracy.',
      discardCriteria:
        'Discard or revise when evidence is missing, confidence falls below 0.72, or risks remain unresolved.',
    },
  };
}

function normalizeEvidenceRefs(
  sourceRefs: ResearchEvidenceRef[] | undefined,
  boardEvidenceRefs: string[]
): ResearchEvidenceRef[] {
  const explicitRefs = sourceRefs ?? [];
  const mappedRefs = boardEvidenceRefs.map(ref => ({
    ref,
    sourceType: inferSourceType(ref),
    summary: `Board input evidence reference: ${ref}`,
  }));

  return [...explicitRefs, ...mappedRefs];
}

function buildFindings(
  input: BoardInput,
  evidenceRefs: ResearchEvidenceRef[]
): ResearchCouncilFinding[] {
  const hasEvidence = evidenceRefs.length > 0;
  const baseConfidence = hasEvidence ? 0.76 : 0.42;

  return [
    {
      role: 'market-researcher',
      claim: 'Treat the request as a question-led research brief before creative production.',
      evidenceRefs: evidenceOrPlaceholder(evidenceRefs),
      confidence: hasEvidence ? baseConfidence : 0.42,
      risks: hasEvidence ? [] : ['Missing source evidence for market claims.'],
      nextAction:
        'Assemble audience, competitor, search, YouTube, and social signals into one brief.',
    },
    {
      role: 'technical-architect',
      claim:
        'Keep orchestration in Synthex command-center services and provider calls behind adapters.',
      evidenceRefs: evidenceOrPlaceholder(evidenceRefs),
      confidence: referencesTechnicalWork(input.cleanedText) ? 0.82 : baseConfidence,
      risks: referencesTechnicalWork(input.cleanedText)
        ? []
        : ['Implementation scope still needs service-layer mapping.'],
      nextAction:
        'Attach repo, API, provider, and command-route dependencies before build work starts.',
    },
    {
      role: 'brand-strategist',
      claim:
        'Creative outputs need a brand, consent, licensing, and approval gate before export.',
      evidenceRefs: evidenceOrPlaceholder(evidenceRefs),
      confidence: referencesCreativeWork(input.cleanedText) ? 0.84 : baseConfidence,
      risks: referencesCreativeWork(input.cleanedText)
        ? []
        : [],
      nextAction:
        'Bind business voice, offer, channel, and media rights before production mode.',
    },
    {
      role: 'contrarian-reviewer',
      claim:
        'A packet is not ready when it has no cited evidence, unresolved risks, or unclear ownership.',
      evidenceRefs: evidenceOrPlaceholder(evidenceRefs),
      confidence: hasEvidence ? 0.78 : 0.5,
      risks: hasEvidence ? [] : ['Research council must block production without source refs.'],
      nextAction:
        'Challenge assumptions, missing evidence, and hidden publish or spend risk.',
    },
  ];
}

function buildOpenQuestions(
  input: BoardInput,
  findings: ResearchCouncilFinding[]
): string[] {
  const questions = new Set<string>();

  findings.flatMap(finding => finding.risks).forEach(risk => questions.add(risk));

  if (!/\bmetric|roi|views|clicks|lead|conversion|rank\b/i.test(input.cleanedText)) {
    questions.add('Success metric is not yet explicit.');
  }

  if (input.evidenceRefs.length === 0) {
    questions.add('No source, wiki, repo, or provider evidence is attached.');
  }

  return Array.from(questions);
}

function buildDecision(confidence: number, openQuestionCount: number): string {
  if (confidence >= 0.72 && openQuestionCount === 0) {
    return 'Proceed to human-reviewed command planning.';
  }

  return 'Hold in research council until evidence, risks, and metrics are resolved.';
}

function evidenceOrPlaceholder(
  evidenceRefs: ResearchEvidenceRef[]
): ResearchEvidenceRef[] {
  if (evidenceRefs.length > 0) {
    return evidenceRefs;
  }

  return [
    {
      ref: 'missing:evidence',
      sourceType: 'user_input',
      summary: 'Placeholder showing why the packet remains blocked.',
    },
  ];
}

function inferSourceType(ref: string): ResearchEvidenceRef['sourceType'] {
  if (ref.startsWith('wiki:')) return 'wiki';
  if (ref.startsWith('repo:')) return 'repo';
  if (ref.startsWith('provider:')) return 'provider';
  if (ref.startsWith('source:')) return 'source';
  return 'user_input';
}

function referencesTechnicalWork(text: string): boolean {
  return /\b(api|repo|code|service|adapter|runtime|deploy|sandbox|command center)\b/i.test(
    text
  );
}

function referencesCreativeWork(text: string): boolean {
  return /\b(video|campaign|thumbnail|brand|storyboard|post|image|creative)\b/i.test(
    text
  );
}

function average(values: number[]): number {
  const total = values.reduce((sum, value) => sum + value, 0);
  return Math.round((total / values.length) * 100) / 100;
}
