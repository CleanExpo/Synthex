'use client';

import { useEffect, useState } from 'react';
import {
  BarChart3,
  BrainCircuit,
  Calendar,
  CheckCircle2,
  ChevronRight,
  ImageIcon,
  Mic,
  Search,
  Shield,
} from '@/components/icons';
import {
  StatusPill,
  type StatusPillVariant,
} from '@/components/ui/status-pill';
import { cn } from '@/lib/utils';

type StageId =
  | 'intake'
  | 'research'
  | 'plan'
  | 'creative'
  | 'approval'
  | 'scheduled';

interface WorkflowStage {
  id: StageId;
  step: string;
  label: string;
  title: string;
  status: StatusPillVariant;
  icon: typeof Mic;
}

const stages: WorkflowStage[] = [
  {
    id: 'intake',
    step: '01',
    label: 'Capture',
    title: 'Voice transcript ingested',
    status: 'intake',
    icon: Mic,
  },
  {
    id: 'research',
    step: '02',
    label: 'Research',
    title: 'Evidence bundle assembled',
    status: 'verified',
    icon: Search,
  },
  {
    id: 'plan',
    step: '03',
    label: 'Strategy',
    title: 'Campaign plan drafted',
    status: 'draft',
    icon: BrainCircuit,
  },
  {
    id: 'creative',
    step: '04',
    label: 'Creative',
    title: 'Assets staged for review',
    status: 'staged',
    icon: ImageIcon,
  },
  {
    id: 'approval',
    step: '05',
    label: 'Approval',
    title: 'Awaiting human sign-off',
    status: 'awaiting_approval',
    icon: CheckCircle2,
  },
  {
    id: 'scheduled',
    step: '06',
    label: 'Publish',
    title: 'Queued for distribution',
    status: 'scheduled',
    icon: Calendar,
  },
];

