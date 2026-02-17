/**
 * Report Export Hook
 *
 * @description Generate and export reports via the reporting API:
 * - Generate report via POST /api/reporting/generate
 * - Poll status via GET /api/reporting/reports/[reportId] every 2s
 * - Returns download URL on completion
 *
 * Uses raw fetch + useState pattern (no SWR/TanStack Query).
 */

'use client';

import { useState, useCallback, useRef } from 'react';

// ============================================================================
// TYPES
// ============================================================================

/** Parameters for generating a report */
export interface GenerateReportParams {
  name: string;
  type: 'campaign' | 'analytics' | 'ab-test' | 'psychology' | 'comprehensive';
  format: 'pdf' | 'csv' | 'json';
  dateRange?: {
    start: string;
    end: string;
  };
  filters?: {
    campaignIds?: string[];
    platforms?: string[];
    metrics?: string[];
  };
}

/** Status of a report generation */
export type ExportStatus =
  | 'idle'
  | 'generating'
  | 'polling'
  | 'completed'
  | 'failed';

/** API response for POST /api/reporting/generate */
interface GenerateResponse {
  success: boolean;
  data: {
    reportId: string;
    status: string;
    message: string;
  };
}

/** API response for GET /api/reporting/reports/[reportId] */
interface ReportStatusResponse {
  success: boolean;
  data: {
    id: string;
    name: string;
    type: string;
    status: 'pending' | 'generating' | 'completed' | 'failed';
    format: string;
    data: unknown | null;
    generatedAt: string | null;
    createdAt: string;
    downloadUrl: string | null;
  };
}

/** Result returned on successful generation */
export interface ExportResult {
  reportId: string;
  downloadUrl: string | null;
  status: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const POLL_INTERVAL_MS = 2000;
const MAX_POLL_ATTEMPTS = 30;

// ============================================================================
// HOOK
// ============================================================================

export function useReportExport() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [exportStatus, setExportStatus] = useState<ExportStatus>('idle');
  const [error, setError] = useState<Error | null>(null);
  const abortRef = useRef(false);

  /**
   * Poll for report status until completed or failed
   */
  const pollReportStatus = useCallback(async (reportId: string): Promise<ExportResult> => {
    let attempts = 0;

    while (attempts < MAX_POLL_ATTEMPTS && !abortRef.current) {
      attempts++;

      const response = await fetch(`/api/reporting/reports/${encodeURIComponent(reportId)}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data: ReportStatusResponse = await response.json();
      const { status, downloadUrl } = data.data;

      if (status === 'completed') {
        return {
          reportId,
          downloadUrl,
          status: 'completed',
        };
      }

      if (status === 'failed') {
        throw new Error('Report generation failed');
      }

      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
    }

    if (abortRef.current) {
      throw new Error('Report generation was cancelled');
    }

    throw new Error('Report generation timed out after maximum polling attempts');
  }, []);

  /**
   * Generate a report and poll until completion
   */
  const generateReport = useCallback(async (params: GenerateReportParams): Promise<ExportResult | null> => {
    abortRef.current = false;
    setIsGenerating(true);
    setExportStatus('generating');
    setError(null);

    try {
      // Step 1: Start generation
      const response = await fetch('/api/reporting/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data: GenerateResponse = await response.json();
      const { reportId } = data.data;

      // Step 2: Poll for completion
      setExportStatus('polling');
      const result = await pollReportStatus(reportId);

      setExportStatus('completed');
      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      setExportStatus('failed');
      throw error;
    } finally {
      setIsGenerating(false);
    }
  }, [pollReportStatus]);

  /**
   * Cancel an in-progress generation
   */
  const cancelGeneration = useCallback(() => {
    abortRef.current = true;
  }, []);

  /**
   * Reset to idle state
   */
  const reset = useCallback(() => {
    abortRef.current = false;
    setIsGenerating(false);
    setExportStatus('idle');
    setError(null);
  }, []);

  return {
    generateReport,
    isGenerating,
    exportStatus,
    error,
    cancelGeneration,
    reset,
  };
}
