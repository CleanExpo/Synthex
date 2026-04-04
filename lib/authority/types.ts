// Source connector types
export type SourceType = 'government' | 'academic' | 'industry' | 'web';

export interface SourceConnector {
  id: string;
  name: string;
  type: SourceType;
  description: string;
  enabled: boolean;
  search(query: string): Promise<SourceResult[]>;
}

export interface SourceResult {
  title: string;
  url: string;
  snippet: string;
  sourceType: SourceType;
  sourceName: string;
  confidence: number; // 0.0-1.0
  citationCount?: number;
  year?: number;
  authors?: string[];
}

// Claim types
export interface ExtractedClaim {
  text: string;
  type: ClaimType;
  confidence: number;
  position: { start: number; end: number };
  entities: string[];
}

export type ClaimType = 'statistical' | 'factual' | 'comparative' | 'causal' | 'temporal' | 'regulatory';

export interface ValidatedClaim extends ExtractedClaim {
  verified: boolean;
  sources: SourceResult[];
  citationText?: string;
  verificationScore: number; // 0.0-1.0
}

// Analysis result types
export interface AuthorityAnalysisResult {
  id?: string; // DB record id when persisted
  overallScore: number; // 0-100
  claims: ValidatedClaim[];
  claimsFound: number;
  claimsVerified: number;
  claimsFailed: number;
  sourceBreakdown: Record<SourceType, number>;
  citations: GeneratedCitation[];
  recommendations: AuthorityRecommendation[];
  addonRequired?: boolean; // true when deep validation requested without addon
}

export interface GeneratedCitation {
  claimText: string;
  sourceUrl: string;
  sourceType: SourceType;
  sourceName: string;
  confidence: number;
  citationText: string; // Formatted footnote
  format: 'footnote' | 'inline' | 'apa' | 'chicago';
}

export interface AuthorityRecommendation {
  type: 'add_citation' | 'verify_claim' | 'remove_unverified' | 'strengthen_source';
  claim: string;
  suggestion: string;
  priority: 'high' | 'medium' | 'low';
}

// Citation monitoring
export interface CitationMonitorResult {
  contentUrl: string;
  platforms: {
    chatgpt: boolean;
    perplexity: boolean;
    claude: boolean;
    googleAI: boolean;
  };
  citationCount: number;
  lastChecked: Date;
  changes: CitationChange[];
}

export interface CitationChange {
  platform: string;
  type: 'added' | 'removed' | 'modified';
  timestamp: Date;
  details: string;
}

// API request/response
export interface AuthorityAnalyzeRequest {
  content: string;
  orgId: string;
  deepValidation?: boolean; // requires addon
}

export interface AuthorityAnalyzeResponse {
  id: string;
  overallScore: number;
  claimsFound: number;
  claimsVerified: number;
  claimsFailed: number;
  claims: ValidatedClaim[];
  citations: GeneratedCitation[];
  sourceBreakdown: Record<SourceType, number>;
  recommendations: AuthorityRecommendation[];
  addonRequired?: boolean; // true if deep validation requested without addon
}
