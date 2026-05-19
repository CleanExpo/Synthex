'use client';

import { useState, useEffect, useCallback } from 'react';
import { Sparkles } from '@/components/icons';
import { cn } from '@/lib/utils';
import AIPMPanel from './AIPMPanel';

/**
 * Open the AI PM panel with pre-filled context from anywhere in the app.
 * Usage: `openAIPMWithContext("Explain why post X was scheduled at 9am")`
 */
export function openAIPMWithContext(context: string) {
  window.dispatchEvent(
    new CustomEvent('aipm:open-with-context', { detail: { context } })
  );
}

export default function AIPMFloatingButton() {
  const [panelOpen, setPanelOpen] = useState(false);
  const [initialContext, setInitialContext] = useState<string | null>(null);

  // Listen for contextual open events
  const handleContextEvent = useCallback((e: Event) => {
    const detail = (e as CustomEvent<{ context: string }>).detail;
    if (detail?.context) {
      setInitialContext(detail.context);
      setPanelOpen(true);
    }
  }, []);

  useEffect(() => {
    window.addEventListener('aipm:open-with-context', handleContextEvent);
    return () => {
      window.removeEventListener('aipm:open-with-context', handleContextEvent);
    };
  }, [handleContextEvent]);

  // Clear context when panel closes
  const handleOpenChange = useCallback((open: boolean) => {
    setPanelOpen(open);
    if (!open) setInitialContext(null);
  }, []);

  return (
    <>
      {/* FAB — fixed bottom-right */}
      <button
        onClick={() => setPanelOpen(true)}
        className={cn(
          'fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full',
          'bg-gradient-to-br from-orange-500 to-orange-600 text-white shadow-lg shadow-orange-500/25',
          'transition-all duration-300 hover:scale-110 hover:shadow-xl hover:shadow-orange-500/30',
          'focus:outline-none focus:ring-2 focus:ring-orange-400 focus:ring-offset-2 focus:ring-offset-gray-950',
          panelOpen && 'scale-0 opacity-0'
        )}
        aria-label="Open AI Project Manager"
        title="Open AI Project Manager"
      >
        <Sparkles className="h-6 w-6" />

        {/* Pulse ring animation */}
        <span
          className="absolute inset-0 rounded-full bg-orange-500/20 animate-ping"
          style={{ animationDuration: '3s' }}
        />
      </button>

      {/* Panel (Sheet) */}
      <AIPMPanel
        open={panelOpen}
        onOpenChange={handleOpenChange}
        initialContext={initialContext}
      />
    </>
  );
}
