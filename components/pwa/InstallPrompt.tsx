'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { X, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISSED_KEY = 'synthex-pwa-install-dismissed';

/**
 * Shows a bottom banner when the browser fires beforeinstallprompt.
 * Dismissed state persists in localStorage — won't show again once dismissed.
 */
export function InstallPrompt() {
  const pathname = usePathname();
  const [promptEvent, setPromptEvent] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Don't show if already dismissed
    if (localStorage.getItem(DISMISSED_KEY)) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setPromptEvent(e as BeforeInstallPromptEvent);
      setVisible(true);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  if (!visible || !promptEvent || !pathname?.startsWith('/dashboard')) {
    return null;
  }

  async function handleInstall() {
    if (!promptEvent) return;
    await promptEvent.prompt();
    const { outcome } = await promptEvent.userChoice;
    if (outcome === 'accepted') {
      setVisible(false);
    }
  }

  function handleDismiss() {
    localStorage.setItem(DISMISSED_KEY, '1');
    setVisible(false);
  }

  return (
    <div
      role="banner"
      aria-label="Install Synthex app"
      className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-sm rounded-xl border border-white/10 bg-gray-900 p-4 shadow-2xl sm:left-auto sm:right-4 sm:max-w-xs"
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-cyan-500/10">
          <Download className="h-5 w-5 text-cyan-400" />
        </div>

        {/* Text */}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-white">Install Synthex</p>
          <p className="mt-0.5 text-xs text-gray-400">
            Add to your home screen for faster access
          </p>
        </div>

        {/* Dismiss */}
        <button
          onClick={handleDismiss}
          aria-label="Dismiss install prompt"
          className="flex-shrink-0 rounded p-1 text-gray-500 hover:text-gray-300"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-3 flex gap-2">
        <Button
          onClick={handleInstall}
          size="sm"
          className="flex-1 bg-cyan-800 text-xs text-white hover:bg-cyan-700"
        >
          Install
        </Button>
        <Button
          onClick={handleDismiss}
          variant="ghost"
          size="sm"
          className="flex-1 text-xs text-gray-400 hover:text-gray-200"
        >
          Not now
        </Button>
      </div>
    </div>
  );
}
