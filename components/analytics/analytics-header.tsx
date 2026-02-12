'use client';

/**
 * Analytics Header Component
 * Header with time range selector and action buttons
 */

import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Filter, Download } from '@/components/icons';
import { timeRangeOptions } from './analytics-config';

interface AnalyticsHeaderProps {
  timeRange: string;
  onTimeRangeChange: (value: string) => void;
  onFilter: () => void;
  onExport: () => void;
}

export function AnalyticsHeader({
  timeRange,
  onTimeRangeChange,
  onFilter,
  onExport,
}: AnalyticsHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-3xl font-bold gradient-text">Analytics Dashboard</h1>
        <p className="text-slate-400 mt-1">
          Track your social media performance and insights
        </p>
      </div>
      <div className="flex space-x-3 mt-4 sm:mt-0">
        <Select value={timeRange} onValueChange={onTimeRangeChange}>
          <SelectTrigger className="w-[140px] bg-white/5 border-white/10">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {timeRangeOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          onClick={onFilter}
          variant="outline"
          className="bg-white/5 border-white/10 text-white hover:bg-white/10"
        >
          <Filter className="mr-2 h-4 w-4" />
          Filter
        </Button>
        <Button onClick={onExport} className="gradient-primary text-white">
          <Download className="mr-2 h-4 w-4" />
          Export
        </Button>
      </div>
    </div>
  );
}
