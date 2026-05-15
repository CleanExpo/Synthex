/**
 * Phill McGurk personal tenant — Pilot V1 ADR 002.
 *
 * "phill" is the founder-internal tenant_slug for Phill McGurk's autonomous
 * Pilot bot. It is NOT a portfolio brand (DR/RA/NRPG/etc.) — it lives here
 * as a TenantConfig envelope only. v1 enforces tenant_slug === brand_slug.
 */
import type { BrandConfig, BrandConfigWithPilot, TenantConfig } from '../types';
import { FORBIDDEN_PRONOUNS } from '../types';

export const phillBrand: BrandConfig = {
  slug: 'unite',  // closest portfolio brand — phill operates under Unite Group
  legalName: 'Phill McGurk',
  displayName: 'Phill',
  tagline: 'Autonomous CEO operations.',
  voice: {
    tone: ['authoritative', 'expert'],
    forbiddenWords: [...FORBIDDEN_PRONOUNS],
    requiredCadence: 'short',
  },
  colour: {
    primary: '#E55A2B',
    secondary: '#1E293B',
    accent: '#FBBF24',
    neutral: { 50: '#F8FAFC', 100: '#E2E8F0', 500: '#64748B', 900: '#0F172A' },
    semantic: { success: '#16A34A', warning: '#D97706', danger: '#DC2626' },
    family: 'industrial',
  },
  typography: {
    display: { family: 'Inter', weight: 700, src: 'fonts/unite/Inter-Bold.woff2' },
    body: { family: 'Inter', weight: 400, src: 'fonts/unite/Inter-Regular.woff2' },
  },
  logo: {
    primary: 'logos/unite/primary.svg',
    inverted: 'logos/unite/inverted.svg',
    icon: 'logos/unite/icon.svg',
    safeAreaPx: 40,
  },
  motion: {
    durations: { fast: 10, base: 20, slow: 36 },
    easing: {
      in: 'cubic-bezier(0.22, 1, 0.36, 1)',
      out: 'cubic-bezier(0.64, 0, 0.78, 0)',
      inOut: 'cubic-bezier(0.83, 0, 0.17, 1)',
    },
    signature: 'rise',
    transitionFrames: 14,
  },
  voiceover: {
    elevenLabsVoiceId: 'EXAVITQu4vr4xnSDxMaL',
    style: 'conversational',
    locale: 'en-AU',
  },
  doNot: ['never use generic AI filler phrases'],
  audience: { primary: 'Phill McGurk — CEO autonomous decision loop' },
  defaultChannel: 'linkedin',
};

export const phillBrandWithPilot: BrandConfigWithPilot = {
  ...phillBrand,
  pilotConfig: { semantic_dedup_enabled: true },
};

export const phillTenant: TenantConfig<BrandConfigWithPilot> = {
  tenant_slug: 'phill',
  billing_tier: 'enterprise',
  brands: { phill: phillBrandWithPilot },
};
