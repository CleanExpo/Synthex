'use client';

/**
 * Anomaly Alerts Widget — displays unacknowledged metric anomalies
 *
 * UNI-1611
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAnomalies, type AnomalyItem } from '@/hooks/useAnomalies';
import { AlertTriangle, CheckCircle, Loader2 } from '@/components/icons';
import { cn } from '@/lib/utils';

// ── Severity styling ─────────────────────────────────────────────────────────

const severityConfig: Record<
  AnomalyItem['severity'],
  { label: string; className: string }
> = {
  critical: {
    label: 'Critical',
    className: 'bg-red-500/20 text-red-400 border-red-500/30',
  },
  high: {
    label: 'High',
    className: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  },
  medium: {
    label: 'Medium',
    className: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  },
  low: {
    label: 'Low',
    className: 'bg-gray-500/20 text-gray-300 border-gray-500/30',
  },
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleString('en-AU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatMetricType(metricType: string): string {
  return metricType.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function countBySeverity(
  anomalies: AnomalyItem[]
): Record<AnomalyItem['severity'], number> {
  const counts: Record<AnomalyItem['severity'], number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  };
  for (const a of anomalies) {
    counts[a.severity]++;
  }
  return counts;
}

// ── Main Widget ──────────────────────────────────────────────────────────────

export function AnomalyAlerts() {
  const { anomalies, total, isLoading, error, acknowledge } = useAnomalies();
  const [acknowledging, setAcknowledging] = useState<string | null>(null);

  const handleAcknowledge = async (anomalyId: string) => {
    try {
      setAcknowledging(anomalyId);
      await acknowledge(anomalyId);
    } catch {
      // Error is surfaced via the hook; reset state
    } finally {
      setAcknowledging(null);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <Card className="border-[0.5px] border-white/[0.06] bg-white/[0.01] rounded-sm">
        <CardContent className="p-6 flex items-center justify-center">
          <Loader2 className="w-5 h-5 text-orange-400 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  // Error state — hide silently
  if (error) {
    return null;
  }

  // Empty state
  if (anomalies.length === 0) {
    return (
      <Card className="border-[0.5px] border-white/[0.06] bg-white/[0.01] rounded-sm">
        <CardContent className="p-6 flex items-center justify-center gap-2 text-sm text-gray-300">
          <CheckCircle className="w-4 h-4 text-emerald-400" />
          No anomalies detected
        </CardContent>
      </Card>
    );
  }

  const severityCounts = countBySeverity(anomalies);
  const displayAnomalies = anomalies.slice(0, 5);

  return (
    <Card className="border-[0.5px] border-white/[0.06] bg-white/[0.01] rounded-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg text-white flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-orange-400" />
          Anomaly Alerts
          <Badge className="bg-orange-500/20 text-orange-400 text-xs ml-1">
            {total}
          </Badge>
        </CardTitle>

        {/* Severity summary */}
        <div className="flex items-center gap-2 pt-1">
          {(
            ['critical', 'high', 'medium', 'low'] as AnomalyItem['severity'][]
          ).map(
            severity =>
              severityCounts[severity] > 0 && (
                <Badge
                  key={severity}
                  variant="outline"
                  className={cn(
                    'text-[10px] px-1.5 py-0',
                    severityConfig[severity].className
                  )}
                >
                  {severityCounts[severity]} {severityConfig[severity].label}
                </Badge>
              )
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-2 pt-0">
        {displayAnomalies.map(anomaly => (
          <div
            key={anomaly.id}
            className="flex items-start gap-3 p-3 rounded-sm bg-white/[0.02] border border-white/[0.04]"
          >
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className={cn(
                    'text-[10px] px-1.5 py-0 shrink-0',
                    severityConfig[anomaly.severity].className
                  )}
                >
                  {severityConfig[anomaly.severity].label}
                </Badge>
                <span className="text-sm text-white truncate">
                  {formatMetricType(anomaly.metricType)}
                </span>
              </div>

              <div className="flex items-center gap-3 text-xs text-gray-300">
                <span
                  className={cn(
                    'font-medium',
                    anomaly.deviationPercent > 0
                      ? 'text-red-400'
                      : 'text-emerald-400'
                  )}
                >
                  {anomaly.deviationPercent > 0 ? '+' : ''}
                  {anomaly.deviationPercent.toFixed(1)}% deviation
                </span>
                <span>{formatTimestamp(anomaly.detectedAt)}</span>
              </div>
            </div>

            <Button
              variant="ghost"
              size="sm"
              className="shrink-0 text-xs text-gray-300 hover:text-white h-7 px-2"
              disabled={acknowledging === anomaly.id}
              onClick={() => handleAcknowledge(anomaly.id)}
            >
              {acknowledging === anomaly.id ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                'Acknowledge'
              )}
            </Button>
          </div>
        ))}

        {total > 5 && (
          <p className="text-xs text-gray-500 text-center pt-1">
            Showing 5 of {total} unacknowledged anomalies
          </p>
        )}
      </CardContent>
    </Card>
  );
}
