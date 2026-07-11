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
      className="bg-sx-bg-secondary py-32"
      aria-labelledby="how-synthex-works-heading"
    >
      <div className="mx-auto max-w-content px-5">
        <div className="mb-14 max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sx-accent">
            How Synthex works
          </p>
          <h2
            id="how-synthex-works-heading"
            className="mt-3 text-3xl font-semibold tracking-tight text-sx-text-primary md:text-5xl"
          >
            The full marketing workflow in one command center
          </h2>
          <p className="mt-5 text-base leading-8 text-sx-text-secondary">
            From raw input to measured performance — every stage visible,
            evidence-linked and approval-aware. An AI marketing operating system
            built for teams that cannot afford guesswork.
          </p>
        </div>

        <div className="relative">
          <div
            className="absolute left-4 top-0 hidden h-full w-px bg-white/[0.08] md:left-1/2 md:block md:-translate-x-px"
            aria-hidden
          />
          <ol className="grid gap-4 md:grid-cols-2 md:gap-6">
            {stages.map((stage, index) => {
              const Icon = stage.icon;
              return (
                <li
                  key={stage.title}
                  className="group relative rounded-card border border-white/[0.08] bg-sx-bg-elevated p-6 transition-colors duration-[200ms] ease-premium hover:border-white/[0.14]"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex gap-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-btn border border-white/[0.08] bg-sx-bg-panel">
                        <Icon className="h-5 w-5 text-sx-text-secondary" />
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
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </section>
  );
}
