'use client';

/**
 * Analytics Header
 * Page title + time-range / platform filters + export action.
 * Matches Synthex design system: sharp corners, white/N opacity tokens,
 * orange accent, light-weight headings, 9px uppercased eyebrows.
 */

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { DatePickerWithRange } from '@/components/ui/date-range-picker';
import { Download, ChevronDown, Loader2 } from '@/components/icons';
import { timeRangeOptions, platformFilterOptions } from './analytics-config';
import type { DateRange } from 'react-day-picker';

export type ExportFormat = 'csv' | 'json' | 'pdf';

interface AnalyticsHeaderProps {
  timeRange: string;
  onTimeRangeChange: (value: string) => void;
  onExport: (format: ExportFormat) => void;
  /** @deprecated use platform/onPlatformChange */
  onFilter?: () => void;
  platform?: string;
  onPlatformChange?: (value: string) => void;
  dateRange?: DateRange;
  onDateRangeChange?: (range: DateRange | undefined) => void;
  isExporting?: boolean;
}

export function AnalyticsHeader({
  timeRange,
  onTimeRangeChange,
  onExport,
  platform = 'all',
  onPlatformChange,
  dateRange,
  onDateRangeChange,
  isExporting = false,
}: AnalyticsHeaderProps) {
  const isCustomRange = timeRange === 'custom';

  return (
    <div className="flex flex-col gap-5 flex-1 min-w-0">
      {/* Page title */}
      <div>
        <p className="text-[9px] uppercase tracking-[0.25em] text-white/30 mb-1">
          Performance
        </p>
        <h1 className="text-3xl font-light text-white leading-none">
          Analytics
        </h1>
        <p className="text-sm text-white/40 mt-1.5">
          Track reach, engagement, and growth across all connected platforms.
        </p>
      </div>

      {/* Controls row */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Time range */}
        <Select value={timeRange} onValueChange={onTimeRangeChange}>
          <SelectTrigger className="h-8 w-32.5 text-xs bg-white/3 border-[0.5px] border-white/8 text-white/70 rounded-sm focus:ring-0 focus:border-white/20">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {timeRangeOptions.map(opt => (
              <SelectItem key={opt.value} value={opt.value} className="text-xs">
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Platform filter */}
        <Select value={platform} onValueChange={onPlatformChange}>
          <SelectTrigger className="h-8 w-35 text-xs bg-white/3 border-[0.5px] border-white/8 text-white/70 rounded-sm focus:ring-0 focus:border-white/20">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {platformFilterOptions.map(opt => (
              <SelectItem key={opt.value} value={opt.value} className="text-xs">
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Export */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              disabled={isExporting}
              className="flex items-center gap-1.5 h-8 px-3 text-xs border-[0.5px] border-white/8 bg-white/3 hover:bg-white/6 text-white/60 hover:text-white/80 rounded-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isExporting ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Download className="h-3 w-3" />
              )}
              {isExporting ? 'Exporting…' : 'Export'}
              <ChevronDown className="h-3 w-3 opacity-50" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="text-xs">
            <DropdownMenuItem onClick={() => onExport('csv')}>
              CSV — spreadsheet
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onExport('json')}>
              JSON — raw data
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onExport('pdf')}>
              PDF — formatted report
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Custom date picker */}
        {isCustomRange && onDateRangeChange && (
          <DatePickerWithRange date={dateRange} onDateChange={onDateRangeChange} />
        )}
      </div>
    </div>
  );
}
