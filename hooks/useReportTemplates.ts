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

import { useState, useCallback, useEffect } from 'react';
import { toast } from 'sonner';

// ============================================================================
// TYPES
// ============================================================================

export type TemplateCategory = 'performance' | 'engagement' | 'growth' | 'content' | 'custom';
export type ReportType = 'overview' | 'engagement' | 'content' | 'audience' | 'campaigns' | 'growth' | 'custom';
export type VisualizationType = 'line' | 'bar' | 'pie' | 'area' | 'table' | 'metric' | 'heatmap';

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
  createTemplate: (input: CreateTemplateInput) => Promise<ReportTemplate | null>;
  updateTemplate: (id: string, input: UpdateTemplateInput) => Promise<ReportTemplate | null>;
  deleteTemplate: (id: string) => Promise<boolean>;
  getTemplate: (id: string) => ReportTemplate | undefined;
  refresh: () => Promise<void>;
}

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

export function useReportTemplates(
  options: UseReportTemplatesOptions = {}
): UseReportTemplatesReturn {
  const { autoLoad = true, category, includeSystem = true } = options;

  const [templates, setTemplates] = useState<ReportTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  /**
   * Fetch templates
   */
  const fetchTemplates = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (category) params.set('category', category);
      params.set('includeSystem', String(includeSystem));

      const response = await fetch(`/api/reports/templates?${params}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch templates');
      }

      const data = await response.json();
      setTemplates(
        (data.templates || []).map((t: any) => ({
          ...t,
          createdAt: t.createdAt ? new Date(t.createdAt) : undefined,
          updatedAt: t.updatedAt ? new Date(t.updatedAt) : undefined,
        }))
      );
    } catch (err) {
      setError(err as Error);
      console.error('Fetch templates error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [category, includeSystem]);

  /**
   * Create a new template
   */
  const createTemplate = useCallback(
    async (input: CreateTemplateInput): Promise<ReportTemplate | null> => {
      setIsLoading(true);
      setError(null);

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
        const newTemplate: ReportTemplate = {
          ...data.template,
          createdAt: new Date(data.template.createdAt),
          updatedAt: new Date(data.template.updatedAt),
        };

        setTemplates((prev) => [newTemplate, ...prev]);
        toast.success('Template created');

        return newTemplate;
      } catch (err) {
        setError(err as Error);
        toast.error((err as Error).message);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  /**
   * Update a template
   */
  const updateTemplate = useCallback(
    async (id: string, input: UpdateTemplateInput): Promise<ReportTemplate | null> => {
      // Can't update system templates
      if (id.startsWith('system-')) {
        toast.error('System templates cannot be modified');
        return null;
      }

      setIsLoading(true);
      setError(null);

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
        const updatedTemplate: ReportTemplate = {
          ...data.template,
          createdAt: new Date(data.template.createdAt),
          updatedAt: new Date(data.template.updatedAt),
        };

        setTemplates((prev) =>
          prev.map((t) => (t.id === id ? updatedTemplate : t))
        );
        toast.success('Template updated');

        return updatedTemplate;
      } catch (err) {
        setError(err as Error);
        toast.error((err as Error).message);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  /**
   * Delete a template
   */
  const deleteTemplate = useCallback(async (id: string): Promise<boolean> => {
    // Can't delete system templates
    if (id.startsWith('system-')) {
      toast.error('System templates cannot be deleted');
      return false;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/reports/templates?id=${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete template');
      }

      setTemplates((prev) => prev.filter((t) => t.id !== id));
      toast.success('Template deleted');

      return true;
    } catch (err) {
      setError(err as Error);
      toast.error((err as Error).message);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Get a template by ID
   */
  const getTemplate = useCallback(
    (id: string): ReportTemplate | undefined => {
      return templates.find((t) => t.id === id);
    },
    [templates]
  );

  /**
   * Auto-load on mount
   */
  useEffect(() => {
    if (autoLoad) {
      fetchTemplates();
    }
  }, [autoLoad, fetchTemplates]);

  return {
    templates,
    isLoading,
    error,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    getTemplate,
    refresh: fetchTemplates,
  };
}

export default useReportTemplates;
