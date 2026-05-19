import type { CommandPacket } from '../ontology/command-ontology.schema';

export interface MediaAssetGate {
  evidenceRefs: string[];
  consentState: 'not_required' | 'pending' | 'cleared';
  licenseState: 'not_required' | 'pending' | 'cleared';
}

export interface GenMediaBrief {
  title: string;
  state: 'draft' | 'blocked';
  productionMode: 'remotion_draft' | 'heygen_blocked' | 'blocked';
  requiredAssets: string[];
  visualStyle: string;
  voiceStyle: string;
  qaFindings: string[];
}

export function createGenMediaBrief(input: {
  commandPacket: CommandPacket;
  assetGate: MediaAssetGate;
}): GenMediaBrief {
  const qaFindings = evaluateMediaGate(input.commandPacket, input.assetGate);

  return {
    title: input.commandPacket.title,
    state: qaFindings.length === 0 ? 'draft' : 'blocked',
    productionMode:
      qaFindings.length === 0 ? 'remotion_draft' : 'blocked',
    requiredAssets: [
      'brand logo',
      'product images',
      'evidence references',
      'voiceover script',
      'platform aspect ratios',
    ],
    visualStyle:
      'first-principles explainer with clear overlays, diagrams, and source-backed claims',
    voiceStyle:
      'calm technical authority, plain English, no unsupported certainty',
    qaFindings,
  };
}

function evaluateMediaGate(
  commandPacket: CommandPacket,
  assetGate: MediaAssetGate
): string[] {
  const findings: string[] = [];

  if (assetGate.evidenceRefs.length === 0) findings.push('missing_evidence');
  if (assetGate.consentState === 'pending') findings.push('consent_pending');
  if (assetGate.licenseState === 'pending') findings.push('license_pending');
  if (commandPacket.approvalGate === 'production_blocked') {
    findings.push('production_gate_blocked');
  }

  return findings;
}
