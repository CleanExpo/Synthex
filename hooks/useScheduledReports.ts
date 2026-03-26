/**
 * Scheduled Reports Hook
 *
 * @description Hook for managing scheduled reports:
 * - List scheduled reports
 * - Create new schedules
 * - Update schedules
 * - Delete schedules
 *
 * Usage:
 * ```tsx
 * const { schedules, createSchedule, isLoading } = useScheduledReports();
 * ```
 */

'use client';

import useSWR from 'swr';
import { useCallback } from 'react';
import { toast } from 'sonner';

// ============================================================================
// TYPES
// ============================================================================

export type ReportFrequency =
  | 'daily'
  | 'weekly'
  | 'biweekly'
  | 'monthly'
  | 'quarterly';
export type ReportFormat = 'pdf' | 'csv' | 'json';
export type DateRangeType =
  | 'last_period'
  | 'custom'
  | 'rolling_7d'
  | 'rolling_30d'
  | 'rolling_90d';

export interface ReportSchedule {
  dayOfWeek?: number;
  dayOfMonth?: number;
  hour: number;
  minute: number;
  timezone: string;
}

export interface ScheduledReport {
  id: string;
  name: string;
  description?: string;
  templateId?: string;
  reportType: string;
  frequency: ReportFrequency;
  schedule: ReportSchedule;
  format: ReportFormat;
  dateRangeType: DateRangeType;
  filters?: Record<string, any>;
  metrics: string[];
  recipients: string[];
  webhookUrl?: string;
  isActive: boolean;
  lastRunAt?: Date;
  lastRunStatus?: string;
  nextRunAt?: Date;
  runCount: number;
  failureCount: number;
  createdAt: Date;
  updatedAt: Date;
  template?: {
    id: string;
    name: string;
    category: string;
  };
}

export interface CreateScheduleInput {
  name: string;
  description?: string;
  templateId?: string;
  reportType: string;
  frequency: ReportFrequency;
  schedule: ReportSchedule;
  format?: ReportFormat;
  dateRangeType?: DateRangeType;
  filters?: Record<string, any>;
  metrics: string[];
  recipients: string[];
  webhookUrl?: string;
}

export interface UpdateScheduleInput extends Partial<CreateScheduleInput> {
  isActive?: boolean;
}

export interface UseScheduledReportsOptions {
  autoLoad?: boolean;
  activeOnly?: boolean;
}

export interface UseScheduledReportsReturn {
  schedules: ScheduledReport[];
  isLoading: boolean;
  error: Error | null;
  createSchedule: (
    input: CreateScheduleInput
  ) => Promise<ScheduledReport | null>;
  updateSchedule: (
    id: string,
    input: UpdateScheduleInput
  ) => Promise<ScheduledReport | null>;
  deleteSchedule: (id: string) => Promise<boolean>;
  toggleActive: (id: string, isActive: boolean) => Promise<boolean>;
  refresh: () => Promise<void>;
}

// ============================================================================
// FETCHER
// ============================================================================

function mapSchedule(s: any): ScheduledReport {
  return {
    ...s,
    lastRunAt: s.lastRunAt ? new Date(s.lastRunAt) : undefined,
    nextRunAt: s.nextRunAt ? new Date(s.nextRunAt) : undefined,
    createdAt: new Date(s.createdAt),
    updatedAt: new Date(s.updatedAt),
  };
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) throw new Error('Failed to fetch scheduled reports');
  const data = await res.json();
  return (data.scheduledReports || []).map(mapSchedule) as T;
}

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

export function useScheduledReports(
  options: UseScheduledReportsOptions = {}
): UseScheduledReportsReturn {
  const { autoLoad = true, activeOnly = false } = options;

  const params = new URLSearchParams();
  if (activeOnly) params.set('activeOnly', 'true');

  const {
    data: schedules = [],
    error,
    isLoading,
    mutate,
  } = useSWR<ScheduledReport[]>(
    autoLoad ? `/api/reports/scheduled?${params}` : null,
    fetchJson,
    { revalidateOnFocus: false }
  );

  /**
   * Create a new scheduled report
   */
  const createSchedule = useCallback(
    async (input: CreateScheduleInput): Promise<ScheduledReport | null> => {
      try {
        const response = await fetch('/api/reports/scheduled', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(input),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to create schedule');
        }

        const data = await response.json();
        const newSchedule: ScheduledReport = {
          ...data.scheduledReport,
          nextRunAt: data.nextRunAt ? new Date(data.nextRunAt) : undefined,
          createdAt: new Date(data.scheduledReport.createdAt),
          updatedAt: new Date(data.scheduledReport.updatedAt),
        };

        await mutate();
        toast.success('Scheduled report created');

        return newSchedule;
      } catch (err) {
        toast.error((err as Error).message);
        return null;
      }
    },
    [mutate]
  );

  /**
   * Update a scheduled report
   */
  const updateSchedule = useCallback(
    async (
      id: string,
      input: UpdateScheduleInput
    ): Promise<ScheduledReport | null> => {
      try {
        const response = await fetch(`/api/reports/scheduled?id=${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(input),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to update schedule');
        }

        const data = await response.json();
        const updatedSchedule: ScheduledReport = {
          ...data.scheduledReport,
          nextRunAt: data.nextRunAt ? new Date(data.nextRunAt) : undefined,
          createdAt: new Date(data.scheduledReport.createdAt),
          updatedAt: new Date(data.scheduledReport.updatedAt),
        };

        await mutate();
        toast.success('Schedule updated');

        return updatedSchedule;
      } catch (err) {
        toast.error((err as Error).message);
        return null;
      }
    },
    [mutate]
  );

  /**
   * Delete a scheduled report
   */
  const deleteSchedule = useCallback(
    async (id: string): Promise<boolean> => {
      try {
        const response = await fetch(`/api/reports/scheduled?id=${id}`, {
          method: 'DELETE',
          credentials: 'include',
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to delete schedule');
        }

        await mutate();
        toast.success('Schedule deleted');

        return true;
      } catch (err) {
        toast.error((err as Error).message);
        return false;
      }
    },
    [mutate]
  );

  /**
   * Toggle schedule active state
   */
  const toggleActive = useCallback(
    async (id: string, isActive: boolean): Promise<boolean> => {
      const result = await updateSchedule(id, { isActive });
      return result !== null;
    },
    [updateSchedule]
  );

  const refresh = useCallback(async () => {
    await mutate();
  }, [mutate]);

  return {
    schedules,
    isLoading,
    error:
      error instanceof Error ? error : error ? new Error(String(error)) : null,
    createSchedule,
    updateSchedule,
    deleteSchedule,
    toggleActive,
    refresh,
  };
}

export default useScheduledReports;
