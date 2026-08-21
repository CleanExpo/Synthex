'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/dashboard/page-header';
import {
  DashboardAtmosphere,
  DashboardPanel,
  DashboardEyebrow,
} from '@/components/dashboard/DashboardAtmosphere';
import { DashboardQuickRail } from '@/components/dashboard/DashboardQuickRail';
import { GoalIntake } from './GoalIntake';
import { RepoContext } from './RepoContext';
import { ProjectGate } from './ProjectGate';
import { TicketDraftReview } from './TicketDraftReview';
import { MissionStatusSpine } from './MissionStatusSpine';
import { ComingSoonStage } from './ComingSoonStage';
import type { MissionRecord } from '@/lib/mission-control/types';
import { ChevronDown } from '@/components/icons';
import { cn } from '@/lib/utils';

function asMission(raw: unknown): MissionRecord {
  return raw as MissionRecord;
}

export function MissionControlHome({
  legacyCommandCentre,
  insights,
}: {
  legacyCommandCentre?: ReactNode;
  insights?: ReactNode;
}) {
  const [missions, setMissions] = useState<MissionRecord[]>([]);
  const [active, setActive] = useState<MissionRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [showLegacy, setShowLegacy] = useState(false);
  const [showInsights, setShowInsights] = useState(false);

  const refresh = useCallback(async () => {
    const res = await fetch('/api/mission-control/missions', {
      credentials: 'include',
    });
    if (!res.ok) throw new Error('Failed to load missions');
    const data = await res.json();
    const list = (data.missions ?? []) as MissionRecord[];
    setMissions(list);
    setActive(prev => {
      if (!prev) return list[0] ?? null;
      return list.find(m => m.id === prev.id) ?? list[0] ?? null;
    });
  }, []);

  useEffect(() => {
    refresh()
      .catch(() => setMissions([]))
      .finally(() => setLoading(false));
  }, [refresh]);

  const startMission = async (goal: string, acceptanceCriteria: string) => {
    const res = await fetch('/api/mission-control/missions', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ goal, acceptanceCriteria }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || data.error || 'Create failed');
    const mission = asMission(data.mission);
    setActive(mission);
    setMissions(prev => [mission, ...prev.filter(m => m.id !== mission.id)]);
  };

  const syncActive = (raw: unknown) => {
    const mission = asMission(raw);
    setActive(mission);
    setMissions(prev => prev.map(m => (m.id === mission.id ? mission : m)));
  };

  if (loading) {
    return (
      <DashboardAtmosphere className="mx-auto max-w-5xl space-y-5 animate-pulse">
        <div className="h-20 bg-white/3 border-[0.5px] border-white/6 rounded-sm" />
        <div className="h-14 bg-white/3 border-[0.5px] border-white/6 rounded-sm" />
        <div className="h-56 bg-white/3 border-[0.5px] border-white/6 rounded-sm" />
      </DashboardAtmosphere>
    );
  }

  const stage = active?.stage ?? 'goal';
  const openCount = missions.filter(m => m.stage !== 'coming_soon').length;
  const shippedCount = missions.filter(m => m.createdTickets.length > 0).length;

  return (
    <DashboardAtmosphere className="mx-auto max-w-5xl space-y-7">
      <PageHeader
        eyebrow="Mission Control"
        title="From goal to shipped work"
        description="One unbroken path: Goal → GitHub → Linear project → approved tickets. Execution stages arrive next."
        actions={
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard/content"
              className="hidden sm:inline-flex items-center px-3.5 py-2 text-xs text-white/55 border-[0.5px] border-white/10 hover:border-white/20 hover:text-white/80 rounded-sm transition-colors"
            >
              Content studio
            </Link>
            <button
              type="button"
              onClick={() => setActive(null)}
              className="inline-flex items-center bg-orange-500 hover:bg-orange-400 text-black font-medium text-xs py-2 px-3.5 rounded-sm transition-colors"
            >
              New mission
            </button>
          </div>
        }
      />

      {/* KPI strip — ops console, not marketing widgets */}
      <div className="grid grid-cols-3 border-[0.5px] border-white/6 rounded-sm divide-x divide-white/6 overflow-hidden">
        {[
          { label: 'Active', value: String(openCount) },
          { label: 'With tickets', value: String(shippedCount) },
          { label: 'Pipeline', value: 'Scene 1' },
        ].map(kpi => (
          <div key={kpi.label} className="px-4 py-3.5 bg-white/[0.01]">
            <p className="text-xs uppercase tracking-[0.2em] text-white/30">
              {kpi.label}
            </p>
            <p className="mt-1 text-xl font-extralight text-white tracking-tight">
              {kpi.value}
            </p>
          </div>
        ))}
      </div>

      <MissionStatusSpine stage={stage} />

      <DashboardQuickRail />

      {!active && <GoalIntake onSubmit={startMission} />}

      {active && (
        <div className="space-y-4">
          <DashboardPanel className="flex flex-wrap items-start justify-between gap-3 !py-4">
            <div className="min-w-0">
              <DashboardEyebrow>Active mission</DashboardEyebrow>
              <p className="text-sm sm:text-base text-white/85 font-light leading-relaxed">
                {active.goal}
              </p>
              {active.linearProjectName && (
                <p className="text-xs text-white/35 mt-1.5">
                  Project · {active.linearProjectName}
                  {active.repoFullName ? ` · ${active.repoFullName}` : ''}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setActive(null)}
              className="text-xs uppercase tracking-[0.14em] text-white/35 hover:text-white/65 shrink-0"
            >
              Clear
            </button>
          </DashboardPanel>

          {(stage === 'repo' ||
            stage === 'project' ||
            stage === 'draft' ||
            stage === 'approval' ||
            stage === 'coming_soon') && (
            <RepoContext
              missionId={active.id}
              analysis={active.repoAnalysis}
              onAnalyzed={syncActive}
            />
          )}

          {(stage === 'project' ||
            stage === 'draft' ||
            stage === 'approval' ||
            stage === 'coming_soon') && (
            <ProjectGate
              missionId={active.id}
              selectedProjectId={active.linearProjectId}
              onSelected={syncActive}
            />
          )}

          {(stage === 'draft' || stage === 'approval') && (
            <TicketDraftReview
              missionId={active.id}
              drafts={active.draftTickets}
              projectName={active.linearProjectName}
              onDrafted={syncActive}
              onApproved={syncActive}
            />
          )}

          {stage === 'coming_soon' && (
            <ComingSoonStage tickets={active.createdTickets} />
          )}
        </div>
      )}

      {missions.length > 0 && (
        <DashboardPanel padded={false} className="overflow-hidden">
          <div className="px-5 py-3.5 border-b border-white/6 flex items-center justify-between">
            <DashboardEyebrow className="mb-0">Mission strip</DashboardEyebrow>
            <span className="text-xs text-white/25">
              {missions.length} total
            </span>
          </div>
          <ul className="divide-y divide-white/6">
            {missions.slice(0, 8).map(m => {
              const isActive = active?.id === m.id;
              return (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={() => setActive(m)}
                    className={cn(
                      'w-full text-left px-5 py-3.5 transition-colors flex items-center justify-between gap-3',
                      isActive ? 'bg-orange-500/10' : 'hover:bg-white/[0.02]'
                    )}
                  >
                    <span
                      className={cn(
                        'text-sm font-light truncate',
                        isActive ? 'text-white' : 'text-white/65'
                      )}
                    >
                      {m.goal}
                    </span>
                    <span className="text-xs uppercase tracking-[0.14em] text-white/30 shrink-0">
                      {m.stage.replace('_', ' ')}
                      {m.createdTickets[0]
                        ? ` · ${m.createdTickets[0].identifier}`
                        : ''}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </DashboardPanel>
      )}

      {insights && (
        <div>
          <button
            type="button"
            aria-expanded={showInsights}
            onClick={() => setShowInsights(v => !v)}
            className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-white/30 hover:text-white/55 transition-colors"
          >
            Insights
            <ChevronDown
              className={cn(
                'h-3.5 w-3.5 transition-transform',
                showInsights && 'rotate-180'
              )}
            />
          </button>
          {showInsights && <div className="mt-4 space-y-4">{insights}</div>}
        </div>
      )}

      {legacyCommandCentre && (
        <div className="pt-1 border-t border-white/6">
          <button
            type="button"
            onClick={() => setShowLegacy(v => !v)}
            className="mt-4 text-xs uppercase tracking-[0.16em] text-white/25 hover:text-white/45"
          >
            {showLegacy ? 'Hide' : 'Show'} classic Command Centre
          </button>
          {showLegacy && <div className="mt-4">{legacyCommandCentre}</div>}
        </div>
      )}
    </DashboardAtmosphere>
  );
}
