'use client';

/**
 * OpportunityPipeline — Phase 99
 *
 * Priority-sorted list of items needing user attention across all v5.0 modules.
 * Empty state shows "All clear" when no action items exist.
 */

import Link from 'next/link';
import { CheckCircle, AlertCircle, AlertTriangle, Info } from '@/components/icons';
import type { OpportunityItem } from '@/lib/citation/aggregator';

interface OpportunityPipelineProps {
  items: OpportunityItem[];
  loading?: boolean;
}

interface SeverityConfig {
  chip: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}

const SEVERITY: Record<string, SeverityConfig> = {
  critical: {
    chip: 'bg-red-500/10 text-red-400 border border-red-500/20',
    icon: AlertCircle,
    label: 'Critical',
  },
  warning: {
    chip: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
    icon: AlertTriangle,
    label: 'Warning',
  },
  info: {
    chip: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
    icon: Info,
    label: 'Info',
  },
};

export function OpportunityPipeline({
  items,
  loading = false,
}: OpportunityPipelineProps) {
  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-white/[0.02]">
            <div className="h-5 w-16 rounded-full bg-white/5 animate-pulse flex-shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 bg-white/5 animate-pulse rounded w-3/4" />
              <div className="h-2.5 bg-white/5 animate-pulse rounded w-full" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <CheckCircle className="w-8 h-8 text-emerald-500 mb-2" />
        <p className="text-sm font-medium text-emerald-400">All clear</p>
        <p className="text-xs text-gray-500 mt-1">No action items across all modules</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {items.map((item) => {
        const sev = SEVERITY[item.severity] ?? SEVERITY.info;
        const SeverityIcon = sev.icon;

        return (
          <div
            key={item.id}
            className="flex items-start gap-3 p-3 rounded-lg bg-white/[0.02] border border-white/[0.05] hover:bg-white/[0.04] transition-colors"
          >
            {/* Severity chip */}
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${sev.chip}`}
            >
              <SeverityIcon className="w-3 h-3" />
              {sev.label}
            </span>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{item.title}</p>
              <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">
                {item.description}
              </p>
            </div>

            {/* Go link */}
            <Link
              href={item.href}
              className="flex-shrink-0 text-xs text-cyan-400 hover:text-cyan-300 font-medium transition-colors whitespace-nowrap"
              aria-label={`Go to ${item.title}`}
            >
              Go →
            </Link>
          </div>
        );
      })}
    </div>
  );
}
