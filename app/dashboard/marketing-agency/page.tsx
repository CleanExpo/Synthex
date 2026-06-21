import type { Metadata } from 'next';
import { OutcomeWorkbench } from '@/components/marketing-agency/OutcomeWorkbench';
import { GovernedOpportunitiesPanel } from '@/components/marketing-agency/GovernedOpportunitiesPanel';
import { MarketingAgentsPanel } from '@/components/marketing-agency/agent/MarketingAgentsPanel';
import { BrandPackageCards } from '@/components/marketing-agency/BrandPackageCards';

export const metadata: Metadata = {
  title: 'Marketing Agency | Synthex',
  description:
    'Agentic marketing agency that drives the governed campaign substrate between gates — propose claims, flag evidence gaps, submit QA reports. Publishing stays human-approved.',
};

export default function MarketingAgencyPage() {
  return (
    <main className="container mx-auto flex min-h-[60vh] flex-col gap-6 px-6 py-8">
      <header className="flex flex-col gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Marketing Agency
        </p>
        <h1 className="text-3xl font-bold">Primary Marketing Agency</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Autonomous agents drive the governed substrate between gates —
          proposing claims, flagging evidence gaps, and assembling QA reports
          for your review. Publishing, licensing, and approval always stay
          human-controlled.
        </p>
      </header>

      <OutcomeWorkbench />

      <MarketingAgentsPanel />

      <GovernedOpportunitiesPanel />

      <BrandPackageCards />
    </main>
  );
}
