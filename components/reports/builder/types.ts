import type { ReportTemplate, TemplateVisualization } from '@/hooks/use-report-templates';

export interface ReportWidget {
  id: string;
  type: 'chart' | 'table' | 'metric' | 'text' | 'image';
  title: string;
  dataSource: string;
  config: Record<string, unknown>;
  size: 'small' | 'medium' | 'large' | 'full';
  visible: boolean;
}

export interface ReportSchedule {
  frequency: 'daily' | 'weekly' | 'monthly';
  time: string;
  recipients: string[];
  format: 'pdf' | 'csv';
}

/** Real metric categories aligned with the report template API */
export const METRIC_DATA_SOURCES = [
  {
    id: 'performance',
    name: 'Performance Metrics',
    metrics: ['impressions', 'reach', 'engagement_rate'],
  },
  {
    id: 'engagement',
    name: 'Engagement Metrics',
    metrics: ['likes', 'comments', 'shares', 'saves'],
  },
  {
    id: 'growth',
    name: 'Growth Metrics',
    metrics: ['followers'],
  },
  {
    id: 'content',
    name: 'Content Metrics',
    metrics: ['clicks', 'conversions'],
  },
  {
    id: 'financial',
    name: 'Financial Metrics',
    metrics: ['revenue', 'cost', 'roi', 'cpc', 'cpm'],
  },
];

/** Convert widgets to template visualizations */
export function widgetsToVisualizations(widgets: ReportWidget[]): TemplateVisualization[] {
  return widgets
    .filter(w => w.visible)
    .map(w => {
      const typeMap: Record<string, TemplateVisualization['type']> = {
        chart: 'bar',
        table: 'table',
        metric: 'metric',
        text: 'table',
        image: 'bar',
      };

      return {
        type: typeMap[w.type] || 'bar',
        title: w.title,
        metrics: [w.dataSource],
        dimensions: [],
      };
    });
}

/** Map API template to local widget list */
export function templateToWidgets(template: ReportTemplate): ReportWidget[] {
  const visualizations = template.visualizations;
  if (!visualizations || !Array.isArray(visualizations)) return [];

  return visualizations.map((viz, idx) => {
    const typeMap: Record<string, ReportWidget['type']> = {
      line: 'chart',
      bar: 'chart',
      pie: 'chart',
      area: 'chart',
      table: 'table',
      metric: 'metric',
      heatmap: 'chart',
    };

    return {
      id: `widget-tmpl-${idx}-${Date.now()}`,
      type: typeMap[viz.type] || 'chart',
      title: viz.title,
      dataSource: viz.metrics[0] || 'impressions',
      config: {},
      size: 'medium' as const,
      visible: true,
    };
  });
}
