/**
 * AI Backlink Prospector — Type Definitions (Phase 95)
 *
 * @module lib/backlinks/types
 */

// ---------------------------------------------------------------------------
// Opportunity Types + Status
// ---------------------------------------------------------------------------

export type BacklinkOpportunityType =
  | 'resource-page'
  | 'guest-post'
  | 'broken-link'
  | 'competitor-link'
  | 'journalist-mention';

export type BacklinkStatus =
  | 'identified'
  | 'contacted'
  | 'published'
  | 'rejected';

export type DomainAuthorityTier = 'high' | 'medium' | 'low';

// ---------------------------------------------------------------------------
// Domain Scoring
// ---------------------------------------------------------------------------

export interface ScoredDomain {
  domain: string;
  domainAuthority: number;   // 0–100 integer
  pageRank: number;          // 0–10 float
  source: 'openpagerank' | 'heuristic';
}

// ---------------------------------------------------------------------------
// Search Opportunities (raw results from Google CSE)
// ---------------------------------------------------------------------------

export interface SearchOpportunity {
  url: string;
  domain: string;
  title: string;
  snippet: string;
  opportunityType: BacklinkOpportunityType;
}

// ---------------------------------------------------------------------------
// BacklinkProspect input (for DB create)
// ---------------------------------------------------------------------------

export interface BacklinkProspectInput {
  orgId: string;
  targetUrl: string;
  targetDomain: string;
  domainAuthority?: number;
  pageRank?: number;
  opportunityType: BacklinkOpportunityType;
  outreachEmail?: string;
  notes?: string;
}

// ---------------------------------------------------------------------------
// Analysis
// ---------------------------------------------------------------------------

export interface AnalyzeParams {
  orgId: string;
  userId: string;
  topic: string;
  userDomain: string;
  competitorDomains?: string[];
}

export interface AnalysisResult {
  topic: string;
  userDomain: string;
  prospects: ScoredProspect[];
  linksFound: number;
  highValueCount: number;
  byType: Record<BacklinkOpportunityType, number>;
}

export interface ScoredProspect extends SearchOpportunity {
  domainAuthority: number;
  pageRank: number;
  authorityTier: DomainAuthorityTier;
  outreachEmail?: string;
}

// ---------------------------------------------------------------------------
// Outreach Templates
// ---------------------------------------------------------------------------

export interface OutreachDraft {
  subject: string;
  body: string;
  recipientEmail: string;
  opportunityType: BacklinkOpportunityType;
}

export interface BrandIdentityBrief {
  name: string;
  description: string;
  websiteUrl: string;
}

// ---------------------------------------------------------------------------
// Matrix filter (for OpportunityMatrix UI)
// ---------------------------------------------------------------------------

export interface MatrixFilter {
  opportunityType: BacklinkOpportunityType | null;
  tier: DomainAuthorityTier | null;
}

// ---------------------------------------------------------------------------
// OpenPageRank API response shape
// ---------------------------------------------------------------------------

export interface OPRResponse {
  status_code: number;
  response: OPRDomainResult[];
}

export interface OPRDomainResult {
  status_code: number;
  error: string;
  page_rank_integer: number;
  page_rank_decimal: number;
  rank: string;
  domain: string;
}

// ---------------------------------------------------------------------------
// Google Custom Search API response shape
// ---------------------------------------------------------------------------

export interface CSEResponse {
  kind: string;
  items?: CSEItem[];
  error?: { message: string; code: number };
}

export interface CSEItem {
  title: string;
  link: string;
  displayLink: string;
  snippet: string;
}
