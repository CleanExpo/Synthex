'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  FileText, Download, Mail, Printer, Database, Table, Loader2,
} from '@/components/icons';
import type { ReportTemplate } from '@/hooks/use-report-templates';

interface BuilderSidebarProps {
  reportName: string;
  setReportName: (v: string) => void;
  reportDescription: string;
  setReportDescription: (v: string) => void;
  apiTemplates: ReportTemplate[];
  templatesLoading: boolean;
  onLoadTemplate: (template: ReportTemplate) => void;
  onExportReport: (format: string) => void;
  isGenerating: boolean;
  exportStatus: string;
}

export function BuilderSidebar({
  reportName, setReportName, reportDescription, setReportDescription,
  apiTemplates, templatesLoading, onLoadTemplate,
  onExportReport, isGenerating, exportStatus,
}: BuilderSidebarProps) {
  return (
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

      {/* Templates */}
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
                onClick={() => onLoadTemplate(template)}
              >
                <FileText className="h-4 w-4 mr-2" />
                {template.name}
              </Button>
            ))
          )}
        </CardContent>
      </Card>

      {/* Export Options */}
      <Card variant="glass">
        <CardHeader>
          <CardTitle>Export Options</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button
            variant="outline"
            className="w-full justify-start bg-white/5 border-white/10"
            onClick={() => onExportReport('PDF')}
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
            onClick={() => onExportReport('CSV')}
            disabled={isGenerating}
          >
            <Database className="h-4 w-4 mr-2" />
            Export as CSV
          </Button>
          <Button
            variant="outline"
            className="w-full justify-start bg-white/5 border-white/10"
            onClick={() => onExportReport('JSON')}
            disabled={isGenerating}
          >
            <Table className="h-4 w-4 mr-2" />
            Export as JSON
          </Button>
          <Button variant="outline" className="w-full justify-start bg-white/5 border-white/10">
            <Mail className="h-4 w-4 mr-2" />
            Email Report
          </Button>
          <Button variant="outline" className="w-full justify-start bg-white/5 border-white/10">
            <Printer className="h-4 w-4 mr-2" />
            Print Report
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
