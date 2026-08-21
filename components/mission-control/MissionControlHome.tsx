'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { PageHeader } from '@/components/dashboard/page-header';
import { GoalIntake } from './GoalIntake';
import { RepoContext } from './RepoContext';
import { ProjectGate } from './ProjectGate';
import { TicketDraftReview } from './TicketDraftReview';
import { MissionStatusSpine } from './MissionStatusSpine';
import { ComingSoonStage } from './ComingSoonStage';
import type { MissionRecord } from '@/lib/mission-control/types';

function asMission(raw: unknown): MissionRecord {
  return raw as MissionRecord;
}

export function MissionControlHome({
  legacyCommandCentre,
}: {
  legacyCommandCentre?: ReactNode;
}) {
  const [missions, setMissions] = useState<MissionRecord[]>([]);
  const [active, setActive] = useState<MissionRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [showLegacy, setShowLegacy] = useState(false);

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
    setMissions(prev =>
      prev.map(m => (m.id === mission.id ? mission : m))
    );
  };

  if (loading) {
    return (
      <div className="space-y-5 animate-pulse">
        <div className="h-16 bg-white/3 border-[0.5px] border-white/6 rounded-sm" />
        <div className="h-48 bg-white/3 border-[0.5px] border-white/6 rounded-sm" />
      </div>
    );
  }

  const stage = active?.stage ?? 'goal';

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Mission Control"
        title="Ship from goal to Linear"
        description="Goal → repo → project → approved tickets. Code, tests, and PRs are next."
      />

      <MissionStatusSpine stage={stage} />

      {!active && <GoalIntake onSubmit={startMission} />}

      {active && (
        <div className="space-y-4">
          <div className="border-[0.5px] border-white/6 bg-white/1 rounded-sm px-4 py-3 flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[9px] uppercase tracking-[0.2em] text-white/30 mb-1">
                Active mission
              </p>
              <p className="text-sm text-white/80 font-light leading-relaxed">
                {active.goal}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActive(null)}
              className="text-[11px] text-white/40 hover:text-white/70 shrink-0"
            >
              New goal
            </button>
          </div>

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
        <div className="border-[0.5px] border-white/6 rounded-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-white/6">
            <p className="text-[9px] uppercase tracking-[0.22em] text-white/30">
              Mission strip
            </p>
          </div>
          <ul className="divide-y divide-white/6">
            {missions.slice(0, 8).map(m => (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => setActive(m)}
                  className="w-full text-left px-4 py-3 hover:bg-white/2 transition-colors flex items-center justify-between gap-3"
                >
                  <span className="text-sm text-white/70 font-light truncate">
                    {m.goal}
                  </span>
                  <span className="text-[10px] uppercase tracking-[0.14em] text-white/30 shrink-0">
                    {m.stage.replace('_', ' ')}
                    {m.createdTickets[0]
                      ? ` · ${m.createdTickets[0].identifier}`
                      : ''}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {legacyCommandCentre && (
        <div className="pt-2">
          <button
            type="button"
            onClick={() => setShowLegacy(v => !v)}
            className="text-[11px] uppercase tracking-[0.16em] text-white/30 hover:text-white/50"
          >
            {showLegacy ? 'Hide' : 'Show'} classic Command Centre
          </button>
          {showLegacy && <div className="mt-4">{legacyCommandCentre}</div>}
        </div>
      )}
    </div>
  );
}
