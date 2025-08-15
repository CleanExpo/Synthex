'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { DatePickerWithRange } from '@/components/ui/date-range-picker';
import { 
  FileText,
  Plus,
  Trash2,
  Download,
  Send,
  Calendar,
  Clock,
  Filter,
  Layout,
  BarChart3,
  PieChart,
  LineChart,
  Table,
  Image,
  Type,
  Move,
  Settings,
  Save,
  Share2,
  Mail,
  Printer,
  ChevronUp,
  ChevronDown,
  Eye,
  EyeOff,
  Sparkles,
  Database,
  TrendingUp,
  Users,
  DollarSign,
  Activity,
  Grid,
  Columns,
  Rows
} from 'lucide-react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { notify } from '@/lib/notifications';

interface ReportWidget {
  id: string;
  type: 'chart' | 'table' | 'metric' | 'text' | 'image';
  title: string;
  dataSource: string;
  config: any;
  size: 'small' | 'medium' | 'large' | 'full';
  visible: boolean;
}

interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  widgets: ReportWidget[];
  schedule?: ReportSchedule;
  filters: ReportFilter[];
}

interface ReportSchedule {
  frequency: 'daily' | 'weekly' | 'monthly';
  time: string;
  recipients: string[];
  format: 'pdf' | 'excel' | 'csv';
}

interface ReportFilter {
  field: string;
  operator: 'equals' | 'contains' | 'greater' | 'less' | 'between';
  value: any;
}

interface DataSource {
  id: string;
  name: string;
  type: 'analytics' | 'social' | 'sales' | 'custom';
  fields: DataField[];
}

interface DataField {
  name: string;
  type: 'string' | 'number' | 'date' | 'boolean';
  aggregatable: boolean;
}

// Sortable Widget Component
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
      case 'image': return <Image className="h-4 w-4" />;
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
      <Card className={`glass-card ${!widget.visible ? 'opacity-50' : ''}`}>
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

