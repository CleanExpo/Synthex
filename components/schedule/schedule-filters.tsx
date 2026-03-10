'use client';

/**
 * Schedule Filters Component
 * Platform/status filters and view mode toggle
 */

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CalendarDays, Calendar, List } from '@/components/icons';
import { platformOptions, statusOptions } from './schedule-config';
import type { ViewMode } from './types';

interface ScheduleFiltersProps {
  filterPlatform: string;
  filterStatus: string;
  viewMode: ViewMode;
  onPlatformChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  onViewModeChange: (mode: ViewMode) => void;
}

export function ScheduleFilters({
  filterPlatform,
  filterStatus,
  viewMode,
  onPlatformChange,
  onStatusChange,
  onViewModeChange,
}: ScheduleFiltersProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div className="flex items-center space-x-3">
        <Select value={filterPlatform} onValueChange={onPlatformChange}>
          <SelectTrigger className="w-40 bg-white/5 border-white/10 text-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {platformOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={onStatusChange}>
          <SelectTrigger className="w-40 bg-white/5 border-white/10 text-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {statusOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <ViewModeToggle viewMode={viewMode} onChange={onViewModeChange} />
    </div>
  );
}

interface ViewModeToggleProps {
  viewMode: ViewMode;
  onChange: (mode: ViewMode) => void;
}

function ViewModeToggle({ viewMode, onChange }: ViewModeToggleProps) {
  const modes: { mode: ViewMode; icon: typeof CalendarDays; label: string }[] = [
    { mode: 'week', icon: CalendarDays, label: 'Week' },
    { mode: 'month', icon: Calendar, label: 'Month' },
    { mode: 'list', icon: List, label: 'List' },
  ];

  return (
    <div className="flex space-x-1 bg-white/5 rounded-lg p-1">
      {modes.map(({ mode, icon: Icon, label }) => (
        <button
          key={mode}
          onClick={() => onChange(mode)}
          className={`px-3 py-1.5 rounded text-sm transition-all flex items-center gap-2 ${
            viewMode === mode
              ? 'bg-cyan-500/20 text-cyan-400'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Icon className="h-4 w-4" />
          {label}
        </button>
      ))}
    </div>
  );
}
