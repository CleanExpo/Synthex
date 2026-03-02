'use client';

/**
 * SEO Audit Page
 * Comprehensive SEO health check with issue analysis
 */

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { SEOFeatureGate } from '@/components/seo';
import { useToast } from '@/hooks/use-toast';
import {
  FileSearch,
  ArrowLeft,
  Loader2,
  Globe,
  Zap,
  Clock,
  RefreshCw,
  Download,
  Sparkles,
  Copy,
  Check,
  Calendar,
} from '@/components/icons';

import {
  AuditResult,
  ScoreGauge,
  CoreWebVitalsCard,
  IssueCategory,
  IssueSummary,
} from '@/components/seo/audit';
import type { AuditResult as AuditResultType, AuditIssue } from '@/components/seo/audit/types';

const SEVERITY_ORDER: Record<string, number> = {
  critical: 0,
  major: 1,
  minor: 2,
  info: 3,
};

function sortIssuesBySeverity(issues: AuditIssue[]): AuditIssue[] {
  return [...issues].sort(
    (a, b) =>
      (SEVERITY_ORDER[a.severity] ?? 99) - (SEVERITY_ORDER[b.severity] ?? 99)
  );
}

async function exportAuditPDF(result: AuditResultType) {
  const { jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');
  const doc = new jsPDF();
  const today = new Date().toLocaleDateString('en-AU');

  // --- Page 1: Summary ---
  doc.setFontSize(20);
  doc.setTextColor(6, 182, 212); // cyan-500
  doc.text('SEO Audit Report', 14, 20);

  doc.setFontSize(11);
  doc.setTextColor(60, 60, 60);
  doc.text(`Domain: ${result.domain}`, 14, 32);
  doc.text(`Audited: ${new Date(result.timestamp).toLocaleString('en-AU')}`, 14, 39);
  doc.text(`Crawled pages: ${result.crawledPages}`, 14, 46);

  // Score
  doc.setFontSize(28);
  doc.setTextColor(
    result.score >= 80 ? 34 : result.score >= 60 ? 245 : 239,
    result.score >= 80 ? 197 : result.score >= 60 ? 158 : 68,
    result.score >= 80 ? 94 : result.score >= 60 ? 11 : 68
  );
  doc.text(`${result.score}`, 14, 65);
  doc.setFontSize(11);
  doc.setTextColor(100, 100, 100);
  doc.text('/ 100 SEO Health Score', 32, 65);

  // Issue summary table
  autoTable(doc, {
    startY: 75,
    head: [['Severity', 'Count']],
    body: [
      ['Critical', String(result.issues.critical)],
      ['Major', String(result.issues.major)],
      ['Minor', String(result.issues.minor)],
      ['Info', String(result.issues.info)],
    ],
    theme: 'grid',
    headStyles: { fillColor: [6, 182, 212], textColor: 255 },
    columnStyles: { 0: { cellWidth: 80 }, 1: { cellWidth: 40 } },
    margin: { left: 14 },
  });

  // Core Web Vitals if available
  if (result.categories.coreWebVitals) {
    const cwv = result.categories.coreWebVitals;
    const lastY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable?.finalY ?? 130;

    doc.setFontSize(13);
    doc.setTextColor(40, 40, 40);
    doc.text('Core Web Vitals', 14, lastY + 12);

    autoTable(doc, {
      startY: lastY + 16,
      head: [['Metric', 'Value', 'Rating']],
      body: [
        ['LCP (Largest Contentful Paint)', `${cwv.lcp.value}s`, cwv.lcp.rating],
        ['FID (First Input Delay)', `${cwv.fid.value}ms`, cwv.fid.rating],
        ['CLS (Cumulative Layout Shift)', String(cwv.cls.value), cwv.cls.rating],
        ['INP (Interaction to Next Paint)', `${cwv.inp.value}ms`, cwv.inp.rating],
      ],
      theme: 'grid',
      headStyles: { fillColor: [6, 182, 212], textColor: 255 },
      margin: { left: 14 },
    });
  }

  // --- Page 2: Detailed Issues ---
  doc.addPage();
  doc.setFontSize(16);
  doc.setTextColor(40, 40, 40);
  doc.text('Detailed Issues', 14, 20);

  const allIssues: Array<[string, string, string, string]> = [];

  const addCategory = (label: string, issues: AuditIssue[]) => {
    for (const issue of sortIssuesBySeverity(issues)) {
      allIssues.push([
        label,
        issue.severity.toUpperCase(),
        issue.title,
        issue.recommendation,
      ]);
    }
  };

  addCategory('Technical', result.categories.technical.issues);
  addCategory('On-Page', result.categories.onPage.issues);
  addCategory('Content', result.categories.content.issues);

  autoTable(doc, {
    startY: 26,
    head: [['Category', 'Severity', 'Issue', 'Recommendation']],
    body: allIssues,
    theme: 'striped',
    headStyles: { fillColor: [6, 182, 212], textColor: 255 },
    columnStyles: {
      0: { cellWidth: 24 },
      1: { cellWidth: 22 },
      2: { cellWidth: 60 },
      3: { cellWidth: 74 },
    },
    styles: { fontSize: 8, cellPadding: 2 },
    margin: { left: 14 },
  });

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `Generated by Synthex · synthex.social · ${today} · Page ${i} of ${pageCount}`,
      14,
      doc.internal.pageSize.height - 8
    );
  }

  doc.save(`seo-audit-${result.domain}-${today.replace(/\//g, '-')}.pdf`);
}

