/**
 * Report Templates Hook
 *
 * @description CRUD operations for report templates:
 * - Fetch templates (system + user) from GET /api/reports/templates
 * - Save new template via POST /api/reports/templates
 * - Update template via PATCH /api/reports/templates?id=X
 * - Delete template via DELETE /api/reports/templates?id=X
 *
 * Uses SWR for GET data fetching; mutations use direct fetch + mutate().
 */

'use client';

import { useCallback } from 'react';
import useSWR from 'swr';

// ============================================================================
// TYPES
// ============================================================================

/** Visualisation configuration within a report template */
export interface TemplateVisualization {
  type: 'line' | 'bar' | 'pie' | 'area' | 'table' | 'metric' | 'heatmap';
  title: string;
  metrics: string[];
  dimensions?: string[];
}

/** Layout configuration for a report template */
export interface TemplateLayout {
  columns?: number;
  sections?: Array<{
    title: string;
    components: string[];
  }>;
}

/** Branding configuration for a report template */
export interface TemplateBranding {
  logoUrl?: string;
  primaryColor?: string;
  accentColor?: string;
  fontFamily?: string;
}

/** A report template as returned by the API */
export interface ReportTemplate {
  id: string;
  userId?: string | null;
  organizationId?: string | null;
  name: string;
  description?: string | null;
  category: string;
  reportType: string;
  metrics: string[];
  dimensions?: string[] | null;
  filters?: Record<string, unknown> | null;
  visualizations?: TemplateVisualization[] | null;
  layout?: TemplateLayout | null;
  branding?: TemplateBranding | null;
  isPublic?: boolean;
  isSystem?: boolean;
  usageCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

/** Parameters for creating a new template */
export interface SaveTemplateParams {
  name: string;
  description?: string;
  category: 'performance' | 'engagement' | 'growth' | 'content' | 'custom';
  reportType:
    | 'overview'
    | 'engagement'
    | 'content'
    | 'audience'
    | 'campaigns'
    | 'growth'
    | 'custom';
  metrics: string[];
  dimensions?: string[];
  visualizations?: TemplateVisualization[];
  layout?: TemplateLayout;
  branding?: TemplateBranding;
  isPublic?: boolean;
}

/** Parameters for updating an existing template */
export type UpdateTemplateParams = Partial<SaveTemplateParams>;

/** API response shape for GET /api/reports/templates */
interface TemplatesResponse {
  templates: ReportTemplate[];
  total: number;
  hasMore: boolean;
}

/** API response shape for POST /api/reports/templates */
interface CreateTemplateResponse {
  template: ReportTemplate;
  created: boolean;
}

/** API response shape for PATCH /api/reports/templates */
interface UpdateTemplateResponse {
  template: ReportTemplate;
  updated: boolean;
}

/** API response shape for DELETE /api/reports/templates */
interface DeleteTemplateResponse {
  success: boolean;
  message: string;
}

// ============================================================================
// FETCHER
// ============================================================================

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

// ============================================================================
// HOOK
// ============================================================================

export function useReportTemplates(options?: { category?: string }) {
  const category = options?.category;

  const params = new URLSearchParams();
  if (category) params.set('category', category);
  const url = `/api/reports/templates${params.toString() ? `?${params.toString()}` : ''}`;

  const {
    data: response,
    error,
    isLoading,
    mutate,
  } = useSWR<TemplatesResponse>(url, fetchJson, { revalidateOnFocus: false });

  const templates = response?.templates ?? [];

  /**
   * Save a new template
   */
  const saveTemplate = useCallback(
    async (
      templateParams: SaveTemplateParams
    ): Promise<ReportTemplate | null> => {
      const res = await fetch('/api/reports/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(templateParams),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(
          errorData.error || `HTTP ${res.status}: ${res.statusText}`
        );
      }

      const data: CreateTemplateResponse = await res.json();
      await mutate();
      return data.template;
    },
    [mutate]
  );

  /**
   * Update an existing template
   */
  const updateTemplate = useCallback(
    async (
      id: string,
      templateParams: UpdateTemplateParams
    ): Promise<ReportTemplate | null> => {
      const res = await fetch(
        `/api/reports/templates?id=${encodeURIComponent(id)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(templateParams),
        }
      );

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(
          errorData.error || `HTTP ${res.status}: ${res.statusText}`
        );
      }

      const data: UpdateTemplateResponse = await res.json();
      await mutate();
      return data.template;
    },
    [mutate]
  );

  /**
   * Delete a template
   */
  const deleteTemplate = useCallback(
    async (id: string): Promise<boolean> => {
      const res = await fetch(
        `/api/reports/templates?id=${encodeURIComponent(id)}`,
        {
          method: 'DELETE',
          credentials: 'include',
        }
      );

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(
          errorData.error || `HTTP ${res.status}: ${res.statusText}`
        );
      }

      const data: DeleteTemplateResponse = await res.json();
      await mutate();
      return data.success;
    },
    [mutate]
  );

  /**
   * Refetch templates manually
   */
  const refetch = useCallback(() => {
    return mutate();
  }, [mutate]);

  return {
    templates,
    isLoading,
    error:
      error instanceof Error ? error : error ? new Error(String(error)) : null,
    saveTemplate,
    updateTemplate,
    deleteTemplate,
    refetch,
  };
}
