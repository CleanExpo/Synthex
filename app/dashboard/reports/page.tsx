'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  FileText,
  Download,
  RefreshCw,
  Plus,
  Filter,
  Calendar,
  BarChart3,
  Brain,
  Beaker,
  TrendingUp,
  Clock,
  CheckCircle,
  AlertCircle,
  Loader2
} from '@/components/icons';
import toast, { Toaster } from 'react-hot-toast';

interface Report {
  id: string;
  name: string;
  type: 'campaign' | 'analytics' | 'ab-test' | 'psychology' | 'comprehensive';
  status: 'pending' | 'generating' | 'completed' | 'failed';
  format: 'pdf' | 'csv' | 'json';
  generatedAt: string | null;
  createdAt: string;
  downloadUrl: string | null;
}

interface ReportType {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
}

const reportTypes: ReportType[] = [
  { id: 'campaign', name: 'Campaign Report', description: 'Campaign performance metrics', icon: TrendingUp },
  { id: 'analytics', name: 'Analytics Report', description: 'Event tracking and behavior', icon: BarChart3 },
  { id: 'ab-test', name: 'A/B Testing Report', description: 'Test results and analysis', icon: Beaker },
  { id: 'psychology', name: 'Psychology Report', description: 'Principle effectiveness', icon: Brain },
  { id: 'comprehensive', name: 'Comprehensive Report', description: 'Full platform analysis', icon: FileText },
];

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

      const response = await fetch(`/api/reporting/reports?${params.toString()}`);
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

  const handleGenerateReport = async () => {
    if (!newReportName.trim()) {
      toast.error('Please enter a report name');
      return;
    }

    setIsGenerating(true);
    try {
      const response = await fetch('/api/reporting/generate', {
        method: 'POST',
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

      // Poll for completion
      if (data.data?.reportId) {
        pollReportStatus(data.data.reportId);
      }
    } catch (error) {
      console.error('Failed to generate report:', error);
      toast.error('Failed to generate report');
    } finally {
      setIsGenerating(false);
    }
  };

  const pollReportStatus = async (reportId: string) => {
    const maxAttempts = 30;
    let attempts = 0;

    const poll = async () => {
      if (attempts >= maxAttempts) {
        toast.error('Report generation timed out');
        return;
      }

      try {
        const response = await fetch(`/api/reporting/reports/${reportId}`);
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
  };

  const handleDownload = async (report: Report) => {
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
  };

  const getTypeIcon = (type: string) => {
    const reportType = reportTypes.find(rt => rt.id === type);
    const Icon = reportType?.icon || FileText;
    return <Icon className="w-4 h-4" />;
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: 'bg-gray-500/20 text-gray-400',
      generating: 'bg-yellow-500/20 text-yellow-400',
      completed: 'bg-green-500/20 text-green-400',
      failed: 'bg-red-500/20 text-red-400',
    };

    const icons: Record<string, React.ReactNode> = {
      pending: <Clock className="w-3 h-3 mr-1" />,
      generating: <Loader2 className="w-3 h-3 mr-1 animate-spin" />,
      completed: <CheckCircle className="w-3 h-3 mr-1" />,
      failed: <AlertCircle className="w-3 h-3 mr-1" />,
    };

    return (
      <Badge className={styles[status] || styles.pending}>
        {icons[status]}
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const getFormatBadge = (format: string) => {
    const styles: Record<string, string> = {
      pdf: 'bg-red-500/20 text-red-400',
      csv: 'bg-green-500/20 text-green-400',
      json: 'bg-blue-500/20 text-blue-400',
    };

    return (
      <Badge className={styles[format] || 'bg-gray-500/20 text-gray-400'}>
        {format.toUpperCase()}
      </Badge>
    );
  };

  return (
    <div className="p-6 space-y-6">
      <Toaster position="top-right" />

      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Reports</h1>
          <p className="text-gray-400">Generate and download comprehensive reports</p>
        </div>
        <div className="flex gap-3">
          <Button onClick={fetchReports} variant="outline">
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            className="gradient-primary text-white"
            onClick={() => setShowGenerateModal(true)}
          >
            <Plus className="w-4 h-4 mr-2" />
            New Report
          </Button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card variant="glass">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center">
              <FileText className="w-4 h-4 mr-2 text-cyan-400" />
              Total Reports
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-white">{reports.length}</p>
            <p className="text-xs text-gray-400 mt-1">All time</p>
          </CardContent>
        </Card>

        <Card variant="glass">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center">
              <CheckCircle className="w-4 h-4 mr-2 text-green-400" />
              Completed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-white">
              {reports.filter(r => r.status === 'completed').length}
            </p>
            <p className="text-xs text-gray-400 mt-1">Ready to download</p>
          </CardContent>
        </Card>

        <Card variant="glass">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center">
              <Loader2 className="w-4 h-4 mr-2 text-yellow-400" />
              In Progress
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-white">
              {reports.filter(r => r.status === 'generating' || r.status === 'pending').length}
            </p>
            <p className="text-xs text-gray-400 mt-1">Generating now</p>
          </CardContent>
        </Card>

        <Card variant="glass">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center">
              <Calendar className="w-4 h-4 mr-2 text-blue-400" />
              This Month
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-white">
              {reports.filter(r => {
                const date = new Date(r.createdAt);
                const now = new Date();
                return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
              }).length}
            </p>
            <p className="text-xs text-gray-400 mt-1">Generated</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter */}
      <div className="flex gap-2 items-center">
        <Filter className="w-4 h-4 text-gray-400" />
        <span className="text-sm text-gray-400">Filter by type:</span>
        <Button
          size="sm"
          variant={filterType === null ? 'default' : 'outline'}
          onClick={() => setFilterType(null)}
        >
          All
        </Button>
        {reportTypes.map((type) => (
          <Button
            key={type.id}
            size="sm"
            variant={filterType === type.id ? 'default' : 'outline'}
            onClick={() => setFilterType(type.id)}
          >
            {type.name}
          </Button>
        ))}
      </div>

      {/* Reports List */}
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
              <Button onClick={() => setShowGenerateModal(true)}>
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
                      {getFormatBadge(report.format)}
                      {getStatusBadge(report.status)}
                      {report.status === 'completed' && report.downloadUrl && (
                        <Button
                          size="sm"
                          onClick={() => handleDownload(report)}
                        >
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

      {/* Generate Report Modal */}
      {showGenerateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Generate New Report</CardTitle>
              <CardDescription>Choose report type and format</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Report Name
                </label>
                <input
                  type="text"
                  value={newReportName}
                  onChange={(e) => setNewReportName(e.target.value)}
                  placeholder="Enter report name..."
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Report Type
                </label>
                <div className="grid grid-cols-1 gap-2">
                  {reportTypes.map((type) => (
                    <button
                      key={type.id}
                      onClick={() => setNewReportType(type.id)}
                      className={`p-3 rounded-lg text-left transition-colors ${
                        newReportType === type.id
                          ? 'bg-cyan-500/20 border border-cyan-500'
                          : 'bg-white/5 border border-white/10 hover:bg-white/10'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <type.icon className="w-5 h-5 text-cyan-400" />
                        <div>
                          <p className="font-medium text-white">{type.name}</p>
                          <p className="text-xs text-gray-400">{type.description}</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Format
                </label>
                <div className="flex gap-2">
                  {['pdf', 'csv', 'json'].map((format) => (
                    <Button
                      key={format}
                      variant={newReportFormat === format ? 'default' : 'outline'}
                      onClick={() => setNewReportFormat(format)}
                    >
                      {format.toUpperCase()}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowGenerateModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1 gradient-primary text-white"
                  onClick={handleGenerateReport}
                  disabled={isGenerating}
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4 mr-2" />
                      Generate
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
