'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SEOFeatureGate } from '@/components/seo';
import {
  useSearchConsole,
  type SearchAnalyticsRow,
  type IndexingInspection,
  type SitemapInfo,
} from '@/hooks/useSearchConsole';
import {
  ArrowLeft,
  BarChart3,
  Search,
  Loader2,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  Globe,
  ExternalLink,
} from '@/components/icons';

// ============================================================================
// Date Range Helpers
// ============================================================================

type DateRange = '7d' | '28d' | '3mo' | '6mo';

function getDateRange(range: DateRange): { startDate: string; endDate: string } {
  const end = new Date();
  const start = new Date();

  switch (range) {
    case '7d':
      start.setDate(end.getDate() - 7);
      break;
    case '28d':
      start.setDate(end.getDate() - 28);
      break;
    case '3mo':
      start.setMonth(end.getMonth() - 3);
      break;
    case '6mo':
      start.setMonth(end.getMonth() - 6);
      break;
  }

  return {
    startDate: start.toISOString().split('T')[0],
    endDate: end.toISOString().split('T')[0],
  };
}

// ============================================================================
// Search Performance Section
// ============================================================================

type Dimension = 'query' | 'page' | 'country' | 'device';

function SearchPerformanceSection({
  analytics,
  loading,
  error,
  onFetch,
}: {
  analytics: ReturnType<typeof useSearchConsole>['searchAnalytics'];
  loading: boolean;
  error: string | null;
  onFetch: (siteUrl: string, options: { startDate: string; endDate: string; dimensions: string[]; rowLimit: number }) => void;
}) {
  const [siteUrl, setSiteUrl] = useState(
    typeof window !== 'undefined'
      ? (process.env.NEXT_PUBLIC_APP_URL || '')
      : ''
  );
  const [dateRange, setDateRange] = useState<DateRange>('28d');
  const [dimension, setDimension] = useState<Dimension>('query');

  const handleFetch = () => {
    if (!siteUrl.trim()) return;
    const normalizedUrl = siteUrl.startsWith('http') ? siteUrl : `https://${siteUrl}`;
    const { startDate, endDate } = getDateRange(dateRange);
    onFetch(normalizedUrl, {
      startDate,
      endDate,
      dimensions: [dimension],
      rowLimit: 25,
    });
  };

  const handleDateRangeChange = (range: DateRange) => {
    setDateRange(range);
    if (siteUrl.trim()) {
      const normalizedUrl = siteUrl.startsWith('http') ? siteUrl : `https://${siteUrl}`;
      const { startDate, endDate } = getDateRange(range);
      onFetch(normalizedUrl, {
        startDate,
        endDate,
        dimensions: [dimension],
        rowLimit: 25,
      });
    }
  };

  const handleDimensionChange = (dim: Dimension) => {
    setDimension(dim);
    if (siteUrl.trim()) {
      const normalizedUrl = siteUrl.startsWith('http') ? siteUrl : `https://${siteUrl}`;
      const { startDate, endDate } = getDateRange(dateRange);
      onFetch(normalizedUrl, {
        startDate,
        endDate,
        dimensions: [dim],
        rowLimit: 25,
      });
    }
  };

  const dimensionLabels: Record<Dimension, string> = {
    query: 'Queries',
    page: 'Pages',
    country: 'Countries',
    device: 'Devices',
  };

  return (
    <div className="space-y-4">
      {/* Site URL + Fetch */}
      <div className="flex gap-3">
        <Input
          type="text"
          value={siteUrl}
          onChange={(e) => setSiteUrl(e.target.value)}
          placeholder="Enter site URL (e.g., https://example.com)"
          className="flex-1 bg-white/5 border-white/10 text-white placeholder:text-gray-500"
        />
        <Button
          onClick={handleFetch}
          disabled={loading || !siteUrl.trim()}
          className="bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-white"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4 mr-2" />}
          {loading ? 'Loading...' : 'Fetch Data'}
        </Button>
      </div>

      {/* Date Range Selector */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-400 mr-2">Period:</span>
        {(['7d', '28d', '3mo', '6mo'] as DateRange[]).map((range) => (
          <Button
            key={range}
            variant="outline"
            size="sm"
            onClick={() => handleDateRangeChange(range)}
            className={`text-xs ${
              dateRange === range
                ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-400'
                : 'border-white/10 text-gray-400 hover:bg-white/5'
            }`}
          >
            {range === '7d' ? 'Last 7 days' : range === '28d' ? 'Last 28 days' : range === '3mo' ? 'Last 3 months' : 'Last 6 months'}
          </Button>
        ))}
      </div>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      {analytics ? (
        <div className="space-y-4">
          {/* Summary Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard label="Total Clicks" value={analytics.totals.clicks.toLocaleString()} />
            <MetricCard label="Total Impressions" value={analytics.totals.impressions.toLocaleString()} />
            <MetricCard label="Average CTR" value={`${(analytics.totals.ctr * 100).toFixed(2)}%`} />
            <MetricCard label="Average Position" value={analytics.totals.position.toFixed(1)} />
          </div>

          {/* Dimension Toggle */}
          <div className="flex items-center gap-2 border-b border-white/10 pb-2">
            {(['query', 'page', 'country', 'device'] as Dimension[]).map((dim) => (
              <button
                key={dim}
                onClick={() => handleDimensionChange(dim)}
                className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                  dimension === dim
                    ? 'bg-cyan-500/20 text-cyan-400'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                {dimensionLabels[dim]}
              </button>
            ))}
          </div>

          {/* Data Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-3 px-2 text-gray-400 font-medium">
                    {dimensionLabels[dimension].slice(0, -1)}
                  </th>
                  <th className="text-right py-3 px-2 text-gray-400 font-medium">Clicks</th>
                  <th className="text-right py-3 px-2 text-gray-400 font-medium">Impressions</th>
                  <th className="text-right py-3 px-2 text-gray-400 font-medium">CTR</th>
                  <th className="text-right py-3 px-2 text-gray-400 font-medium">Position</th>
                </tr>
              </thead>
              <tbody>
                {analytics.rows.map((row: SearchAnalyticsRow, i: number) => (
                  <tr key={i} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="py-2.5 px-2 text-white font-mono text-xs truncate max-w-[300px]">
                      {row.keys.join(', ')}
                    </td>
                    <td className="py-2.5 px-2 text-right text-cyan-400 font-medium">
                      {row.clicks.toLocaleString()}
                    </td>
                    <td className="py-2.5 px-2 text-right text-gray-300">
                      {row.impressions.toLocaleString()}
                    </td>
                    <td className="py-2.5 px-2 text-right text-gray-300">
                      {(row.ctr * 100).toFixed(2)}%
                    </td>
                    <td className="py-2.5 px-2 text-right text-gray-300">
                      {row.position.toFixed(1)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {analytics.rows.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No data found for the selected period and dimension.
            </div>
          )}
        </div>
      ) : !loading && !error ? (
        <div className="text-center py-12">
          <Globe className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">Connect Google Search Console</h3>
          <p className="text-gray-400 mb-2">
            Enter your site URL and click Fetch Data to see search performance data.
          </p>
          <p className="text-xs text-gray-500">
            Requires Google Search Console API credentials to be configured.
          </p>
        </div>
      ) : null}
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-4 bg-white/5 rounded-lg">
      <p className="text-sm text-gray-400 mb-1">{label}</p>
      <p className="text-2xl font-bold text-white">{value}</p>
    </div>
  );
}

// ============================================================================
// Indexing Status Section
// ============================================================================

function IndexingStatusSection({
  onCheck,
  result,
  loading,
  error,
}: {
  onCheck: (siteUrl: string, inspectionUrl: string) => void;
  result: IndexingInspection | null;
  loading: boolean;
  error: string | null;
}) {
  const [siteUrl, setSiteUrl] = useState(
    typeof window !== 'undefined'
      ? (process.env.NEXT_PUBLIC_APP_URL || '')
      : ''
  );
  const [inspectionUrl, setInspectionUrl] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!siteUrl.trim() || !inspectionUrl.trim()) return;
    const normalizedSite = siteUrl.startsWith('http') ? siteUrl : `https://${siteUrl}`;
    const normalizedUrl = inspectionUrl.startsWith('http') ? inspectionUrl : `https://${inspectionUrl}`;
    onCheck(normalizedSite, normalizedUrl);
  };

  function getStatusBadge(state: string) {
    const lowerState = state.toLowerCase();
    if (lowerState.includes('submitted_and_indexed') || lowerState === 'pass' || lowerState.includes('indexed')) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-500/10 text-green-400 rounded-full text-sm font-medium border border-green-500/20">
          <CheckCircle className="w-4 h-4" />
          {state.replace(/_/g, ' ')}
        </span>
      );
    }
    if (lowerState.includes('crawled') || lowerState.includes('discovered') || lowerState === 'neutral') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-yellow-500/10 text-yellow-400 rounded-full text-sm font-medium border border-yellow-500/20">
          <AlertTriangle className="w-4 h-4" />
          {state.replace(/_/g, ' ')}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-red-500/10 text-red-400 rounded-full text-sm font-medium border border-red-500/20">
        <AlertTriangle className="w-4 h-4" />
        {state.replace(/_/g, ' ')}
      </span>
    );
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="flex gap-3">
          <Input
            type="text"
            value={siteUrl}
            onChange={(e) => setSiteUrl(e.target.value)}
            placeholder="Site URL (e.g., https://example.com)"
            className="flex-1 bg-white/5 border-white/10 text-white placeholder:text-gray-500"
          />
        </div>
        <div className="flex gap-3">
          <Input
            type="text"
            value={inspectionUrl}
            onChange={(e) => setInspectionUrl(e.target.value)}
            placeholder="Page URL to inspect (e.g., https://example.com/page)"
            className="flex-1 bg-white/5 border-white/10 text-white placeholder:text-gray-500"
          />
          <Button
            type="submit"
            disabled={loading || !siteUrl.trim() || !inspectionUrl.trim()}
            className="bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-white"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4 mr-2" />}
            {loading ? 'Checking...' : 'Check Status'}
          </Button>
        </div>
      </form>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      {result && (
        <div className="space-y-4">
          {/* Indexing State */}
          <div className="flex flex-wrap items-center gap-3">
            {getStatusBadge(result.indexingState)}
            {result.verdict && result.verdict !== 'UNKNOWN' && (
              <span className="text-sm text-gray-400">
                Verdict: {result.verdict.replace(/_/g, ' ')}
              </span>
            )}
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-white/5 rounded-lg">
              <h4 className="text-sm font-medium text-gray-400 mb-2">Crawl State</h4>
              <p className="text-white font-medium">{result.crawlState.replace(/_/g, ' ')}</p>
            </div>
            <div className="p-4 bg-white/5 rounded-lg">
              <h4 className="text-sm font-medium text-gray-400 mb-2">Last Crawl Time</h4>
              <p className="text-white font-medium">
                {result.lastCrawlTime
                  ? new Date(result.lastCrawlTime).toLocaleString()
                  : 'Not available'}
              </p>
            </div>
            <div className="p-4 bg-white/5 rounded-lg">
              <h4 className="text-sm font-medium text-gray-400 mb-2">Robots.txt State</h4>
              <p className="text-white font-medium">{result.robotsTxtState.replace(/_/g, ' ')}</p>
            </div>
            <div className="p-4 bg-white/5 rounded-lg">
              <h4 className="text-sm font-medium text-gray-400 mb-2">Page Fetch State</h4>
              <p className="text-white font-medium">{result.pageFetchState.replace(/_/g, ' ')}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Sitemap Health Section
// ============================================================================

function SitemapHealthSection({
  sitemaps,
  loading,
  error,
  onFetch,
}: {
  sitemaps: SitemapInfo[];
  loading: boolean;
  error: string | null;
  onFetch: (siteUrl: string) => void;
}) {
  const [siteUrl, setSiteUrl] = useState(
    typeof window !== 'undefined'
      ? (process.env.NEXT_PUBLIC_APP_URL || '')
      : ''
  );

  const handleFetch = () => {
    if (!siteUrl.trim()) return;
    const normalizedUrl = siteUrl.startsWith('http') ? siteUrl : `https://${siteUrl}`;
    onFetch(normalizedUrl);
  };

  function getSitemapStatusIcon(sitemap: SitemapInfo) {
    if (sitemap.errors > 0) {
      return <AlertTriangle className="w-4 h-4 text-red-400" />;
    }
    if (sitemap.warnings > 0 || sitemap.isPending) {
      return <AlertTriangle className="w-4 h-4 text-yellow-400" />;
    }
    return <CheckCircle className="w-4 h-4 text-green-400" />;
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <Input
          type="text"
          value={siteUrl}
          onChange={(e) => setSiteUrl(e.target.value)}
          placeholder="Enter site URL (e.g., https://example.com)"
          className="flex-1 bg-white/5 border-white/10 text-white placeholder:text-gray-500"
        />
        <Button
          onClick={handleFetch}
          disabled={loading || !siteUrl.trim()}
          className="bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-white"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
          {loading ? 'Loading...' : 'Load Sitemaps'}
        </Button>
      </div>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      {sitemaps.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left py-3 px-2 text-gray-400 font-medium">Status</th>
                <th className="text-left py-3 px-2 text-gray-400 font-medium">Sitemap Path</th>
                <th className="text-left py-3 px-2 text-gray-400 font-medium">Last Submitted</th>
                <th className="text-right py-3 px-2 text-gray-400 font-medium">Warnings</th>
                <th className="text-right py-3 px-2 text-gray-400 font-medium">Errors</th>
              </tr>
            </thead>
            <tbody>
              {sitemaps.map((sitemap: SitemapInfo, i: number) => (
                <tr key={i} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                  <td className="py-2.5 px-2">
                    {getSitemapStatusIcon(sitemap)}
                  </td>
                  <td className="py-2.5 px-2 text-white font-mono text-xs truncate max-w-[300px]">
                    {sitemap.path}
                    {sitemap.isSitemapsIndex && (
                      <span className="ml-2 px-1.5 py-0.5 bg-cyan-500/10 text-cyan-400 rounded text-[10px] font-medium">
                        INDEX
                      </span>
                    )}
                    {sitemap.isPending && (
                      <span className="ml-2 px-1.5 py-0.5 bg-yellow-500/10 text-yellow-400 rounded text-[10px] font-medium">
                        PENDING
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 px-2 text-gray-300 text-xs">
                    {sitemap.lastSubmitted
                      ? new Date(sitemap.lastSubmitted).toLocaleDateString()
                      : 'N/A'}
                  </td>
                  <td className="py-2.5 px-2 text-right">
                    <span className={sitemap.warnings > 0 ? 'text-yellow-400' : 'text-gray-500'}>
                      {sitemap.warnings}
                    </span>
                  </td>
                  <td className="py-2.5 px-2 text-right">
                    <span className={sitemap.errors > 0 ? 'text-red-400' : 'text-gray-500'}>
                      {sitemap.errors}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : !loading && !error ? (
        <div className="text-center py-8">
          <Globe className="w-10 h-10 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">
            No sitemaps found. Enter your site URL and click Load Sitemaps.
          </p>
        </div>
      ) : null}
    </div>
  );
}

// ============================================================================
// Page Component
// ============================================================================

export default function SearchConsolePage() {
  const {
    searchAnalytics,
    analyticsLoading,
    analyticsError,
    fetchAnalytics,
    indexingResult,
    indexingLoading,
    indexingError,
    checkIndexingStatus,
    sitemapStatus,
    sitemapLoading,
    sitemapError,
    fetchSitemaps,
  } = useSearchConsole();

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <Link
            href="/dashboard/seo"
            className="text-sm text-gray-400 hover:text-cyan-400 flex items-center gap-1 mb-2 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to SEO Tools
          </Link>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <BarChart3 className="w-8 h-8 text-cyan-400" />
            Search Console
          </h1>
          <p className="text-gray-400 mt-2">
            Search performance, indexing coverage, and sitemap health
          </p>
        </div>
      </div>

      <SEOFeatureGate
        feature="Search Console"
        requiredPlan="professional"
        description="Access Google Search Console data including search analytics, URL indexing inspection, and sitemap health monitoring."
      >
        {/* Search Performance */}
        <Card className="bg-surface-base/80 backdrop-blur-xl border border-cyan-500/10">
          <CardContent className="p-6">
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-cyan-400" />
                Search Performance
              </h2>
              <p className="text-sm text-gray-400 mt-1">
                Top queries, pages, countries, and devices from Google Search Console
              </p>
            </div>
            <SearchPerformanceSection
              analytics={searchAnalytics}
              loading={analyticsLoading}
              error={analyticsError}
              onFetch={fetchAnalytics}
            />
          </CardContent>
        </Card>

        {/* Indexing Status */}
        <Card className="bg-surface-base/80 backdrop-blur-xl border border-cyan-500/10">
          <CardContent className="p-6">
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                <Search className="w-5 h-5 text-cyan-400" />
                Indexing Status
              </h2>
              <p className="text-sm text-gray-400 mt-1">
                Check if specific URLs are indexed by Google and view crawl details
              </p>
            </div>
            <IndexingStatusSection
              onCheck={checkIndexingStatus}
              result={indexingResult}
              loading={indexingLoading}
              error={indexingError}
            />
          </CardContent>
        </Card>

        {/* Sitemap Health */}
        <Card className="bg-surface-base/80 backdrop-blur-xl border border-cyan-500/10">
          <CardContent className="p-6">
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                <Globe className="w-5 h-5 text-cyan-400" />
                Sitemap Health
              </h2>
              <p className="text-sm text-gray-400 mt-1">
                View sitemap submission status, warnings, and errors
              </p>
            </div>
            <SitemapHealthSection
              sitemaps={sitemapStatus}
              loading={sitemapLoading}
              error={sitemapError}
              onFetch={fetchSitemaps}
            />
          </CardContent>
        </Card>
      </SEOFeatureGate>
    </div>
  );
}
