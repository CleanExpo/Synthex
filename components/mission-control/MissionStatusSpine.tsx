'use client';

import { cn } from '@/lib/utils';
import type { MissionStage } from '@/lib/mission-control/types';
import { COMING_SOON_STAGES } from '@/lib/mission-control/types';
import {
  DashboardPanel,
  DashboardEyebrow,
} from '@/components/dashboard/DashboardAtmosphere';

const SCENE1: Array<{ key: MissionStage | 'spine'; label: string }> = [
  { key: 'goal', label: 'Goal' },
  { key: 'repo', label: 'Repo' },
  { key: 'project', label: 'Project' },
  { key: 'approval', label: 'Tickets' },
];

const ORDER: MissionStage[] = [
  'goal',
  'repo',
  'project',
  'draft',
  'approval',
  'tickets',
  'coming_soon',
];

function stageIndex(stage: MissionStage): number {
  if (stage === 'draft') return ORDER.indexOf('project');
  if (stage === 'tickets') return ORDER.indexOf('approval');
  return ORDER.indexOf(stage);
}

export function MissionStatusSpine({
  stage,
  className,
}: {
  stage: MissionStage;
  className?: string;
}) {
  const current = stageIndex(stage);

  return (
    <DashboardPanel className={cn('!py-4', className)}>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <DashboardEyebrow className="mb-0">Pipeline</DashboardEyebrow>
        <p className="text-xs text-white/30">
          Human gates on project + approval
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {SCENE1.map((step, i) => {
          const active =
            step.key === 'goal'
              ? current >= 0
              : step.key === 'repo'
                ? current >= 1
                : step.key === 'project'
                  ? current >= 2
                  : current >= 4;
          const isNow =
            (step.key === 'goal' && stage === 'goal') ||
            (step.key === 'repo' && stage === 'repo') ||
            (step.key === 'project' &&
              (stage === 'project' || stage === 'draft')) ||
            (step.key === 'approval' &&
              (stage === 'approval' || stage === 'tickets'));

          return (
            <div key={step.key} className="flex items-center gap-2">
              {i > 0 && (
                <span className="h-px w-4 sm:w-8 bg-white/10" aria-hidden />
              )}
              <span
                className={cn(
                  'text-xs uppercase tracking-[0.18em] px-2.5 py-1.5 border-[0.5px] rounded-sm transition-colors',
                  isNow
                    ? 'border-orange-500/45 text-orange-400 bg-orange-500/10'
                    : active
                      ? 'border-white/15 text-white/70 bg-white/3'
                      : 'border-white/6 text-white/25'
                )}
              >
                {step.label}
              </span>
            </div>
          );
        })}
        <span className="h-px w-4 sm:w-8 bg-white/10" aria-hidden />
        <span className="text-xs uppercase tracking-[0.18em] px-2.5 py-1.5 border-[0.5px] border-dashed border-white/10 text-white/25 rounded-sm">
          Code → Tests → PR
        </span>
      </div>

      {stage === 'coming_soon' && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mt-4 pt-4 border-t border-white/6">
          {COMING_SOON_STAGES.map(s => (
            <div
              key={s.key}
              className="border-[0.5px] border-dashed border-white/8 bg-black/20 px-3 py-2.5 rounded-sm"
            >
              <p className="text-xs uppercase tracking-[0.2em] text-white/30 mb-1">
                Coming soon
              </p>
              <p className="text-xs text-white/55 font-light">{s.label}</p>
              <p className="text-xs text-white/30 mt-0.5 leading-snug">
                {s.blurb}
              </p>
            </div>
          ))}
        </div>
      )}
    </DashboardPanel>
  );
}
