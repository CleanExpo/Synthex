'use client';

/**
 * Team Stats Component
 * Displays team statistics in a grid of cards
 */

import { Card, CardContent } from '@/components/ui/card';
import { Users, CheckCircle, AlertTriangle, Crown } from '@/components/icons';
import type { TeamStats } from './types';

interface TeamStatsGridProps {
  stats: TeamStats;
}

export function TeamStatsGrid({ stats }: TeamStatsGridProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card variant="glass">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-400">Total Members</p>
              <p className="text-2xl font-bold text-white">{stats.total}</p>
            </div>
            <Users className="h-8 w-8 text-cyan-400" />
          </div>
        </CardContent>
      </Card>

      <Card variant="glass">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-400">Active Members</p>
              <p className="text-2xl font-bold text-white">{stats.active}</p>
            </div>
            <CheckCircle className="h-8 w-8 text-green-400" />
          </div>
        </CardContent>
      </Card>

      <Card variant="glass">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-400">Pending Invites</p>
              <p className="text-2xl font-bold text-white">{stats.pending}</p>
            </div>
            <AlertTriangle className="h-8 w-8 text-yellow-400" />
          </div>
        </CardContent>
      </Card>

      <Card variant="glass">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-400">Admins</p>
              <p className="text-2xl font-bold text-white">{stats.admins}</p>
            </div>
            <Crown className="h-8 w-8 text-red-400" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
