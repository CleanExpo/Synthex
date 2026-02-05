'use client';

import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Crown,
  ArrowUp,
  ArrowDown,
  Minus,
  Twitter,
  Instagram,
  Linkedin,
  Facebook,
  Youtube,
  Globe,
} from '@/components/icons';
import type { Competitor, PlatformMetrics } from './types';

interface CompetitorCardProps {
  competitor: Competitor;
  isSelected: boolean;
  isComparing: boolean;
  isSelectedForComparison: boolean;
  onSelect: () => void;
  onToggleComparison: () => void;
}

// Platform icon mapping
const getPlatformIcon = (platform: string) => {
  const icons: Record<string, React.ComponentType<{ className?: string }>> = {
    twitter: Twitter,
    instagram: Instagram,
    linkedin: Linkedin,
    facebook: Facebook,
    youtube: Youtube,
    tiktok: Globe,
  };
  return icons[platform] || Globe;
};

// Change indicator component
const getChangeIndicator = (change: number) => {
  if (change > 0) return <ArrowUp className="h-3 w-3 text-green-400" />;
  if (change < 0) return <ArrowDown className="h-3 w-3 text-red-400" />;
  return <Minus className="h-3 w-3 text-gray-400" />;
};

export function CompetitorCard({
  competitor,
  isSelected,
  isComparing,
  isSelectedForComparison,
  onSelect,
  onToggleComparison,
}: CompetitorCardProps) {
  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      <Card
        variant="glass"
        className={`cursor-pointer ${
          isSelected ? 'ring-2 ring-purple-500' : ''
        } ${
          isSelectedForComparison ? 'ring-2 ring-blue-500' : ''
        }`}
        onClick={() => !isComparing && onSelect()}
      >
        <CardContent className="p-4">
          {/* Header */}
          <div className="flex items-start justify-between mb-3">
            <div>
              <h3 className="font-semibold text-white flex items-center gap-2">
                {competitor.name}
                {competitor.metrics.growthRate > 20 && (
                  <Crown className="h-4 w-4 text-yellow-400" />
                )}
              </h3>
              <p className="text-xs text-gray-400">{competitor.domain}</p>
            </div>
            {isComparing && (
              <input
                type="checkbox"
                checked={isSelectedForComparison}
                onChange={onToggleComparison}
                onClick={(e) => e.stopPropagation()}
                className="h-4 w-4"
              />
            )}
          </div>

          {/* Key Metrics */}
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <p className="text-xs text-gray-400">Followers</p>
              <p className="text-lg font-bold text-white">
                {(competitor.metrics.followers.total / 1000000).toFixed(1)}M
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Engagement</p>
              <p className="text-lg font-bold text-white">
                {competitor.metrics.engagement.total.toFixed(1)}%
              </p>
            </div>
          </div>

          {/* Secondary Metrics */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400">Growth Rate</span>
              <div className="flex items-center gap-1">
                {getChangeIndicator(competitor.metrics.growthRate)}
                <span className="text-xs text-white">
                  {Math.abs(competitor.metrics.growthRate)}%
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400">Share of Voice</span>
              <Progress value={competitor.metrics.shareOfVoice} className="w-20 h-2" />
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400">Sentiment</span>
              <Badge
                variant={competitor.metrics.sentimentScore > 70 ? 'default' : 'secondary'}
                className="text-xs"
              >
                {competitor.metrics.sentimentScore}%
              </Badge>
            </div>
          </div>

          {/* Platform Icons */}
          <div className="flex gap-2 mt-3">
            {Object.keys(competitor.metrics.followers)
              .filter(p => p !== 'total' && competitor.metrics.followers[p as keyof PlatformMetrics])
              .map(platform => {
                const Icon = getPlatformIcon(platform);
                return (
                  <div
                    key={platform}
                    className="p-1.5 bg-white/5 rounded"
                    title={platform}
                  >
                    <Icon className="h-3 w-3 text-gray-400" />
                  </div>
                );
              })}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default CompetitorCard;
