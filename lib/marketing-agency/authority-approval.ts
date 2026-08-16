import {
  CAMPAIGN_AUTHORITY_MANIFEST_KEY,
  extractCampaignAuthorityManifest,
  type CampaignEvidenceManifest,
} from './campaign-authority-manifest';
import { assertCampaignPublishable } from './publish-gate';

export interface ApproveCampaignAuthorityInput {
  approvedBy: string;
  approvedAt?: string;
  platforms?: string[];
  requestedAction?: string;
  minApprovalReadiness?: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function platformList(
  manifest: CampaignEvidenceManifest,
  platforms?: string[]
) {
  if (platforms && platforms.length > 0) return platforms;
  return manifest.platformOutputs.map(output => output.platform);
}

export function approveCampaignAuthorityManifest(
  manifest: CampaignEvidenceManifest,
  input: ApproveCampaignAuthorityInput
): CampaignEvidenceManifest {
  const approvedAt = input.approvedAt ?? new Date().toISOString();
  const minApprovalReadiness = input.minApprovalReadiness ?? 90;

  return {
    ...manifest,
    approval: {
      ...manifest.approval,
      status: 'approved',
      humanApproved: true,
      approvedBy: input.approvedBy,
      approvedAt,
    },
    // A human approval raises `approvalReadiness` on scores that already exist.
    // It does NOT manufacture an evaluation where there was none — a manifest
    // with no scores stays with no scores and the gate keeps blocking it with
    // `campaign_evaluation_missing`.
    evaluation: manifest.evaluation
      ? {
          ...manifest.evaluation,
          approvalReadiness: Math.max(
            manifest.evaluation.approvalReadiness ?? 0,
            minApprovalReadiness
          ),
        }
      : undefined,
  };
}

export function approveCampaignAuthorityMetadata(
  value: unknown,
  input: ApproveCampaignAuthorityInput
): Record<string, unknown> {
  const base = isRecord(value) ? { ...value } : {};
  const manifest = extractCampaignAuthorityManifest(base);
  if (!manifest) return base;

  const approvedManifest = approveCampaignAuthorityManifest(manifest, input);
  const platforms = platformList(approvedManifest, input.platforms);
  const publishGate = assertCampaignPublishable({
    manifest: approvedManifest,
    platforms,
    requestedAction: input.requestedAction ?? 'campaign_authority_approval',
  });

  return {
    ...base,
    [CAMPAIGN_AUTHORITY_MANIFEST_KEY]: approvedManifest,
    publishGate,
  };
}
