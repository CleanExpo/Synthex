'use client';

/**
 * Content Header Component
 * Page title and action buttons
 */

import { Button } from '@/components/ui/button';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Brain, TrendingUp } from '@/components/icons';

interface ContentHeaderProps {
  onViewAnalytics: () => void;
}

export function ContentHeader({ onViewAnalytics }: ContentHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-3xl font-bold gradient-text">Content Generator</h1>
        <p className="text-gray-400 mt-1">
          AI-powered content creation with viral patterns
        </p>
      </div>
      <div className="flex space-x-3 mt-4 sm:mt-0">
        <Tooltip>
          <TooltipTrigger asChild>
            <span tabIndex={0} className="inline-flex">
              <Button
                disabled
                variant="outline"
                className="bg-white/5 border-white/10 text-white opacity-50 cursor-not-allowed"
              >
                <Brain className="mr-2 h-4 w-4" />
                Train AI
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent variant="glass-solid">Coming soon</TooltipContent>
        </Tooltip>
        <Button onClick={onViewAnalytics} className="gradient-primary text-white">
          <TrendingUp className="mr-2 h-4 w-4" />
          View Analytics
        </Button>
      </div>
    </div>
  );
}
