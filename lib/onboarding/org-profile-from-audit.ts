/**
 * Map onboarding pipeline / review payload → Organization identity fields.
 * Used by review + complete so Brand Profile and dashboard read durable columns.
 */

import type { Prisma } from '@prisma/client';

export type OnboardingAuditLike = {
  businessName?: string | null;
  industry?: string | null;
  teamSize?: string | null;
  description?: string | null;
  url?: string | null;
  website?: string | null;
  websiteUrl?: string | null;
  logoUrl?: string | null;
  faviconUrl?: string | null;
  brandColours?:
    | { primary?: string; secondary?: string; accent?: string }
    | string[]
    | null;
  socialProfiles?: Array<{
    platform: string;
    url: string;
    verified?: boolean;
  }> | null;
  socialHandles?: Record<string, string> | null;
  structuredData?: {
    phone?: string | null;
    email?: string | null;
    address?: string | null;
    abn?: string | null;
    googleBusinessUrl?: string | null;
  } | null;
  seoScore?: number | null;
  pageSpeed?: unknown;
  overallHealth?: string | null;
  quickWins?: string[] | null;
  contentGaps?: string[] | null;
  keyTopics?: string[] | null;
  targetAudience?: string | null;
  suggestedTone?: string | null;
  suggestedPersonaName?: string | null;
  postingMode?: string | null;
};

function primaryColourFromAudit(audit: OnboardingAuditLike): string | null {
  const colours = audit.brandColours;
  if (Array.isArray(colours)) {
    const first = colours.find(c => typeof c === 'string' && c.startsWith('#'));
    return first ?? null;
  }
  if (colours && typeof colours === 'object' && colours.primary) {
    return colours.primary;
  }
  return null;
}

function socialHandlesFromAudit(
  audit: OnboardingAuditLike
): Record<string, string> {
  if (
    audit.socialHandles &&
    typeof audit.socialHandles === 'object' &&
    !Array.isArray(audit.socialHandles)
  ) {
    return { ...audit.socialHandles };
  }

  const handles: Record<string, string> = {};
  for (const profile of audit.socialProfiles ?? []) {
    if (profile.platform && profile.url) {
      handles[profile.platform.toLowerCase()] = profile.url;
    }
  }
  return handles;
}

/**
 * Build a Prisma Organization update payload from onboarding audit/review data.
 * Omits empty optional strings so we don't wipe existing values with blanks
 * unless the caller explicitly provides a non-empty value (name always set when present).
 */
export function organizationProfileFromAudit(
  audit: OnboardingAuditLike
): Prisma.OrganizationUpdateInput {
  const website =
    audit.url?.trim() ||
    audit.website?.trim() ||
    audit.websiteUrl?.trim() ||
    undefined;
  const socialHandles = socialHandlesFromAudit(audit);
  const primaryColor = primaryColourFromAudit(audit);
  const structured = audit.structuredData ?? {};

  const aiGeneratedData = {
    seoScore: audit.seoScore ?? null,
    pageSpeed: audit.pageSpeed ?? null,
    overallHealth: audit.overallHealth ?? null,
    quickWins: audit.quickWins ?? [],
    contentGaps: audit.contentGaps ?? [],
    keyTopics: audit.keyTopics ?? [],
    targetAudience: audit.targetAudience ?? null,
    suggestedTone: audit.suggestedTone ?? null,
    suggestedPersonaName: audit.suggestedPersonaName ?? null,
    brandColours: audit.brandColours ?? null,
    postingMode: audit.postingMode ?? null,
    structuredData: structured,
    syncedAt: new Date().toISOString(),
  };

  const data: Prisma.OrganizationUpdateInput = {
    aiGeneratedData: aiGeneratedData as Prisma.InputJsonValue,
  };

  if (audit.businessName?.trim()) {
    data.name = audit.businessName.trim();
  }
  if (audit.industry?.trim()) {
    data.industry = audit.industry.trim();
  }
  if (audit.teamSize?.trim()) {
    data.teamSize = audit.teamSize.trim();
  }
  if (audit.description?.trim()) {
    data.description = audit.description.trim();
  }
  if (website) {
    data.website = website;
  }
  if (audit.logoUrl) {
    data.logo = audit.logoUrl;
  }
  if (audit.faviconUrl) {
    data.favicon = audit.faviconUrl;
  }
  if (primaryColor) {
    data.primaryColor = primaryColor;
  }
  if (Object.keys(socialHandles).length > 0) {
    data.socialHandles = socialHandles as Prisma.InputJsonValue;
  }
  if (structured.abn?.trim()) {
    data.abn = structured.abn.trim();
  }
  if (structured.phone?.trim()) {
    data.phoneNumber = structured.phone.trim();
  }

  return data;
}

/** Normalise brand colours from audit (object or array) to hex string list. */
export function brandColourListFromAudit(
  brandColours: OnboardingAuditLike['brandColours']
): string[] {
  if (!brandColours) return [];
  if (Array.isArray(brandColours)) {
    return brandColours.filter(
      (c): c is string => typeof c === 'string' && c.length > 0
    );
  }
  return [
    brandColours.primary,
    brandColours.secondary,
    brandColours.accent,
  ].filter((c): c is string => typeof c === 'string' && c.length > 0);
}
