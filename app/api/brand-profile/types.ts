/**
 * Brand Profile Types
 *
 * Shared TypeScript types for the brand profile API.
 * Import these in UI components and hooks.
 *
 * @module app/api/brand-profile/types
 */

export interface BrandProfileResponse {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  website: string | null;
  industry: string | null;
  teamSize: string | null;
  abn: string | null;
  logo: string | null;
  favicon: string | null;
  primaryColor: string | null;
  socialHandles: Record<string, string>;
  updatedAt: string;
}

export interface BrandProfileUpdatePayload {
  name?: string;
  description?: string;
  website?: string;
  industry?: string;
  teamSize?: string;
  abn?: string;
  logo?: string;
  favicon?: string;
  primaryColor?: string;
  socialHandles?: Record<string, string>;
}
