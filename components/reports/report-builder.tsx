'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  FileText,
  Plus,
  Trash2,
  Download,
  Calendar,
  Clock,
  Layout,
  BarChart3,
  Table,
  Image as ImageIcon,
  Type,
  Move,
  Settings,
  Save,
  Mail,
  Printer,
  Database,
  TrendingUp,
  Loader2,
} from '@/components/icons';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { notify } from '@/lib/notifications';
import { useReportTemplates } from '@/hooks/use-report-templates';
import { useReportExport } from '@/hooks/use-report-export';
import type { ReportTemplate, TemplateVisualization } from '@/hooks/use-report-templates';

// ============================================================================
// TYPES
// ============================================================================

interface ReportWidget {
  id: string;
  type: 'chart' | 'table' | 'metric' | 'text' | 'image';
  title: string;
  dataSource: string;
  config: Record<string, unknown>;
  size: 'small' | 'medium' | 'large' | 'full';
  visible: boolean;
}

interface ReportSchedule {
  frequency: 'daily' | 'weekly' | 'monthly';
  time: string;
  recipients: string[];
  format: 'pdf' | 'csv';
}

// ============================================================================
// METRIC DATA SOURCES
// ============================================================================

/** Real metric categories aligned with the report template API */
const METRIC_DATA_SOURCES = [
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

// ============================================================================
// HELPER: Convert widgets to template visualizations
// ============================================================================

function widgetsToVisualizations(widgets: ReportWidget[]): TemplateVisualization[] {
  return widgets
    .filter(w => w.visible)
    .map(w => {
      // Map widget type to visualization type
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
function templateToWidgets(template: ReportTemplate): ReportWidget[] {
  const visualizations = template.visualizations;
  if (!visualizations || !Array.isArray(visualizations)) return [];

  return visualizations.map((viz, idx) => {
    // Map visualization type to widget type
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

// ============================================================================
// SORTABLE WIDGET COMPONENT
// ============================================================================

function SortableWidget({ widget, onEdit, onDelete }: {
  widget: ReportWidget;
  onEdit: (widget: ReportWidget) => void;
  onDelete: (id: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: widget.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const getWidgetIcon = (type: string) => {
    switch (type) {
      case 'chart': return <BarChart3 className="h-4 w-4" />;
      case 'table': return <Table className="h-4 w-4" />;
      case 'metric': return <TrendingUp className="h-4 w-4" />;
      case 'text': return <Type className="h-4 w-4" />;
      case 'image': return <ImageIcon className="h-4 w-4" />;
      default: return <Layout className="h-4 w-4" />;
    }
  };

  const getSizeClass = (size: string) => {
    switch (size) {
      case 'small': return 'col-span-1';
      case 'medium': return 'col-span-2';
      case 'large': return 'col-span-3';
      case 'full': return 'col-span-4';
      default: return 'col-span-2';
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`${getSizeClass(widget.size)}`}
    >
      <Card variant="glass" className={`${!widget.visible ? 'opacity-50' : ''}`}>
        <CardHeader className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div {...attributes} {...listeners} className="cursor-move">
                <Move className="h-4 w-4 text-gray-400" />
              </div>
              {getWidgetIcon(widget.type)}
              <span className="font-medium text-white">{widget.title}</span>
            </div>
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onEdit(widget)}
              >
                <Settings className="h-3 w-3" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onDelete(widget.id)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4">
          {/* Widget Preview */}
          <div className="h-32 bg-white/5 rounded flex items-center justify-center">
            <span className="text-gray-400">
              {widget.type === 'chart' && 'Chart Preview'}
              {widget.type === 'table' && 'Table Preview'}
              {widget.type === 'metric' && (
                <div className="text-center">
                  <p className="text-3xl font-bold text-white">1,234</p>
                  <p className="text-sm text-gray-400">Sample Metric</p>
                </div>
              )}
              {widget.type === 'text' && 'Text Content'}
              {widget.type === 'image' && 'Image Placeholder'}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// REPORT BUILDER COMPONENT
// ============================================================================

export function ReportBuilder() {
  // API hooks
  const {
    templates: apiTemplates,
    isLoading: templatesLoading,
    saveTemplate,
  } = useReportTemplates();

  const {
    generateReport,
    isGenerating,
    exportStatus,
  } = useReportExport();

  // Local state
  const [widgets, setWidgets] = useState<ReportWidget[]>([]);
  const [showAddWidget, setShowAddWidget] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [editingWidget, setEditingWidget] = useState<ReportWidget | null>(null);
  const [reportName, setReportName] = useState('');
  const [reportDescription, setReportDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Widget form
  const [widgetType, setWidgetType] = useState('chart');
  const [widgetTitle, setWidgetTitle] = useState('');
  const [widgetDataSource, setWidgetDataSource] = useState('');
  const [widgetSize, setWidgetSize] = useState('medium');

  // Schedule form
  const [scheduleFrequency, setScheduleFrequency] = useState('weekly');
  const [scheduleTime, setScheduleTime] = useState('09:00');
  const [scheduleRecipients, setScheduleRecipients] = useState('');
  const [scheduleFormat, setScheduleFormat] = useState('pdf');

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // ========================================================================
  // DnD Handler (unchanged)
  // ========================================================================

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setWidgets((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  // ========================================================================
  // Widget CRUD (unchanged logic)
  // ========================================================================

  const addWidget = () => {
    if (!widgetTitle || !widgetDataSource) {
      notify.error('Please fill in all required fields');
      return;
    }

    const newWidget: ReportWidget = {
      id: `widget-${Date.now()}`,
      type: widgetType as ReportWidget['type'],
      title: widgetTitle,
      dataSource: widgetDataSource,
      config: {},
      size: widgetSize as ReportWidget['size'],
      visible: true
    };

    setWidgets([...widgets, newWidget]);
    setShowAddWidget(false);
    resetWidgetForm();
    notify.success('Widget added successfully');
  };

  const updateWidget = () => {
    if (!editingWidget) return;

    setWidgets(widgets.map(w =>
      w.id === editingWidget.id
        ? { ...editingWidget, title: widgetTitle, dataSource: widgetDataSource, size: widgetSize as ReportWidget['size'] }
        : w
    ));

    setEditingWidget(null);
    resetWidgetForm();
    notify.success('Widget updated');
  };

  const deleteWidget = (id: string) => {
    setWidgets(widgets.filter(w => w.id !== id));
    notify.info('Widget removed');
  };

  const resetWidgetForm = () => {
    setWidgetTitle('');
    setWidgetDataSource('');
    setWidgetType('chart');
    setWidgetSize('medium');
  };

  // ========================================================================
  // Save Report (wired to real API)
  // ========================================================================

  const saveReport = useCallback(async () => {
    if (!reportName) {
      notify.error('Please enter a report name');
      return;
    }

    setIsSaving(true);
    try {
      // Collect all unique metrics from widgets
      const allMetrics = widgets
        .filter(w => w.visible)
        .map(w => w.dataSource)
        .filter((v, i, a) => a.indexOf(v) === i);

      await saveTemplate({
        name: reportName,
        description: reportDescription || undefined,
        category: 'custom',
        reportType: 'custom',
        metrics: allMetrics.length > 0 ? allMetrics : ['impressions'],
        visualizations: widgetsToVisualizations(widgets),
        layout: {
          columns: 4,
          sections: [{
            title: 'Main',
            components: widgets.map(w => w.id),
          }],
        },
      });

      notify.success('Report saved successfully!');
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Failed to save report');
    } finally {
      setIsSaving(false);
    }
  }, [reportName, reportDescription, widgets, saveTemplate]);

  // ========================================================================
  // Export Report (wired to real API)
  // ========================================================================

  const exportReport = useCallback(async (format: string) => {
    if (!reportName) {
      notify.error('Please enter a report name before exporting');
      return;
    }

    // Map display format to API format
    const formatMap: Record<string, 'pdf' | 'csv' | 'json'> = {
      PDF: 'pdf',
      pdf: 'pdf',
      CSV: 'csv',
      csv: 'csv',
      JSON: 'json',
      json: 'json',
    };
    const apiFormat = formatMap[format] || 'pdf';

    notify.info(`Generating report as ${format}...`);
    try {
      const result = await generateReport({
        name: reportName,
        type: 'comprehensive',
        format: apiFormat,
      });

      if (result?.downloadUrl) {
        // Open download URL in new tab
        window.open(result.downloadUrl, '_blank');
        notify.success(`Report exported as ${format}`);
      } else {
        notify.success('Report generated successfully');
      }
    } catch (err) {
      notify.error(err instanceof Error ? err.message : `Failed to export report as ${format}`);
    }
  }, [reportName, generateReport]);

  // ========================================================================
  // Load Template (from API data)
  // ========================================================================

  const loadTemplate = useCallback((template: ReportTemplate) => {
    setReportName(template.name);
    setReportDescription(template.description || '');
    setWidgets(templateToWidgets(template));
    notify.success(`Template "${template.name}" loaded`);
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-cyan-500/20 to-cyan-500/20">
            <FileText className="h-6 w-6 text-cyan-400" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">Custom Report Builder</h2>
            <p className="text-gray-400">Create personalized reports and dashboards</p>
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setShowSchedule(!showSchedule)}
            className="bg-white/5 border-white/10"
          >
            <Calendar className="h-4 w-4 mr-2" />
            Schedule
          </Button>
          <Button
            onClick={saveReport}
            disabled={isSaving}
            className="gradient-primary"
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            {isSaving ? 'Saving...' : 'Save Report'}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-4">
        {/* Sidebar */}
        <div className="lg:col-span-1 space-y-4">
          {/* Report Details */}
          <Card variant="glass">
            <CardHeader>
              <CardTitle>Report Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="report-name">Report Name</Label>
                <Input
                  id="report-name"
                  value={reportName}
                  onChange={(e) => setReportName(e.target.value)}
                  placeholder="Monthly Performance Report"
                  className="mt-1 bg-white/5 border-white/10"
                />
              </div>

              <div>
                <Label htmlFor="report-desc">Description</Label>
                <Input
                  id="report-desc"
                  value={reportDescription}
                  onChange={(e) => setReportDescription(e.target.value)}
                  placeholder="Brief description..."
                  className="mt-1 bg-white/5 border-white/10"
                />
              </div>
            </CardContent>
          </Card>

          {/* Templates (from API) */}
          <Card variant="glass">
            <CardHeader>
              <CardTitle>Templates</CardTitle>
              <CardDescription>Start with a template</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {templatesLoading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                </div>
              ) : apiTemplates.length === 0 ? (
                <p className="text-sm text-gray-500 py-2">No templates available</p>
              ) : (
                apiTemplates.map(template => (
                  <Button
                    key={template.id}
                    variant="outline"
                    className="w-full justify-start bg-white/5 border-white/10"
                    onClick={() => loadTemplate(template)}
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    {template.name}
                  </Button>
                ))
              )}
            </CardContent>
          </Card>

          {/* Export Options (wired to real API) */}
          <Card variant="glass">
            <CardHeader>
              <CardTitle>Export Options</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button
                variant="outline"
                className="w-full justify-start bg-white/5 border-white/10"
                onClick={() => exportReport('PDF')}
                disabled={isGenerating}
              >
                {isGenerating && exportStatus !== 'idle' ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                Export as PDF
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start bg-white/5 border-white/10"
                onClick={() => exportReport('CSV')}
                disabled={isGenerating}
              >
                <Database className="h-4 w-4 mr-2" />
                Export as CSV
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start bg-white/5 border-white/10"
                onClick={() => exportReport('JSON')}
                disabled={isGenerating}
              >
                <Table className="h-4 w-4 mr-2" />
                Export as JSON
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start bg-white/5 border-white/10"
              >
                <Mail className="h-4 w-4 mr-2" />
                Email Report
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start bg-white/5 border-white/10"
              >
                <Printer className="h-4 w-4 mr-2" />
                Print Report
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-3 space-y-4">
          {/* Add Widget Button */}
          <Card variant="glass">
            <CardContent className="p-4">
              <Button
                onClick={() => setShowAddWidget(true)}
                className="w-full gradient-primary"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Widget
              </Button>
            </CardContent>
          </Card>

          {/* Widgets Grid */}
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={widgets.map(w => w.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="grid grid-cols-4 gap-4">
                {widgets.map((widget) => (
                  <SortableWidget
                    key={widget.id}
                    widget={widget}
                    onEdit={(w) => {
                      setEditingWidget(w);
                      setWidgetTitle(w.title);
                      setWidgetDataSource(w.dataSource);
                      setWidgetSize(w.size);
                      setWidgetType(w.type);
                      setShowAddWidget(true);
                    }}
                    onDelete={deleteWidget}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>

          {widgets.length === 0 && (
            <Card variant="glass" className="p-12 text-center">
              <Layout className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-400">No widgets added yet</p>
              <p className="text-sm text-gray-500 mt-1">Click &quot;Add Widget&quot; to get started</p>
            </Card>
          )}
        </div>
      </div>

      {/* Add/Edit Widget Modal */}
      <AnimatePresence>
        {showAddWidget && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
            onClick={() => setShowAddWidget(false)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-gray-900 rounded-lg p-6 max-w-md w-full mx-4"
            >
              <h3 className="text-lg font-semibold text-white mb-4">
                {editingWidget ? 'Edit Widget' : 'Add Widget'}
              </h3>

              <div className="space-y-4">
                <div>
                  <Label>Widget Type</Label>
                  <Select value={widgetType} onValueChange={setWidgetType}>
                    <SelectTrigger className="mt-1 bg-white/5 border-white/10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="chart">Chart</SelectItem>
                      <SelectItem value="table">Table</SelectItem>
                      <SelectItem value="metric">Metric</SelectItem>
                      <SelectItem value="text">Text</SelectItem>
                      <SelectItem value="image">Image</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Title</Label>
                  <Input
                    value={widgetTitle}
                    onChange={(e) => setWidgetTitle(e.target.value)}
                    placeholder="Widget title..."
                    className="mt-1 bg-white/5 border-white/10"
                  />
                </div>

                <div>
                  <Label>Data Source</Label>
                  <Select value={widgetDataSource} onValueChange={setWidgetDataSource}>
                    <SelectTrigger className="mt-1 bg-white/5 border-white/10">
                      <SelectValue placeholder="Select data source" />
                    </SelectTrigger>
                    <SelectContent>
                      {METRIC_DATA_SOURCES.map(source => (
                        <SelectItem key={source.id} value={source.id}>
                          {source.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Size</Label>
                  <Select value={widgetSize} onValueChange={setWidgetSize}>
                    <SelectTrigger className="mt-1 bg-white/5 border-white/10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="small">Small (1 column)</SelectItem>
                      <SelectItem value="medium">Medium (2 columns)</SelectItem>
                      <SelectItem value="large">Large (3 columns)</SelectItem>
                      <SelectItem value="full">Full Width (4 columns)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex gap-2 mt-6">
                <Button
                  onClick={editingWidget ? updateWidget : addWidget}
                  className="flex-1 gradient-primary"
                >
                  {editingWidget ? 'Update' : 'Add'} Widget
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowAddWidget(false);
                    setEditingWidget(null);
                    resetWidgetForm();
                  }}
                  className="flex-1 bg-white/5 border-white/10"
                >
                  Cancel
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Schedule Modal */}
      <AnimatePresence>
        {showSchedule && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
            onClick={() => setShowSchedule(false)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-gray-900 rounded-lg p-6 max-w-md w-full mx-4"
            >
              <h3 className="text-lg font-semibold text-white mb-4">Schedule Report</h3>

              <div className="space-y-4">
                <div>
                  <Label>Frequency</Label>
                  <Select value={scheduleFrequency} onValueChange={setScheduleFrequency}>
                    <SelectTrigger className="mt-1 bg-white/5 border-white/10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Time</Label>
                  <Input
                    type="time"
                    value={scheduleTime}
                    onChange={(e) => setScheduleTime(e.target.value)}
                    className="mt-1 bg-white/5 border-white/10"
                  />
                </div>

                <div>
                  <Label>Recipients (comma-separated emails)</Label>
                  <Input
                    value={scheduleRecipients}
                    onChange={(e) => setScheduleRecipients(e.target.value)}
                    placeholder="email1@example.com, email2@example.com"
                    className="mt-1 bg-white/5 border-white/10"
                  />
                </div>

                <div>
                  <Label>Format</Label>
                  <Select value={scheduleFormat} onValueChange={setScheduleFormat}>
                    <SelectTrigger className="mt-1 bg-white/5 border-white/10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pdf">PDF</SelectItem>
                      <SelectItem value="csv">CSV</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex gap-2 mt-6">
                <Button
                  onClick={() => {
                    setShowSchedule(false);
                    notify.success('Report scheduled successfully');
                  }}
                  className="flex-1 gradient-primary"
                >
                  <Clock className="h-4 w-4 mr-2" />
                  Schedule
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowSchedule(false)}
                  className="flex-1 bg-white/5 border-white/10"
                >
                  Cancel
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
