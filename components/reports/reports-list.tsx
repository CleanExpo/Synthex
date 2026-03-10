'use client';

/**
 * Reports List Component
 * List of generated reports
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, Download, Loader2, Plus } from '@/components/icons';
import { getTypeIcon, StatusBadge, FormatBadge } from './reports-config';
import type { Report } from './types';

interface ReportsListProps {
  reports: Report[];
  isLoading: boolean;
  onDownload: (report: Report) => void;
  onNewReport: () => void;
}

export function ReportsList({ reports, isLoading, onDownload, onNewReport }: ReportsListProps) {
  return (
    <Card variant="glass">
      <CardHeader>
        <CardTitle>Generated Reports</CardTitle>
        <CardDescription>View and download your reports</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
          </div>
        ) : reports.length === 0 ? (
          <div className="text-center py-8">
            <FileText className="w-12 h-12 mx-auto text-gray-500 mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">No reports yet</h3>
            <p className="text-gray-400 mb-4">Generate your first report to see it here</p>
            <Button onClick={onNewReport}>
              <Plus className="w-4 h-4 mr-2" />
              Generate Report
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {reports.map((report) => (
              <div
                key={report.id}
                className="p-4 bg-white/5 rounded-lg hover:bg-white/10 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-cyan-500/20 rounded-lg">
                      {getTypeIcon(report.type)}
                    </div>
                    <div>
                      <h3 className="font-medium text-white">{report.name}</h3>
                      <p className="text-sm text-gray-400">
                        {new Date(report.createdAt).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <FormatBadge format={report.format} />
                    <StatusBadge status={report.status} />
                    {report.status === 'completed' && report.downloadUrl && (
                      <Button size="sm" onClick={() => onDownload(report)}>
                        <Download className="w-4 h-4 mr-1" />
                        Download
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
