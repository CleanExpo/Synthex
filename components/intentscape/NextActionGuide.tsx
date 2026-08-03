'use client';

import {
  ArrowRight,
  BadgeCheck,
  Brain,
  Database,
  FileText,
  Target,
} from '@/components/icons';
import { Button } from '@/components/ui/button';
import type {
  IntentScapeWorkspaceSnapshot,
  IntentScapeWorkPacket,
} from './types';

interface NextActionGuideProps {
  snapshot: IntentScapeWorkspaceSnapshot;
  workPacket: IntentScapeWorkPacket | null;
  busy: boolean;
  onExpand: () => Promise<void>;
  onBuildWorkPacket: () => Promise<void>;
}

function scrollTo(id: string) {
  document.getElementById(id)?.scrollIntoView({
    behavior: 'smooth',
    block: 'start',
  });
}

export function NextActionGuide({
  snapshot,
  workPacket,
  busy,
  onExpand,
  onBuildWorkPacket,
}: NextActionGuideProps) {
  const evidenceCount =
    snapshot.contextField?.signals.filter(
      signal => signal.kind !== 'origin-signal'
    ).length ?? 0;

  const action = workPacket
    ? {
        stage: 'Packet ready',
        title: 'The governed hand-off is ready',
        detail:
          'The agents now have an approved goal, evidence references and explicit limits. No action has been executed.',
        label: 'Review the packet',
        progress: 100,
        icon: BadgeCheck,
        run: () => scrollTo('decision-dock-title'),
      }
    : snapshot.goalContract
      ? {
          stage: 'One move left',
          title: 'Package your decision for the agent team',
          detail:
            'Synthex will carry forward only the goal and boundaries you approved.',
          label: 'Build the governed packet',
          progress: 75,
          icon: FileText,
          run: onBuildWorkPacket,
        }
      : snapshot.acceptedVision
        ? {
            stage: 'Your decision',
            title: 'Choose the direction that deserves authority',
            detail:
              'The agents have finished exploring. This is the only step they cannot take for you.',
            label: 'Go to the decision',
            progress: 50,
            icon: Target,
            run: () => scrollTo('decision-dock-title'),
          }
        : evidenceCount > 0
          ? {
              stage: 'Context ready',
              title: 'Let the agents expand beyond the original request',
              detail:
                'Seven lenses will generate competing causes, research branches and decision paths.',
              label: 'Expand the vision',
              progress: 25,
              icon: Brain,
              run: onExpand,
            }
          : {
              stage: 'Recommended next move',
              title: 'Paste everything you already know once',
              detail:
                'Drop in links, documents and notes together. Synthex will sort them without an interview.',
              label: 'Add context in one paste',
              progress: 10,
              icon: Database,
              run: () => scrollTo('context-field-title'),
            };

  const Icon = action.icon;

  return (
    <section
      aria-label="Recommended next action"
      className="relative overflow-hidden rounded-card border border-sx-accent/20 bg-sx-bg-elevated shadow-[var(--sx-shadow-elevated)]"
    >
      <div
        className="absolute inset-y-0 left-0 w-1 bg-sx-accent"
        aria-hidden="true"
      />
      <div className="grid gap-4 p-4 md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-center md:p-5">
        <div className="flex h-11 w-11 items-center justify-center rounded-btn border border-sx-intelligence/20 bg-sx-intelligence/[0.08] text-sx-intelligence">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-sx-accent">
              {action.stage}
            </p>
            <span className="font-mono text-xs tabular-nums text-sx-text-muted">
              {action.progress}% of the authority path complete
            </span>
          </div>
          <h2 className="mt-1 text-balance font-[var(--font-space-grotesk)] text-lg font-medium text-sx-text-primary">
            {action.title}
          </h2>
          <p className="mt-1 max-w-3xl text-pretty text-sm leading-6 text-sx-text-muted">
            {action.detail}
          </p>
          <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className="h-full rounded-full bg-sx-accent transition-[width] duration-[220ms] ease-premium motion-reduce:transition-none"
              style={{ width: `${action.progress}%` }}
            />
          </div>
        </div>
        <Button
          type="button"
          variant="premium-primary"
          size="xl"
          disabled={busy}
          onClick={action.run}
          className="min-h-11 active:scale-[0.96] transition-transform motion-reduce:transform-none"
        >
          {action.label}
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </section>
  );
}
