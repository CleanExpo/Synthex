'use client';

import { useEffect, useState } from 'react';
import {
  BarChart3,
  BrainCircuit,
  Calendar,
  CheckCircle2,
  ImageIcon,
  Mic,
  Search,
} from '@/components/icons';
import {
  StatusPill,
  type StatusPillVariant,
} from '@/components/ui/status-pill';
import { cn } from '@/lib/utils';

const workflowCards: {
  step: string;
  title: string;
  copy: string;
  status: StatusPillVariant;
  icon: typeof Mic;
}[] = [
  {
    step: '01',
    title: 'Voice transcript',
    copy: 'Founder brief from mobile — raw idea captured with source timestamp.',
    status: 'intake',
    icon: Mic,
  },
  {
    step: '02',
    title: 'Research bundle',
    copy: 'Search, competitors and product notes linked to evidence refs.',
    status: 'verified',
    icon: Search,
  },
  {
    step: '03',
    title: 'Campaign plan',
    copy: 'Audience, offer, channels, assets, risks and open questions as cards.',
    status: 'draft',
    icon: BrainCircuit,
  },
  {
    step: '04',
    title: 'Creative assets',
    copy: 'Posts, email, thumbnails and video storyboards staged for review.',
    status: 'staged',
    icon: ImageIcon,
  },
  {
    step: '05',
    title: 'Awaiting approval',
    copy: 'Human reviewer must sign off before anything reaches a publish queue.',
    status: 'awaiting_approval',
    icon: CheckCircle2,
  },
  {
    step: '06',
    title: 'Scheduled',
    copy: 'Approved assets enter the calendar with platform and time locked.',
    status: 'scheduled',
    icon: Calendar,
  },
];

export function HeroProductMock() {
  const [visibleCount, setVisibleCount] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mq.matches);
    if (mq.matches) {
      setVisibleCount(workflowCards.length);
      return undefined;
    }

    setVisibleCount(1);
    const timers = workflowCards
      .slice(1)
      .map((_, i) =>
        window.setTimeout(() => setVisibleCount(i + 2), (i + 1) * 80 + 160)
      );

    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div
      className="relative rounded-card border border-white/[0.08] bg-sx-bg-elevated p-3 shadow-[var(--sx-shadow-elevated)]"
      aria-label="Synthex workflow preview"
    >
      <div className="mb-3 flex items-center justify-between border-b border-white/[0.06] px-2 py-2">
        <span className="text-[11px] font-medium uppercase tracking-[0.2em] text-sx-text-muted">
          Command center
        </span>
        <StatusPill variant="awaiting_approval" size="sm" />
      </div>
      <div
        className="grid max-h-[min(520px,70svh)] gap-2 overflow-y-auto"
        aria-live="polite"
      >
        {workflowCards.map((card, index) => {
          const Icon = card.icon;
          const isVisible = reducedMotion || index < visibleCount;

          return (
            <article
              key={card.title}
              className={cn(
                'rounded-[14px] border border-white/[0.06] bg-sx-bg-panel p-4 transition-all duration-[160ms] ease-premium',
                isVisible
                  ? 'translate-y-0 opacity-100'
                  : 'translate-y-2 opacity-0'
              )}
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sx-accent">
                  {card.step}
                </span>
                <StatusPill variant={card.status} size="sm" />
              </div>
              <div className="flex gap-3">
                <Icon className="mt-0.5 h-4 w-4 shrink-0 text-sx-text-secondary" />
                <div>
                  <h3 className="text-sm font-semibold text-sx-text-primary">
                    {card.title}
                  </h3>
                  <p className="mt-1.5 text-xs leading-5 text-sx-text-muted">
                    {card.copy}
                  </p>
                </div>
              </div>
            </article>
          );
        })}
      </div>
      <div className="mt-2 flex items-center gap-2 border-t border-white/[0.06] px-2 pt-3 text-[11px] text-sx-text-muted">
        <BarChart3 className="h-3.5 w-3.5" />
        Performance insights unlock after publish — not before approval.
      </div>
    </div>
  );
}
