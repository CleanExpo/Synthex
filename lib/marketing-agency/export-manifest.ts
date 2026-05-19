import type { CampaignAsset, ExportManifest, GateResult } from './types';

export function buildExportManifest(input: {
  campaignId: string;
  formats: string[];
  assets: CampaignAsset[];
  gates: GateResult[];
}): ExportManifest {
  return {
    campaignId: input.campaignId,
    formats: input.formats,
    assets: input.assets,
    blockedReasons: input.gates.flatMap((gate) => gate.blockedReasons),
  };
}
