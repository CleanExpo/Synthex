'use client';

/**
 * Analytics Header Component
 * Header with time range selector, platform filter, and action buttons
 */

import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DatePickerWithRange } from '@/components/ui/date-range-picker';
import { Download } from '@/components/icons';
import { timeRangeOptions, platformFilterOptions } from './analytics-config';
import type { DateRange } from 'react-day-picker';

interface AnalyticsHeaderProps {
  timeRange: string;
  onTimeRangeChange: (value: string) => void;
  onExport: () => void;
  /** @deprecated Use platform/onPlatformChange instead */
  onFilter?: () => void;
  platform?: string;
  onPlatformChange?: (value: string) => void;
  dateRange?: DateRange;
  onDateRangeChange?: (range: DateRange | undefined) => void;
}

export function AnalyticsHeader({
  timeRange,
  onTimeRangeChange,
  onExport,
  platform = 'all',
  onPlatformChange,
  dateRange,
  onDateRangeChange,
}: AnalyticsHeaderProps) {
  const isCustomRange = timeRange === 'custom';

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold gradient-text">Analytics Dashboard</h1>
          <p className="text-slate-400 mt-1">
            Track your social media performance and insights
          </p>
        </div>
        <div className="flex flex-wrap gap-3 mt-4 sm:mt-0">
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

          <Select value={platform} onValueChange={onPlatformChange}>
            <SelectTrigger className="w-[150px] bg-white/5 border-white/10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {platformFilterOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button onClick={onExport} className="gradient-primary text-white">
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      {isCustomRange && (
        <div className="flex justify-end">
          <div className="w-full sm:w-[320px]">
            <DatePickerWithRange
              date={dateRange}
              onDateChange={onDateRangeChange}
            />
          </div>
        </div>
      )}
    </div>
  );
}
