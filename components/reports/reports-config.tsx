'use client';

/**
 * Reports Configuration
 * Report types and badge helpers
 */

import { Badge } from '@/components/ui/badge';
import {
  FileText,
  TrendingUp,
  BarChart3,
  Beaker,
  Brain,
  Clock,
  CheckCircle,
  AlertCircle,
  Loader2,
} from '@/components/icons';
import type { ReportType } from './types';

export const reportTypes: ReportType[] = [
  { id: 'campaign', name: 'Campaign Report', description: 'Campaign performance metrics', icon: TrendingUp },
  { id: 'analytics', name: 'Analytics Report', description: 'Event tracking and behavior', icon: BarChart3 },
  { id: 'ab-test', name: 'A/B Testing Report', description: 'Test results and analysis', icon: Beaker },
  { id: 'psychology', name: 'Psychology Report', description: 'Principle effectiveness', icon: Brain },
  { id: 'comprehensive', name: 'Comprehensive Report', description: 'Full platform analysis', icon: FileText },
];

export const formatOptions = ['pdf', 'csv', 'json'] as const;

export function getTypeIcon(type: string) {
  const reportType = reportTypes.find(rt => rt.id === type);
  const Icon = reportType?.icon || FileText;
  return <Icon className="w-4 h-4" />;
}

export function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: 'bg-gray-500/20 text-gray-400',
    generating: 'bg-yellow-500/20 text-yellow-400',
    completed: 'bg-green-500/20 text-green-400',
    failed: 'bg-red-500/20 text-red-400',
  };

  const icons: Record<string, React.ReactNode> = {
    pending: <Clock className="w-3 h-3 mr-1" />,
    generating: <Loader2 className="w-3 h-3 mr-1 animate-spin" />,
    completed: <CheckCircle className="w-3 h-3 mr-1" />,
    failed: <AlertCircle className="w-3 h-3 mr-1" />,
  };

  return (
    <Badge className={styles[status] || styles.pending}>
      {icons[status]}
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  );
}

export function FormatBadge({ format }: { format: string }) {
  const styles: Record<string, string> = {
    pdf: 'bg-red-500/20 text-red-400',
    csv: 'bg-green-500/20 text-green-400',
    json: 'bg-blue-500/20 text-blue-400',
  };

  return (
    <Badge className={styles[format] || 'bg-gray-500/20 text-gray-400'}>
      {format.toUpperCase()}
    </Badge>
  );
}
