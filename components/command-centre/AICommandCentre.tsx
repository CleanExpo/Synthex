'use client';

import { useCommandCentre } from '@/hooks/useCommandCentre';
import { AutopilotStatusBar } from './AutopilotStatusBar';
import { CommandCentreStats } from './CommandCentreStats';
import { AIActivityFeed } from './AIActivityFeed';
import { PendingApprovalQueue } from './PendingApprovalQueue';
import { PerformancePulse } from './PerformancePulse';
import { QuickActionsBar } from './QuickActionsBar';
import { CommandCentrePanels } from './CommandCentrePanels';

export function AICommandCentre() {
  const {
    status,
    activity,
    pending,
    performance,
    stats,
    isLoading,
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

  return (
    <div className="space-y-5">
      {/* Autopilot status bar */}
      <AutopilotStatusBar status={status} onToggled={handleToggled} />

      {/* Stats strip */}
      <CommandCentreStats stats={stats} />

      {/* Quick actions */}
      <QuickActionsBar />

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
