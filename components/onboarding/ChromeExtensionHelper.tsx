'use client';

/**
 * Chrome Extension Helper — Onboarding Connect Step
 *
 * Detects whether the Synthex Chrome Extension is installed and uses it
 * to surface which social platforms the user is already logged into.
 * Provides contextual hints on platform cards ("You're logged in — one click!").
 *
 * Degrades gracefully: if the extension is not installed, shows a subtle
 * install prompt. If installed but no platforms detected, hides this component.
 *
 * @module components/onboarding/ChromeExtensionHelper
 */

import React, { useEffect, useState } from 'react';
import { Zap, Chrome } from '@/components/icons';
import {
  checkExtensionAvailability,
  detectLoggedInPlatforms,
  type ExtensionCapabilities,
  type ExtensionSocialDetection,
} from '@/lib/chrome-extension/bridge';

// ============================================================================
// TYPES
// ============================================================================

export interface ExtensionHelperState {
  /** Whether the extension check is still running */
  loading: boolean;
  /** Whether the extension is installed */
  available: boolean;
  /** Platforms the extension detected the user is logged into */
  loggedInPlatforms: ExtensionSocialDetection[];
}

// ============================================================================
// HOOK
// ============================================================================

/**
 * Hook to detect Chrome Extension availability and logged-in social platforms.
 * Safe to call on every render — results are memoised until unmount.
 */
export function useExtensionHelper(): ExtensionHelperState {
  const [state, setState] = useState<ExtensionHelperState>({
    loading: true,
    available: false,
    loggedInPlatforms: [],
  });

  useEffect(() => {
    let cancelled = false;

    async function detect() {
      try {
        const capabilities: ExtensionCapabilities = await checkExtensionAvailability();

        if (cancelled) return;

        if (!capabilities.available) {
          setState({ loading: false, available: false, loggedInPlatforms: [] });
          return;
        }

        // Extension found — now ask it which platforms the user is logged into
        const platforms = await detectLoggedInPlatforms();

        if (cancelled) return;

        setState({
          loading: false,
          available: true,
          loggedInPlatforms: platforms.filter((p) => p.loggedIn),
        });
      } catch {
        if (!cancelled) {
          setState({ loading: false, available: false, loggedInPlatforms: [] });
        }
      }
    }

    detect();
    return () => { cancelled = true; };
  }, []);

  return state;
}

// ============================================================================
// COMPONENT — Extension Install Prompt
// ============================================================================

interface ExtensionInstallPromptProps {
  className?: string;
}

/**
 * Shown when the extension is NOT installed.
 * Subtle — never blocks the onboarding flow.
 */
export function ExtensionInstallPrompt({ className }: ExtensionInstallPromptProps) {
  return (
    <div className={`flex items-center gap-3 p-3 rounded-lg bg-white/3 border border-white/5 ${className ?? ''}`}>
      <div className="w-8 h-8 rounded-full bg-cyan-500/10 flex items-center justify-center shrink-0">
        <Chrome className="w-4 h-4 text-cyan-400/60" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-gray-500">
          Install the{' '}
          <a
            href="https://chrome.google.com/webstore/detail/synthex"
            target="_blank"
            rel="noopener noreferrer"
            className="text-cyan-400/70 hover:text-cyan-400 underline decoration-dotted transition-colors"
          >
            Synthex Chrome Extension
          </a>{' '}
          for one-click social connections.
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// COMPONENT — Extension Social Hint (per platform card)
// ============================================================================

interface ExtensionSocialHintProps {
  platformId: string;
  loggedInPlatforms: ExtensionSocialDetection[];
}

/**
 * Inline hint shown inside a platform card when the extension detects
 * that the user is already logged in on that platform.
 */
export function ExtensionSocialHint({ platformId, loggedInPlatforms }: ExtensionSocialHintProps) {
  const match = loggedInPlatforms.find(
    (p) => p.platform.toLowerCase() === platformId.toLowerCase() && p.loggedIn,
  );

  if (!match) return null;

  return (
    <div className="flex items-center gap-1.5 mt-1.5">
      <Zap className="w-3 h-3 text-cyan-400 shrink-0" />
      <p className="text-[11px] text-cyan-400">
        {match.username
          ? `Logged in as @${match.username} — one click!`
          : 'Already logged in — one click!'}
      </p>
    </div>
  );
}

// ============================================================================
// COMPONENT — Extension Status Banner
// ============================================================================

interface ExtensionStatusBannerProps {
  state: ExtensionHelperState;
}

/**
 * Banner shown at the top of the connect page when the extension is available
 * and has detected logged-in platforms. Hidden if no platforms detected.
 */
export function ExtensionStatusBanner({ state }: ExtensionStatusBannerProps) {
  if (state.loading || !state.available || state.loggedInPlatforms.length === 0) {
    return null;
  }

  const count = state.loggedInPlatforms.length;
  const names = state.loggedInPlatforms
    .slice(0, 3)
    .map((p) => p.platform.charAt(0).toUpperCase() + p.platform.slice(1))
    .join(', ');

  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-cyan-500/5 border border-cyan-500/20 max-w-2xl mx-auto">
      <div className="w-8 h-8 rounded-full bg-cyan-500/20 flex items-center justify-center shrink-0">
        <Zap className="w-4 h-4 text-cyan-400" />
      </div>
      <div>
        <p className="text-sm text-cyan-400 font-medium">
          Extension detected {count} active session{count !== 1 ? 's' : ''}
        </p>
        <p className="text-xs text-gray-400">
          You&apos;re logged into {names}{count > 3 ? ` +${count - 3} more` : ''} — connect them below with one click.
        </p>
      </div>
    </div>
  );
}
