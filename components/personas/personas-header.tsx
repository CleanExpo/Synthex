'use client';

/**
 * Personas Header Component
 * Header with title and actions
 */

import { Button } from '@/components/ui/button';
import { Plus, Download, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import type { Persona } from './types';

interface PersonasHeaderProps {
  personas: Persona[];
  isCreating: boolean;
  onCreateClick: () => void;
}

export function PersonasHeader({ personas, isCreating, onCreateClick }: PersonasHeaderProps) {
  const handleExport = () => {
    const dataStr = JSON.stringify(personas, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'personas-export.json';
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Personas exported successfully!');
  };

  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-3xl font-bold gradient-text">Persona Learning Engine</h1>
        <p className="text-slate-400 mt-1">
          Train AI to match your unique voice and style
        </p>
      </div>
      <div className="flex space-x-3 mt-4 sm:mt-0">
        <Button
          onClick={onCreateClick}
          disabled={isCreating}
          className="gradient-primary text-white"
        >
          {isCreating ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Plus className="mr-2 h-4 w-4" />
          )}
          Create Persona
        </Button>
        <Button
          variant="outline"
          className="bg-white/5 border-white/10 text-white hover:bg-white/10"
          onClick={handleExport}
        >
          <Download className="mr-2 h-4 w-4" />
          Export All
        </Button>
      </div>
    </div>
  );
}
