'use client';

/**
 * Issue Card Component
 * Expandable card for displaying SEO issues
 */

import { XCircle, AlertTriangle, Info, ChevronDown, ChevronRight, ExternalLink } from '@/components/icons';
import type { AuditIssue, SeverityConfig } from './types';

interface IssueCardProps {
  issue: AuditIssue;
  isExpanded: boolean;
  onToggle: () => void;
}

const severityConfigs: Record<string, SeverityConfig> = {
  critical: { icon: XCircle, color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30' },
  major: { icon: AlertTriangle, color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/30' },
  minor: { icon: Info, color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30' },
  info: { icon: Info, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/30' },
};

export function IssueCard({ issue, isExpanded, onToggle }: IssueCardProps) {
  const config = severityConfigs[issue.severity] || severityConfigs.info;
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
