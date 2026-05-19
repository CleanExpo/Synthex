import type { CampaignAsset, GateResult } from './types';

export function evaluateAssetLicences(assets: CampaignAsset[]): GateResult {
  const blockedReasons = assets
    .filter((asset) => asset.licenceStatus !== 'licensed')
    .map((asset) => `Asset ${asset.id} is ${asset.licenceStatus}; licensed status is required.`);

  return {
    status: blockedReasons.length > 0 ? 'blocked' : 'pass',
    blockedReasons,
    warnings: [],
  };
}
