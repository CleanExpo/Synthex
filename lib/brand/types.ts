/**
 * Brand Builder — Type Definitions
 * @module lib/brand/types
 */

// ---------------------------------------------------------------------------
// Brand Identity Input (form data → service)
// ---------------------------------------------------------------------------

export interface BrandIdentityInput {
  entityType: 'organization' | 'person' | 'local-business';
  canonicalName: string;
  canonicalUrl: string;
  description?: string;
  logoUrl?: string;
  foundingDate?: string;         // ISO date string YYYY-MM-DD
  hasPhysicalLocation?: boolean;
  address?: {
    street?: string;
    suburb?: string;
    state?: string;
    postcode?: string;
    country?: string;
  };
  phone?: string;
  // sameAs URLs
  wikidataUrl?: string;
  wikipediaUrl?: string;
  linkedinUrl?: string;
  crunchbaseUrl?: string;
  youtubeUrl?: string;
  twitterUrl?: string;
  facebookUrl?: string;
  instagramUrl?: string;
  // Optional: declared handles for consistency check
  declaredHandles?: PlatformHandle[];
}

export interface PlatformHandle {
  platform: string;
  url: string;
  handle?: string;   // without @ symbol
}

// ---------------------------------------------------------------------------
// Entity Graph
// ---------------------------------------------------------------------------

export interface EntityGraph {
  organizationSchema: Record<string, unknown>;
  websiteSchema: Record<string, unknown>;
  personSchema?: Record<string, unknown>;       // If entityType === 'person'
  articleAuthorRef: Record<string, unknown>;    // Minimal ref for article pages
  generatedAt: string;                          // ISO timestamp
}

// ---------------------------------------------------------------------------
// Consistency
// ---------------------------------------------------------------------------

export type NameMatchType = 'exact' | 'variant' | 'mismatch' | 'not-found';

export interface ConsistencyResult {
  platformUrl: string;
  platform: string;
  canonicalName: string;
  foundName: string | null;
  nameMatch: NameMatchType;
  issues: string[];
  score: number;           // 0-100
  weight: number;          // Platform weight (sameAs platforms weight 3x)
}

export interface ConsistencyReport {
  overallScore: number;
  results: ConsistencyResult[];
  criticalIssues: string[];
  recommendations: string[];
  auditedAt: string;
}

// ---------------------------------------------------------------------------
// Mentions
// ---------------------------------------------------------------------------

export type MentionApiSource = 'newsdata' | 'gnews' | 'guardian' | 'gdelt' | 'rss';
export type MentionSentiment = 'positive' | 'neutral' | 'negative';

export interface RawMention {
  url: string;
  title: string;
  description: string | null;
  publishedAt: string | null;    // ISO timestamp
  source: string;                // publisher domain
  apiSource: MentionApiSource;
}

export interface MentionPollResult {
  mentions: RawMention[];
  newCount: number;
  totalFetched: number;
  sources: MentionApiSource[];
  polledAt: string;
}

// ---------------------------------------------------------------------------
// Wikidata
// ---------------------------------------------------------------------------

export interface WikidataCheckResult {
  found: boolean;
  qId: string | null;
  entityLabel: string | null;
  wikidataUrl: string | null;
  presentProps: string[];
  missingRequiredProps: string[];
  missingRecommendedProps: string[];
  referenceCount: number;         // How many external references in entry
  score: number;                  // 0-100 — Wikidata completeness score
  recommendations: string[];
}

// ---------------------------------------------------------------------------
// Knowledge Graph
// ---------------------------------------------------------------------------

export interface KGCheckResult {
  found: boolean;
  kgmid: string | null;
  name: string | null;
  description: string | null;
  confidence: number;             // 0.0-1.0
  types: string[];                // @type values returned
  checkedAt: string;
}

// ---------------------------------------------------------------------------
// Brand Calendar
// ---------------------------------------------------------------------------

export type CalendarEventType =
  | 'publish-article'
  | 'social-post'
  | 'credential-refresh'
  | 'mention-review'
  | 'schema-audit'
  | 'wikidata-update';

export interface CalendarEvent {
  date: string;              // ISO date YYYY-MM-DD
  type: CalendarEventType;
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  recurrence?: string;       // 'weekly' | 'monthly' | 'quarterly'
}

export interface BrandCalendar {
  events: CalendarEvent[];
  generatedAt: string;
  coverageDays: number;      // How many days ahead the calendar covers
  summary: {
    totalEvents: number;
    highPriority: number;
    publishingEvents: number;
    maintenanceEvents: number;
  };
}
