'use client';

/**
 * Sandbox Header Component
 * Page title and action buttons
 */

import { Button } from '@/components/ui/button';
import { RotateCcw, Download } from '@/components/icons';

interface SandboxHeaderProps {
  onReset: () => void;
  onExport: () => void;
}

export function SandboxHeader({ onReset, onExport }: SandboxHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-3xl font-bold gradient-text">Content Sandbox</h1>
        <p className="text-gray-400 mt-1">
          Test and preview your content across platforms
        </p>
      </div>
      <div className="flex space-x-3 mt-4 sm:mt-0">
        <Button
          onClick={onReset}
          variant="outline"
          className="bg-white/5 border-white/10 text-white hover:bg-white/10"
        >
          <RotateCcw className="mr-2 h-4 w-4" />
          Reset
        </Button>
        <Button onClick={onExport} className="gradient-primary text-white">
          <Download className="mr-2 h-4 w-4" />
          Export
        </Button>
      </div>
    </div>
  );
}
