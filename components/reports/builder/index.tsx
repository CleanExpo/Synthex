'use client';

import { useState, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  FileText, Plus, Calendar, Save, Layout, Loader2,
} from '@/components/icons';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { notify } from '@/lib/notifications';
import { useReportTemplates } from '@/hooks/use-report-templates';
import { useReportExport } from '@/hooks/use-report-export';
import type { ReportTemplate } from '@/hooks/use-report-templates';
import type { ReportWidget } from './types';
import { widgetsToVisualizations, templateToWidgets } from './types';
import { SortableWidget } from './SortableWidget';
import { BuilderSidebar } from './BuilderSidebar';
import { WidgetModal } from './WidgetModal';
import { ScheduleModal } from './ScheduleModal';

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

  // DnD Handler
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

  // Widget CRUD
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

  // Save Report (wired to real API)
  const saveReport = useCallback(async () => {
    if (!reportName) {
      notify.error('Please enter a report name');
      return;
    }

    setIsSaving(true);
    try {
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

  // Export Report (wired to real API)
  const exportReport = useCallback(async (format: string) => {
    if (!reportName) {
      notify.error('Please enter a report name before exporting');
      return;
    }

    const formatMap: Record<string, 'pdf' | 'csv' | 'json'> = {
      PDF: 'pdf', pdf: 'pdf', CSV: 'csv', csv: 'csv', JSON: 'json', json: 'json',
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
        window.open(result.downloadUrl, '_blank');
        notify.success(`Report exported as ${format}`);
      } else {
        notify.success('Report generated successfully');
      }
    } catch (err) {
      notify.error(err instanceof Error ? err.message : `Failed to export report as ${format}`);
    }
  }, [reportName, generateReport]);

  // Load Template (from API data)
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
        <BuilderSidebar
          reportName={reportName}
          setReportName={setReportName}
          reportDescription={reportDescription}
          setReportDescription={setReportDescription}
          apiTemplates={apiTemplates}
          templatesLoading={templatesLoading}
          onLoadTemplate={loadTemplate}
          onExportReport={exportReport}
          isGenerating={isGenerating}
          exportStatus={exportStatus}
        />

        {/* Main Content */}
        <div className="lg:col-span-3 space-y-4">
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
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={widgets.map(w => w.id)} strategy={verticalListSortingStrategy}>
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
      <WidgetModal
        open={showAddWidget}
        onClose={() => setShowAddWidget(false)}
        editingWidget={editingWidget}
        widgetType={widgetType}
        setWidgetType={setWidgetType}
        widgetTitle={widgetTitle}
        setWidgetTitle={setWidgetTitle}
        widgetDataSource={widgetDataSource}
        setWidgetDataSource={setWidgetDataSource}
        widgetSize={widgetSize}
        setWidgetSize={setWidgetSize}
        onAdd={addWidget}
        onUpdate={updateWidget}
        onResetForm={() => {
          setEditingWidget(null);
          resetWidgetForm();
        }}
      />

      {/* Schedule Modal */}
      <ScheduleModal
        open={showSchedule}
        onClose={() => setShowSchedule(false)}
        scheduleFrequency={scheduleFrequency}
        setScheduleFrequency={setScheduleFrequency}
        scheduleTime={scheduleTime}
        setScheduleTime={setScheduleTime}
        scheduleRecipients={scheduleRecipients}
        setScheduleRecipients={setScheduleRecipients}
        scheduleFormat={scheduleFormat}
        setScheduleFormat={setScheduleFormat}
      />
    </div>
  );
}