export function CustomReportBuilder() {
  const [templates, setTemplates] = useState<ReportTemplate[]>([]);
  const [currentReport, setCurrentReport] = useState<ReportTemplate | null>(null);
  const [widgets, setWidgets] = useState<ReportWidget[]>([]);
  const [dataSources, setDataSources] = useState<DataSource[]>([]);
  const [showAddWidget, setShowAddWidget] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [editingWidget, setEditingWidget] = useState<ReportWidget | null>(null);
  const [reportName, setReportName] = useState('');
  const [reportDescription, setReportDescription] = useState('');
  
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
  
  useEffect(() => {
    loadTemplates();
    loadDataSources();
  }, []);
  
  const loadTemplates = () => {
    const mockTemplates: ReportTemplate[] = [
      {
        id: 'template-1',
        name: 'Executive Dashboard',
        description: 'High-level overview for executives',
        category: 'Dashboard',
        widgets: [],
        filters: []
      },
      {
        id: 'template-2',
        name: 'Social Media Performance',
        description: 'Detailed social media analytics',
        category: 'Analytics',
        widgets: [],
        filters: []
      },
      {
        id: 'template-3',
        name: 'ROI Report',
        description: 'Return on investment analysis',
        category: 'Financial',
        widgets: [],
        filters: []
      }
    ];
    setTemplates(mockTemplates);
  };
  
  const loadDataSources = () => {
    const sources: DataSource[] = [
      {
        id: 'analytics',
        name: 'Website Analytics',
        type: 'analytics',
        fields: [
          { name: 'pageViews', type: 'number', aggregatable: true },
          { name: 'uniqueVisitors', type: 'number', aggregatable: true },
          { name: 'bounceRate', type: 'number', aggregatable: true },
          { name: 'avgSessionDuration', type: 'number', aggregatable: true }
        ]
      },
      {
        id: 'social',
        name: 'Social Media Metrics',
        type: 'social',
        fields: [
          { name: 'followers', type: 'number', aggregatable: true },
          { name: 'engagement', type: 'number', aggregatable: true },
          { name: 'reach', type: 'number', aggregatable: true },
          { name: 'impressions', type: 'number', aggregatable: true }
        ]
      },
      {
        id: 'sales',
        name: 'Sales Data',
        type: 'sales',
        fields: [
          { name: 'revenue', type: 'number', aggregatable: true },
          { name: 'orders', type: 'number', aggregatable: true },
          { name: 'averageOrderValue', type: 'number', aggregatable: true },
          { name: 'conversionRate', type: 'number', aggregatable: true }
        ]
      }
    ];
    setDataSources(sources);
  };
  
  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    
    if (active.id !== over.id) {
      setWidgets((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };
  
  const addWidget = () => {
    if (!widgetTitle || !widgetDataSource) {
      notify.error('Please fill in all required fields');
      return;
    }
    
    const newWidget: ReportWidget = {
      id: `widget-${Date.now()}`,
      type: widgetType as any,
      title: widgetTitle,
      dataSource: widgetDataSource,
      config: {},
      size: widgetSize as any,
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
        ? { ...editingWidget, title: widgetTitle, dataSource: widgetDataSource, size: widgetSize as any }
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
  
  const toggleWidgetVisibility = (id: string) => {
    setWidgets(widgets.map(w => 
      w.id === id ? { ...w, visible: !w.visible } : w
    ));
  };
  
  const resetWidgetForm = () => {
    setWidgetTitle('');
    setWidgetDataSource('');
    setWidgetType('chart');
    setWidgetSize('medium');
  };
  
  const saveReport = () => {
    if (!reportName) {
      notify.error('Please enter a report name');
      return;
    }
    
    const report: ReportTemplate = {
      id: `report-${Date.now()}`,
      name: reportName,
      description: reportDescription,
      category: 'Custom',
      widgets,
      filters: [],
      schedule: showSchedule ? {
        frequency: scheduleFrequency as any,
        time: scheduleTime,
        recipients: scheduleRecipients.split(',').map(e => e.trim()),
        format: scheduleFormat as any
      } : undefined
    };
    
    setCurrentReport(report);
    notify.success('Report saved successfully!');
  };
  
  const exportReport = (format: string) => {
    notify.info(`Exporting report as ${format}...`);
    // Simulate export
    setTimeout(() => {
      notify.success(`Report exported as ${format}`);
    }, 2000);
  };
  
  const loadTemplate = (template: ReportTemplate) => {
    setCurrentReport(template);
    setReportName(template.name);
    setReportDescription(template.description);
    setWidgets(template.widgets);
    notify.success(`Template "${template.name}" loaded`);
  };
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500/20 to-pink-500/20">
            <FileText className="h-6 w-6 text-purple-400" />
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
          <Button onClick={saveReport} className="gradient-primary">
            <Save className="h-4 w-4 mr-2" />
            Save Report
          </Button>
        </div>
      </div>
      
      <div className="grid gap-6 lg:grid-cols-4">
        {/* Sidebar */}
        <div className="lg:col-span-1 space-y-4">
          {/* Report Details */}
          <Card className="glass-card">
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
          
          {/* Templates */}
          <Card className="glass-card">
            <CardHeader>
              <CardTitle>Templates</CardTitle>
              <CardDescription>Start with a template</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {templates.map(template => (
                <Button
                  key={template.id}
                  variant="outline"
                  className="w-full justify-start bg-white/5 border-white/10"
                  onClick={() => loadTemplate(template)}
                >
                  <FileText className="h-4 w-4 mr-2" />
                  {template.name}
                </Button>
              ))}
            </CardContent>
          </Card>
          
          {/* Export Options */}
          <Card className="glass-card">
            <CardHeader>
              <CardTitle>Export Options</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button
                variant="outline"
                className="w-full justify-start bg-white/5 border-white/10"
                onClick={() => exportReport('PDF')}
              >
                <Download className="h-4 w-4 mr-2" />
                Export as PDF
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start bg-white/5 border-white/10"
                onClick={() => exportReport('Excel')}
              >
                <Table className="h-4 w-4 mr-2" />
                Export as Excel
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start bg-white/5 border-white/10"
                onClick={() => exportReport('CSV')}
              >
                <Database className="h-4 w-4 mr-2" />
                Export as CSV
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
          <Card className="glass-card">
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
            <Card className="glass-card p-12 text-center">
              <Layout className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-400">No widgets added yet</p>
              <p className="text-sm text-gray-500 mt-1">Click "Add Widget" to get started</p>
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
                      {dataSources.map(source => (
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
                      <SelectItem value="excel">Excel</SelectItem>
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