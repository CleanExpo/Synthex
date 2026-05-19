#!/usr/bin/env npx tsx
import { generateMockCampaignPackage } from '../lib/marketing-agency/orchestrator';
import { restoreAssistFixture } from '../lib/marketing-agency/fixtures/restoreassist';
import { buildMediaGuideItems } from '../lib/marketing-agency/media-guide';
import { buildMediaTestingPlan } from '../lib/marketing-agency/media-testing';
import { buildRemotionStoryboardPlans } from '../lib/marketing-agency/remotion/storyboard-plan';

const campaignPackage = generateMockCampaignPackage({ providerMode: 'mock' });
const remotionPlans = buildRemotionStoryboardPlans(
  campaignPackage.storyboards,
  restoreAssistFixture.clientBrand
);
const mediaGuideItems = buildMediaGuideItems(
  campaignPackage.storyboards,
  remotionPlans
);
const mediaTestingPlan = buildMediaTestingPlan(
  campaignPackage.storyboards,
  mediaGuideItems
);

const manifest = {
  campaignId: campaignPackage.campaignId,
  providerMode: campaignPackage.providerMode,
  publishStatus: campaignPackage.qa.publishGate.status,
  exportReady: campaignPackage.qa.exportReady,
  blockedReasons: campaignPackage.exportManifest.blockedReasons,
  mediaTestingPlan,
  renderTargets: remotionPlans.map(plan => ({
    storyboardId: plan.storyboardId,
    compositionId: plan.compositionId,
    width: plan.width,
    height: plan.height,
    fps: plan.fps,
    durationInFrames: plan.durationInFrames,
    outputPath: `tmp/videos/marketing-agency/${plan.storyboardId}.mp4`,
    voiceoverScript: plan.voiceoverScript,
    inputProps: plan.inputProps,
  })),
};

process.stdout.write(`${JSON.stringify(manifest, null, 2)}\n`);
