import type { GateResult } from './types';

export interface CampaignQaInput {
  claimGate: GateResult;
  licenceGate: GateResult;
  consentGate: GateResult;
  formatGate: GateResult;
  publishApproved: boolean;
}

export interface CampaignQaResult {
  claimGate: GateResult;
  licenceGate: GateResult;
  consentGate: GateResult;
  formatGate: GateResult;
  publishGate: GateResult;
  exportReady: boolean;
}

export function runCampaignQa(input: CampaignQaInput): CampaignQaResult {
  const publishGate: GateResult = input.publishApproved
    ? { status: 'pass', blockedReasons: [], warnings: [] }
    : {
        status: 'blocked',
        blockedReasons: ['Publishing and ad spend are blocked by default.'],
        warnings: [],
      };

  const gates = [input.claimGate, input.licenceGate, input.consentGate, input.formatGate];

  return {
    ...input,
    publishGate,
    exportReady: gates.every((gate) => gate.status === 'pass'),
  };
}
