'use client';

/**
 * Content Header Component
 * Page title and action buttons
 */

import { Button } from '@/components/ui/button';
import { Brain, TrendingUp } from '@/components/icons';

interface ContentHeaderProps {
  onTrainAI: () => void;
  onViewAnalytics: () => void;
}

export function ContentHeader({ onTrainAI, onViewAnalytics }: ContentHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-3xl font-bold gradient-text">Content Generator</h1>
        <p className="text-gray-400 mt-1">
          AI-powered content creation with viral patterns
        </p>
      </div>
      <div className="flex space-x-3 mt-4 sm:mt-0">
        <Button
          disabled
          title="AI Training — coming soon"
          variant="outline"
          className="bg-white/5 border-white/10 text-white opacity-50 cursor-not-allowed"
        >
          <Brain className="mr-2 h-4 w-4" />
          Train AI
        </Button>
        <Button onClick={onViewAnalytics} className="gradient-primary text-white">
          <TrendingUp className="mr-2 h-4 w-4" />
          View Analytics
        </Button>
      </div>
    </div>
  );
}
