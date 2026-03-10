'use client';

/**
 * Persona Stats Component
 * Displays persona statistics in a grid of cards
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { User, Brain, BarChart3, FileText } from '@/components/icons';
import type { PersonaStats } from './types';

interface PersonaStatsGridProps {
  stats: PersonaStats;
}

export function PersonaStatsGrid({ stats }: PersonaStatsGridProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card variant="glass">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-slate-400">Active Personas</CardTitle>
          <User className="h-4 w-4 text-cyan-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-white">{stats.activeCount}</div>
          <p className="text-xs text-slate-500 mt-1">Ready to use</p>
        </CardContent>
      </Card>

      <Card variant="glass">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-slate-400">Training Data</CardTitle>
          <Brain className="h-4 w-4 text-cyan-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-white">{stats.totalWords}</div>
          <p className="text-xs text-slate-500 mt-1">Total words analyzed</p>
        </CardContent>
      </Card>

      <Card variant="glass">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-slate-400">Avg Accuracy</CardTitle>
          <BarChart3 className="h-4 w-4 text-cyan-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-white">{stats.avgAccuracy}</div>
          <p className="text-xs text-slate-500 mt-1">Voice matching score</p>
        </CardContent>
      </Card>

      <Card variant="glass">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-slate-400">Content Sources</CardTitle>
          <FileText className="h-4 w-4 text-cyan-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-white">{stats.totalSources}</div>
          <p className="text-xs text-slate-500 mt-1">Documents & media</p>
        </CardContent>
      </Card>
    </div>
  );
}
