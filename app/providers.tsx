'use client';

import { ThemeProvider } from 'next-themes';
import { AuthProvider, useAuth } from '@/hooks/useAuth';
import { TooltipProvider } from '@/components/ui/tooltip';
import { DynamicBrandProvider } from '@/components/providers/dynamic-brand-provider';
// LenisProvider removed from root — Lenis + GSAP (~130 KB) was loading on every page
// including dashboard, admin, and settings where smooth scroll adds no value.
// Re-add LenisProvider to marketing pages only if needed (e.g., app/(marketing)/layout.tsx).

/**
 * Inner wrapper that reads auth context to pass orgId to the brand provider.
 * DynamicBrandProvider applies per-client CSS tokens when an org is active.
 */
function BrandedProviders({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  const orgId =
    (user as (typeof user & { organizationId?: string }) | null)
      ?.organizationId ?? null;

  return (
    <DynamicBrandProvider orgId={orgId}>
      <TooltipProvider delayDuration={300}>{children}</TooltipProvider>
    </DynamicBrandProvider>
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem={false}
      disableTransitionOnChange
    >
      <AuthProvider>
        <BrandedProviders>{children}</BrandedProviders>
      </AuthProvider>
    </ThemeProvider>
  );
}
