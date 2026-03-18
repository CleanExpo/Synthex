'use client';

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from 'react';
import { useSubscription } from '@/hooks/useSubscription';
import type { SurfaceMode } from '@/lib/design-tokens';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ModeContextValue {
  mode: SurfaceMode;
  isLoading: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PRO_PLANS = new Set([
  'pro',
  'growth',
  'scale',
  'professional',
  'business',
  'custom',
]);

function resolveModeFromPlan(plan: string | undefined): SurfaceMode {
  if (!plan) return 'simple';
  return PRO_PLANS.has(plan) ? 'pro' : 'simple';
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const ModeContext = createContext<ModeContextValue>({
  mode: 'simple',
  isLoading: true,
});

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Returns the current surface mode and loading state.
 *
 * ```tsx
 * const { mode, isLoading } = useMode();
 * ```
 */
export function useMode(): ModeContextValue {
  return useContext(ModeContext);
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

interface ModeProviderProps {
  children: ReactNode;
}

/**
 * Reads the subscription plan and applies the correct mode class to <body>.
 * Wrap around dashboard layout content only — not the root layout.
 */
export function ModeProvider({ children }: ModeProviderProps) {
  const { subscription, isLoading } = useSubscription();

  const mode = useMemo<SurfaceMode>(
    () => resolveModeFromPlan(subscription?.plan),
    [subscription?.plan]
  );

  // Apply mode class to <body> — removed on cleanup
  useEffect(() => {
    if (isLoading) return;
    const body = document.body;
    body.classList.remove('mode-simple', 'mode-pro');
    body.classList.add(`mode-${mode}`);
    return () => {
      body.classList.remove('mode-simple', 'mode-pro');
    };
  }, [mode, isLoading]);

  const value = useMemo<ModeContextValue>(
    () => ({ mode, isLoading }),
    [mode, isLoading]
  );

  return <ModeContext.Provider value={value}>{children}</ModeContext.Provider>;
}
