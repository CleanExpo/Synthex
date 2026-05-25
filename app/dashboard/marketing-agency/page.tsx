import Link from 'next/link';
import type { Metadata } from 'next';
import { GovernedOpportunitiesPanel } from '@/components/marketing-agency/GovernedOpportunitiesPanel';
import { MarketingAgentsPanel } from '@/components/marketing-agency/agent/MarketingAgentsPanel';

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
          Autonomous agents drive the governed substrate between gates — proposing claims,
          flagging evidence gaps, and assembling QA reports for your review. Publishing,
          licensing, and approval always stay human-controlled.
        </p>
      </header>

      <MarketingAgentsPanel />

      <GovernedOpportunitiesPanel />

      <section className="rounded-sm border border-white/10 p-5">
        <h2 className="text-lg font-semibold">RestoreAssist Launch</h2>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Mock-mode package for the RestoreAssist launch campaign. Publishing and ad spend remain blocked.
        </p>
        <Link
          href="/dashboard/marketing-agency/restoreassist-launch"
          className="mt-4 inline-flex rounded-sm bg-white px-4 py-2 text-sm font-medium text-black"
        >
          Open Package
        </Link>
      </section>
    </main>
  );
}
