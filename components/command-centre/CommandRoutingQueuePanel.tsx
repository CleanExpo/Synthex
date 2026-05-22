'use client';

import {
  AlertTriangle,
  CheckCircle2,
  GitBranch,
  Inbox,
  MessageSquare,
  Shield,
  Users,
} from '@/components/icons';
import { cn } from '@/lib/utils';
import type { CommandPacket } from '@/lib/unite-command-center';
import type { DraftCommandResponse } from './types';

const GATE_CLASSES: Record<CommandPacket['approvalGate'], string> = {
  human_review: 'border-amber-500/25 bg-amber-500/[0.04] text-amber-300',
  client_review: 'border-cyan-500/25 bg-cyan-500/[0.04] text-cyan-300',
  production_blocked: 'border-red-500/25 bg-red-500/[0.04] text-red-300',
};

const TEAM_LABELS: Record<string, string> = {
  'ceo-board': 'CEO Board',
  margot: 'Margot',
  'marketing-strategy': 'Marketing Strategy',
  'research-council': 'Research Council',
  'senior-engineering-team': 'Senior Engineering',
  'gen-media': 'Gen Media',
  'presentation-qa': 'Presentation QA',
  compliance: 'Compliance',
};

export function CommandRoutingQueuePanel({
  draft,
}: {
  draft: DraftCommandResponse | null;
}) {
  const evidenceCount = draft?.boardInput.evidenceRefs.length ?? 0;
  const risks = draft?.commandPacket.risks ?? [];
  const teamRoute = draft?.commandPacket.teamRoute ?? [];

  return (
    <section className="border-[0.5px] border-white/[0.06] bg-white/[0.015] rounded-sm p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-[0.22em] text-white/35">
            Board, Margot and @team queue
          </div>
          <h3 className="mt-1 text-lg font-medium text-white/85">
            Draft packet routing state
          </h3>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-white/50">
            Intake stays in review mode while Synthex maps the source, Margot
            pass, evidence, risk, approval gate and team route.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <QueueBadge
            label={draft ? 'Draft queued' : 'Waiting'}
            tone={draft ? 'ready' : 'waiting'}
          />
          <QueueBadge label="No provider execution" tone="blocked" />
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] gap-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <QueueStatusCard
            title="Board input"
            value={draft ? draft.boardInput.source.replace(/_/g, ' ') : 'No packet'}
            detail={
              draft
                ? `${draft.boardInput.speaker} - ${formatDate(draft.boardInput.capturedAt)}`
                : 'Create a draft packet to populate the queue.'
            }
            Icon={Inbox}
            tone={draft ? 'ready' : 'waiting'}
          />
          <QueueStatusCard
            title="Margot pass"
            value={draft ? draft.boardInput.sensitivity : 'Waiting'}
            detail={
              draft
                ? risks.length > 0
                  ? `${risks.length} risk signal${risks.length === 1 ? '' : 's'} found`
                  : 'Cleaned and classified for routing.'
                : 'Conversation pass runs after intake.'
            }
            Icon={MessageSquare}
            tone={risks.length > 0 ? 'warning' : draft ? 'ready' : 'waiting'}
          />
          <QueueStatusCard
            title="Evidence"
            value={draft ? `${evidenceCount} ref${evidenceCount === 1 ? '' : 's'}` : 'Waiting'}
            detail={
              evidenceCount > 0
                ? 'Evidence attached to the packet.'
                : 'Missing evidence keeps review gates visible.'
            }
            Icon={GitBranch}
            tone={evidenceCount > 0 ? 'ready' : draft ? 'warning' : 'waiting'}
          />
          <QueueStatusCard
            title="Approval gate"
            value={draft ? draft.commandPacket.approvalGate.replace(/_/g, ' ') : 'Waiting'}
            detail={draft ? draft.commandPacket.nextAction : 'No approval path yet.'}
            Icon={Shield}
            tone={
              draft?.commandPacket.approvalGate === 'production_blocked'
                ? 'blocked'
                : draft
                  ? 'ready'
                  : 'waiting'
            }
          />
        </div>

        <div className="rounded-sm border-[0.5px] border-white/[0.06] bg-black/10 p-4 min-h-[236px]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[10px] uppercase tracking-widest text-white/35">
                @team dispatch
              </div>
              <div className="mt-1 text-sm text-white/75">
                {teamRoute.length > 0
                  ? `${teamRoute.length} route${teamRoute.length === 1 ? '' : 's'} queued`
                  : 'No draft route'}
              </div>
            </div>
            <Users className="h-5 w-5 text-cyan-300" />
          </div>

          {teamRoute.length > 0 ? (
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
              {teamRoute.map(route => (
                <div
                  key={route}
                  className="rounded-sm border-[0.5px] border-white/[0.06] bg-white/[0.02] p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-sm text-white/75">
                      {TEAM_LABELS[route] ?? titleCase(route)}
                    </div>
                    <span className="rounded-sm border-[0.5px] border-cyan-500/20 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-cyan-300">
                      queued
                    </span>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-white/42">
                    {route === 'margot'
                      ? 'Conversation pass and follow-up framing.'
                      : 'Draft review assignment only; no external execution.'}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-4 rounded-sm border-[0.5px] border-dashed border-white/[0.08] p-4 text-sm text-white/45">
              Team route appears after a draft packet is created.
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {draft && (
          <span
            className={cn(
              'rounded-sm border-[0.5px] px-2.5 py-1 text-[10px] uppercase tracking-wider',
              GATE_CLASSES[draft.commandPacket.approvalGate]
            )}
          >
            {draft.commandPacket.approvalGate.replace(/_/g, ' ')}
          </span>
        )}
        {(risks.length > 0 ? risks : ['execution_blocked']).map(item => (
          <span
            key={item}
            className="inline-flex items-center gap-1.5 rounded-sm border-[0.5px] border-red-500/20 bg-red-500/[0.04] px-2.5 py-1 text-[10px] uppercase tracking-wider text-red-300"
          >
            <AlertTriangle className="h-3 w-3" />
            {item.replace(/_/g, ' ')}
          </span>
        ))}
        {draft && risks.length === 0 && (
          <span className="inline-flex items-center gap-1.5 rounded-sm border-[0.5px] border-emerald-500/20 bg-emerald-500/[0.04] px-2.5 py-1 text-[10px] uppercase tracking-wider text-emerald-300">
            <CheckCircle2 className="h-3 w-3" />
            ready for review
          </span>
        )}
      </div>
    </section>
  );
}

function QueueStatusCard({
  title,
  value,
  detail,
  Icon,
  tone,
}: {
  title: string;
  value: string;
  detail: string;
  Icon: typeof Inbox;
  tone: 'ready' | 'waiting' | 'warning' | 'blocked';
}) {
  return (
    <div className="rounded-sm border-[0.5px] border-white/[0.06] bg-black/10 p-4 min-h-[136px]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-white/35">
            {title}
          </div>
          <div className="mt-2 text-sm font-medium text-white/78 capitalize">
            {value}
          </div>
        </div>
        <span
          className={cn(
            'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-sm border-[0.5px]',
            toneClass(tone)
          )}
        >
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-3 text-xs leading-relaxed text-white/45">{detail}</p>
    </div>
  );
}

function QueueBadge({
  label,
  tone,
}: {
  label: string;
  tone: 'ready' | 'waiting' | 'blocked';
}) {
  return (
    <span
      className={cn(
        'rounded-sm border-[0.5px] px-2.5 py-1 text-[10px] uppercase tracking-wider',
        toneClass(tone)
      )}
    >
      {label}
    </span>
  );
}

function toneClass(tone: 'ready' | 'waiting' | 'warning' | 'blocked') {
  switch (tone) {
    case 'ready':
      return 'border-emerald-500/25 bg-emerald-500/[0.04] text-emerald-300';
    case 'warning':
      return 'border-amber-500/25 bg-amber-500/[0.04] text-amber-300';
    case 'blocked':
      return 'border-red-500/25 bg-red-500/[0.04] text-red-300';
    case 'waiting':
    default:
      return 'border-white/[0.08] bg-white/[0.03] text-white/45';
  }
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'time unknown';
  return date.toLocaleDateString('en-AU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function titleCase(value: string): string {
  return value
    .split(/[-_]/g)
    .filter(Boolean)
    .map(part => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ');
}
