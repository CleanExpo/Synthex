'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  ChevronDown,
  Globe,
  Check,
  RefreshCw,
  Loader2,
} from '@/components/icons';

interface GSCProperty {
  id: string;
  siteUrl: string;
  permissionLevel: string | null;
  isPrimary: boolean;
}

interface PropertySelectorProps {
  properties: GSCProperty[];
  selectedUrl: string | null;
  onSelect: (siteUrl: string) => void;
  onSync?: () => Promise<void>;
  syncing?: boolean;
}

export function PropertySelector({
  properties,
  selectedUrl,
  onSelect,
  onSync,
  syncing,
}: PropertySelectorProps) {
  const [open, setOpen] = useState(false);

  if (properties.length === 0) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-300">No properties synced</span>
        {onSync && (
          <Button
            variant="outline"
            size="sm"
            onClick={onSync}
            disabled={syncing}
            className="border-orange-500/30 text-orange-400 hover:bg-orange-500/10"
          >
            {syncing ? (
              <Loader2 className="w-3 h-3 animate-spin mr-1" />
            ) : (
              <RefreshCw className="w-3 h-3 mr-1" />
            )}
            Sync Properties
          </Button>
        )}
      </div>
    );
  }

  const selected = properties.find(p => p.siteUrl === selectedUrl);

  return (
    <div className="relative">
      <div className="flex items-center gap-2">
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-2 px-3 py-2 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-colors text-sm min-w-[200px]"
        >
          <Globe className="w-4 h-4 text-orange-400" />
          <span className="text-white truncate flex-1 text-left">
            {selected?.siteUrl || 'Select property'}
          </span>
          <ChevronDown className="w-4 h-4 text-gray-300" />
        </button>
        {onSync && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onSync}
            disabled={syncing}
            className="text-gray-300 hover:text-orange-400"
            title="Sync properties from Google"
          >
            {syncing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
          </Button>
        )}
      </div>

      {open && (
        <div className="absolute z-50 mt-1 w-full min-w-[300px] bg-[#1a1612] border border-white/10 rounded-lg shadow-xl">
          {properties.map(p => (
            <button
              key={p.id}
              onClick={() => {
                onSelect(p.siteUrl);
                setOpen(false);
              }}
              className="flex items-center gap-2 w-full px-3 py-2.5 hover:bg-white/5 transition-colors text-sm text-left"
            >
              <Globe className="w-4 h-4 text-gray-500 shrink-0" />
              <span className="text-white truncate flex-1">{p.siteUrl}</span>
              {p.siteUrl === selectedUrl && (
                <Check className="w-4 h-4 text-orange-400 shrink-0" />
              )}
              {p.isPrimary && (
                <span className="px-1.5 py-0.5 bg-orange-500/10 text-orange-400 rounded text-[10px] font-medium shrink-0">
                  PRIMARY
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
