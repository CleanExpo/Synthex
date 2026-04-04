'use client';

/**
 * Overview Tab Component
 * Main dashboard overview with performance stats, trending topics, and activity feed.
 */

import { useState } from 'react';
import {
  BarChart3,
  Share2,
  Calendar,
  TrendingUp,
  Users,
  Zap,
  MessageSquare,
} from '@/components/icons';
import { cn } from '@/lib/utils';
import { AnimatedCard } from '../animated-card';
import { AIPMWidget } from '@/components/ai-pm';
import { AIPMPanel } from '@/components/ai-pm';
import type { DashboardStats } from '../types';

interface OverviewTabProps {
  stats: DashboardStats | null;
}

const STAT_ITEMS = (stats: DashboardStats | null) => [
  {
    icon: Share2,
    label: 'Total Posts',
    value: (stats?.totalPosts || 0).toLocaleString(),
    trend: '—',
    trendUp: false,
    colour: '#00F5FF',
  },
  {
    icon: Calendar,
    label: 'Scheduled',
    value: String(stats?.scheduledPosts || 0),
    trend: '—',
    trendUp: false,
    colour: '#00F5FF',
  },
  {
    icon: TrendingUp,
    label: 'Engagement',
    value: `${(stats?.engagementRate || 0).toFixed(1)}%`,
    trend: '—',
    trendUp: false,
    colour: '#00FF88',
  },
  {
    icon: Users,
    label: 'Followers',
    value: (stats?.followers || 0).toLocaleString(),
    trend: '—',
    trendUp: false,
    colour: '#FFB800',
  },
];

export function OverviewTab({ stats }: OverviewTabProps) {
  const [pmPanelOpen, setPmPanelOpen] = useState(false);

  const statItems = STAT_ITEMS(stats);

  return (
    <div className="space-y-4">
      {/* ── Performance + Trending ──────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Performance block */}
        <AnimatedCard delay={0.1} className="lg:col-span-2">
          <div className="border-[0.5px] border-white/[0.06] bg-white/[0.01] rounded-sm overflow-hidden">
            <div className="px-5 py-4 border-b-[0.5px] border-white/[0.06] flex items-center gap-2">
              <BarChart3 className="h-3.5 w-3.5 text-white/50" />
              <span className="text-[10px] uppercase tracking-[0.25em] text-white/40">
                Performance Overview
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 divide-x-[0.5px] divide-white/[0.06]">
              {statItems.map(item => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.label}
                    className="px-4 py-4 hover:bg-white/[0.02] transition-colors"
                  >
                    <div className="flex items-center gap-1.5 mb-2">
                      <Icon className="h-3 w-3 text-white/50" />
                      <span className="text-[9px] uppercase tracking-[0.2em] text-white/50">
                        {item.label}
                      </span>
                    </div>
                    <span
                      className="font-mono text-xl font-medium tabular-nums leading-none block"
                      style={{ color: item.colour }}
                    >
                      {item.value}
                    </span>
                    <span
                      className={cn(
                        'text-[9px] font-mono tabular-nums mt-1.5 block',
                        item.trend === '—'
                          ? 'text-white/50'
                          : item.trendUp
                            ? 'text-emerald-400'
                            : 'text-red-400'
                      )}
                    >
                      {item.trend === '—'
                        ? '—'
                        : `${item.trendUp ? '↑' : '↓'} ${item.trend}`}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </AnimatedCard>

        {/* Trending Topics */}
        <AnimatedCard delay={0.2}>
          <div className="border-[0.5px] border-white/[0.06] bg-white/[0.01] rounded-sm overflow-hidden h-full">
            <div className="px-5 py-4 border-b-[0.5px] border-white/[0.06] flex items-center gap-2">
              <Zap className="h-3.5 w-3.5 text-orange-400" />
              <span className="text-[10px] uppercase tracking-[0.25em] text-white/40">
                Trending Topics
              </span>
            </div>
            <div className="p-5">
              {stats?.trendingTopics && stats.trendingTopics.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {stats.trendingTopics.map((topic, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center px-2.5 py-1 rounded-sm border-[0.5px] border-white/[0.08] bg-white/[0.02] text-[10px] text-white/50 hover:text-white/70 hover:border-white/[0.14] transition-colors cursor-pointer"
                    >
                      {topic}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-white/50 text-center py-4">
                  No trending topics yet
                </p>
              )}
            </div>
          </div>
        </AnimatedCard>
      </div>

      {/* ── AI Project Manager ──────────────────────────────────────────────── */}
      <AnimatedCard delay={0.25}>
        <AIPMWidget onOpenChat={() => setPmPanelOpen(true)} />
        <AIPMPanel open={pmPanelOpen} onOpenChange={setPmPanelOpen} />
      </AnimatedCard>

      {/* ── Recent Activity ─────────────────────────────────────────────────── */}
      <AnimatedCard delay={0.3}>
        <div className="border-[0.5px] border-white/[0.06] bg-white/[0.01] rounded-sm overflow-hidden">
          <div className="px-5 py-4 border-b-[0.5px] border-white/[0.06] flex items-center gap-2">
            <MessageSquare className="h-3.5 w-3.5 text-white/50" />
            <span className="text-[10px] uppercase tracking-[0.25em] text-white/40">
              Recent Activity
            </span>
          </div>

          {stats?.recentActivity && stats.recentActivity.length > 0 ? (
            <div className="divide-y-[0.5px] divide-white/[0.04]">
              {stats.recentActivity.map((activity, index) => (
                <div
                  key={activity.id}
                  className="flex items-center justify-between px-5 py-3 hover:bg-white/[0.02] transition-colors gap-3"
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div
                      className={cn(
                        'h-1.5 w-1.5 rounded-full shrink-0',
                        activity.type === 'milestone'
                          ? 'bg-orange-400'
                          : 'bg-orange-400'
                      )}
                    />
                    <span className="text-xs text-white/60 line-clamp-1">
                      {activity.message}
                    </span>
                  </div>
                  <span className="font-mono text-[10px] text-white/50 whitespace-nowrap shrink-0 tabular-nums">
                    {activity.timestamp}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="px-5 py-8 text-center">
              <p className="text-xs text-white/50">No recent activity</p>
            </div>
          )}
        </div>
      </AnimatedCard>
    </div>
  );
}
