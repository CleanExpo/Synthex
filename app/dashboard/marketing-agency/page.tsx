import Link from 'next/link';
import type { Metadata } from 'next';
import { GovernedOpportunitiesPanel } from '@/components/marketing-agency/GovernedOpportunitiesPanel';

export const metadata: Metadata = {
  title: 'Marketing Agency Campaign Packages | Synthex',
  description:
    'Review source-backed campaign packages with evidence, licensing, QA, and export gates before provider integrations.',
};

export default function MarketingAgencyPage() {
  return (
    <main className="container mx-auto flex min-h-[60vh] flex-col gap-6 px-6 py-8">
      <header className="flex flex-col gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Marketing Agency
        </p>
        <h1 className="text-3xl font-bold">Campaign Packages</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Generate source-backed campaign packages with evidence, licensing, QA, and export gates.
        </p>
      </header>

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