function StagePreview({ stageId }: { stageId: StageId }) {
  switch (stageId) {
    case 'intake':
      return (
        <div className="space-y-3">
          <div className="flex items-end gap-0.5 h-8 px-1">
            {[3, 6, 4, 8, 5, 7, 3, 9, 4, 6, 2, 8].map((h, i) => (
              <span
                key={i}
                className="w-1 rounded-full bg-sx-accent/40"
                style={{ height: `${h * 3}px` }}
              />
            ))}
          </div>
          <div className="space-y-2 rounded-[12px] border border-white/[0.06] bg-sx-bg-primary/60 p-3">
            <p className="text-[11px] font-medium text-sx-text-muted">
              Transcript · 02:14
            </p>
            <p className="text-xs leading-5 text-sx-text-secondary">
              &ldquo;We need a Q3 campaign for the new service tier — focus on
              trust and local proof, not discount language.&rdquo;
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {['Voice note', 'Mobile intake', 'Source tagged'].map(tag => (
              <span
                key={tag}
                className="rounded-md border border-white/[0.06] bg-white/[0.03] px-2 py-0.5 text-xs text-sx-text-muted"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      );
    case 'research':
      return (
        <div className="space-y-2">
          {[
            { source: 'Search Console', ref: '12 keywords · rising' },
            { source: 'Competitor SERP', ref: '3 gaps identified' },
            { source: 'Product wiki', ref: 'Offer tier linked' },
          ].map(row => (
            <div
              key={row.source}
              className="flex items-center justify-between rounded-[10px] border border-white/[0.06] bg-sx-bg-primary/50 px-3 py-2"
            >
              <span className="text-xs text-sx-text-secondary">
                {row.source}
              </span>
              <span className="text-xs font-medium text-sx-info">
                {row.ref}
              </span>
            </div>
          ))}
          <p className="pt-1 text-xs text-sx-text-muted">
            3 sources linked · confidence high
          </p>
        </div>
      );
    case 'plan':
      return (
        <div className="grid grid-cols-2 gap-2">
          {['Audience', 'Offer', 'Channels', 'Risks'].map(card => (
            <div
              key={card}
              className="rounded-[10px] border border-white/[0.06] bg-sx-bg-primary/50 p-2.5"
            >
              <p className="text-xs uppercase tracking-wider text-sx-text-muted">
                {card}
              </p>
              <div className="mt-2 space-y-1">
                <div className="h-1.5 w-full rounded bg-white/[0.06]" />
                <div className="h-1.5 w-2/3 rounded bg-white/[0.04]" />
              </div>
            </div>
          ))}
        </div>
      );
    case 'creative':
      return (
        <div className="grid grid-cols-3 gap-2">
          {['Post', 'Email', 'Video'].map(asset => (
            <div
              key={asset}
              className="overflow-hidden rounded-[10px] border border-white/[0.06] bg-sx-bg-primary/50"
            >
              <div className="aspect-[4/3] bg-gradient-to-br from-sx-bg-subtle to-sx-bg-panel" />
              <p className="px-2 py-1.5 text-xs text-sx-text-muted">{asset}</p>
            </div>
          ))}
        </div>
      );
    case 'approval':
      return (
        <div className="space-y-3">
          <div className="rounded-[12px] border border-sx-warning/20 bg-sx-warning/[0.06] p-3">
            <p className="text-xs font-medium text-sx-text-primary">
              Review required before publish
            </p>
            <p className="mt-1 text-[11px] text-sx-text-muted">
              4 assets · 1 comment · version 2
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex -space-x-2">
              {['JR', 'AM'].map(initials => (
                <span
                  key={initials}
                  className="flex h-7 w-7 items-center justify-center rounded-full border border-sx-bg-elevated bg-sx-bg-subtle text-xs font-medium text-sx-text-secondary"
                >
                  {initials}
                </span>
              ))}
            </div>
            <span className="text-xs text-sx-text-muted">
              2 reviewers assigned
            </span>
          </div>
          <div className="flex gap-2">
            <span className="flex-1 rounded-[10px] border border-sx-success/25 bg-sx-success/10 py-2 text-center text-xs font-semibold text-sx-success">
              Approve
            </span>
            <span className="flex-1 rounded-[10px] border border-white/[0.08] py-2 text-center text-xs text-sx-text-muted">
              Request changes
            </span>
          </div>
        </div>
      );
    case 'scheduled':
      return (
        <div className="space-y-2">
          {[
            { platform: 'LinkedIn', time: 'Tue 09:00', state: 'Queued' },
            { platform: 'Email', time: 'Wed 10:30', state: 'Queued' },
            { platform: 'GBP Post', time: 'Thu 14:00', state: 'Queued' },
          ].map(row => (
            <div
              key={row.platform}
              className="flex items-center justify-between rounded-[10px] border border-white/[0.06] bg-sx-bg-primary/50 px-3 py-2"
            >
              <div>
                <p className="text-xs font-medium text-sx-text-primary">
                  {row.platform}
                </p>
                <p className="text-xs text-sx-text-muted">{row.time}</p>
              </div>
              <StatusPill variant="scheduled" size="sm" label={row.state} />
            </div>
          ))}
        </div>
      );
    default:
      return null;
  }
}

export function HeroProductMock() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  const active = stages[activeIndex];

  useEffect(() => {
    setMounted(true);
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mq.matches);
    if (mq.matches) return undefined;

    const timer = window.setInterval(() => {
      setActiveIndex(i => (i + 1) % stages.length);
    }, 4000);

    return () => clearInterval(timer);
  }, []);

  return (
    <div
      className="landing-hero-mock-perspective relative"
      aria-hidden={!mounted}
    >
      {/* Depth layer — back panel */}
      <div
        className="absolute -right-3 top-6 -z-10 h-[94%] w-[96%] rounded-[22px] border border-white/[0.04] bg-sx-bg-panel/40"
        aria-hidden
      />

      <div
        className="relative overflow-hidden rounded-[20px] border border-white/[0.12] bg-sx-bg-elevated/95 shadow-[0_24px_80px_rgba(0,0,0,0.55),0_0_0_1px_rgba(255,255,255,0.04)_inset] backdrop-blur-xl"
        aria-label="Synthex command center preview"
      >
        {/* Gradient top edge */}
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-sx-accent/50 to-transparent"
          aria-hidden
        />

        {/* Title bar */}
        <div className="flex items-center gap-3 border-b border-white/[0.06] bg-sx-bg-panel/90 px-4 py-3">
          <div className="flex gap-1.5" aria-hidden>
            <span className="h-2.5 w-2.5 rounded-full bg-error/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-warning/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-success/70" />
          </div>
          <div className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-white/[0.06] bg-sx-bg-primary/70 px-3 py-1.5">
            <Shield className="h-3 w-3 text-sx-accent/80" />
            <span className="text-xs font-medium tracking-wide text-sx-text-muted">
              synthex.social / workspace / campaign-run
            </span>
          </div>
          <span className="flex items-center gap-1.5 rounded-full border border-sx-success/25 bg-sx-success/10 px-2 py-0.5 text-xs font-medium text-sx-success">
            <span className="h-1.5 w-1.5 rounded-full bg-sx-success" />
            Live
          </span>
        </div>

        <div className="grid lg:grid-cols-[168px_1fr]">
          {/* Pipeline rail */}
          <nav
            className="border-b border-white/[0.06] bg-sx-bg-primary/40 p-3 lg:border-b-0 lg:border-r"
            aria-label="Workflow pipeline"
          >
            <p className="mb-3 px-2 text-xs font-semibold uppercase tracking-[0.2em] text-sx-text-muted">
              Pipeline
            </p>
            <ol className="space-y-1">
              {stages.map((stage, index) => {
                const Icon = stage.icon;
                const isActive = index === activeIndex;
                const isPast = index < activeIndex;

                return (
                  <li key={stage.id}>
                    <button
                      type="button"
                      onClick={() => setActiveIndex(index)}
                      className={cn(
                        'group flex w-full items-center gap-2.5 rounded-[12px] px-2 py-2 text-left transition-all duration-[200ms] ease-premium',
                        isActive
                          ? 'bg-gradient-to-r from-sx-accent/[0.14] to-transparent border border-sx-accent/20'
                          : 'border border-transparent hover:bg-white/[0.03]'
                      )}
                    >
                      <span
                        className={cn(
                          'relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-colors',
                          isActive
                            ? 'border-sx-accent/30 bg-sx-accent/10'
                            : isPast
                              ? 'border-sx-success/20 bg-sx-success/5'
                              : 'border-white/[0.06] bg-sx-bg-subtle/40'
                        )}
                      >
                        <Icon
                          className={cn(
                            'h-3.5 w-3.5',
                            isActive
                              ? 'text-sx-accent'
                              : isPast
                                ? 'text-sx-success'
                                : 'text-sx-text-muted'
                          )}
                        />
                        {isPast && !isActive && (
                          <CheckCircle2 className="absolute -bottom-0.5 -right-0.5 h-3 w-3 text-sx-success" />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-xs text-sx-text-muted">
                          {stage.step}
                        </span>
                        <span
                          className={cn(
                            'block truncate text-xs font-medium',
                            isActive
                              ? 'text-sx-text-primary'
                              : 'text-sx-text-secondary'
                          )}
                        >
                          {stage.label}
                        </span>
                      </span>
                      {isActive && (
                        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-sx-accent" />
                      )}
                    </button>
                  </li>
                );
              })}
            </ol>
          </nav>

          {/* Active stage panel */}
          <div className="flex min-h-[320px] flex-col p-4 lg:min-h-[380px]">
            <div
              className="mb-4 flex items-start justify-between gap-3"
              aria-live="polite"
            >
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sx-accent">
                  Stage {active.step} · {active.label}
                </p>
                <h3 className="mt-1 text-base font-semibold text-sx-text-primary">
                  {active.title}
                </h3>
              </div>
              <StatusPill variant={active.status} size="sm" />
            </div>

            <div
              key={active.id}
              className={cn(
                'flex-1 rounded-[14px] border border-white/[0.08] bg-gradient-to-br from-sx-bg-panel/80 to-sx-bg-primary/60 p-4',
                !reducedMotion && 'landing-stage-enter'
              )}
            >
              <StagePreview stageId={active.id} />
            </div>

            {/* Metrics strip */}
            <div className="mt-4 grid grid-cols-3 gap-2 border-t border-white/[0.06] pt-4">
              {[
                { label: 'Pending', value: '3', tone: 'text-sx-warning' },
                { label: 'Staged', value: '8', tone: 'text-sx-info' },
                { label: 'Approved', value: '12', tone: 'text-sx-success' },
              ].map(metric => (
                <div
                  key={metric.label}
                  className="rounded-[10px] border border-white/[0.05] bg-sx-bg-primary/40 px-2 py-2 text-center"
                >
                  <p
                    className={cn(
                      'text-lg font-semibold tabular-nums',
                      metric.tone
                    )}
                  >
                    {metric.value}
                  </p>
                  <p className="text-xs text-sx-text-muted">{metric.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer bar */}
        <div className="flex items-center justify-between border-t border-white/[0.06] bg-sx-bg-panel/60 px-4 py-2.5">
          <div className="flex items-center gap-2 text-xs text-sx-text-muted">
            <BarChart3 className="h-3.5 w-3.5 text-sx-intelligence" />
            Insights unlock post-publish
          </div>
          <div className="flex gap-1">
            {stages.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Go to stage ${i + 1}`}
                onClick={() => setActiveIndex(i)}
                className={cn(
                  'h-1 rounded-full transition-all duration-[200ms]',
                  i === activeIndex ? 'w-4 bg-sx-accent' : 'w-1 bg-white/15'
                )}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
