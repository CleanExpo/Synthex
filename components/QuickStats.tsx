import { useRouter } from 'next/navigation';
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { 
  TrendingUp, 
  TrendingDown, 
  Eye, 
  Heart, 
  Users, 
  FileText,
  ArrowUp,
  ArrowDown,
  Minus,
  Activity,
  Zap,
  Target
} from '@/components/icons';
import { Skeleton } from '@/components/ui/skeleton';

interface Stat {
  label: string;
  value: string | number;
  change?: number;
  changeType?: 'increase' | 'decrease' | 'neutral';
  icon?: React.ElementType;
  color?: string;
  sparkline?: number[];
}

interface QuickStatsProps {
  stats?: Stat[];
  loading?: boolean;
  compact?: boolean;
  className?: string;
}

// Default stats structure
const defaultStats: Stat[] = [
  {
    label: "Today's Views",
    value: '2.3K',
    change: 12.5,
    changeType: 'increase',
    icon: Eye,
    color: 'text-blue-400',
    sparkline: [20, 35, 30, 45, 50, 60, 55, 70, 65, 80]
  },
  {
    label: 'Engagement Rate',
    value: '4.5%',
    change: 0.3,
    changeType: 'increase',
    icon: Heart,
    color: 'text-pink-400',
    sparkline: [30, 35, 40, 38, 42, 45, 43, 47, 45, 48]
  },
  {
    label: 'New Followers',
    value: 127,
    change: 23,
    changeType: 'increase',
    icon: Users,
    color: 'text-green-400',
    sparkline: [10, 15, 12, 18, 20, 25, 22, 28, 30, 35]
  },
  {
    label: 'Content Score',
    value: 92,
    change: 5,
    changeType: 'increase',
    icon: Target,
    color: 'text-purple-400',
    sparkline: [70, 72, 75, 78, 80, 82, 85, 88, 90, 92]
  }
];

const tickerStats = [
  { label: 'Views Today', value: '2.3K', icon: Eye },
  { label: 'Engagement', value: '4.5%', icon: Heart },
  { label: 'New Followers', value: '+127', icon: Users },
  { label: 'Viral Score', value: '92/100', icon: Zap },
];

function Sparkline({ data, color = 'text-purple-400' }: { data: number[]; color?: string }) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min;
  
  return (
    <svg className="w-full h-8" viewBox="0 0 100 32">
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className={color}
        points={data.map((value, index) => {
          const x = (index / (data.length - 1)) * 100;
          const y = 32 - ((value - min) / range) * 28;
          return `${x},${y}`;
        }).join(' ')}
      />
    </svg>
  );
}

function StatCard({ stat, compact = false }: { stat: Stat; compact?: boolean }) {
  const Icon = stat.icon || Activity;
  const TrendIcon = stat.changeType === 'increase' ? ArrowUp : 
                    stat.changeType === 'decrease' ? ArrowDown : Minus;
  
  const trendColor = stat.changeType === 'increase' ? 'text-green-400' :
                     stat.changeType === 'decrease' ? 'text-red-400' : 'text-gray-400';
  
  if (compact) {
    return (
      <div className="flex items-center justify-between p-3 glass-card rounded-lg hover:bg-white/5 transition-colors">
        <div className="flex items-center gap-3">
          <Icon className={`h-4 w-4 ${stat.color || 'text-gray-400'}`} />
          <div>
            <p className="text-xs text-gray-400">{stat.label}</p>
            <p className="text-lg font-semibold text-white">{stat.value}</p>
          </div>
        </div>
        {stat.change !== undefined && (
          <div className={`flex items-center gap-1 ${trendColor}`}>
            <TrendIcon className="h-3 w-3" />
            <span className="text-xs font-medium">
              {stat.change > 0 ? '+' : ''}{stat.change}%
            </span>
          </div>
        )}
      </div>
    );
  }
  
  return (
    <Card className="glass-card hover:scale-[1.02] transition-transform">
      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-lg bg-white/5 ${stat.color || 'text-gray-400'}`}>
              <Icon className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs text-gray-400">{stat.label}</p>
              <p className="text-xl font-bold text-white">{stat.value}</p>
            </div>
          </div>
          
          {stat.change !== undefined && (
            <div className={`flex items-center gap-1 ${trendColor}`}>
              <TrendIcon className="h-3 w-3" />
              <span className="text-sm font-medium">
                {stat.change > 0 ? '+' : ''}{stat.change}%
              </span>
            </div>
          )}
        </div>
        
        {stat.sparkline && (
          <div className="pt-2">
            <Sparkline data={stat.sparkline} color={stat.color} />
          </div>
        )}
      </div>
    </Card>
  );
}

export function QuickStats({ 
  stats = defaultStats, 
  loading = false, 
  compact = false,
  className = '' 
}: QuickStatsProps) {
  const [animatedStats, setAnimatedStats] = useState(stats);
  
  // Animate numbers on mount
  useEffect(() => {
    if (!loading) {
      setAnimatedStats(stats);
    }
  }, [stats, loading]);
  
  if (loading) {
    return (
      <div className={`grid gap-4 ${compact ? 'grid-cols-1' : 'grid-cols-2 lg:grid-cols-4'} ${className}`}>
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
    );
  }
  
  return (
    <div className={`grid gap-4 ${compact ? 'grid-cols-1' : 'grid-cols-2 lg:grid-cols-4'} ${className}`}>
      {animatedStats.map((stat, index) => (
        <StatCard key={index} stat={stat} compact={compact} />
      ))}
    </div>
  );
}

// Live Stats Ticker
export function StatsTickker() {
  const [currentStat, setCurrentStat] = useState(0);
  
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentStat((prev) => (prev + 1) % tickerStats.length);
    }, 3000);
    
    return () => clearInterval(interval);
  }, []);
  
  const stat = tickerStats[currentStat];
  const Icon = stat.icon;
  
  return (
    <div className="flex items-center gap-2 px-4 py-2 glass-card rounded-full">
      <Icon className="h-4 w-4 text-purple-400" />
      <span className="text-sm text-gray-400">{stat.label}:</span>
      <span className="text-sm font-semibold text-white">{stat.value}</span>
    </div>
  );
}

// Mini Stats for Header
export function MiniStats() {
  return (
    <div className="flex items-center gap-4">
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
        <span className="text-xs text-gray-400">Live</span>
      </div>
      
      <div className="flex items-center gap-1">
        <Eye className="h-3 w-3 text-gray-400" />
        <span className="text-xs text-white font-medium">2.3K</span>
      </div>
      
      <div className="flex items-center gap-1">
        <TrendingUp className="h-3 w-3 text-green-400" />
        <span className="text-xs text-green-400 font-medium">+12%</span>
      </div>
    </div>
  );
}
