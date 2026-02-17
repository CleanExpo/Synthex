/**
 * Report Templates Hook
 *
 * @description CRUD operations for report templates:
 * - Fetch templates (system + user) from GET /api/reports/templates
 * - Save new template via POST /api/reports/templates
 * - Update template via PATCH /api/reports/templates?id=X
 * - Delete template via DELETE /api/reports/templates?id=X
 *
 * Uses raw fetch + useState pattern (no SWR/TanStack Query).
 */

'use client';

import { useState, useCallback, useEffect, useRef } from 'react';

// ============================================================================
// TYPES
// ============================================================================

/** Visualization configuration within a report template */
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
  reportType: 'overview' | 'engagement' | 'content' | 'audience' | 'campaigns' | 'growth' | 'custom';
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
// HOOK
// ============================================================================

export function useReportTemplates(options?: { category?: string }) {
  const [templates, setTemplates] = useState<ReportTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const mountedRef = useRef(true);

  const category = options?.category;

  /**
   * Fetch templates from API
   */
  const fetchTemplates = useCallback(async () => {
    if (!mountedRef.current) return;
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (category) params.set('category', category);

      const url = `/api/reports/templates${params.toString() ? `?${params.toString()}` : ''}`;
      const response = await fetch(url, {
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data: TemplatesResponse = await response.json();

      if (mountedRef.current) {
        setTemplates(data.templates);
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err : new Error(String(err)));
      }
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [category]);

  /**
   * Save a new template
   */
  const saveTemplate = useCallback(async (params: SaveTemplateParams): Promise<ReportTemplate | null> => {
    try {
      const response = await fetch('/api/reports/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data: CreateTemplateResponse = await response.json();

      // Refetch templates to include the new one
      if (mountedRef.current) {
        await fetchTemplates();
      }

      return data.template;
    } catch (err) {
      throw err instanceof Error ? err : new Error(String(err));
    }
  }, [fetchTemplates]);

  /**
   * Update an existing template
   */
  const updateTemplate = useCallback(async (id: string, params: UpdateTemplateParams): Promise<ReportTemplate | null> => {
    try {
      const response = await fetch(`/api/reports/templates?id=${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data: UpdateTemplateResponse = await response.json();

      // Refetch templates to reflect the update
      if (mountedRef.current) {
        await fetchTemplates();
      }

      return data.template;
    } catch (err) {
      throw err instanceof Error ? err : new Error(String(err));
    }
  }, [fetchTemplates]);

  /**
   * Delete a template
   */
  const deleteTemplate = useCallback(async (id: string): Promise<boolean> => {
    try {
      const response = await fetch(`/api/reports/templates?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data: DeleteTemplateResponse = await response.json();

      // Refetch templates to reflect the deletion
      if (mountedRef.current) {
        await fetchTemplates();
      }

      return data.success;
    } catch (err) {
      throw err instanceof Error ? err : new Error(String(err));
    }
  }, [fetchTemplates]);

  /**
   * Refetch templates manually
   */
  const refetch = useCallback(() => {
    return fetchTemplates();
  }, [fetchTemplates]);

  // Initial fetch
  useEffect(() => {
    mountedRef.current = true;
    fetchTemplates();

    return () => {
      mountedRef.current = false;
    };
  }, [fetchTemplates]);

  return {
    templates,
    isLoading,
    error,
    saveTemplate,
    updateTemplate,
    deleteTemplate,
    refetch,
  };
}
