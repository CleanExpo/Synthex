'use client';

/**
 * Platform Card Component
 *
 * @description Individual platform card showing metrics and status.
 */

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Twitter,
  Instagram,
  Youtube,
  Linkedin,
  Facebook,
  Video,
  Image,
  MessageSquare,
  Link2,
  TrendingUp,
  TrendingDown,
  Users,
  Activity,
  ExternalLink,
  Plus,
} from '@/components/icons';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

// Platform icon mapping
const PLATFORM_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  twitter: Twitter,
  instagram: Instagram,
  youtube: Youtube,
  linkedin: Linkedin,
  facebook: Facebook,
  tiktok: Video,
  pinterest: Image,
  reddit: MessageSquare,
  threads: Link2,
};

export interface PlatformCardProps {
  platform: {
    id: string;
    name: string;
    connected: boolean;
    followers: number;
    engagement: number;
    engagementRate: number;
    growth: number;
    lastSync: string | null;
    color: string;
  };
  onConnect?: () => void;
  onViewDetails?: () => void;
}

function formatNumber(num: number): string {
  if (num >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(1)}M`;
  }
  if (num >= 1_000) {
    return `${(num / 1_000).toFixed(1)}K`;
  }
  return num.toLocaleString();
}

export function PlatformCard({ platform, onConnect, onViewDetails }: PlatformCardProps) {
  const Icon = PLATFORM_ICONS[platform.id] || Link2;
  const isPositiveGrowth = platform.growth >= 0;

  return (
    <div
      className={cn(
        'relative bg-gray-900/50 border rounded-xl p-4 transition-all duration-200',
        platform.connected
          ? 'border-white/10 hover:border-white/20 hover:scale-[1.02]'
          : 'border-white/5 opacity-60'
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div
            className="p-2 rounded-lg"
            style={{ backgroundColor: `${platform.color}20` }}
          >
            <span style={{ color: platform.color }}>
              <Icon className="w-5 h-5" />
            </span>
          </div>
          <div>
            <h3 className="font-semibold text-white">{platform.name}</h3>
            {platform.lastSync && platform.connected && (
              <p className="text-xs text-gray-500">
                Synced {formatDistanceToNow(new Date(platform.lastSync), { addSuffix: true })}
              </p>
            )}
          </div>
        </div>
        <Badge
          variant={platform.connected ? 'default' : 'secondary'}
          className={cn(
            platform.connected
              ? 'bg-green-500/10 text-green-400 border-green-500/20'
              : 'bg-gray-500/10 text-gray-500 border-gray-500/20'
          )}
        >
          {platform.connected ? 'Connected' : 'Not Connected'}
        </Badge>
      </div>

      {/* Metrics */}
      {platform.connected ? (
        <div className="space-y-3">
          {/* Followers */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-gray-400">
              <Users className="w-4 h-4" />
              <span className="text-sm">Followers</span>
            </div>
            <span className="font-semibold text-white">
              {formatNumber(platform.followers)}
            </span>
          </div>

          {/* Engagement Rate */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-gray-400">
              <Activity className="w-4 h-4" />
              <span className="text-sm">Engagement</span>
            </div>
            <span className="font-semibold text-white">
              {platform.engagementRate.toFixed(1)}%
            </span>
          </div>

          {/* Growth */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-gray-400">
              {isPositiveGrowth ? (
                <TrendingUp className="w-4 h-4 text-green-400" />
              ) : (
                <TrendingDown className="w-4 h-4 text-red-400" />
              )}
              <span className="text-sm">Growth</span>
            </div>
            <span
              className={cn(
                'font-semibold',
                isPositiveGrowth ? 'text-green-400' : 'text-red-400'
              )}
            >
              {isPositiveGrowth ? '+' : ''}
              {platform.growth.toFixed(1)}%
            </span>
          </div>

          {/* Actions */}
          <div className="pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onViewDetails}
              className="w-full gap-2"
            >
              <ExternalLink className="w-4 h-4" />
              View Details
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-gray-500">
            Connect your {platform.name} account to see metrics and insights.
          </p>
          <Button
            onClick={onConnect}
            className="w-full gap-2"
            style={{
              backgroundColor: platform.color,
              color: '#ffffff',
            }}
          >
            <Plus className="w-4 h-4" />
            Connect {platform.name}
          </Button>
        </div>
      )}
    </div>
  );
}

export default PlatformCard;
