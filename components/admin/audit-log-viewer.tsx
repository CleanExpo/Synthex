'use client';

/**
 * Audit Log Viewer Component
 *
 * Paginated, filterable audit log table.
 * Data source: /api/admin/audit-log (SWR with query params as SWR key)
 *
 * Filters: category, severity, date range
 * Pagination: previous / next buttons
 */

import { useState, useCallback } from 'react';
import useSWR from 'swr';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ChevronLeft, ChevronRight, RefreshCw } from '@/components/icons';
import { AuditLogDrawer } from './audit-log-drawer';

// =============================================================================
// Types
// =============================================================================

interface AuditLogEntry {
  id: string;
  createdAt: string;
  userId: string;
  action: string;
  resource: string;
  resourceId?: string | null;
  details?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: string;
  outcome: 'success' | 'failure';
  user?: { id: string; email: string; name?: string | null } | null;
}

interface AuditLogApiResponse {
  success: boolean;
  data?: AuditLogEntry[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
  stats?: {
    severity: Record<string, number>;
    total: number;
  };
}

// =============================================================================
// Constants
// =============================================================================

const CATEGORIES = [
  { value: 'all', label: 'All Categories' },
  { value: 'auth', label: 'Auth' },
  { value: 'admin', label: 'Admin' },
  { value: 'content', label: 'Content' },
  { value: 'billing', label: 'Billing' },
  { value: 'system', label: 'System' },
];

const SEVERITIES = [
  { value: 'all', label: 'All Severities' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
];

const OUTCOMES = [
  { value: 'all', label: 'All Outcomes' },
  { value: 'success', label: 'Success' },
  { value: 'failure', label: 'Failure' },
];

const SEVERITY_COLOURS: Record<string, string> = {
  low: 'bg-gray-500/20 text-gray-300',
  medium: 'bg-yellow-500/20 text-yellow-400',
  high: 'bg-orange-500/20 text-orange-400',
  critical: 'bg-red-500/20 text-red-400',
};

const OUTCOME_COLOURS: Record<string, string> = {
  success: 'bg-green-500/20 text-green-400',
  failure: 'bg-red-500/20 text-red-400',
};

// =============================================================================
// Fetcher
// =============================================================================

function fetchJson(url: string) {
  return fetch(url, { credentials: 'include' }).then((r) => r.json());
}

// =============================================================================
// Component
// =============================================================================

export function AuditLogViewer() {
  const [page, setPage] = useState(1);
  const [category, setCategory] = useState('all');
  const [severity, setSeverity] = useState('all');
  const [outcome, setOutcome] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedEntry, setSelectedEntry] = useState<AuditLogEntry | null>(null);

  const limit = 25;

  // Build SWR key from filter state — changing filters resets to page 1
  const buildUrl = useCallback(() => {
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
      category,
      severity,
      outcome,
    });
    if (startDate) params.set('startDate', new Date(startDate).toISOString());
    if (endDate) {
      // Set end-of-day for the end date
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      params.set('endDate', end.toISOString());
    }
    return `/api/admin/audit-log?${params.toString()}`;
  }, [page, category, severity, outcome, startDate, endDate]);

  const swrKey = buildUrl();

  const { data, isLoading, mutate } = useSWR<AuditLogApiResponse>(swrKey, fetchJson);

  const logs = data?.data ?? [];
  const pagination = data?.pagination;

  // Reset page when filters change
  const handleFilterChange = useCallback(
    (setter: (v: string) => void) => (value: string) => {
      setPage(1);
      setter(value);
    },
    []
  );

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <Card variant="glass">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Audit Log</CardTitle>
            <CardDescription>
              System events — {pagination?.total ?? 0} total entries
            </CardDescription>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => mutate()}
            className="text-gray-400 hover:text-white"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* ---------------------------------------------------------------- */}
        {/* Filters                                                          */}
        {/* ---------------------------------------------------------------- */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="space-y-1">
            <Label className="text-xs text-gray-400">Category</Label>
            <Select value={category} onValueChange={handleFilterChange(setCategory)}>
              <SelectTrigger className="bg-white/5 border-white/10 text-white text-sm h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-gray-400">Severity</Label>
            <Select value={severity} onValueChange={handleFilterChange(setSeverity)}>
              <SelectTrigger className="bg-white/5 border-white/10 text-white text-sm h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SEVERITIES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-gray-400">Outcome</Label>
            <Select value={outcome} onValueChange={handleFilterChange(setOutcome)}>
              <SelectTrigger className="bg-white/5 border-white/10 text-white text-sm h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {OUTCOMES.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-gray-400">From</Label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => { setPage(1); setStartDate(e.target.value); }}
              className="bg-white/5 border-white/10 text-white text-sm h-8"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-gray-400">To</Label>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => { setPage(1); setEndDate(e.target.value); }}
              className="bg-white/5 border-white/10 text-white text-sm h-8"
            />
          </div>
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Table                                                            */}
        {/* ---------------------------------------------------------------- */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10">
                <th scope="col" className="text-left py-2 px-3 text-gray-400 font-medium">Timestamp</th>
                <th scope="col" className="text-left py-2 px-3 text-gray-400 font-medium">User</th>
                <th scope="col" className="text-left py-2 px-3 text-gray-400 font-medium">Action</th>
                <th scope="col" className="text-left py-2 px-3 text-gray-400 font-medium">Resource</th>
                <th scope="col" className="text-left py-2 px-3 text-gray-400 font-medium">Severity</th>
                <th scope="col" className="text-left py-2 px-3 text-gray-400 font-medium">Outcome</th>
                <th scope="col" className="w-8" aria-label="Row actions" />
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-gray-400">
                    Loading audit log...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-gray-400">
                    No audit log entries found
                  </td>
                </tr>
              ) : (
                logs.map((entry) => (
                  <tr
                    key={entry.id}
                    role="button"
                    tabIndex={0}
                    aria-label={`View audit log: ${entry.action} — ${entry.user?.email ?? entry.userId.slice(0, 8)}`}
                    className="border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-cyan-500"
                    onClick={() => setSelectedEntry(entry)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setSelectedEntry(entry);
                      }
                    }}
                  >
                    <td className="py-2 px-3 text-gray-400 whitespace-nowrap text-xs">
                      {new Date(entry.createdAt).toLocaleString()}
                    </td>
                    <td className="py-2 px-3">
                      {entry.user ? (
                        <span className="text-white text-xs">
                          {entry.user.email}
                        </span>
                      ) : (
                        <span className="text-gray-500 text-xs font-mono">
                          {entry.userId.slice(0, 8)}…
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-white font-mono text-xs">
                      {entry.action}
                    </td>
                    <td className="py-2 px-3 text-gray-300 text-xs">
                      {entry.resource}
                      {entry.resourceId && (
                        <span className="text-gray-500 ml-1 font-mono">
                          #{entry.resourceId.slice(0, 8)}
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-3">
                      <Badge
                        className={`text-xs ${SEVERITY_COLOURS[entry.severity] ?? 'bg-gray-500/20 text-gray-300'}`}
                      >
                        {entry.severity}
                      </Badge>
                    </td>
                    <td className="py-2 px-3">
                      <Badge
                        className={`text-xs ${OUTCOME_COLOURS[entry.outcome] ?? 'bg-gray-500/20 text-gray-300'}`}
                      >
                        {entry.outcome}
                      </Badge>
                    </td>
                    <td className="py-2 px-1 text-gray-600">
                      <ChevronRight className="w-3 h-3" />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Pagination                                                       */}
        {/* ---------------------------------------------------------------- */}
        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-between pt-2">
            <p className="text-xs text-gray-400">
              Page {pagination.page} of {pagination.totalPages} — {pagination.total} entries
            </p>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1 || isLoading}
                className="text-gray-400 hover:text-white"
              >
                <ChevronLeft className="w-4 h-4" />
                Previous
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setPage((p) => p + 1)}
                disabled={!pagination.hasMore || isLoading}
                className="text-gray-400 hover:text-white"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>

      {/* Audit log detail drawer */}
      <AuditLogDrawer
        entry={selectedEntry}
        open={!!selectedEntry}
        onClose={() => setSelectedEntry(null)}
      />
    </Card>
  );
}
