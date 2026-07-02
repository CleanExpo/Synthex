import {
  type CampaignAuthorityGateResult,
  type CampaignEvidenceManifest,
  evaluateCampaignEvidenceManifest,
} from './campaign-authority-manifest';

export interface CampaignPublishGateInput {
  manifest: CampaignEvidenceManifest | null;
  platforms: string[];
  requestedAction: string;
  minScore?: number;
  maxRiskLevel?: number;
}

export function assertCampaignPublishable(
  input: CampaignPublishGateInput
): CampaignAuthorityGateResult {
  return evaluateCampaignEvidenceManifest(input.manifest, {
    platforms: input.platforms,
    requestedAction: input.requestedAction,
    minScore: input.minScore,
    maxRiskLevel: input.maxRiskLevel,
  });
}
