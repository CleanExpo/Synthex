'use client';

/**
 * Sitemap Analyzer Tool
 * Validates XML sitemaps: structure, URL count, lastmod freshness, duplicates
 */

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SEOFeatureGate } from '@/components/seo';
import { useToast } from '@/hooks/use-toast';
import {
  Map,
  ArrowLeft,
  Loader2,
  Globe,
  Zap,
  CheckCircle,
  AlertTriangle,
  XCircle,
  FileText,
  Clock,
  Link as LinkIcon,
} from '@/components/icons';

interface SitemapAnalysisResult {
  url: string;
  timestamp: string;
  valid: boolean;
  urlCount: number;
  issues: Array<{ severity: 'error' | 'warning' | 'info'; message: string }>;
  urls: Array<{
    loc: string;
    lastmod: string | null;
    changefreq: string | null;
    priority: string | null;
  }>;
  stats: {
    withLastmod: number;
    withChangefreq: number;
    withPriority: number;
    duplicates: number;
    staleUrls: number;
  };
}

export default function SitemapAnalyzerPage() {
  const { toast } = useToast();
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<SitemapAnalysisResult | null>(null);

  const handleAnalyze = async () => {
    if (!url) {
      toast({ title: 'URL Required', description: 'Please enter a sitemap URL', variant: 'destructive' });
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/seo/sitemap', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.startsWith('http') ? url : `https://${url}` }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Analysis failed');

      setResult(data.analysis);
      toast({ title: 'Sitemap Analyzed', description: `Found ${data.analysis.urlCount} URLs` });
    } catch (error) {
      toast({
        title: 'Analysis Failed',
        description: error instanceof Error ? error.message : 'Failed to analyze sitemap',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
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
            <Map className="w-8 h-8 text-cyan-400" />
            Sitemap Analyzer
          </h1>
          <p className="text-gray-400 mt-1">
            Validate and analyze XML sitemaps
          </p>
        </div>
      </div>

      <SEOFeatureGate
        feature="Sitemap Analyzer"
        requiredPlan="professional"
        description="Validate XML sitemaps, check URL structure, detect issues, and ensure search engines can crawl your site effectively."
      >
        {/* URL Input */}
        <Card className="bg-surface-base/80 backdrop-blur-xl border border-cyan-500/10">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <Input
                  type="url"
                  placeholder="Enter sitemap URL (e.g., https://example.com/sitemap.xml)"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-gray-500"
                  onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
                />
              </div>
              <Button
                onClick={handleAnalyze}
                disabled={isLoading}
                className="bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-white shadow-lg shadow-cyan-500/25"
              >
                {isLoading ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Analyzing...</>
                ) : (
                  <><Zap className="w-4 h-4 mr-2" />Analyze Sitemap</>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        {result && (
          <div className="space-y-6">
            {/* Overview */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="bg-surface-base/80 backdrop-blur-xl border border-cyan-500/10">
                <CardContent className="p-6 text-center">
                  {result.valid ? (
                    <CheckCircle className="w-8 h-8 text-green-400 mx-auto mb-2" />
                  ) : (
                    <XCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
                  )}
                  <p className="text-white font-medium">{result.valid ? 'Valid' : 'Invalid'}</p>
                  <p className="text-gray-400 text-sm">XML Structure</p>
                </CardContent>
              </Card>
              <Card className="bg-surface-base/80 backdrop-blur-xl border border-cyan-500/10">
                <CardContent className="p-6 text-center">
                  <div className="text-2xl font-bold text-white mb-1">{result.urlCount}</div>
                  <p className="text-gray-400 text-sm">Total URLs</p>
                </CardContent>
              </Card>
              <Card className="bg-surface-base/80 backdrop-blur-xl border border-cyan-500/10">
                <CardContent className="p-6 text-center">
                  <div className={`text-2xl font-bold mb-1 ${result.stats.duplicates > 0 ? 'text-red-400' : 'text-green-400'}`}>
                    {result.stats.duplicates}
                  </div>
                  <p className="text-gray-400 text-sm">Duplicates</p>
                </CardContent>
              </Card>
              <Card className="bg-surface-base/80 backdrop-blur-xl border border-cyan-500/10">
                <CardContent className="p-6 text-center">
                  <div className={`text-2xl font-bold mb-1 ${result.stats.staleUrls > 0 ? 'text-yellow-400' : 'text-green-400'}`}>
                    {result.stats.staleUrls}
                  </div>
                  <p className="text-gray-400 text-sm">Stale URLs</p>
                </CardContent>
              </Card>
            </div>

            {/* Issues */}
            {result.issues.length > 0 && (
              <Card className="bg-surface-base/80 backdrop-blur-xl border border-cyan-500/10">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-yellow-400" />
                    Issues ({result.issues.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {result.issues.map((issue, i) => (
                    <div key={i} className="flex items-start gap-3 p-3 bg-white/5 rounded-lg">
                      {issue.severity === 'error' ? (
                        <XCircle className="w-4 h-4 text-red-400 mt-0.5" />
                      ) : issue.severity === 'warning' ? (
                        <AlertTriangle className="w-4 h-4 text-yellow-400 mt-0.5" />
                      ) : (
                        <CheckCircle className="w-4 h-4 text-blue-400 mt-0.5" />
                      )}
                      <p className="text-gray-300 text-sm">{issue.message}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Completeness Stats */}
            <Card className="bg-surface-base/80 backdrop-blur-xl border border-cyan-500/10">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <FileText className="w-5 h-5 text-cyan-400" />
                  Completeness
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { label: 'lastmod', value: result.stats.withLastmod, icon: Clock },
                  { label: 'changefreq', value: result.stats.withChangefreq, icon: Clock },
                  { label: 'priority', value: result.stats.withPriority, icon: LinkIcon },
                ].map(({ label, value, icon: Icon }) => (
                  <div key={label} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Icon className="w-4 h-4 text-gray-400" />
                      <span className="text-gray-300 text-sm">URLs with <code className="text-cyan-400">&lt;{label}&gt;</code></span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-white font-medium">{value}/{result.urlCount}</span>
                      <span className={`text-xs ${value === result.urlCount ? 'text-green-400' : 'text-yellow-400'}`}>
                        ({Math.round((value / Math.max(result.urlCount, 1)) * 100)}%)
                      </span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* URL List */}
            <Card className="bg-surface-base/80 backdrop-blur-xl border border-cyan-500/10">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <LinkIcon className="w-5 h-5 text-cyan-400" />
                  URLs ({result.urlCount})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="max-h-96 overflow-y-auto space-y-1">
                  {result.urls.slice(0, 100).map((entry, i) => (
                    <div key={i} className="flex items-center justify-between p-2 hover:bg-white/5 rounded text-sm">
                      <span className="text-gray-300 truncate max-w-[60%]">{entry.loc}</span>
                      <div className="flex items-center gap-4 text-gray-500 text-xs">
                        {entry.lastmod && <span>{entry.lastmod}</span>}
                        {entry.priority && <span>P: {entry.priority}</span>}
                      </div>
                    </div>
                  ))}
                  {result.urlCount > 100 && (
                    <p className="text-gray-500 text-sm text-center py-2">Showing first 100 of {result.urlCount} URLs</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Empty State */}
        {!result && !isLoading && (
          <div className="text-center py-16">
            <Map className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-medium text-white mb-2">Ready to Analyze</h3>
            <p className="text-gray-400 max-w-md mx-auto">
              Enter a sitemap URL to validate its XML structure, check for duplicates, missing fields, and stale entries.
            </p>
          </div>
        )}
      </SEOFeatureGate>
    </div>
  );
}