export default function SEOAuditPage() {
  const { toast } = useToast();
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [copiedIds, setCopiedIds] = useState<Set<string>>(new Set());
  const [isCreatingCampaign, setIsCreatingCampaign] = useState(false);
  const [auditResult, setAuditResult] = useState<AuditResultType | null>(null);
  const [expandedIssues, setExpandedIssues] = useState<Set<string>>(new Set());

  const handleAudit = async () => {
    if (!url) {
      toast({
        title: 'URL Required',
        description: 'Please enter a valid URL to audit',
        variant: 'destructive',
      });
      return;
    }

    try {
      new URL(url.startsWith('http') ? url : `https://${url}`);
    } catch {
      toast({
        title: 'Invalid URL',
        description: 'Please enter a valid URL',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/seo/audit', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: url.startsWith('http') ? url : `https://${url}`,
          depth: 3,
          includeSchemaCheck: true,
          includeCoreWebVitals: true,
          includeContentAnalysis: true,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to perform audit');
      }

      setAuditResult(data.audit);
      toast({
        title: 'Audit Complete',
        description: `Found ${data.audit.issues.critical + data.audit.issues.major + data.audit.issues.minor} issues`,
      });
    } catch (error) {
      toast({
        title: 'Audit Failed',
        description: error instanceof Error ? error.message : 'Failed to perform audit',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const toggleIssue = (id: string) => {
    setExpandedIssues((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleExportPDF = async () => {
    if (!auditResult) return;
    setIsExporting(true);
    try {
      await exportAuditPDF(auditResult);
    } finally {
      setIsExporting(false);
    }
  };

  const handleCopyFix = (issueTitle: string, recommendation: string) => {
    navigator.clipboard.writeText(recommendation).then(() => {
      setCopiedIds((prev) => new Set(prev).add(issueTitle));
      setTimeout(() => {
        setCopiedIds((prev) => {
          const next = new Set(prev);
          next.delete(issueTitle);
          return next;
        });
      }, 2000);
    });
  };

  const handleCreateContentCampaign = async () => {
    if (!auditResult) return;
    setIsCreatingCampaign(true);
    try {
      const contentIssues = sortIssuesBySeverity(auditResult.categories.content.issues);
      const recommendations = contentIssues
        .map((issue) => `- **${issue.title}** (${issue.severity}): ${issue.recommendation}`)
        .join('\n');

      const today = new Date().toLocaleDateString('en-AU');
      const response = await fetch('/api/campaigns', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `SEO Content Fix: ${auditResult.domain}`,
          platform: 'multi',
          content: `## SEO Content Issues — ${auditResult.domain}\n\n${recommendations}`,
          description: `Generated from SEO audit on ${today}`,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create campaign');
      }

      toast({
        title: 'Campaign created!',
        description: (
          <span>
            Your content fix campaign is ready.{' '}
            <button
              onClick={() => router.push('/dashboard/content')}
              className="underline font-medium"
            >
              View Campaign →
            </button>
          </span>
        ),
      });
      setIsSheetOpen(false);
    } catch (error) {
      toast({
        title: 'Failed to create campaign',
        description: error instanceof Error ? error.message : 'Something went wrong',
        variant: 'destructive',
      });
    } finally {
      setIsCreatingCampaign(false);
    }
  };

  const contentIssues = auditResult
    ? sortIssuesBySeverity(auditResult.categories.content.issues)
    : [];

  const severityColour: Record<string, string> = {
    critical: 'bg-red-500/20 text-red-400 border-red-500/30',
    major: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    minor: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    info: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/dashboard/seo">
          <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <FileSearch className="w-8 h-8 text-cyan-400" />
            Site Audit
          </h1>
          <p className="text-gray-400 mt-1">
            Comprehensive SEO health check for your website
          </p>
        </div>
      </div>

      <SEOFeatureGate
        feature="Site Audit"
        requiredPlan="professional"
        description="Run comprehensive SEO audits to identify technical issues, on-page problems, and optimization opportunities."
      >
        {/* URL Input */}
        <Card className="bg-[#0f172a]/80 backdrop-blur-xl border border-cyan-500/10">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <Input
                  type="url"
                  placeholder="Enter website URL (e.g., https://example.com)"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-gray-500"
                  onKeyDown={(e) => e.key === 'Enter' && handleAudit()}
                />
              </div>
              <Button
                onClick={handleAudit}
                disabled={isLoading}
                className="bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-white shadow-lg shadow-cyan-500/25"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Analysing...
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 mr-2" />
                    Run Audit
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        {auditResult && (
          <div className="space-y-6">
            {/* Overview */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Score */}
              <Card className="bg-[#0f172a]/80 backdrop-blur-xl border border-cyan-500/10 lg:col-span-1">
                <CardContent className="p-6 flex flex-col items-center">
                  <ScoreGauge score={auditResult.score} />
                  <h3 className="text-lg font-semibold text-white mt-4">SEO Health Score</h3>
                  <p className="text-gray-400 text-sm mt-1">{auditResult.domain}</p>
                  <div className="flex items-center gap-2 mt-4 text-gray-500 text-sm">
                    <Clock className="w-4 h-4" />
                    {new Date(auditResult.timestamp).toLocaleString()}
                  </div>
                </CardContent>
              </Card>

              {/* Issue Summary */}
              <IssueSummary issues={auditResult.issues} crawledPages={auditResult.crawledPages} />
            </div>

            {/* Core Web Vitals */}
            {auditResult.categories.coreWebVitals && (
              <CoreWebVitalsCard vitals={auditResult.categories.coreWebVitals} />
            )}

            {/* Detailed Issues */}
            <Card className="bg-[#0f172a]/80 backdrop-blur-xl border border-cyan-500/10">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-white">Detailed Issues</CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-cyan-500/30 text-cyan-400"
                  onClick={handleExportPDF}
                  disabled={isExporting}
                >
                  {isExporting ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4 mr-2" />
                  )}
                  {isExporting ? 'Exporting...' : 'Export Report'}
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                <IssueCategory
                  title="Technical SEO"
                  category={auditResult.categories.technical}
                  categoryKey="tech"
                  expandedIssues={expandedIssues}
                  onToggleIssue={toggleIssue}
                />

                <IssueCategory
                  title="On-Page SEO"
                  category={auditResult.categories.onPage}
                  categoryKey="onpage"
                  expandedIssues={expandedIssues}
                  onToggleIssue={toggleIssue}
                />

                <IssueCategory
                  title="Content Quality"
                  category={auditResult.categories.content}
                  categoryKey="content"
                  expandedIssues={expandedIssues}
                  onToggleIssue={toggleIssue}
                />
              </CardContent>
            </Card>

            {/* Quick Wins Action Bar */}
            <Card className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.08]">
              <CardContent className="p-6">
                <p className="text-gray-300 text-sm font-medium mb-4">
                  What do you want to do with these results?
                </p>
                <div className="flex flex-wrap gap-3">
                  <Button
                    variant="outline"
                    className="border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10"
                    onClick={handleExportPDF}
                    disabled={isExporting}
                  >
                    {isExporting ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Download className="w-4 h-4 mr-2" />
                    )}
                    Export PDF
                  </Button>

                  {contentIssues.length > 0 && (
                    <Button
                      className="bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-white shadow-lg shadow-cyan-500/25"
                      onClick={() => setIsSheetOpen(true)}
                    >
                      <Sparkles className="w-4 h-4 mr-2" />
                      Fix Content Issues ({contentIssues.length})
                    </Button>
                  )}

                  <Link href="/dashboard/seo/scheduled-audits">
                    <Button
                      variant="outline"
                      className="border-white/10 text-gray-300 hover:bg-white/5 hover:text-white"
                    >
                      <Calendar className="w-4 h-4 mr-2" />
                      Schedule Recurring Audit
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>

            {/* Actions */}
            <div className="flex justify-center gap-4">
              <Button
                variant="outline"
                onClick={() => handleAudit()}
                disabled={isLoading}
                className="border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Re-run Audit
              </Button>
              <Link href="/dashboard/seo">
                <Button variant="ghost" className="text-gray-400 hover:text-white">
                  Back to SEO Dashboard
                </Button>
              </Link>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!auditResult && !isLoading && (
          <div className="text-center py-16">
            <FileSearch className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-medium text-white mb-2">Ready to Audit</h3>
            <p className="text-gray-400 max-w-md mx-auto">
              Enter a website URL above to run a comprehensive SEO audit. We&apos;ll analyse technical issues, on-page elements, content quality, and Core Web Vitals.
            </p>
          </div>
        )}
      </SEOFeatureGate>

      {/* Content Quick Wins Sheet */}
      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent
          variant="glass-solid"
          side="right"
          className="w-[480px] sm:max-w-[480px] flex flex-col p-0"
        >
          {/* Header */}
          <div className="p-6 border-b border-white/[0.08]">
            <SheetHeader>
              <SheetTitle className="text-white">
                Content Quick Wins · {auditResult?.domain}
              </SheetTitle>
              <SheetDescription className="text-white/60">
                {contentIssues.length} issue{contentIssues.length !== 1 ? 's' : ''} found · sorted by priority
              </SheetDescription>
            </SheetHeader>
          </div>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {contentIssues.map((issue) => (
              <div
                key={issue.title}
                className="rounded-lg border border-white/[0.08] bg-white/[0.03] p-4 space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge
                        variant="outline"
                        className={`text-xs font-semibold uppercase ${severityColour[issue.severity] ?? severityColour.info}`}
                      >
                        {issue.severity}
                      </Badge>
                      <span className="text-sm font-medium text-white">{issue.title}</span>
                    </div>
                    <p className="text-xs text-white/60 leading-relaxed">{issue.description}</p>
                  </div>
                </div>
                <p className="text-xs text-cyan-300/80 leading-relaxed border-t border-white/[0.06] pt-2">
                  {issue.recommendation}
                </p>
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-white/50 hover:text-white hover:bg-white/10 h-7 text-xs"
                    onClick={() => handleCopyFix(issue.title, issue.recommendation)}
                  >
                    {copiedIds.has(issue.title) ? (
                      <>
                        <Check className="w-3 h-3 mr-1" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3 mr-1" />
                        Copy Fix
                      </>
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {/* Sticky footer */}
          <div className="p-4 border-t border-white/[0.08] flex gap-3">
            <Button
              className="flex-1 bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-white shadow-lg shadow-cyan-500/25"
              onClick={handleCreateContentCampaign}
              disabled={isCreatingCampaign}
            >
              {isCreatingCampaign ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4 mr-2" />
              )}
              {isCreatingCampaign ? 'Creating...' : 'Create Content Campaign'}
            </Button>
            <Button
              variant="ghost"
              className="text-white/50 hover:text-white hover:bg-white/10"
              onClick={() => setIsSheetOpen(false)}
            >
              Close
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
