import type { BoardInput, BoardInputSource } from './board-input.schema';
import type { CommandPacket } from '../ontology/command-ontology.schema';
import { evaluateApprovalPolicy } from '../gates/approval-policy.service';
import { linkCommandOntology } from '../ontology/command-ontology.service';
import { routeBoardInputToTeam } from '../routing/team-dispatch.service';
import { runMargotConversationPass } from './margot-conversation-pass.service';

export interface CreateBoardInputDraftRequest {
  organizationId: string;
  source: BoardInputSource;
  speaker: string;
  rawText: string;
  evidenceRefs?: string[];
  now?: Date;
  idFactory?: () => string;
}

export interface CreateBoardInputDraftResult {
  boardInput: BoardInput;
  commandPacket: CommandPacket;
}

export function createBoardInputDraft(
  request: CreateBoardInputDraftRequest
): CreateBoardInputDraftResult {
  const speaker = request.speaker.trim();
  if (!speaker) {
    throw new Error('Speaker is required');
  }

  const pass = runMargotConversationPass({
    rawText: request.rawText,
    evidenceRefs: request.evidenceRefs,
  });

  const boardInput: BoardInput = {
    id: request.idFactory?.() ?? crypto.randomUUID(),
    organizationId: request.organizationId,
    source: request.source,
    speaker,
    rawText: request.rawText,
    cleanedText: pass.cleanedText,
    sensitivity: pass.sensitivity,
    capturedAt: (request.now ?? new Date()).toISOString(),
    evidenceRefs: request.evidenceRefs ?? [],
  };

  const policy = evaluateApprovalPolicy(boardInput);
  const ontologyRefs = linkCommandOntology(boardInput);
  const teamRoute = routeBoardInputToTeam(boardInput);

  return {
    boardInput,
    commandPacket: {
      id: request.idFactory?.() ?? crypto.randomUUID(),
      boardInputId: boardInput.id,
      title: buildPacketTitle(boardInput.cleanedText),
      ontologyRefs,
      teamRoute,
      scenarioState: policy.scenarioState,
      approvalGate: policy.approvalGate,
      risks: Array.from(new Set([...pass.risks, ...policy.risks])),
      nextAction: policy.nextAction,
      outcomeMetric:
        policy.approvalGate === 'production_blocked'
          ? 'blocked_command_packet'
          : 'approved_command_packet',
    },
  };
}

function buildPacketTitle(text: string): string {
  const firstSentence = text.split(/[.!?]/)[0]?.trim() || 'Board input';
  return firstSentence.length > 80
    ? `${firstSentence.slice(0, 77).trim()}...`
    : firstSentence;
}
