'use client';

/**
 * Patterns Header Component
 * Page title and action buttons
 */

import { Button } from '@/components/ui/button';
import { Search, Download, RefreshCw } from '@/components/icons';

interface PatternsHeaderProps {
  isAnalyzing: boolean;
  onAnalyze: () => void;
  onExport: () => void;
}

export function PatternsHeader({ isAnalyzing, onAnalyze, onExport }: PatternsHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-3xl font-bold gradient-text">Viral Pattern Analyzer</h1>
        <p className="text-gray-400 mt-1">
          Discover what makes content go viral across platforms
        </p>
      </div>
      <div className="flex space-x-3 mt-4 sm:mt-0">
        <Button
          onClick={onAnalyze}
          disabled={isAnalyzing}
          className="gradient-primary text-white"
        >
          {isAnalyzing ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              Analyzing...
            </>
          ) : (
            <>
              <Search className="mr-2 h-4 w-4" />
              Analyze New
            </>
          )}
        </Button>
        <Button
          onClick={onExport}
          variant="outline"
          className="bg-white/5 border-white/10 text-white hover:bg-white/10"
        >
          <Download className="mr-2 h-4 w-4" />
          Export Report
        </Button>
      </div>
    </div>
  );
}
