'use client';

/**
 * DynamicBrandProvider
 *
 * Loads the client's brand profile and injects CSS custom properties
 * so that ALL UI components automatically reflect the client's brand.
 * Falls back to Synthex's candy palette when no brand profile exists.
 *
 * This is what makes the dashboard feel like THEIR tool, not a generic SaaS.
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import useSWR from 'swr';

// =============================================================================
// Types
// =============================================================================
export interface BrandTokens {
  primaryColour: string;
  secondaryColour: string;
  neutralColour: string;
  accentColour: string;
  logoUrl: string | null;
  businessName: string;
  loaded: boolean;
  isClientBranded: boolean; // true = client's own brand, false = Synthex defaults
}

// Synthex candy defaults (used when client has no brand profile)
const SYNTHEX_DEFAULTS: BrandTokens = {
  primaryColour: '#FF6B35', // Candy Orange
  secondaryColour: '#FFD60A', // Candy Yellow
  neutralColour: '#0A0A12', // Deep Space Dark
  accentColour: '#34D399', // Candy Green
  logoUrl: null,
  businessName: 'SYNTHEX',
  loaded: true,
  isClientBranded: false,
};

const BrandContext = createContext<BrandTokens>(SYNTHEX_DEFAULTS);
// =============================================================================
// Colour Utilities
// =============================================================================

/** Convert hex (#FF6B35) to HSL string for CSS vars */
function hexToHsl(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return '0 0% 50%';

  const r = parseInt(result[1], 16) / 255;
  const g = parseInt(result[2], 16) / 255;
  const b = parseInt(result[3], 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0,
    s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}
/** Convert hex to RGB string for CSS vars */
function hexToRgb(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return '128 128 128';
  return `${parseInt(result[1], 16)} ${parseInt(result[2], 16)} ${parseInt(result[3], 16)}`;
}

/** Inject CSS custom properties onto :root to override the design system */
function applyBrandTokens(tokens: BrandTokens): void {
  const root = document.documentElement;

  // Primary colour → used by all shadcn/ui components via --color-primary
  root.style.setProperty('--color-primary', hexToHsl(tokens.primaryColour));
  root.style.setProperty('--color-accent', hexToHsl(tokens.primaryColour));
  root.style.setProperty('--color-ring', hexToHsl(tokens.primaryColour));
  root.style.setProperty('--color-brand', hexToRgb(tokens.primaryColour));

  // Secondary colour → used for highlights and secondary actions
  root.style.setProperty('--color-secondary', hexToHsl(tokens.secondaryColour));

  // Accent/CTA glow
  root.style.setProperty(
    '--glow-primary',
    `0 0 30px ${tokens.primaryColour}4D, 0 0 20px ${tokens.secondaryColour}33`
  );

  // Neutral background adjustments (only if client has custom neutral)
  if (tokens.isClientBranded && tokens.neutralColour !== '#0A0A12') {
    root.style.setProperty(
      '--color-background',
      hexToHsl(tokens.neutralColour)
    );
    root.style.setProperty('--surface-bg', tokens.neutralColour);
  }
}
// =============================================================================
// Provider Component
// =============================================================================

interface DynamicBrandProviderProps {
  orgId?: string | null;
  children: React.ReactNode;
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) throw new Error('Failed to fetch');
  return res.json();
}

interface BrandProfileResponse {
  profile?: {
    primaryColour?: string;
    secondaryColour?: string;
    neutralColour?: string;
    accentColour?: string;
    logoUrl?: string | null;
    businessName?: string;
  } | null;
}

export function DynamicBrandProvider({
  orgId,
  children,
}: DynamicBrandProviderProps) {
  const [tokens, setTokens] = useState<BrandTokens>(SYNTHEX_DEFAULTS);

  const { data } = useSWR<BrandProfileResponse>(
    orgId ? `/api/brand/profile?orgId=${orgId}` : null,
    fetchJson,
    { revalidateOnFocus: false, dedupingInterval: 60000 }
  );

  useEffect(() => {
    if (!orgId) {
      applyBrandTokens(SYNTHEX_DEFAULTS);
      setTokens(SYNTHEX_DEFAULTS);
      return;
    }

    if (!data) return;

    if (data.profile) {
      const clientTokens: BrandTokens = {
        primaryColour:
          data.profile.primaryColour || SYNTHEX_DEFAULTS.primaryColour,
        secondaryColour:
          data.profile.secondaryColour || SYNTHEX_DEFAULTS.secondaryColour,
        neutralColour:
          data.profile.neutralColour || SYNTHEX_DEFAULTS.neutralColour,
        accentColour:
          data.profile.accentColour || SYNTHEX_DEFAULTS.accentColour,
        logoUrl: data.profile.logoUrl || null,
        businessName: data.profile.businessName || 'SYNTHEX',
        loaded: true,
        isClientBranded: true,
      };
      applyBrandTokens(clientTokens);
      setTokens(clientTokens);
    } else {
      applyBrandTokens(SYNTHEX_DEFAULTS);
      setTokens(SYNTHEX_DEFAULTS);
    }
  }, [orgId, data]);

  return (
    <BrandContext.Provider value={tokens}>{children}</BrandContext.Provider>
  );
}

/** Hook for components to access the current brand tokens */
export function useBrandTokens(): BrandTokens {
  return useContext(BrandContext);
}

/** Hook to check if current session is using client's own branding */
export function useIsClientBranded(): boolean {
  return useContext(BrandContext).isClientBranded;
}
