'use client';

import {
  BarChart3,
  CheckCircle2,
  ImageIcon,
  Mic,
  Search,
  Send,
  Target,
} from '@/components/icons';
import { StatusPill } from '@/components/ui/status-pill';
import { SectionFloatingGradients } from './floating-gradients';
import { SectionReveal } from './section-reveal';

const stages = [
  {
    icon: Mic,
    title: 'Capture',
    copy: 'Voice notes, meetings and rough ideas enter as structured intake.',
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
      className="relative overflow-hidden bg-sx-bg-secondary py-32"
      aria-labelledby="how-synthex-works-heading"
    >
      <SectionFloatingGradients variant="mid" />

      <div className="relative z-10 mx-auto max-w-content px-5">
        <SectionReveal>
          <div className="mb-14 max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sx-accent">
              How Synthex works
            </p>
            <h2
              id="how-synthex-works-heading"
              className="mt-3 text-3xl font-semibold tracking-tight text-sx-text-primary md:text-5xl"
            >
              The full marketing workflow in one{' '}
              <span className="landing-gradient-text-intelligence">
                command center
              </span>
            </h2>
            <p className="mt-5 text-base leading-8 text-sx-text-secondary">
              From raw input to measured performance — every stage visible,
              evidence-linked and approval-aware.
            </p>
          </div>
        </SectionReveal>

        <div className="relative">
          <div
            className="landing-timeline-connector absolute left-4 top-0 hidden w-px md:left-1/2 md:block md:-translate-x-px"
            style={{ height: 'calc(100% - 2rem)' }}
            aria-hidden
          />
          <div className="grid gap-4 md:grid-cols-2 md:gap-6" role="list">
            {stages.map((stage, index) => {
              const Icon = stage.icon;
              return (
                <SectionReveal key={stage.title} delay={index * 60}>
                  <div
                    role="listitem"
                    className="group relative h-full rounded-card border border-white/[0.08] bg-sx-bg-elevated/80 p-6 backdrop-blur-sm transition-all duration-[220ms] ease-premium hover:-translate-y-0.5 hover:border-white/[0.14] hover:shadow-[0_8px_32px_rgba(0,0,0,0.25)]"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex gap-4">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-btn border border-white/[0.08] bg-gradient-to-br from-sx-bg-panel to-sx-bg-subtle transition-colors duration-[160ms] group-hover:border-sx-accent/25 group-hover:from-sx-accent/[0.08]">
                          <Icon className="h-5 w-5 text-sx-text-secondary transition-colors group-hover:text-sx-accent" />
                        </div>
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-sx-text-muted">
                            Step {String(index + 1).padStart(2, '0')}
                          </p>
                          <h3 className="mt-1 text-lg font-semibold text-sx-text-primary">
                            {stage.title}
                          </h3>
                          <p className="mt-2 text-sm leading-6 text-sx-text-muted">
                            {stage.copy}
                          </p>
                        </div>
                      </div>
                      <StatusPill variant={stage.status} size="sm" />
                    </div>
                  </div>
                </SectionReveal>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
