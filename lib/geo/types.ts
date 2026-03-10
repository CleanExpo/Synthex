/**
 * GEO Engine Type Definitions
 *
 * Types for Generative Engine Optimization scoring
 *
 * @module lib/geo/types
 */

import type { AuthorityAnalysisResult } from '@/lib/authority/types';

export interface GEOAnalysisInput {
  contentText: string;
  contentUrl?: string;
  contentId?: string;
  authorId?: number;
  platform?: GEOPlatform;
  /** Optional user ID — enables deep authority analysis for Authority add-on users */
  userId?: string;
  /** Optional org ID — required alongside userId for authority analysis persistence */
  orgId?: string;
}

export type GEOPlatform = 'google_aio' | 'chatgpt' | 'perplexity' | 'bing_copilot' | 'all';

export interface GEOScore {
  overall: number;          // 0-100 weighted
  citability: number;       // 0-100, weight 25%
  structure: number;        // 0-100, weight 20%
  multiModal: number;       // 0-100, weight 15%
  authority: number;        // 0-100, weight 20%
  technical: number;        // 0-100, weight 20%
  entityCoherence: number;  // 0-100, standalone metric (not part of overall weighted score)
}

export interface CitablePassage {
  text: string;
  wordCount: number;
  startIndex: number;
  endIndex: number;
  score: number;            // 0-100 passage citability
  isOptimalLength: boolean; // 134-167 words
  answerFirst: boolean;     // starts with direct answer
  hasCitation: boolean;     // contains inline citation
}

export interface StructureAnalysis {
  hasH1: boolean;
  headingHierarchy: boolean;
  hasLists: boolean;
  hasTables: boolean;
  hasSchema: boolean;
  hasFAQ: boolean;
  readabilityScore: number;
  answerFirstSections: number;
  totalSections: number;
}

export interface PlatformScore {
  platform: GEOPlatform;
  score: number;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
}

export interface GEORecommendation {
  category: 'citability' | 'structure' | 'multiModal' | 'authority' | 'technical';
  priority: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  impact: number; // estimated score improvement 0-20
}

export interface SchemaIssue {
  type: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  recommendation: string;
}

export type EntityType = 'PERSON' | 'ORGANISATION' | 'LOCATION' | 'CONCEPT';

export interface EntityMention {
  text: string;
  type: EntityType;
  count: number;           // occurrences in content
  firstIndex: number;      // char position of first occurrence
  variants: string[];      // alternative forms found (e.g., ["Apple", "Apple Inc"])
}

export interface EntityAnalysisResult {
  entities: EntityMention[];
  entityCount: number;
  uniqueEntityCount: number;
  properNounDensity: number;    // percentage of total words
  entityTypes: Record<EntityType, number>;  // count per type
  coherenceIssues: string[];    // e.g., "Entity 'Apple' referred to as 'the company' — ambiguous"
  score: number;                // 0-100 entity coherence score
}

export interface GEOAnalysisResult {
  score: GEOScore;
  citablePassages: CitablePassage[];
  structureAnalysis: StructureAnalysis;
  entityAnalysis: EntityAnalysisResult;
  platformScores: PlatformScore[];
  recommendations: GEORecommendation[];
  schemaIssues: SchemaIssue[];
  metadata: {
    wordCount: number;
    citationCount: number;
    citationDensity: number; // per 200 words
    passageCount: number;
    optimalPassageCount: number;
    analyzedAt: string;
  };
  /** Deep authority analysis — only present for Authority Ranking add-on users */
  authorityAnalysis?: AuthorityAnalysisResult;
}
