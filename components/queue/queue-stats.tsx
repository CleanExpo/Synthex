'use client';

/**
 * QueueStats Component
 *
 * Mini stat cards row: Total | Scheduled | Failed | Published Today | Next Up In
 */

import { Calendar, AlertCircle, CheckCircle, Clock } from '@/components/icons';

interface QueueStatsProps {
  total: number;
  scheduled: number;
  failed: number;
  publishedToday: number;
  nextScheduledAt: string | null;
}

function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return '—';
  const diff = new Date(dateStr).getTime() - Date.now();

  if (diff <= 0) return 'Now';

  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (hours > 0) {
    return `in ${hours}h ${remainingMinutes}m`;
  }
  return `in ${remainingMinutes}m`;
}

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  highlight?: boolean;
  highlightColour?: string;
}

function StatCard({ label, value, icon: Icon, highlight, highlightColour }: StatCardProps) {
  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors ${
        highlight
          ? `border-${highlightColour ?? 'red'}-500/30 bg-${highlightColour ?? 'red'}-500/[0.05]`
          : 'border-white/10 bg-white/[0.02]'
      }`}
      style={
        highlight
          ? {
              borderColor: highlightColour === 'red' ? 'rgba(239,68,68,0.3)' : undefined,
              backgroundColor: highlightColour === 'red' ? 'rgba(239,68,68,0.05)' : undefined,
            }
          : undefined
      }
    >
      <div
        className={`p-2 rounded-lg ${
          highlight ? 'bg-red-500/10' : 'bg-white/5'
        }`}
      >
        <Icon
          className={`h-4 w-4 ${
            highlight ? 'text-red-400' : 'text-gray-400'
          }`}
        />
      </div>
      <div>
        <p className="text-xs text-gray-500 uppercase tracking-wider">{label}</p>
        <p
          className={`text-lg font-semibold ${
            highlight ? 'text-red-400' : 'text-white'
          }`}
        >
          {value}
        </p>
      </div>
    </div>
  );
}

export function QueueStats({
  total,
  scheduled,
  failed,
  publishedToday,
  nextScheduledAt,
}: QueueStatsProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
      <StatCard label="Total" value={total} icon={Calendar} />
      <StatCard label="Scheduled" value={scheduled} icon={Clock} />
      <StatCard
        label="Failed"
        value={failed}
        icon={AlertCircle}
        highlight={failed > 0}
        highlightColour="red"
      />
      <StatCard label="Published Today" value={publishedToday} icon={CheckCircle} />
      <StatCard
        label="Next Up"
        value={formatRelativeTime(nextScheduledAt)}
        icon={Clock}
      />
    </div>
  );
}
