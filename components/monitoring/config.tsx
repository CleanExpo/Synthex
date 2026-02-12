'use client';

/**
 * Monitoring Config
 * Status utilities and sample data
 */

import { Badge } from '@/components/ui/badge';
import { CheckCircle, AlertCircle } from '@/components/icons';
import type { PerformanceDataPoint } from './types';

export const PERFORMANCE_DATA: PerformanceDataPoint[] = [
  { time: '00:00', responseTime: 210, requests: 450 },
  { time: '04:00', responseTime: 190, requests: 320 },
  { time: '08:00', responseTime: 245, requests: 780 },
  { time: '12:00', responseTime: 310, requests: 1200 },
  { time: '16:00', responseTime: 280, requests: 950 },
  { time: '20:00', responseTime: 225, requests: 620 },
  { time: '24:00', responseTime: 200, requests: 480 },
];

export function getStatusColor(status: string): string {
  switch (status) {
    case 'operational':
    case 'healthy':
    case 'completed':
    case 'valid':
      return 'text-green-400';
    case 'degraded':
    case 'warning':
      return 'text-yellow-400';
    case 'down':
    case 'error':
    case 'failed':
      return 'text-red-400';
    default:
      return 'text-gray-400';
  }
}

export function StatusBadge({ status }: { status: string }) {
  const color = getStatusColor(status);
  const isGood = status === 'operational' || status === 'healthy';

  return (
    <Badge className={`${color} bg-opacity-20`}>
      {isGood ? (
        <CheckCircle className="w-3 h-3 mr-1" />
      ) : (
        <AlertCircle className="w-3 h-3 mr-1" />
      )}
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  );
}
