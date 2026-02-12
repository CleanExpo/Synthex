'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SEOFeatureGate } from '@/components/seo';
import { useToast } from '@/hooks/use-toast';
import {
  Search,
  FileSearch,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Info,
  ArrowLeft,
  Loader2,
  Globe,
  Zap,
  TrendingUp,
  Clock,
  RefreshCw,
  Download,
  ChevronDown,
  ChevronRight,
  ExternalLink,
} from '@/components/icons';

interface AuditResult {
  url: string;
  domain: string;
  timestamp: string;
  score: number;
  crawledPages: number;
  issues: {
    critical: number;
    major: number;
    minor: number;
    info: number;
  };
  categories: {
    technical: {
      score: number;
      issues: Array<{
        severity: string;
        title: string;
        description: string;
        recommendation: string;
        affectedPages: string[];
      }>;
    };
    onPage: {
      score: number;
      issues: Array<{
        severity: string;
        title: string;
        description: string;
        recommendation: string;
        affectedPages: string[];
      }>;
    };
    content: {
      score: number;
      issues: Array<{
        severity: string;
        title: string;
        description: string;
        recommendation: string;
        affectedPages: string[];
      }>;
    };
    coreWebVitals?: {
      lcp: { value: number; rating: string };
      fid: { value: number; rating: string };
      cls: { value: number; rating: string };
      inp: { value: number; rating: string };
    };
    schema?: {
      detected: string[];
      valid: boolean;
      recommendations: string[];
    };
  };
}

function ScoreGauge({ score }: { score: number }) {
  const getColor = (s: number) => {
    if (s >= 90) return 'text-green-400';
    if (s >= 70) return 'text-yellow-400';
    if (s >= 50) return 'text-orange-400';
    return 'text-red-400';
  };

  const getBgColor = (s: number) => {
    if (s >= 90) return 'from-green-500/20 to-green-600/20';
    if (s >= 70) return 'from-yellow-500/20 to-yellow-600/20';
    if (s >= 50) return 'from-orange-500/20 to-orange-600/20';
    return 'from-red-500/20 to-red-600/20';
  };

  return (
    <div className={`relative w-32 h-32 rounded-full bg-gradient-to-br ${getBgColor(score)} flex items-center justify-center`}>
      <div className="absolute inset-2 rounded-full bg-[#0f172a]" />
      <span className={`relative text-4xl font-bold ${getColor(score)}`}>
        {score}
      </span>
    </div>
  );
}

