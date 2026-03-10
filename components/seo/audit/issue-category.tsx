'use client';

/**
 * Issue Category Component
 * Section for displaying issues by category with score
 */

import { IssueCard } from './issue-card';
import type { AuditCategory } from './types';

interface IssueCategoryProps {
  title: string;
  category: AuditCategory;
  categoryKey: string;
  expandedIssues: Set<string>;
  onToggleIssue: (id: string) => void;
}

function getScoreBadgeStyles(score: number): string {
  if (score >= 80) return 'bg-green-500/20 text-green-400';
  if (score >= 60) return 'bg-yellow-500/20 text-yellow-400';
  return 'bg-red-500/20 text-red-400';
}

export function IssueCategory({
  title,
  category,
  categoryKey,
  expandedIssues,
  onToggleIssue,
}: IssueCategoryProps) {
  return (
    <div>
      <h4 className="text-lg font-medium text-white mb-3 flex items-center gap-2">
        {title}
        <span className={`text-sm px-2 py-0.5 rounded ${getScoreBadgeStyles(category.score)}`}>
          {category.score}%
        </span>
      </h4>
      <div className="space-y-2">
        {category.issues.map((issue, i) => (
          <IssueCard
            key={`${categoryKey}-${i}`}
            issue={issue}
            isExpanded={expandedIssues.has(`${categoryKey}-${i}`)}
            onToggle={() => onToggleIssue(`${categoryKey}-${i}`)}
          />
        ))}
      </div>
    </div>
  );
}
