'use client';

/**
 * Admin Stats Component
 * Statistics cards for user metrics
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Activity, UserPlus, Ban } from '@/components/icons';
import type { AdminStatsData } from './types';

interface AdminStatsProps {
  stats: AdminStatsData;
}

const statsConfig = [
  {
    key: 'totalUsers' as const,
    title: 'Total Users',
    description: 'Registered accounts',
    Icon: Users,
    iconColor: 'text-cyan-400',
  },
  {
    key: 'activeToday' as const,
    title: 'Active Today',
    description: 'Users signed in today',
    Icon: Activity,
    iconColor: 'text-green-400',
  },
  {
    key: 'newThisWeek' as const,
    title: 'New This Week',
    description: 'Recent signups',
    Icon: UserPlus,
    iconColor: 'text-blue-400',
  },
  {
    key: 'bannedUsers' as const,
    title: 'Banned Users',
    description: 'Suspended accounts',
    Icon: Ban,
    iconColor: 'text-red-400',
  },
];

export function AdminStats({ stats }: AdminStatsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      {statsConfig.map(({ key, title, description, Icon, iconColor }) => (
        <Card key={key} variant="glass">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center">
              <Icon className={`w-4 h-4 mr-2 ${iconColor}`} />
              {title}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-white">{stats[key]}</p>
            <p className="text-xs text-gray-400 mt-1">{description}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
