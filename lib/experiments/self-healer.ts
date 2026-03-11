/**
 * Self-Healer Service
 *
 * Analyses a URL for common SEO issues and generates actionable fix suggestions.
 * Rule-based — no external API calls. Persists issues to HealingAction table.
 *
 * @module lib/experiments/self-healer
 */

import { prisma } from '@/lib/prisma';
import type { HealingIssue, HealingIssueType, HealingSeverity } from './types';

// ============================================================================
// Issue Detection Rules
// ============================================================================

interface PageMetadata {
  title?: string;
  metaDescription?: string;
  h1?: string;
  hasSchema?: boolean;
  geoScore?: number;
  qualityScore?: number;
  canonicalUrl?: string;
  wordCount?: number;
}

/**
 * Derive healing issues from page metadata.
 * In production, metadata comes from an external fetch/parse.
 * Here we use what's available and apply rule-based checks.
 */
function detectIssues(meta: PageMetadata): HealingIssue[] {
  const issues: HealingIssue[] = [];

  // Missing title
  if (!meta.title || meta.title.trim().length === 0) {
    issues.push({
      issueType: 'missing-meta' as HealingIssueType,
      severity: 'critical' as HealingSeverity,
      description: 'Page is missing a title tag.',
      currentValue: undefined,
      suggestedFix:
        'Add a descriptive <title> tag (50-60 characters) that includes the primary keyword and brand name. Example: "Your Primary Topic — Brand Name".',
      estimatedImpact: 'Critical for SEO — missing titles severely hurt rankings and CTR.',
    });
  }

  // Short title
  if (meta.title && meta.title.length < 30) {
    issues.push({
      issueType: 'short-title' as HealingIssueType,
      severity: 'warning' as HealingSeverity,
      description: `Title tag is too short (${meta.title.length} characters). Optimal is 50-60 characters.`,
      currentValue: meta.title,
      suggestedFix: `Expand the current title "${meta.title}" to include the primary keyword and brand name. Aim for 50-60 characters total.`,
      estimatedImpact: 'Short titles miss keyword opportunities and look thin in SERPs.',
    });
  }

  // Missing meta description
  if (!meta.metaDescription || meta.metaDescription.trim().length === 0) {
    issues.push({
      issueType: 'weak-meta-description' as HealingIssueType,
      severity: 'critical' as HealingSeverity,
      description: 'Page is missing a meta description.',
      currentValue: undefined,
      suggestedFix:
        'Add a compelling meta description of 150-160 characters. Lead with the primary benefit, include the target keyword, and end with a call-to-action such as "Learn more" or "Get started today".',
      estimatedImpact: 'Meta descriptions directly affect click-through rate from search results.',
    });
  }

  // Weak meta description (too short)
  if (meta.metaDescription && meta.metaDescription.length < 100) {
    issues.push({
      issueType: 'weak-meta-description' as HealingIssueType,
      severity: 'warning' as HealingSeverity,
      description: `Meta description is only ${meta.metaDescription.length} characters. Aim for 150-160 characters.`,
      currentValue: meta.metaDescription,
      suggestedFix: `Expand the current description: "${meta.metaDescription}" — add more detail about the value proposition and include a call-to-action. Target 150-160 characters.`,
      estimatedImpact: 'Longer, more descriptive meta descriptions improve CTR.',
    });
  }

  // Missing H1
  if (!meta.h1 || meta.h1.trim().length === 0) {
    issues.push({
      issueType: 'missing-h1' as HealingIssueType,
      severity: 'critical' as HealingSeverity,
      description: 'Page is missing an H1 heading.',
      currentValue: undefined,
      suggestedFix:
        'Add a single H1 heading that clearly states the page topic, includes the primary keyword, and — where relevant — mentions the entity name. The H1 should be unique to this page.',
      estimatedImpact: 'H1 is a primary on-page SEO and GEO signal.',
    });
  }

  // Missing schema
  if (meta.hasSchema === false) {
    issues.push({
      issueType: 'broken-schema' as HealingIssueType,
      severity: 'warning' as HealingSeverity,
      description: 'No structured data (JSON-LD schema) detected on this page.',
      currentValue: 'No schema',
      suggestedFix:
        'Add JSON-LD schema markup appropriate to the page type. For an article: {"@type": "Article"} with headline, author, datePublished. For an organisation landing page: {"@type": "Organization"} with name, url, logo. Use Google\'s Schema Markup Validator to verify.',
      estimatedImpact: 'Schema markup improves rich results eligibility and AI citability.',
    });
  }

  // Low GEO score
  if (typeof meta.geoScore === 'number' && meta.geoScore < 60) {
    issues.push({
      issueType: 'low-geo-score' as HealingIssueType,
      severity: meta.geoScore < 40 ? 'critical' : 'warning',
      description: `GEO citability score is ${meta.geoScore}/100 — below the 60-point threshold for AI search visibility.`,
      currentValue: String(meta.geoScore),
      suggestedFix:
        'Improve GEO score by: (1) Adding entity name consistently in H1, first paragraph, and conclusion. (2) Using structured "passage" format — clear question + concise answer blocks that AI can extract. (3) Adding relevant statistics with source citations. (4) Including FAQ schema for common questions.',
      estimatedImpact: 'Low GEO score means the page is rarely cited by AI search engines.',
    });
  }

  // Low quality score
  if (typeof meta.qualityScore === 'number' && meta.qualityScore < 60) {
    issues.push({
      issueType: 'low-quality-score' as HealingIssueType,
      severity: meta.qualityScore < 40 ? 'critical' : 'warning',
      description: `Content quality score is ${meta.qualityScore}/100 — indicates AI-like phrasing, filler content, or thin depth.`,
      currentValue: String(meta.qualityScore),
      suggestedFix:
        'Improve quality score by: (1) Removing AI slop phrases ("In conclusion", "It\'s worth noting", "Delve into"). (2) Adding specific examples, case studies, or data points. (3) Replacing passive voice with active voice. (4) Breaking up long paragraphs into focused, scannable sections.',
      estimatedImpact: 'Low quality scores hurt E-E-A-T, user engagement, and rankings.',
    });
  }

  // Missing entity references
  if (meta.geoScore !== undefined && meta.geoScore < 70 && meta.title && !meta.h1) {
    issues.push({
      issueType: 'missing-entity' as HealingIssueType,
      severity: 'warning' as HealingSeverity,
      description: 'Entity name may not be consistently referenced across key heading and body elements.',
      currentValue: undefined,
      suggestedFix:
        'Ensure the primary entity name (brand, product, or topic) appears: in the H1, in the first 100 words, and in at least one subheading. Consistent entity references improve Knowledge Graph association and AI citability.',
      estimatedImpact: 'Entity consistency is a primary GEO and Knowledge Graph signal.',
    });
  }

  return issues;
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Analyse a URL for healing opportunities.
 * Persists each issue as a HealingAction in the database.
 * Returns the list of issues found.
 */
export async function analyzeForHealing(
  url: string,
  userId: string,
  orgId: string,
  pageMetadata?: PageMetadata
): Promise<HealingIssue[]> {
  // Use provided metadata or fall back to minimal defaults for offline analysis
  const meta: PageMetadata = pageMetadata ?? {
    title: undefined,
    metaDescription: undefined,
    h1: undefined,
    hasSchema: false,
    geoScore: undefined,
    qualityScore: undefined,
  };

  const issues = detectIssues(meta);

  // Persist each issue as a HealingAction
  if (issues.length > 0) {
    await prisma.healingAction.createMany({
      data: issues.map((issue) => ({
        userId,
        orgId,
        targetUrl: url,
        issueType: issue.issueType,
        severity: issue.severity,
        description: issue.description,
        suggestedFix: issue.suggestedFix,
        fixApplied: false,
      })),
    });
  }

  return issues;
}

/**
 * Generate a fix suggestion string for a given issue.
 * Used when the full HealingIssue object is not available.
 */
export function generateFixSuggestion(issue: HealingIssue): string {
  return issue.suggestedFix;
}

/**
 * Mark a HealingAction as applied.
 */
export async function markFixApplied(healingActionId: string): Promise<void> {
  await prisma.healingAction.update({
    where: { id: healingActionId },
    data: { fixApplied: true, appliedAt: new Date() },
  });
}