function IssueCard({
  issue,
  isExpanded,
  onToggle,
}: {
  issue: {
    severity: string;
    title: string;
    description: string;
    recommendation: string;
    affectedPages: string[];
  };
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const severityConfig = {
    critical: { icon: XCircle, color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30' },
    major: { icon: AlertTriangle, color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/30' },
    minor: { icon: Info, color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30' },
    info: { icon: Info, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/30' },
  };

  const config = severityConfig[issue.severity as keyof typeof severityConfig] || severityConfig.info;
  const Icon = config.icon;

  return (
    <div className={`border rounded-lg overflow-hidden ${config.border} ${config.bg}`}>
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Icon className={`w-5 h-5 ${config.color}`} />
          <span className="font-medium text-white">{issue.title}</span>
        </div>
        {isExpanded ? (
          <ChevronDown className="w-5 h-5 text-gray-400" />
        ) : (
          <ChevronRight className="w-5 h-5 text-gray-400" />
        )}
      </button>
      {isExpanded && (
        <div className="px-4 pb-4 space-y-3">
          <p className="text-gray-400 text-sm">{issue.description}</p>
          <div className="bg-[#0f172a]/50 p-3 rounded-lg">
            <p className="text-cyan-400 text-sm font-medium mb-1">Recommendation</p>
            <p className="text-gray-300 text-sm">{issue.recommendation}</p>
          </div>
          {issue.affectedPages.length > 0 && (
            <div>
              <p className="text-gray-500 text-xs mb-2">Affected pages:</p>
              <div className="flex flex-wrap gap-2">
                {issue.affectedPages.map((page, i) => (
                  <a
                    key={i}
                    href={page}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                  >
                    {page}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

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

    // Validate URL
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
              <Card className="bg-[#0f172a]/80 backdrop-blur-xl border border-cyan-500/10 lg:col-span-2">
                <CardHeader>
                  <CardTitle className="text-white">Issues Found</CardTitle>
                  <CardDescription>Across {auditResult.crawledPages} pages analyzed</CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-center">
                    <XCircle className="w-6 h-6 text-red-400 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-red-400">{auditResult.issues.critical}</p>
                    <p className="text-sm text-gray-400">Critical</p>
                  </div>
                  <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-4 text-center">
                    <AlertTriangle className="w-6 h-6 text-orange-400 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-orange-400">{auditResult.issues.major}</p>
                    <p className="text-sm text-gray-400">Major</p>
                  </div>
                  <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 text-center">
                    <Info className="w-6 h-6 text-yellow-400 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-yellow-400">{auditResult.issues.minor}</p>
                    <p className="text-sm text-gray-400">Minor</p>
                  </div>
                  <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 text-center">
                    <CheckCircle className="w-6 h-6 text-blue-400 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-blue-400">{auditResult.issues.info}</p>
                    <p className="text-sm text-gray-400">Info</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Core Web Vitals */}
            {auditResult.categories.coreWebVitals && (
              <Card className="bg-[#0f172a]/80 backdrop-blur-xl border border-cyan-500/10">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-cyan-400" />
                    Core Web Vitals
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {Object.entries(auditResult.categories.coreWebVitals).map(([key, vital]) => (
                      <div
                        key={key}
                        className={`p-4 rounded-lg border ${
                          vital.rating === 'good'
                            ? 'bg-green-500/10 border-green-500/30'
                            : vital.rating === 'needs-improvement'
                            ? 'bg-yellow-500/10 border-yellow-500/30'
                            : 'bg-red-500/10 border-red-500/30'
                        }`}
                      >
                        <p className="text-gray-400 text-sm uppercase">{key.toUpperCase()}</p>
                        <p
                          className={`text-2xl font-bold ${
                            vital.rating === 'good'
                              ? 'text-green-400'
                              : vital.rating === 'needs-improvement'
                              ? 'text-yellow-400'
                              : 'text-red-400'
                          }`}
                        >
                          {key === 'cls' ? vital.value.toFixed(3) : `${vital.value.toFixed(0)}${key === 'lcp' ? 's' : 'ms'}`}
                        </p>
                        <p className="text-xs text-gray-500 capitalize">{vital.rating.replace('-', ' ')}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
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
                {/* Technical Issues */}
                <div>
                  <h4 className="text-lg font-medium text-white mb-3 flex items-center gap-2">
                    Technical SEO
                    <span className={`text-sm px-2 py-0.5 rounded ${
                      auditResult.categories.technical.score >= 80
                        ? 'bg-green-500/20 text-green-400'
                        : auditResult.categories.technical.score >= 60
                        ? 'bg-yellow-500/20 text-yellow-400'
                        : 'bg-red-500/20 text-red-400'
                    }`}>
                      {auditResult.categories.technical.score}%
                    </span>
                  </h4>
                  <div className="space-y-2">
                    {auditResult.categories.technical.issues.map((issue, i) => (
                      <IssueCard
                        key={`tech-${i}`}
                        issue={issue}
                        isExpanded={expandedIssues.has(`tech-${i}`)}
                        onToggle={() => toggleIssue(`tech-${i}`)}
                      />
                    ))}
                  </div>
                </div>

                {/* On-Page Issues */}
                <div>
                  <h4 className="text-lg font-medium text-white mb-3 flex items-center gap-2">
                    On-Page SEO
                    <span className={`text-sm px-2 py-0.5 rounded ${
                      auditResult.categories.onPage.score >= 80
                        ? 'bg-green-500/20 text-green-400'
                        : auditResult.categories.onPage.score >= 60
                        ? 'bg-yellow-500/20 text-yellow-400'
                        : 'bg-red-500/20 text-red-400'
                    }`}>
                      {auditResult.categories.onPage.score}%
                    </span>
                  </h4>
                  <div className="space-y-2">
                    {auditResult.categories.onPage.issues.map((issue, i) => (
                      <IssueCard
                        key={`onpage-${i}`}
                        issue={issue}
                        isExpanded={expandedIssues.has(`onpage-${i}`)}
                        onToggle={() => toggleIssue(`onpage-${i}`)}
                      />
                    ))}
                  </div>
                </div>

                {/* Content Issues */}
                <div>
                  <h4 className="text-lg font-medium text-white mb-3 flex items-center gap-2">
                    Content Quality
                    <span className={`text-sm px-2 py-0.5 rounded ${
                      auditResult.categories.content.score >= 80
                        ? 'bg-green-500/20 text-green-400'
                        : auditResult.categories.content.score >= 60
                        ? 'bg-yellow-500/20 text-yellow-400'
                        : 'bg-red-500/20 text-red-400'
                    }`}>
                      {auditResult.categories.content.score}%
                    </span>
                  </h4>
                  <div className="space-y-2">
                    {auditResult.categories.content.issues.map((issue, i) => (
                      <IssueCard
                        key={`content-${i}`}
                        issue={issue}
                        isExpanded={expandedIssues.has(`content-${i}`)}
                        onToggle={() => toggleIssue(`content-${i}`)}
                      />
                    ))}
                  </div>
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
              Enter a website URL above to run a comprehensive SEO audit. We&apos;ll analyze technical issues, on-page elements, content quality, and Core Web Vitals.
            </p>
          </div>
        )}
      </SEOFeatureGate>
    </div>
  );
}
