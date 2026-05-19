import type { CommandPacket } from '../ontology/command-ontology.schema';

export interface PresentationQaInput {
  packet: CommandPacket;
  slideTitles: string[];
  evidenceRefs: string[];
  mediaLicenseState: 'not_required' | 'pending' | 'cleared';
}

export interface PresentationQaResult {
  passed: boolean;
  findings: string[];
}

export function evaluatePresentationQa(
  input: PresentationQaInput
): PresentationQaResult {
  const findings: string[] = [];

  if (input.slideTitles.length === 0) findings.push('missing_slides');
  if (input.evidenceRefs.length === 0) findings.push('missing_evidence');
  if (input.mediaLicenseState === 'pending') findings.push('media_license_pending');
  if (input.packet.approvalGate === 'production_blocked') {
    findings.push('production_gate_blocked');
  }

  const oversizedTitle = input.slideTitles.find((title) => title.length > 88);
  if (oversizedTitle) findings.push('slide_title_too_long');

  return {
    passed: findings.length === 0,
    findings,
  };
}
