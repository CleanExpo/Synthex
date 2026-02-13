'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  FileText,
  Plus,
  Award,
  Database,
  Eye,
  RefreshCw,
} from '@/components/icons';
import { GEOFeatureGate } from '@/components/geo/GEOFeatureGate';

interface ResearchReport {
  id: number;
  title: string;
  slug: string;
  status: string;
  sasScore: number | null;
  createdAt: string;
  updatedAt: string;
  _count?: { visuals: number };
}

export default function ResearchPage() {
  const [reports, setReports] = useState<ResearchReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newReport, setNewReport] = useState({ title: '', executiveSummary: '' });
  const [creating, setCreating] = useState(false);

  useEffect(() => { fetchReports(); }, []);

  const fetchReports = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/research', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setReports(data.reports || []);
      }
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  const createReport = async () => {
    if (!newReport.title || newReport.title.length < 5) return;
    setCreating(true);
    try {
      const res = await fetch('/api/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(newReport),
      });
      if (res.ok) {
        setShowCreate(false);
        setNewReport({ title: '', executiveSummary: '' });
        fetchReports();
      }
    } catch (err) { console.error(err); } finally { setCreating(false); }
  };

  const statusColors: Record<string, string> = {
    draft: 'bg-gray-500/20 text-gray-400',
    review: 'bg-amber-500/20 text-amber-400',
    published: 'bg-emerald-500/20 text-emerald-400',
  };

  return (
    <GEOFeatureGate
      feature="Research Reports"
      requiredPlan="professional"
      description="Generate original research with first-party data that becomes a citation magnet for AI search engines."
      benefits={[
        'First-party data research generation',
        'SAS (Synthex Authority Score) methodology',
        'Paper Banana visualizations for reports',
      ]}
    >
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Database className="h-7 w-7 text-cyan-400" />
            Research Reports
          </h1>
          <p className="text-gray-400 mt-1">Create first-party data citation magnets for AI search engines</p>
        </div>
        <Button onClick={() => setShowCreate(!showCreate)} className="bg-cyan-600 hover:bg-cyan-700">
          <Plus className="h-4 w-4 mr-2" />
          New Report
        </Button>
      </div>

      {showCreate && (
        <Card className="bg-[#0f172a]/80 border border-cyan-500/10">
          <CardContent className="p-6 space-y-4">
            <input
              value={newReport.title}
              onChange={(e) => setNewReport({ ...newReport, title: e.target.value })}
              placeholder="Report title (e.g., '2026 Digital Marketing Benchmark Report')"
              className="w-full bg-white/5 border border-white/10 text-white rounded-lg px-4 py-2 text-sm placeholder:text-gray-500"
            />
            <textarea
              value={newReport.executiveSummary}
              onChange={(e) => setNewReport({ ...newReport, executiveSummary: e.target.value })}
              placeholder="Executive summary (optional)"
              className="w-full h-20 bg-white/5 border border-white/10 text-white rounded-lg px-4 py-2 text-sm placeholder:text-gray-500 resize-y"
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
              <Button onClick={createReport} disabled={creating || newReport.title.length < 5} className="bg-cyan-600 hover:bg-cyan-700">
                {creating ? 'Creating...' : 'Create Report'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="space-y-4">
          {[1, 2].map(i => (
            <Card key={i} className="bg-[#0f172a]/80 border border-cyan-500/10">
              <CardContent className="p-6 animate-pulse"><div className="h-6 bg-white/10 rounded w-1/2" /></CardContent>
            </Card>
          ))}
        </div>
      ) : reports.length === 0 ? (
        <Card className="bg-[#0f172a]/80 border border-cyan-500/10">
          <CardContent className="p-12 text-center text-gray-400">
            <Database className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>No research reports yet</p>
            <p className="text-sm mt-1">Create original research to become a citation magnet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {reports.map((report) => (
            <Card key={report.id} className="bg-[#0f172a]/80 border border-cyan-500/10 hover:border-cyan-500/30 transition-all">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-white">{report.title}</h3>
                    <div className="flex items-center gap-3 mt-2">
                      <Badge className={statusColors[report.status] || statusColors.draft}>{report.status}</Badge>
                      {report.sasScore !== null && (
                        <Badge className={`${report.sasScore >= 7 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
                          <Award className="h-3 w-3 mr-1" />
                          SAS: {report.sasScore.toFixed(1)}
                        </Badge>
                      )}
                      <span className="text-xs text-gray-500">{report._count?.visuals || 0} visuals</span>
                      <span className="text-xs text-gray-500">
                        {new Date(report.updatedAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" className="text-cyan-400">
                    <Eye className="h-4 w-4 mr-1" /> View
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
    </GEOFeatureGate>
  );
}
