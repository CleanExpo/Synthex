/**
 * Prompt Intelligence Types (Phase 96)
 *
 * Type definitions for the Prompt Intelligence Tool — tracking AI prompt
 * visibility for brands and entities across AI search engines.
 *
 * @module lib/prompts/types
 */

// ─── Prompt Category ─────────────────────────────────────────────────────────

export type PromptCategory =
  | 'brand-awareness'        // "What is X?", "Tell me about X"
  | 'competitor-comparison'  // "X vs Y", "alternatives to X"
  | 'local-discovery'        // "best X in Sydney", "who provides X near me?"
  | 'use-case'               // "how to do X using Y", "tool for X"
  | 'how-to'                 // "how to get started with X", "step by step X"
  | 'product-feature'        // "does X support Y feature?", "can X help with Y?"

// ─── Prompt Template ─────────────────────────────────────────────────────────

export interface PromptTemplate {
  category: PromptCategory
  /** The rendered prompt text with variables already substituted */
  text: string
  /** Original template string before substitution — for display/debug */
  template: string
  /** Variable names used in the template */
  variables: string[]
}

// ─── Test Result ─────────────────────────────────────────────────────────────

export interface PromptTestResult {
  response: string
  brandMentioned: boolean
  brandPosition: number | null   // 1-based sentence index of first mention; null if not mentioned
  mentionContext: string | null  // sentence containing the brand mention
  competitorsFound: string[]     // proper noun names found in response (potential competitors)
  responseQuality: number        // 0–1 quality heuristic
}

// ─── Gap Analysis ────────────────────────────────────────────────────────────

export interface CategoryMentionRate {
  category: PromptCategory
  testedCount: number
  mentionedCount: number
  mentionRate: number  // 0–100 percentage
}

export interface CategoryGap {
  category: PromptCategory
  missedPrompts: string[]
  recommendation: string
}

export interface PromptGapAnalysis {
  entityName: string
  testedCount: number
  mentionedCount: number
  missedCount: number
  coverageRate: number  // 0–100 percentage
  topCategories: CategoryMentionRate[]
  gaps: CategoryGap[]
}

// ─── Competitor Visibility ────────────────────────────────────────────────────

export interface CompetitorVisibility {
  competitor: string
  mentionCount: number
  mentionRate: number   // across tested prompts
  avgPosition: number   // 1-based average sentence position
}

// ─── Category Display Config ─────────────────────────────────────────────────

export const CATEGORY_CONFIG: Record<PromptCategory, {
  label: string
  colour: string        // Tailwind colour class prefix
  description: string
}> = {
  'brand-awareness': {
    label: 'Brand Awareness',
    colour: 'purple',
    description: 'Queries asking what your brand is or does',
  },
  'competitor-comparison': {
    label: 'Competitor Comparison',
    colour: 'amber',
    description: 'Queries comparing your brand to alternatives',
  },
  'local-discovery': {
    label: 'Local Discovery',
    colour: 'green',
    description: 'Location-based queries for your service area',
  },
  'use-case': {
    label: 'Use Case',
    colour: 'blue',
    description: 'Queries about specific problems your brand solves',
  },
  'how-to': {
    label: 'How-To',
    colour: 'cyan',
    description: 'Step-by-step and tutorial queries in your domain',
  },
  'product-feature': {
    label: 'Product Feature',
    colour: 'slate',
    description: 'Queries about specific features or capabilities',
  },
}
