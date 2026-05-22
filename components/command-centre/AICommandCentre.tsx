'use client';

import { useState } from 'react';
import { useCommandCentre } from '@/hooks/useCommandCentre';
import { AutopilotStatusBar } from './AutopilotStatusBar';
import { CommandCentreStats } from './CommandCentreStats';
import { AIActivityFeed } from './AIActivityFeed';
import { PendingApprovalQueue } from './PendingApprovalQueue';
import { PerformancePulse } from './PerformancePulse';
import { QuickActionsBar } from './QuickActionsBar';
import { CommandCentrePanels } from './CommandCentrePanels';
import { DraftCommandIntakePanel } from './DraftCommandIntakePanel';
import { CommandRoutingQueuePanel } from './CommandRoutingQueuePanel';
import { ProviderReadinessStrip } from './ProviderReadinessStrip';
import { SandboxCampaignStudio } from './SandboxCampaignStudio';
import { HealthLoopCard } from './HealthLoopCard';
import { APIErrorCard } from '@/components/error-states';
import type { DraftCommandResponse } from './types';

export function AICommandCentre() {
  const [latestDraft, setLatestDraft] = useState<DraftCommandResponse | null>(
    null
  );
  const {
    status,
    activity,
    pending,
    performance,
    stats,
    isLoading,
    error,
    mutateStatus,
    mutatePending,
    mutateActivity,
    mutateStats,
  } = useCommandCentre();

  const handleToggled = () => {
    mutateStatus();
    mutateStats();
  };

  const handlePendingAction = () => {
    mutatePending();
    mutateStats();
    mutateActivity();
  };

  if (isLoading) {
    return (
      <div className="space-y-5 animate-pulse">
        <div className="h-14 bg-white/[0.03] border-[0.5px] border-white/[0.06] rounded-sm" />
        <div className="border-[0.5px] border-white/[0.06] rounded-sm grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 divide-x divide-white/[0.06]">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="px-5 py-4 space-y-2">
              <div className="h-7 w-16 bg-white/[0.05] rounded-sm" />
              <div className="h-2 w-20 bg-white/[0.03] rounded-sm" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 h-64 bg-white/[0.03] border-[0.5px] border-white/[0.06] rounded-sm" />
          <div className="h-64 bg-white/[0.03] border-[0.5px] border-white/[0.06] rounded-sm" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <APIErrorCard
          title="Command Centre Error"
          message="Failed to load Command Centre data. Please try again."
          onRetry={() => {
            mutateStatus();
            mutateStats();
            mutateActivity();
            mutatePending();
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Autopilot status bar */}
      <AutopilotStatusBar status={status} onToggled={handleToggled} />

      {/* Stats strip */}
      <CommandCentreStats stats={stats} />

      {/* Quick actions */}
      <QuickActionsBar />

      {/* Sandbox campaign studio */}
      <SandboxCampaignStudio draft={latestDraft} />

      {/* Draft-only command intake */}
      <DraftCommandIntakePanel onDraftCreated={setLatestDraft} />

      {/* Board, Margot and @team routing queue */}
      <CommandRoutingQueuePanel draft={latestDraft} />

      {/* Provider readiness gates */}
      <ProviderReadinessStrip />

      {/* Health loop evidence chain */}
      <HealthLoopCard health={status?.closeLoopHealth ?? null} />

      {/* Main grid: Activity + Pending */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <AIActivityFeed items={activity} />
          <PerformancePulse data={performance} />
        </div>
        <PendingApprovalQueue items={pending} onAction={handlePendingAction} />
      </div>

      {/* Tabbed panels — orphan components */}
      <CommandCentrePanels />
    </div>
  );
}
