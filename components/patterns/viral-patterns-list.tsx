'use client';

/**
 * Viral Patterns List Component
 * List of top performing content patterns
 */

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  TrendingUp,
  Eye,
  Heart,
  Share2,
  Clock,
  ChevronRight,
} from '@/components/icons';
import type { ViralPattern } from './types';

interface ViralPatternsListProps {
  patterns: ViralPattern[];
  onAnalyzePattern: (pattern: ViralPattern) => void;
}

export function ViralPatternsList({
  patterns,
  onAnalyzePattern,
}: ViralPatternsListProps) {
  return (
    <Card variant="glass">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Top Viral Patterns</span>
          <TrendingUp className="h-4 w-4 text-orange-500" />
        </CardTitle>
        <CardDescription className="text-gray-300">
          Highest performing content patterns this week
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {patterns.map(pattern => (
            <div
              key={pattern.id}
              className="p-4 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-all cursor-pointer"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="px-2 py-1 rounded-full bg-orange-500/20 text-orange-400 text-xs font-medium">
                      {pattern.platform}
                    </span>
                    <span className="px-2 py-1 rounded-full bg-blue-500/20 text-blue-400 text-xs font-medium">
                      {pattern.type}
                    </span>
                    <span className="px-2 py-1 rounded-full bg-green-500/20 text-green-400 text-xs font-medium">
                      {pattern.hookType}
                    </span>
                  </div>
                  <p className="text-white mb-3">{pattern.content}</p>
                  <div className="flex items-center gap-6 text-sm">
                    <div className="flex items-center gap-1 text-gray-300">
                      <Eye className="w-4 h-4" />
                      <span>{(pattern.impressions / 1000).toFixed(0)}K</span>
                    </div>
                    <div className="flex items-center gap-1 text-gray-300">
                      <Heart className="w-4 h-4" />
                      <span>{(pattern.engagement / 1000).toFixed(0)}K</span>
                    </div>
                    <div className="flex items-center gap-1 text-gray-300">
                      <Share2 className="w-4 h-4" />
                      <span>{pattern.shares}</span>
                    </div>
                    <div className="flex items-center gap-1 text-gray-300">
                      <Clock className="w-4 h-4" />
                      <span>{pattern.timing}</span>
                    </div>
                  </div>
                </div>
                <div className="text-right ml-4">
                  <div className="text-2xl font-bold text-white">
                    {pattern.viralityScore}
                  </div>
                  <div className="text-xs text-gray-300">Virality Score</div>
                  <div className="text-sm text-green-400 mt-1">
                    {pattern.growthRate}
                  </div>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">Sentiment:</span>
                  <div className="w-24 h-2 bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-orange-500 to-orange-500"
                      style={{ width: `${pattern.sentiment * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-300">
                    {(pattern.sentiment * 100).toFixed(0)}%
                  </span>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-orange-400 hover:text-orange-300"
                  onClick={() => onAnalyzePattern(pattern)}
                >
                  Analyze Pattern
                  <ChevronRight className="ml-1 w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
