/**
 * Report Templates Hook
 *
 * @description Hook for managing report templates:
 * - List system and custom templates
 * - Create custom templates
 * - Update templates
 * - Delete templates
 *
 * Usage:
 * ```tsx
 * const { templates, createTemplate, isLoading } = useReportTemplates();
 * ```
 */

'use client';

import useSWR from 'swr';
import { useCallback } from 'react';
import { toast } from 'sonner';

// ============================================================================
// TYPES
// ============================================================================

export type TemplateCategory =
  | 'performance'
  | 'engagement'
  | 'growth'
  | 'content'
  | 'custom';
export type ReportType =
  | 'overview'
  | 'engagement'
  | 'content'
  | 'audience'
  | 'campaigns'
  | 'growth'
  | 'custom';
export type VisualizationType =
  | 'line'
  | 'bar'
  | 'pie'
  | 'area'
  | 'table'
  | 'metric'
  | 'heatmap';

export interface Visualization {
  type: VisualizationType;
  title: string;
  metrics: string[];
  dimensions?: string[];
}

export interface ReportTemplate {
  id: string;
  name: string;
  description?: string;
  category: TemplateCategory;
  reportType: ReportType;
  metrics: string[];
  dimensions: string[];
  filters?: Record<string, any>;
  visualizations?: Visualization[];
  layout?: {
    columns?: number;
    sections?: { title: string; components: string[] }[];
  };
  branding?: {
    logoUrl?: string;
    primaryColor?: string;
    accentColor?: string;
    fontFamily?: string;
  };
  isSystem: boolean;
  isPublic: boolean;
  usageCount: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CreateTemplateInput {
  name: string;
  description?: string;
  category: TemplateCategory;
  reportType: ReportType;
  metrics: string[];
  dimensions?: string[];
  filters?: Record<string, any>;
  visualizations?: Visualization[];
  layout?: ReportTemplate['layout'];
  branding?: ReportTemplate['branding'];
  isPublic?: boolean;
}

export interface UpdateTemplateInput extends Partial<CreateTemplateInput> {}

export interface UseReportTemplatesOptions {
  autoLoad?: boolean;
  category?: TemplateCategory;
  includeSystem?: boolean;
}

export interface UseReportTemplatesReturn {
  templates: ReportTemplate[];
  isLoading: boolean;
  error: Error | null;
  createTemplate: (
    input: CreateTemplateInput
  ) => Promise<ReportTemplate | null>;
  updateTemplate: (
    id: string,
    input: UpdateTemplateInput
  ) => Promise<ReportTemplate | null>;
  deleteTemplate: (id: string) => Promise<boolean>;
  getTemplate: (id: string) => ReportTemplate | undefined;
  refresh: () => Promise<void>;
}

// ============================================================================
// FETCHER
// ============================================================================

function mapTemplate(t: any): ReportTemplate {
  return {
    ...t,
    createdAt: t.createdAt ? new Date(t.createdAt) : undefined,
    updatedAt: t.updatedAt ? new Date(t.updatedAt) : undefined,
  };
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) throw new Error('Failed to fetch templates');
  const data = await res.json();
  return (data.templates || []).map(mapTemplate) as T;
}

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

export function useReportTemplates(
  options: UseReportTemplatesOptions = {}
): UseReportTemplatesReturn {
  const { autoLoad = true, category, includeSystem = true } = options;

  const params = new URLSearchParams();
  if (category) params.set('category', category);
  params.set('includeSystem', String(includeSystem));

  const {
    data: templates = [],
    error,
    isLoading,
    mutate,
  } = useSWR<ReportTemplate[]>(
    autoLoad ? `/api/reports/templates?${params}` : null,
    fetchJson,
    { revalidateOnFocus: false }
  );

  /**
   * Create a new template
   */
  const createTemplate = useCallback(
    async (input: CreateTemplateInput): Promise<ReportTemplate | null> => {
      try {
        const response = await fetch('/api/reports/templates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(input),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to create template');
        }

        const data = await response.json();
        const newTemplate = mapTemplate(data.template);

        await mutate();
        toast.success('Template created');

        return newTemplate;
      } catch (err) {
        toast.error((err as Error).message);
        return null;
      }
    },
    [mutate]
  );

  /**
   * Update a template
   */
  const updateTemplate = useCallback(
    async (
      id: string,
      input: UpdateTemplateInput
    ): Promise<ReportTemplate | null> => {
      // Can't update system templates
      if (id.startsWith('system-')) {
        toast.error('System templates cannot be modified');
        return null;
      }

      try {
        const response = await fetch(`/api/reports/templates?id=${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(input),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to update template');
        }

        const data = await response.json();
        const updatedTemplate = mapTemplate(data.template);

        await mutate();
        toast.success('Template updated');

        return updatedTemplate;
      } catch (err) {
        toast.error((err as Error).message);
        return null;
      }
    },
    [mutate]
  );

  /**
   * Delete a template
   */
  const deleteTemplate = useCallback(
    async (id: string): Promise<boolean> => {
      // Can't delete system templates
      if (id.startsWith('system-')) {
        toast.error('System templates cannot be deleted');
        return false;
      }

      try {
        const response = await fetch(`/api/reports/templates?id=${id}`, {
          method: 'DELETE',
          credentials: 'include',
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to delete template');
        }

        await mutate();
        toast.success('Template deleted');

        return true;
      } catch (err) {
        toast.error((err as Error).message);
        return false;
      }
    },
    [mutate]
  );

  /**
   * Get a template by ID
   */
  const getTemplate = useCallback(
    (id: string): ReportTemplate | undefined => {
      return templates.find(t => t.id === id);
    },
    [templates]
  );

  const refresh = useCallback(async () => {
    await mutate();
  }, [mutate]);

  return {
    templates,
    isLoading,
    error:
      error instanceof Error ? error : error ? new Error(String(error)) : null,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    getTemplate,
    refresh,
  };
}

export default useReportTemplates;
