import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, CheckCircle2 } from '@/components/icons';
import { Button } from '@/components/ui/button';
import {
  FeatureGrid,
  SafetyStrip,
  SiteShell,
  WorkflowBand,
  workflowStages,
} from '@/components/landing/public-v2';

export const metadata: Metadata = {
  title: 'Features | Synthex',
  description:
    'Explore Synthex command-center features for market research, campaign planning, Gen Media production, approvals and ROI learning.',
};

const capabilityGroups = [
  {
    title: 'Research Council',
    points: [
      'Source-backed market and competitor research',
      'Contrarian review before strategy is accepted',
      'Confidence, risk and open-question tracking',
      'Wiki and repo evidence references preserved',
    ],
  },
  {
    title: 'Campaign Studio',
    points: [
      'Storyboard, post, email and thumbnail concepts',
      'Client-specific offer and product grounding',
      'Brand voice and compliance checks',
      'Draft mode before production spend',
    ],
  },
  {
    title: 'Command Center',
    points: [
      'Telegram, Plaud and dashboard input surfaces',
      'Team routing for PM, engineering, brand and QA',
      'Provider readiness and credential gates',
      'Production gate and rollback discipline',
    ],
  },
];

export default function FeaturesPage() {
  return (
    <SiteShell>
      <section className="bg-[#08090b] px-5 pb-16 pt-32">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-orange-300">
              Platform features
            </p>
            <h1 className="mt-4 text-5xl font-semibold leading-tight tracking-tight text-white md:text-7xl">
              Everything needed to run a serious marketing workflow from one
              board.
            </h1>
            <p className="mt-6 text-lg leading-8 text-white/60">
              Synthex connects fragmented input, business knowledge, market
              signals, creative production and approval gates so campaigns can
              move faster without losing control.
            </p>
          </div>
        </div>
      </section>

      <WorkflowBand />
      <FeatureGrid />

      <section className="bg-[#0d0f12] py-20 md:py-24">
        <div className="mx-auto max-w-7xl px-5">
          <div className="mb-10 max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-orange-300">
              Capability map
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white md:text-4xl">
              The product is built around decisions, not disconnected tools.
            </h2>
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            {capabilityGroups.map(group => (
              <div key={group.title} className="border border-white/[0.08] bg-[#08090b] p-6">
                <h3 className="text-xl font-semibold text-white">{group.title}</h3>
                <ul className="mt-5 space-y-3">
                  {group.points.map(point => (
                    <li key={point} className="flex gap-3 text-sm leading-6 text-white/58">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#08090b] py-20 md:py-24">
        <div className="mx-auto max-w-7xl px-5">
          <div className="grid gap-4 md:grid-cols-4">
            {workflowStages.map(stage => (
              <div key={stage.label} className="border border-white/[0.08] p-5">
                <p className="text-xs uppercase tracking-[0.2em] text-orange-300/80">
                  {stage.label}
                </p>
                <h3 className="mt-4 text-lg font-semibold text-white">
                  {stage.title}
                </h3>
                <p className="mt-3 text-sm leading-6 text-white/55">{stage.copy}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <SafetyStrip />

      <section className="bg-[#08090b] px-5 py-20 text-center md:py-24">
        <h2 className="mx-auto max-w-3xl text-3xl font-semibold tracking-tight text-white md:text-5xl">
          Built for controlled launch, then scale.
        </h2>
        <p className="mx-auto mt-5 max-w-2xl text-base leading-8 text-white/58">
          Synthex can run as an internal agency cockpit first, then open
          controlled client access once each provider, approval and QA gate is
          proven.
        </p>
        <div className="mt-8">
          <Button asChild variant="premium-primary" size="xl">
            <Link href="/pricing">
              Review pilot packages
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>
    </SiteShell>
  );
}
