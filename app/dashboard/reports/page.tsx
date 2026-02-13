'use client';

import { useState, useEffect, useCallback } from 'react';
import toast, { Toaster } from 'react-hot-toast';

import {
  type Report,
  ReportsHeader,
  ReportsStats,
  ReportsFilters,
  ReportsList,
  GenerateReportModal,
} from '@/components/reports';

export default function ReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [filterType, setFilterType] = useState<string | null>(null);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [newReportType, setNewReportType] = useState<string>('campaign');
  const [newReportFormat, setNewReportFormat] = useState<string>('pdf');
  const [newReportName, setNewReportName] = useState('');

  const fetchReports = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterType) params.append('type', filterType);

      const response = await fetch(`/api/reporting/reports?${params.toString()}`, { credentials: 'include' });
      if (!response.ok) {
        throw new Error('Failed to fetch reports');
      }

      const data = await response.json();
      setReports(data.data?.reports || []);
    } catch (error) {
      console.error('Failed to fetch reports:', error);
      toast.error('Failed to load reports');
    } finally {
      setIsLoading(false);
    }
  }, [filterType]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const pollReportStatus = useCallback(async (reportId: string) => {
    const maxAttempts = 30;
    let attempts = 0;

    const poll = async () => {
      if (attempts >= maxAttempts) {
        toast.error('Report generation timed out');
        return;
      }

      try {
        const response = await fetch(`/api/reporting/reports/${reportId}`, { credentials: 'include' });
        const data = await response.json();

        if (data.data?.status === 'completed') {
          toast.success('Report ready for download!');
          fetchReports();
          return;
        } else if (data.data?.status === 'failed') {
          toast.error('Report generation failed');
          fetchReports();
          return;
        }

        attempts++;
        setTimeout(poll, 2000);
      } catch (error) {
        console.error('Poll error:', error);
      }
    };

    setTimeout(poll, 2000);
  }, [fetchReports]);

  const handleGenerateReport = useCallback(async () => {
    if (!newReportName.trim()) {
      toast.error('Please enter a report name');
      return;
    }

    setIsGenerating(true);
    try {
      const response = await fetch('/api/reporting/generate', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newReportName,
          type: newReportType,
          format: newReportFormat,
          dateRange: {
            start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
            end: new Date().toISOString(),
          },
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate report');
      }

      const data = await response.json();
      toast.success('Report generation started!');
      setShowGenerateModal(false);
      setNewReportName('');
      fetchReports();

      if (data.data?.reportId) {
        pollReportStatus(data.data.reportId);
      }
    } catch (error) {
      console.error('Failed to generate report:', error);
      toast.error('Failed to generate report');
    } finally {
      setIsGenerating(false);
    }
  }, [newReportName, newReportType, newReportFormat, fetchReports, pollReportStatus]);

  const handleDownload = useCallback(async (report: Report) => {
    if (!report.downloadUrl) {
      toast.error('Report not ready for download');
      return;
    }

    try {
      window.open(report.downloadUrl, '_blank');
      toast.success('Download started');
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Failed to download report');
    }
  }, []);

  return (
    <div className="p-6 space-y-6">
      <Toaster position="top-right" />

      <ReportsHeader
        isLoading={isLoading}
        onRefresh={fetchReports}
        onNewReport={() => setShowGenerateModal(true)}
      />

      <ReportsStats reports={reports} />

      <ReportsFilters filterType={filterType} onFilterChange={setFilterType} />

      <ReportsList
        reports={reports}
        isLoading={isLoading}
        onDownload={handleDownload}
        onNewReport={() => setShowGenerateModal(true)}
      />

      <GenerateReportModal
        isOpen={showGenerateModal}
        onClose={() => setShowGenerateModal(false)}
        reportName={newReportName}
        onReportNameChange={setNewReportName}
        reportType={newReportType}
        onReportTypeChange={setNewReportType}
        reportFormat={newReportFormat}
        onReportFormatChange={setNewReportFormat}
        isGenerating={isGenerating}
        onGenerate={handleGenerateReport}
      />
    </div>
  );
}
