'use client';

/**
 * Alert Feed Component
 *
 * Displays a paginated list of SentinelAlert records with:
 * - Severity icon + colour coding (critical=red, warning=amber, info=blue)
 * - Alert type badge
 * - Metric change display
 * - Acknowledge button
 * - Empty state
 */

import { useState } from 'react';
import { ExclamationCircleIcon as AlertCircle } from '@heroicons/react/24/outline';
import { CheckCircleIcon } from '@heroicons/react/24/outline';

interface SentinelAlert {
  id: string;
  alertType: string;
  severity: string;
  title: string;
  description: string;
  metric: string | null;
  previousValue: number | null;
  currentValue: number | null;
  changePercent: number | null;
  relatedUpdateId: string | null;
  acknowledged: boolean;
  createdAt: string;
}

interface AlertFeedProps {
  alerts: SentinelAlert[];
  onAcknowledge: (id: string) => Promise<void>;
  loading?: boolean;
}

const SEVERITY_CONFIG = {
  critical: {
    containerClass: 'border-red-500/30 bg-red-500/5',
    iconClass: 'text-red-400',
    badgeClass: 'bg-red-500/20 text-red-300',
    label: 'Critical',
  },
  warning: {
    containerClass: 'border-amber-500/30 bg-amber-500/5',
    iconClass: 'text-amber-400',
    badgeClass: 'bg-amber-500/20 text-amber-300',
    label: 'Warning',
  },
  info: {
    containerClass: 'border-blue-500/30 bg-blue-500/5',
    iconClass: 'text-blue-400',
    badgeClass: 'bg-blue-500/20 text-blue-300',
    label: 'Info',
  },
} as const;

const ALERT_TYPE_LABELS: Record<string, string> = {
  'ranking-drop': 'Ranking Drop',
  'traffic-drop': 'Traffic Drop',
  'crawl-error-spike': 'Crawl Errors',
  'cwv-regression': 'CWV Regression',
  'algorithm-update': 'Algorithm Update',
};

function MetricChange({
  metric,
  previousValue,
  currentValue,
  changePercent,
  alertType,
}: {
  metric: string | null;
  previousValue: number | null;
  currentValue: number | null;
  changePercent: number | null;
  alertType: string;
}) {
  if (metric === null || previousValue === null || currentValue === null) return null;

  const isPositiveBad = alertType === 'ranking-drop' || alertType === 'crawl-error-spike';
  const change = changePercent !== null ? Math.abs(changePercent).toFixed(0) : null;
  const increased = currentValue > previousValue;
  const isBad = isPositiveBad ? increased : !increased;

  const metricLabels: Record<string, string> = {
    avgPosition: 'Avg Position',
    totalClicks: 'Total Clicks',
    coverageErrors: 'Crawl Errors',
    lcp: 'LCP',
    inp: 'INP',
    cls: 'CLS',
  };

  const label = metricLabels[metric] ?? metric;
  const fmtVal = (v: number) => {
    if (metric === 'lcp') return `${v.toFixed(1)}s`;
    if (metric === 'inp') return `${v}ms`;
    if (metric === 'cls') return v.toFixed(2);
    if (metric === 'avgPosition') return v.toFixed(1);
    return v.toLocaleString();
  };

  return (
    <div className={`mt-2 text-sm font-mono ${isBad ? 'text-red-400' : 'text-emerald-400'}`}>
      {label}: {fmtVal(previousValue)} → {fmtVal(currentValue)}
      {change && (
        <span className="ml-2 text-xs opacity-80">
          ({increased ? '+' : '-'}{change}%)
        </span>
      )}
    </div>
  );
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function AlertFeed({ alerts, onAcknowledge, loading = false }: AlertFeedProps) {
  const [acknowledging, setAcknowledging] = useState<Set<string>>(new Set());

  const handleAcknowledge = async (id: string) => {
    setAcknowledging((prev) => new Set(prev).add(id));
    try {
      await onAcknowledge(id);
    } finally {
      setAcknowledging((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 rounded-lg bg-white/5 animate-pulse" />
        ))}
      </div>
    );
  }

  if (alerts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <CheckCircleIcon className="w-12 h-12 text-emerald-400 mb-3" />
        <p className="text-lg font-medium text-white">No alerts — your site is healthy</p>
        <p className="text-sm text-gray-400 mt-1">
          Sentinel will notify you when regressions are detected.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {alerts.map((alert) => {
        const config =
          SEVERITY_CONFIG[alert.severity as keyof typeof SEVERITY_CONFIG] ??
          SEVERITY_CONFIG.info;
        const typeLabel = ALERT_TYPE_LABELS[alert.alertType] ?? alert.alertType;

        return (
          <div
            key={alert.id}
            className={`relative rounded-lg border p-4 transition-opacity ${config.containerClass} ${
              alert.acknowledged ? 'opacity-50' : ''
            }`}
          >
            <div className="flex items-start gap-3">
              {/* Severity icon */}
              <AlertCircle className={`w-5 h-5 mt-0.5 flex-shrink-0 ${config.iconClass}`} />

              <div className="flex-1 min-w-0">
                {/* Header row */}
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="font-medium text-white text-sm">{alert.title}</span>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${config.badgeClass}`}>
                    {config.label}
                  </span>
                  <span className="px-2 py-0.5 rounded text-xs bg-white/10 text-gray-300">
                    {typeLabel}
                  </span>
                </div>

                {/* Description */}
                <p className="text-sm text-gray-300 leading-relaxed">{alert.description}</p>

                {/* Metric change */}
                <MetricChange
                  metric={alert.metric}
                  previousValue={alert.previousValue}
                  currentValue={alert.currentValue}
                  changePercent={alert.changePercent}
                  alertType={alert.alertType}
                />

                {/* Footer */}
                <div className="flex items-center justify-between mt-3">
                  <span className="text-xs text-gray-500">{formatDate(alert.createdAt)}</span>
                  {!alert.acknowledged && (
                    <button
                      onClick={() => handleAcknowledge(alert.id)}
                      disabled={acknowledging.has(alert.id)}
                      className="text-xs px-3 py-1 rounded bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white transition-colors disabled:opacity-50"
                    >
                      {acknowledging.has(alert.id) ? 'Acknowledging...' : 'Acknowledge'}
                    </button>
                  )}
                  {alert.acknowledged && (
                    <span className="text-xs text-gray-500 flex items-center gap-1">
                      <CheckCircleIcon className="w-3 h-3" />
                      Acknowledged
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
