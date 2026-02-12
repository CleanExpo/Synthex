'use client';

/**
 * Reports Stats Component
 * Statistics cards for reports overview
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, CheckCircle, Loader2, Calendar } from '@/components/icons';
import type { Report } from './types';

interface ReportsStatsProps {
  reports: Report[];
}

export function ReportsStats({ reports }: ReportsStatsProps) {
  const completedCount = reports.filter(r => r.status === 'completed').length;
  const inProgressCount = reports.filter(r => r.status === 'generating' || r.status === 'pending').length;
  const thisMonthCount = reports.filter(r => {
    const date = new Date(r.createdAt);
    const now = new Date();
    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  }).length;

  const stats = [
    {
      title: 'Total Reports',
      value: reports.length,
      description: 'All time',
      Icon: FileText,
      iconColor: 'text-cyan-400',
    },
    {
      title: 'Completed',
      value: completedCount,
      description: 'Ready to download',
      Icon: CheckCircle,
      iconColor: 'text-green-400',
    },
    {
      title: 'In Progress',
      value: inProgressCount,
      description: 'Generating now',
      Icon: Loader2,
      iconColor: 'text-yellow-400',
    },
    {
      title: 'This Month',
      value: thisMonthCount,
      description: 'Generated',
      Icon: Calendar,
      iconColor: 'text-blue-400',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      {stats.map(({ title, value, description, Icon, iconColor }) => (
        <Card key={title} variant="glass">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center">
              <Icon className={`w-4 h-4 mr-2 ${iconColor}`} />
              {title}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-white">{value}</p>
            <p className="text-xs text-gray-400 mt-1">{description}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
