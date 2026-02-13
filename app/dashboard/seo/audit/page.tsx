'use client';

/**
 * SEO Audit Page
 * Comprehensive SEO health check with issue analysis
 */

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
} from '@/components/icons';

import {
  AuditResult,
  ScoreGauge,
  CoreWebVitalsCard,
  IssueCategory,
  IssueSummary,
} from '@/components/seo/audit';

export default function SEOAuditPage() {
  const { toast } = useToast();
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [auditResult, setAuditResult] = useState<AuditResult | null>(null);
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
                    Analyzing...
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
                <Button variant="outline" size="sm" className="border-cyan-500/30 text-cyan-400">
                  <Download className="w-4 h-4 mr-2" />
                  Export Report
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
              Enter a website URL above to run a comprehensive SEO audit. We&apos;ll analyze technical issues, on-page elements, content quality, and Core Web Vitals.
            </p>
          </div>
        )}
      </SEOFeatureGate>
    </div>
  );
}
