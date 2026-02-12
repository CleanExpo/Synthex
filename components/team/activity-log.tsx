'use client';

/**
 * Activity Log Component
 * Displays recent team activity
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Activity, Clock } from 'lucide-react';
import type { ActivityLog } from './types';

interface ActivityLogCardProps {
  activities: ActivityLog[];
  maxItems?: number;
}

export function ActivityLogCard({ activities, maxItems = 10 }: ActivityLogCardProps) {
  return (
    <Card variant="glass">
      <CardHeader>
        <CardTitle className="text-white flex items-center">
          <Activity className="mr-2 h-5 w-5" />
          Recent Activity
        </CardTitle>
        <CardDescription className="text-slate-400">
          Team member activity and changes
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {activities.slice(0, maxItems).map((activity) => (
          <div key={activity.id} className="flex space-x-3">
            <div className="flex-shrink-0">
              <div className="h-2 w-2 rounded-full bg-cyan-400 mt-2" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white">
                <span className="font-medium">{activity.userName}</span>
                <span className="text-slate-400"> {activity.action}</span>
              </p>
              {activity.details && (
                <p className="text-xs text-slate-500 mt-1">{activity.details}</p>
              )}
              <div className="flex items-center mt-2">
                <Clock className="h-3 w-3 text-slate-500 mr-1" />
                <span className="text-xs text-slate-500">{activity.timestamp}</span>
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
