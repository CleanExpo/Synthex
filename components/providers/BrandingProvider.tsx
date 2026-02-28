'use client';

/**
 * Branding Provider
 * Context provider for white-label branding configuration.
 *
 * Sets CSS custom properties on document.documentElement so that
 * any component can reference brand colours via var(--brand-primary), etc.
 *
 * @task UNI-683 - White-label UI tenant branding system
 */

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';
import { useUser } from '@/hooks/use-user';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BrandingConfig {
  primaryColor: string;
  secondaryColor: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  companyName: string | null;
  customDomain: string | null;
  customCss: string | null;
  footerLinks: { label: string; url: string }[];
}

interface BrandingContextValue {
  branding: BrandingConfig;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

const DEFAULT_BRANDING: BrandingConfig = {
  primaryColor: '#6366f1',
  secondaryColor: '#06b6d4',
  logoUrl: null,
  faviconUrl: null,
  companyName: null,
  customDomain: null,
  customCss: null,
  footerLinks: [],
};

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const BrandingContext = createContext<BrandingContextValue>({
  branding: DEFAULT_BRANDING,
  isLoading: false,
  error: null,
  refetch: async () => {},
});

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Access the current white-label branding configuration.
 *
 * ```tsx
 * const { branding, isLoading } = useBranding();
 * ```
 */
export function useBranding(): BrandingContextValue {
  return useContext(BrandingContext);
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

interface BrandingProviderProps {
  children: ReactNode;
}

export function BrandingProvider({ children }: BrandingProviderProps) {
  const { user } = useUser();
  const [branding, setBranding] = useState<BrandingConfig>(DEFAULT_BRANDING);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBranding = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch('/api/white-label/config', {
        credentials: 'include',
      });

      if (!response.ok) {
        // Non-critical — fall back to defaults silently for non-enterprise users
        if (response.status === 401) {
          return;
        }
        throw new Error('Failed to fetch branding config');
      }

      const data = await response.json();
      if (data.theme) {
        const config: BrandingConfig = {
          primaryColor: data.theme.primaryColor || DEFAULT_BRANDING.primaryColor,
          secondaryColor: data.theme.secondaryColor || DEFAULT_BRANDING.secondaryColor,
          logoUrl: data.theme.logoUrl || null,
          faviconUrl: data.theme.faviconUrl || null,
          companyName: data.theme.companyName || null,
          customDomain: data.theme.customDomain || null,
          customCss: data.theme.customCss || null,
          footerLinks: data.theme.footerLinks || [],
        };
        setBranding(config);
      }
    } catch (err) {
      console.error('BrandingProvider: error fetching config', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      // Keep defaults — don't break the UI
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch branding when user is authenticated
  useEffect(() => {
    if (user?.id) {
      fetchBranding();
    }
  }, [user?.id, fetchBranding]);

  // Re-fetch when organization changes
  useEffect(() => {
    if (user?.organizationId) {
      fetchBranding();
    }
  }, [user?.organizationId, fetchBranding]);

  // Apply CSS custom properties to the document root
  useEffect(() => {
    if (typeof document === 'undefined') return;

    const root = document.documentElement;
    root.style.setProperty('--brand-primary', branding.primaryColor);
    root.style.setProperty('--brand-secondary', branding.secondaryColor);
    root.style.setProperty('--brand-logo', branding.logoUrl || '');

    return () => {
      root.style.removeProperty('--brand-primary');
      root.style.removeProperty('--brand-secondary');
      root.style.removeProperty('--brand-logo');
    };
  }, [branding.primaryColor, branding.secondaryColor, branding.logoUrl]);

  // Inject custom CSS via a <style> tag
  useEffect(() => {
    if (typeof document === 'undefined' || !branding.customCss) return;

    const styleId = 'brand-custom-css';
    let styleEl = document.getElementById(styleId) as HTMLStyleElement | null;

    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = styleId;
      document.head.appendChild(styleEl);
    }

    styleEl.textContent = branding.customCss;

    return () => {
      const el = document.getElementById(styleId);
      if (el) el.remove();
    };
  }, [branding.customCss]);

  const value = useMemo<BrandingContextValue>(
    () => ({
      branding,
      isLoading,
      error,
      refetch: fetchBranding,
    }),
    [branding, isLoading, error, fetchBranding]
  );

  return (
    <BrandingContext.Provider value={value}>
      {children}
    </BrandingContext.Provider>
  );
}
