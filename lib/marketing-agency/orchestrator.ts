import { getMockArtlistAudioAsset } from './artlist/mock';
import { buildExportManifest } from './export-manifest';
import { restoreAssistFixture } from './fixtures/restoreassist';
import { evaluateAssetLicences } from './licensing';
import { runCampaignQa } from './qa';
import { restoreAssistLaunchStoryboards } from './storyboards';
import type { GateResult, MockCampaignPackage, ProviderMode } from './types';

export function generateMockCampaignPackage(input: { providerMode: ProviderMode }): MockCampaignPackage {
  const audioAsset = getMockArtlistAudioAsset();
  const claimGate: GateResult = { status: 'pass', blockedReasons: [], warnings: [] };
  const licenceGate = evaluateAssetLicences([audioAsset]);
  const consentGate: GateResult = { status: 'pass', blockedReasons: [], warnings: [] };
  const formatGate: GateResult = { status: 'pass', blockedReasons: [], warnings: [] };
  const qa = runCampaignQa({
    claimGate,
    licenceGate,
    consentGate,
    formatGate,
    publishApproved: false,
  });

  const campaignId = 'restoreassist-launch-2026-05';

  return {
    campaignId,
    providerMode: input.providerMode,
    boardMemo: {
      campaignObjective:
        'Launch RestoreAssist.app with an evidence-led campaign for Australian restoration professionals.',
      targetPersona: restoreAssistFixture.personas[0].name,
      creativeStrategy:
        'Lead with job evidence and reporting friction before introducing RestoreAssist as the connected workflow.',
      evidenceGaps: [
        'Artlist licence evidence required before client-ready export.',
        'Product screenshots must be approved before final video export.',
      ],
      finalBoardDecision: 'blocked',
    },
    personas: restoreAssistFixture.personas,
    storyboards: restoreAssistLaunchStoryboards,
    qa,
    exportManifest: buildExportManifest({
      campaignId,
      formats: ['16:9', '9:16', '4:5', '1:1'],
      assets: [audioAsset],
      gates: [claimGate, licenceGate, consentGate, formatGate, qa.publishGate],
    }),
  };
}
