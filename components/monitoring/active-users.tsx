'use client';

/**
 * Active Users Card
 * Current user session count
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, TrendingUp } from '@/components/icons';

interface ActiveUsersProps {
  activeUsers: number;
}

export function ActiveUsers({ activeUsers }: ActiveUsersProps) {
  return (
    <Card variant="glass">
      <CardHeader>
        <CardTitle className="flex items-center">
          <Users className="w-5 h-5 mr-2 text-cyan-400" />
          Active Users
        </CardTitle>
        <CardDescription>Currently active user sessions</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-3xl font-bold text-white">{activeUsers}</p>
            <p className="text-sm text-gray-400">Users online</p>
          </div>
          <div className="flex items-center text-green-400">
            <TrendingUp className="w-5 h-5 mr-2" />
            <span className="text-sm">+12% from yesterday</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
