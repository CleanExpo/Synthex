import type { BoardInput } from '../intake/board-input.schema';
import type {
  ApprovalGate,
  ScenarioState,
} from '../ontology/command-ontology.schema';

export interface ApprovalPolicyResult {
  scenarioState: ScenarioState;
  approvalGate: ApprovalGate;
  risks: string[];
  nextAction: string;
}

export function evaluateApprovalPolicy(input: BoardInput): ApprovalPolicyResult {
  const risks: string[] = [];
  const text = input.cleanedText;

  if (input.evidenceRefs.length === 0) risks.push('missing_evidence');
  if (input.sensitivity !== 'public') risks.push(`sensitivity_${input.sensitivity}`);
  if (/\b(publish|ad spend|payment|go live|production|deploy)\b/i.test(text)) {
    risks.push('production_or_spend_requested');
  }

  if (risks.includes('production_or_spend_requested')) {
    return {
      scenarioState: 'blocked',
      approvalGate: 'production_blocked',
      risks,
      nextAction: 'Collect explicit human approval before any live action.',
    };
  }

  if (risks.includes('missing_evidence')) {
    return {
      scenarioState: 'needs_evidence',
      approvalGate: 'human_review',
      risks,
      nextAction: 'Attach evidence, source links, or wiki references.',
    };
  }

  return {
    scenarioState: 'ready_for_review',
    approvalGate: 'client_review',
    risks,
    nextAction: 'Prepare a draft packet for review.',
  };
}
