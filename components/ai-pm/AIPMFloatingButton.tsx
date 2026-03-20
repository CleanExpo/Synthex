'use client';

import { useState } from 'react';
import { Sparkles, X } from '@/components/icons';
import { cn } from '@/lib/utils';
import AIPMPanel from './AIPMPanel';

export default function AIPMFloatingButton() {
  const [panelOpen, setPanelOpen] = useState(false);

  return (
    <>
      {/* FAB — fixed bottom-right */}
      <button
        onClick={() => setPanelOpen(true)}
        className={cn(
          'fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full',
          'bg-gradient-to-br from-amber-500 to-amber-600 text-white shadow-lg shadow-amber-500/25',
          'transition-all duration-300 hover:scale-110 hover:shadow-xl hover:shadow-amber-500/30',
          'focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2 focus:ring-offset-gray-950',
          panelOpen && 'scale-0 opacity-0'
        )}
        aria-label="Open AI Project Manager"
      >
        <Sparkles className="h-6 w-6" />

        {/* Pulse ring animation */}
        <span
          className="absolute inset-0 rounded-full bg-amber-500/20 animate-ping"
          style={{ animationDuration: '3s' }}
        />
      </button>

      {/* Panel (Sheet) */}
      <AIPMPanel open={panelOpen} onOpenChange={setPanelOpen} />
    </>
  );
}
