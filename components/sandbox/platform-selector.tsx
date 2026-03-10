'use client';

/**
 * Platform Selector Component
 * Grid of platform buttons for selection
 */

import { Label } from '@/components/ui/label';
import { platformConfigs } from './sandbox-config';

interface PlatformSelectorProps {
  selected: string;
  onSelect: (platform: string) => void;
}

export function PlatformSelector({ selected, onSelect }: PlatformSelectorProps) {
  return (
    <div>
      <Label className="text-gray-400">Platform</Label>
      <div className="grid grid-cols-5 gap-2 mt-2">
        {Object.entries(platformConfigs).map(([key, config]) => {
          const Icon = config.icon;
          return (
            <button
              key={key}
              onClick={() => onSelect(key)}
              className={`p-3 rounded-lg border transition-all ${
                selected === key
                  ? 'bg-cyan-500/20 border-cyan-500'
                  : 'bg-white/5 border-white/10 hover:bg-white/10'
              }`}
            >
              <Icon className="h-5 w-5 mx-auto" />
              <p className="text-xs mt-1">{config.name}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
