import { BoardMemoPanel } from '@/components/marketing-agency/BoardMemoPanel';
import { ExportManifestPanel } from '@/components/marketing-agency/ExportManifestPanel';
import { MediaGuidePanel } from '@/components/marketing-agency/MediaGuidePanel';
import { MediaTestingPanel } from '@/components/marketing-agency/MediaTestingPanel';
import { PersonaMapPanel } from '@/components/marketing-agency/PersonaMapPanel';
import { QaGatePanel } from '@/components/marketing-agency/QaGatePanel';
import { StoryboardPanel } from '@/components/marketing-agency/StoryboardPanel';
import { restoreAssistFixture } from '@/lib/marketing-agency/fixtures/restoreassist';
import { buildMediaGuideItems } from '@/lib/marketing-agency/media-guide';
import { buildMediaTestingPlan } from '@/lib/marketing-agency/media-testing';
import { generateMockCampaignPackage } from '@/lib/marketing-agency/orchestrator';
import { buildRemotionStoryboardPlans } from '@/lib/marketing-agency/remotion/storyboard-plan';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'RestoreAssist Launch Package | Synthex Marketing Agency',
  description:
    'Review the RestoreAssist mock campaign package with personas, storyboards, QA gates, and blocked publish controls.',
};

export default function RestoreAssistLaunchPage() {
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

  return (
    <main className="container mx-auto flex flex-col gap-6 px-6 py-8">
      <header className="flex flex-col gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Marketing Agency
        </p>
        <h1 className="text-3xl font-bold">RestoreAssist Launch Package</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Mock-mode campaign package with evidence, licensing, QA, and export gates visible before provider integrations.
        </p>
      </header>

      <BoardMemoPanel memo={campaignPackage.boardMemo} />
      <PersonaMapPanel personas={campaignPackage.personas} />
      <MediaGuidePanel items={mediaGuideItems} />
      <MediaTestingPanel items={mediaTestingPlan} />
      <StoryboardPanel storyboards={campaignPackage.storyboards} />
      <QaGatePanel qa={campaignPackage.qa} />
      <ExportManifestPanel manifest={campaignPackage.exportManifest} />
    </main>
  );
}
