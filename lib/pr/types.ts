/**
 * PR Journalist CRM — Type Definitions (Phase 92)
 *
 * @module lib/pr/types
 */

// ---------------------------------------------------------------------------
// Journalist Contact
// ---------------------------------------------------------------------------

export interface JournalistInput {
  name: string;
  outlet: string;
  outletDomain: string;
  email?: string;
  title?: string;
  location?: string;
  beats?: string[];
  twitterHandle?: string;
  linkedinUrl?: string;
  notes?: string;
  tier?: PitchTier;
  lastContactedAt?: string; // ISO date string
}

export type PitchTier = 'cold' | 'warm' | 'hot' | 'advocate';

// ---------------------------------------------------------------------------
// Pitch
// ---------------------------------------------------------------------------

export interface PitchInput {
  journalistId: string;
  subject: string;
  angle: string;
  bodyDraft?: string;
  personalisation?: string;
  campaignId?: string;
  tags?: string[];
}

export type PitchStatus =
  | 'draft'
  | 'sent'
  | 'opened'
  | 'replied'
  | 'covered'
  | 'declined'
  | 'archived';

// Valid status transitions
export const PITCH_TRANSITIONS: Record<PitchStatus, PitchStatus[]> = {
  draft:    ['sent', 'archived'],
  sent:     ['opened', 'replied', 'declined', 'archived'],
  opened:   ['replied', 'covered', 'declined', 'archived'],
  replied:  ['covered', 'declined', 'archived'],
  covered:  ['archived'],
  declined: ['archived'],
  archived: [],
};

// ---------------------------------------------------------------------------
// Coverage
// ---------------------------------------------------------------------------

export interface RawCoverage {
  url: string;
  title: string;
  outlet: string;
  outletDomain: string;
  description?: string | null;
  publishedAt?: string | null;
  apiSource: 'gdelt' | 'newsdata' | 'manual' | 'rss';
}

export interface CoverageResult extends RawCoverage {
  pitchId?: string;
  journalistId?: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  tier: 'tier1' | 'tier2' | 'tier3';
}

// ---------------------------------------------------------------------------
// Pitch Draft
// ---------------------------------------------------------------------------

export interface PRDraftSuggestion {
  subject: string;
  body: string;
  personalisation: string;
  angle: string;
  wordCount: number;
}

// ---------------------------------------------------------------------------
// Press Release
// ---------------------------------------------------------------------------

export interface PressReleaseInput {
  headline: string;
  body: string;
  slug?: string;
  subheading?: string;
  boilerplate?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  datePublished?: string; // ISO date string
  location?: string;
  category?: PressReleaseCategory;
  keywords?: string[];
  imageUrl?: string;
  status?: 'draft' | 'published' | 'archived';
  distributedTo?: string[];
}

export type PressReleaseCategory =
  | 'funding'
  | 'product'
  | 'partnership'
  | 'award'
  | 'other';
