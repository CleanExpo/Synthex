// lib/brand-dna/types.ts
// TypeScript interfaces for the Brand DNA system.
// These mirror the Prisma BrandDNA model but are safe to use in client components.

export interface BrandVoice {
  formality: 1 | 2 | 3 | 4 | 5; // 1 = very casual, 5 = very formal
  boldness: 1 | 2 | 3 | 4 | 5; // 1 = reserved, 5 = bold
  tone: string; // e.g. "friendly and approachable"
  samplePhrases: string[];
}

export interface BrandPersona {
  ageRange: string; // e.g. "25-45"
  values: string[]; // e.g. ["quality", "convenience"]
  painPoints: string[]; // e.g. ["no time for social media"]
  description: string;
}

export interface BrandSocialProfile {
  platform: string;
  url: string;
  verified: boolean;
}

export interface BrandDNARecord {
  id: string;
  organizationId: string;
  businessName: string;
  vertical: string;
  industry: string;
  logoUrl: string | null;
  primaryColour: string | null;
  secondaryColour: string | null;
  neutralColour: string | null;
  brandVoice: BrandVoice;
  persona: BrandPersona;
  offerings: string[];
  socialProfiles: BrandSocialProfile[];
  seoScore: number | null;
  sourceUrl: string;
  extractedAt: string;
  lastRefreshedAt: string;
}

// Returned by the instant-preview path (≤3s)
export interface BrandDNAPreview {
  businessName: string;
  industry: string;
  firstPost: string; // AI-generated post content
}

export interface ExtractResponse {
  preview: BrandDNAPreview;
  status: 'extracting'; // full pipeline still running
}

export interface BrandDNAResponse {
  brandDna: BrandDNARecord;
  status: 'complete';
}
