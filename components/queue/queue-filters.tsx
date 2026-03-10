'use client';

/**
 * QueueFilters Component
 *
 * Filter controls for the post queue: platform, status, date range, search.
 */

import { Button } from '@/components/ui/button';
import { Search, X } from '@/components/icons';
import { platformOptions, statusOptions } from '@/components/schedule/schedule-config';

interface QueueFiltersProps {
  platform: string;
  status: string;
  startDate: string;
  endDate: string;
  searchQuery: string;
  onPlatformChange: (v: string) => void;
  onStatusChange: (v: string) => void;
  onStartDateChange: (v: string) => void;
  onEndDateChange: (v: string) => void;
  onSearchChange: (v: string) => void;
  onClearFilters: () => void;
}

// Extended status options to include failed + cancelled
const queueStatusOptions = [
  ...statusOptions,
  { value: 'failed', label: 'Failed' },
  { value: 'cancelled', label: 'Cancelled' },
];

export function QueueFilters({
  platform,
  status,
  startDate,
  endDate,
  searchQuery,
  onPlatformChange,
  onStatusChange,
  onStartDateChange,
  onEndDateChange,
  onSearchChange,
  onClearFilters,
}: QueueFiltersProps) {
  const hasActiveFilters =
    platform !== 'all' ||
    status !== 'all' ||
    startDate !== '' ||
    endDate !== '' ||
    searchQuery !== '';

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Platform dropdown */}
      <select
        value={platform}
        onChange={(e) => onPlatformChange(e.target.value)}
        className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white focus:outline-none focus:ring-1 focus:ring-cyan-500 appearance-none cursor-pointer"
      >
        {platformOptions.map((opt) => (
          <option key={opt.value} value={opt.value} className="bg-gray-900">
            {opt.label}
          </option>
        ))}
      </select>

      {/* Status dropdown */}
      <select
        value={status}
        onChange={(e) => onStatusChange(e.target.value)}
        className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white focus:outline-none focus:ring-1 focus:ring-cyan-500 appearance-none cursor-pointer"
      >
        {queueStatusOptions.map((opt) => (
          <option key={opt.value} value={opt.value} className="bg-gray-900">
            {opt.label}
          </option>
        ))}
      </select>

      {/* Date range */}
      <div className="flex items-center gap-1">
        <input
          type="date"
          value={startDate}
          onChange={(e) => onStartDateChange(e.target.value)}
          placeholder="From"
          className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
        />
        <span className="text-gray-500 text-xs">to</span>
        <input
          type="date"
          value={endDate}
          onChange={(e) => onEndDateChange(e.target.value)}
          placeholder="To"
          className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
        />
      </div>

      {/* Search */}
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search content..."
          className="w-full pl-9 pr-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
        />
      </div>

      {/* Clear filters */}
      {hasActiveFilters && (
        <Button
          size="sm"
          variant="ghost"
          className="text-gray-400 hover:text-white"
          onClick={onClearFilters}
        >
          <X className="mr-1 h-3.5 w-3.5" />
          Clear Filters
        </Button>
      )}
    </div>
  );
}
