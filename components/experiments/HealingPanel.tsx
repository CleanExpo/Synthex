'use client';

/**
 * HealingPanel
 *
 * URL input for self-healing analysis. Displays detected SEO issues
 * with severity badges, suggested fixes, and copy-to-clipboard functionality.
 */

import { useState } from 'react';
import useSWR from 'swr';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  Copy,
  Search,
  RefreshCw,
  ChevronDown,
} from '@/components/icons';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// ============================================================================
// Types
// ============================================================================

interface HealingIssue {
  issueType: string;
  severity: 'critical' | 'warning';
  description: string;
  currentValue?: string;
  suggestedFix: string;
  estimatedImpact: string;
}

interface HealingAnalysisResult {
  url: string;
  issues: HealingIssue[];
  issueCount: number;
  criticalCount: number;
  warningCount: number;
  analysedAt: string;
}

interface HealingAction {
  id: string;
  targetUrl: string;
  issueType: string;
  severity: string;
  description: string;
  suggestedFix: string;
  fixApplied: boolean;
  createdAt: string;
}

const fetchJson = (url: string) =>
  fetch(url, { credentials: 'include' }).then((r) => r.json());

const ISSUE_TYPE_LABELS: Record<string, string> = {
  'missing-meta': 'Missing Meta',
  'broken-schema': 'Schema Issues',
  'low-geo-score': 'Low GEO Score',
  'low-quality-score': 'Low Quality Score',
  'missing-entity': 'Missing Entity',
  'short-title': 'Short Title',
  'missing-h1': 'Missing H1',
  'weak-meta-description': 'Weak Meta Description',
};

// ============================================================================
// Issue card
// ============================================================================

function IssueCard({ issue }: { issue: HealingIssue }) {
  const [expanded, setExpanded] = useState(false);
  const isCritical = issue.severity === 'critical';

  async function copyFix() {
    await navigator.clipboard.writeText(issue.suggestedFix);
    toast.success('Fix copied to clipboard');
  }

  return (
    <div
      className={cn(
        'p-4 rounded-lg border transition-colors',
        isCritical
          ? 'bg-red-500/5 border-red-500/30'
          : 'bg-amber-500/5 border-amber-500/30'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 flex-1 min-w-0">
          {isCritical ? (
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <Badge
                className={cn(
                  'text-xs',
                  isCritical
                    ? 'bg-red-500/20 text-red-400'
                    : 'bg-amber-500/20 text-amber-400'
                )}
              >
                {isCritical ? 'Critical' : 'Warning'}
              </Badge>
              <span className="text-xs text-gray-400">
                {ISSUE_TYPE_LABELS[issue.issueType] ?? issue.issueType}
              </span>
            </div>
            <p className="text-sm text-white">{issue.description}</p>
            {issue.currentValue && (
              <p className="text-xs text-gray-500 mt-1 font-mono truncate">
                Current: {issue.currentValue}
              </p>
            )}
            <p className="text-xs text-gray-400 mt-1">
              Impact: {issue.estimatedImpact}
            </p>
          </div>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="shrink-0 text-gray-400 hover:text-white p-1"
          aria-label={expanded ? 'Collapse fix' : 'Expand fix'}
        >
          <ChevronDown
            className={cn('w-4 h-4 transition-transform', expanded && 'rotate-180')}
          />
        </button>
      </div>

      {expanded && (
        <div className="mt-3 pt-3 border-t border-white/10">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <p className="text-xs font-medium text-gray-300 mb-1">
                Suggested Fix:
              </p>
              <p className="text-xs text-gray-400 whitespace-pre-wrap">
                {issue.suggestedFix}
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={copyFix}
              className="shrink-0 text-xs h-7"
            >
              <Copy className="w-3 h-3 mr-1" />
              Copy
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function HealingPanel() {
  const [url, setUrl] = useState('');
  const [analysisResult, setAnalysisResult] = useState<HealingAnalysisResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  // Healing action history
  const { data: historyData, mutate: refreshHistory } = useSWR<{
    actions: HealingAction[];
    pagination: { total: number };
  }>('/api/experiments/healing?limit=10', fetchJson);

  const actions = historyData?.actions ?? [];

  async function handleAnalyze() {
    if (!url) return;
    setAnalyzing(true);
    try {
      const res = await fetch('/api/experiments/healing/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ url }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? 'Analysis failed');
      }
      const data = await res.json();
      setAnalysisResult(data);
      refreshHistory();
      toast.success(`Found ${data.issueCount} issue${data.issueCount === 1 ? '' : 's'}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setAnalyzing(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* URL Input */}
      <Card variant="glass">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Search className="w-4 h-4 text-cyan-400" />
            Analyse URL for Healing Opportunities
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/page"
              className="flex-1 bg-white/5 border-white/10 text-white"
              onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
            />
            <Button
              onClick={handleAnalyze}
              disabled={!url || analyzing}
              className="gradient-primary text-white shrink-0"
            >
              {analyzing ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Search className="w-4 h-4 mr-2" />
              )}
              {analyzing ? 'Analysing...' : 'Analyse'}
            </Button>
          </div>

          <p className="text-xs text-gray-500 mt-2">
            Provide optional metadata (title, meta description, GEO score) for more accurate analysis.
          </p>
        </CardContent>
      </Card>

      {/* Analysis Results */}
      {analysisResult && (
        <Card variant="glass">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">
                Issues Found: {analysisResult.issueCount}
              </CardTitle>
              <div className="flex gap-2">
                {analysisResult.criticalCount > 0 && (
                  <Badge className="bg-red-500/20 text-red-400 text-xs">
                    {analysisResult.criticalCount} Critical
                  </Badge>
                )}
                {analysisResult.warningCount > 0 && (
                  <Badge className="bg-amber-500/20 text-amber-400 text-xs">
                    {analysisResult.warningCount} Warning
                  </Badge>
                )}
              </div>
            </div>
            <p className="text-xs text-gray-400 truncate">{analysisResult.url}</p>
          </CardHeader>
          <CardContent>
            {analysisResult.issues.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-3" />
                <p className="text-white font-medium">No issues detected</p>
                <p className="text-sm text-gray-400 mt-1">
                  This page appears to have no obvious SEO healing opportunities
                  based on the provided metadata.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Critical first */}
                {[...analysisResult.issues]
                  .sort((a, b) =>
                    a.severity === 'critical' && b.severity !== 'critical' ? -1 : 1
                  )
                  .map((issue, idx) => (
                    <IssueCard key={idx} issue={issue} />
                  ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Healing Action History */}
      {actions.length > 0 && (
        <Card variant="glass">
          <CardHeader>
            <CardTitle className="text-base">Recent Analysis History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {actions.slice(0, 8).map((action) => (
                <div
                  key={action.id}
                  className="flex items-center gap-3 p-3 bg-white/5 rounded-lg"
                >
                  <div
                    className={cn(
                      'w-2 h-2 rounded-full shrink-0',
                      action.severity === 'critical' ? 'bg-red-400' : 'bg-amber-400'
                    )}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-white truncate">{action.targetUrl}</p>
                    <p className="text-xs text-gray-400 truncate">
                      {ISSUE_TYPE_LABELS[action.issueType] ?? action.issueType}
                    </p>
                  </div>
                  {action.fixApplied && (
                    <Badge className="text-xs bg-green-500/20 text-green-400 shrink-0">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Applied
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
