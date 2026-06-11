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
          Autonomous agents drive the governed substrate between gates —
          proposing claims, flagging evidence gaps, and assembling QA reports
          for your review. Publishing, licensing, and approval always stay
          human-controlled.
        </p>
      </header>

      <MarketingAgentsPanel />

      <GovernedOpportunitiesPanel />

      <section className="rounded-sm border border-emerald-400/30 bg-emerald-950/20 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-200">
              Live package
            </p>
            <h2 className="mt-1 text-lg font-semibold">
              CCW EOFY Sales Acceleration 2026
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Production CCW package with Facebook, Instagram, LinkedIn, and
              Reddit drafts staged from live records. Publishing stays blocked
              until CCW social credentials are submitted and verified.
            </p>
          </div>
          <Link
            href="/dashboard/marketing-agency/ccw-eofy"
            className="inline-flex rounded-sm bg-emerald-300 px-4 py-2 text-sm font-medium text-emerald-950"
          >
            Open CCW Package
          </Link>
        </div>
      </section>

      <section className="rounded-sm border border-sky-400/30 bg-sky-950/20 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-sky-200">
              First client authority pack
            </p>
            <h2 className="mt-1 text-lg font-semibold">
              CARSI Restoration Training Authority
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Source-registered campaign pack for CARSI with owned-media drafts
              ready for review. External social publishing stays blocked until
              CARSI credentials, approval, asset rights, and analytics receipts
              are verified.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/dashboard/marketing-agency/carsi/authority"
              className="inline-flex rounded-sm bg-sky-300 px-4 py-2 text-sm font-medium text-sky-950"
            >
              Open Live Package
            </Link>
            <Link
              href="/dashboard/marketing-agency/carsi/studio"
              className="inline-flex rounded-sm border border-sky-300/40 px-4 py-2 text-sm font-medium text-sky-100"
            >
              Open Studio
            </Link>
          </div>
        </div>
      </section>

      <section className="rounded-sm border border-orange-400/30 bg-orange-950/20 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-orange-200">
              Portfolio authority packs
            </p>
            <h2 className="mt-1 text-lg font-semibold">
              RestoreAssist, Disaster Recovery, and NRPG
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Source-led owned-media packages are staged for the nested
              portfolio. External publishing stays blocked until credentials,
              current source checks, and approval receipts are recorded.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/dashboard/marketing-agency/restoreassist/authority"
              className="inline-flex rounded-sm bg-orange-300 px-4 py-2 text-sm font-medium text-orange-950"
            >
              RestoreAssist
            </Link>
            <Link
              href="/dashboard/marketing-agency/disaster-recovery/authority"
              className="inline-flex rounded-sm border border-orange-300/40 px-4 py-2 text-sm font-medium text-orange-100"
            >
              Disaster Recovery
            </Link>
            <Link
              href="/dashboard/marketing-agency/nrpg/authority"
              className="inline-flex rounded-sm border border-orange-300/40 px-4 py-2 text-sm font-medium text-orange-100"
            >
              NRPG
            </Link>
          </div>
        </div>
      </section>

      <section className="rounded-sm border border-white/10 p-5">
        <h2 className="text-lg font-semibold">RestoreAssist Launch</h2>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Mock-mode package for the RestoreAssist launch campaign. Publishing
          and ad spend remain blocked.
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
