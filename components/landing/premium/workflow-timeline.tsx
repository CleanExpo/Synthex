'use client';

import {
  BarChart3,
  CheckCircle2,
  ImageIcon,
  Map,
  Search,
  Send,
  Target,
} from '@/components/icons';
import { StatusPill } from '@/components/ui/status-pill';
import { SectionAtmosphere } from './section-atmosphere';
import { SectionReveal } from './section-reveal';

const stages = [
  {
    icon: Map,
    title: 'Map',
    copy: 'Public website, social links and notes become three ranked directions.',
    status: 'intake' as const,
  },
  {
    icon: Search,
    title: 'Research',
    copy: 'Market signal, competitors and product context tied to sources.',
    status: 'verified' as const,
  },
  {
    icon: Target,
    title: 'Strategy',
    copy: 'Campaign hypothesis, audience and channel plan as reviewable cards.',
    status: 'draft' as const,
  },
  {
    icon: ImageIcon,
    title: 'Creative',
    copy: 'Copy, visuals, email and video briefs staged for production.',
    status: 'staged' as const,
  },
  {
    icon: CheckCircle2,
    title: 'Approval',
    copy: 'Explicit human gate before spend, claims or publishing.',
    status: 'awaiting_approval' as const,
  },
  {
    icon: Send,
    title: 'Publishing',
    copy: 'Approved assets enter the queue with platform and schedule locked.',
    status: 'scheduled' as const,
  },
  {
    icon: BarChart3,
    title: 'Insights',
    copy: 'Performance feeds the next campaign — evidence compounds over time.',
    status: 'published' as const,
  },
];

export function WorkflowTimeline() {
  return (
    <section
      id="how-synthex-works"
      className="relative overflow-hidden bg-sx-bg-secondary py-24 md:py-32"
      aria-labelledby="how-synthex-works-heading"
    >
      <SectionAtmosphere variant="ember" />
      <div className="relative z-10 mx-auto max-w-container px-5">
        <SectionReveal>
          <div className="mb-14 max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sx-accent">
              How Synthex works
            </p>
            <h2
              id="how-synthex-works-heading"
              className="mt-3 text-3xl font-semibold tracking-tight text-sx-text-primary md:text-5xl"
            >
              One command spine, from map to measured result
            </h2>
          </div>
        </SectionReveal>

        <div className="relative">
          <div
            className="pointer-events-none absolute left-0 right-0 top-8 hidden h-px bg-gradient-to-r from-sx-accent via-[var(--sx-evidence)] to-transparent xl:block"
            aria-hidden
          />
          <div className="-mx-5 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-4 xl:mx-0 xl:grid xl:grid-cols-7 xl:gap-3 xl:overflow-visible xl:px-0 xl:pb-0">
            {stages.map((stage, index) => {
              const Icon = stage.icon;
              return (
                <article
                  key={stage.title}
                  className="w-[min(78vw,18rem)] shrink-0 snap-start rounded-card border border-white/[0.08] bg-sx-bg-elevated/90 p-4 xl:w-auto"
                >
                  <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-full border border-sx-accent/30 bg-sx-bg-primary">
                    <Icon className="h-4 w-4 text-sx-accent" />
                  </div>
                  <p className="font-mono text-[11px] text-sx-text-muted">
                    {String(index + 1).padStart(2, '0')}
                  </p>
                  <h3 className="mt-2 text-base font-semibold text-sx-text-primary">
                    {stage.title}
                  </h3>
                  <p className="mt-2 text-xs leading-5 text-sx-text-muted">
                    {stage.copy}
                  </p>
                  <div className="mt-4">
                    <StatusPill variant={stage.status} size="sm" />
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
