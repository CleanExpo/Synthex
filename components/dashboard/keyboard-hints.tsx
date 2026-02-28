'use client';

import { useState, useEffect } from 'react';
import { X, Command } from '@/components/icons';
import { Button } from '@/components/ui/button';

const SHORTCUTS = [
  { keys: ['⌘', 'K'], description: 'Command palette' },
  { keys: ['?'], description: 'Help & shortcuts' },
];

export function KeyboardHints() {
  const [isVisible, setIsVisible] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const hasSeenHints = localStorage.getItem('hasSeenKeyboardHints');
    if (!hasSeenHints) {
      // Show after 3 seconds on first visit
      const timer = setTimeout(() => setIsVisible(true), 3000);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleDismiss = () => {
    setIsDismissed(true);
    setIsVisible(false);
    localStorage.setItem('hasSeenKeyboardHints', 'true');
  };

  if (!isVisible || isDismissed) return null;

  return (
    <div className="fixed bottom-6 right-6 z-40 animate-in slide-in-from-bottom-4">
      <div className="bg-white/[0.02] backdrop-blur-xl border border-white/[0.08] rounded-xl p-4 shadow-xl max-w-xs">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-white">
            <Command className="w-4 h-4 text-cyan-400" />
            <span className="font-medium text-sm">Keyboard Shortcuts</span>
          </div>
          <button onClick={handleDismiss} className="text-gray-400 hover:text-white" aria-label="Dismiss keyboard shortcuts">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-2">
          {SHORTCUTS.map((shortcut, i) => (
            <div key={i} className="flex items-center justify-between text-sm">
              <span className="text-gray-400">{shortcut.description}</span>
              <div className="flex gap-1">
                {shortcut.keys.map((key, j) => (
                  <kbd key={j} className="px-1.5 py-0.5 bg-white/10 rounded text-xs text-white">
                    {key}
                  </kbd>
                ))}
              </div>
            </div>
          ))}
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={handleDismiss}
          className="w-full mt-3 text-xs text-gray-400 hover:text-white"
        >
          Got it!
        </Button>
      </div>
    </div>
  );
}
