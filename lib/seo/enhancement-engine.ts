/**
 * Post-Audit Enhancement Engine
 *
 * Reads a completed SEOAudit, classifies issues into actionable categories,
 * and returns a plan split into auto-executable and human-approval buckets.
 *
 * Auto-execute (safe): sitemap submission, indexing requests
 * Needs approval: schema markup, meta tag changes, GBP completeness
 *
 * UNI-1610
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import {
  executeSitemapSubmission,
  executeIndexingRequests,
} from './enhancement-actions';

// ============================================================================
// TYPES
// ============================================================================

export interface EnhancementAction {
  type:
    | 'sitemap-submit'
    | 'indexing-request'
    | 'schema-markup'
    | 'meta-tag'
    | 'gbp-completeness';
  title: string;
  description: string;
  severity: string;
  estimatedImpact: 'high' | 'medium' | 'low';
}

export interface EnhancementPlan {
  autoExecute: EnhancementAction[];
  needsApproval: EnhancementAction[];
}

// ============================================================================
// CLASSIFICATION
// ============================================================================

/**
 * Classify audit issues into enhancement categories based on keyword matching
 * on issue titles/descriptions.
 */
function classifyIssues(
  issues: Array<{
    severity: string;
    title: string;
    description?: string;
    affectedPages?: string[];
  }>
): EnhancementPlan {
  const autoExecute: EnhancementAction[] = [];
  const needsApproval: EnhancementAction[] = [];

  // Track if we've already added a sitemap action (avoid duplicates)
  let sitemapAdded = false;
  const indexingUrls: string[] = [];

  for (const issue of issues) {
    const titleLower = issue.title.toLowerCase();
    const descLower = (issue.description ?? '').toLowerCase();
    const combined = `${titleLower} ${descLower}`;

    // Sitemap patterns
    if (
      !sitemapAdded &&
      combined.includes('sitemap') &&
      (combined.includes('missing') ||
        combined.includes('not submitted') ||
        combined.includes('error'))
    ) {
      autoExecute.push({
        type: 'sitemap-submit',
        title: 'Submit sitemap to Google',
        description:
          'Your sitemap is missing or not submitted. We will submit it to GSC automatically.',
        severity: issue.severity,
        estimatedImpact: 'high',
      });
      sitemapAdded = true;
      continue;
    }

    // Indexing patterns
    if (
      combined.includes('not indexed') ||
      (combined.includes('discovered') && combined.includes('not indexed')) ||
      (combined.includes('crawled') && combined.includes('not indexed'))
    ) {
      // Collect URLs for batch indexing request
      const pages = issue.affectedPages ?? [];
      indexingUrls.push(...pages);
      continue;
    }

    // Schema markup patterns
    if (
      combined.includes('schema') ||
      combined.includes('structured data') ||
      combined.includes('json-ld') ||
      combined.includes('rich result')
    ) {
      needsApproval.push({
        type: 'schema-markup',
        title: `Add schema markup: ${issue.title}`,
        description:
          issue.description ??
          'Missing structured data detected. Review and add appropriate schema.',
        severity: issue.severity,
        estimatedImpact: 'medium',
      });
      continue;
    }

    // Meta tag patterns
    if (
      combined.includes('meta description') ||
      combined.includes('title tag') ||
      combined.includes('missing meta') ||
      combined.includes('missing title')
    ) {
      needsApproval.push({
        type: 'meta-tag',
        title: `Fix meta tags: ${issue.title}`,
        description:
          issue.description ?? 'Meta tag issues detected. Review and update.',
        severity: issue.severity,
        estimatedImpact: 'medium',
      });
      continue;
    }
  }

  // Add batch indexing request if URLs found
  if (indexingUrls.length > 0) {
    const uniqueUrls = [...new Set(indexingUrls)];
    autoExecute.push({
      type: 'indexing-request',
      title: `Request indexing for ${uniqueUrls.length} URL${uniqueUrls.length !== 1 ? 's' : ''}`,
      description: `Submit indexing requests for discovered-but-not-indexed pages (within 200/day quota).`,
      severity: 'major',
      estimatedImpact: 'high',
    });
  }

  return { autoExecute, needsApproval };
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Analyse a completed audit and produce an enhancement plan.
 */
export async function analyseAuditForEnhancements(
  auditId: string,
  userId: string,
  orgId: string
): Promise<EnhancementPlan> {
  const audit = await prisma.sEOAudit.findFirst({
    where: { id: parseInt(auditId, 10), userId },
    select: { rawData: true, recommendations: true, url: true },
  });

  if (!audit) {
    return { autoExecute: [], needsApproval: [] };
  }

  // Extract issues from rawData or recommendations
  const rawData = audit.rawData as Record<string, unknown> | null;
  const recommendations = audit.recommendations as Record<
    string,
    unknown
  > | null;

  let issues: Array<{
    severity: string;
    title: string;
    description?: string;
    affectedPages?: string[];
  }> = [];

  // Try to get issues from rawData.categories first (richer data)
  if (rawData) {
    const categories = rawData.categories as
      | Record<
          string,
          {
            issues?: Array<{
              severity: string;
              title: string;
              description?: string;
              affectedPages?: string[];
            }>;
          }
        >
      | undefined;
    if (categories) {
      for (const cat of Object.values(categories)) {
        if (Array.isArray(cat?.issues)) {
          issues.push(...cat.issues);
        }
      }
    }
  }

  // Also check if recommendations has issue-like data
  if (issues.length === 0 && recommendations) {
    // recommendations might be { critical: N, major: N, ... } or an array
    if (Array.isArray(recommendations)) {
      issues = recommendations as typeof issues;
    }
  }

  // If we still have no issues but have the URL, add it for potential indexing
  if (issues.length === 0 && audit.url) {
    // No specific issues found — nothing to enhance
    return { autoExecute: [], needsApproval: [] };
  }

  return classifyIssues(issues);
}

/**
 * Execute safe auto-enhancements from a plan.
 */
export async function executeAutoEnhancements(
  plan: EnhancementPlan,
  userId: string,
  orgId: string
): Promise<{ executed: number; errors: number }> {
  let executed = 0;
  let errors = 0;

  for (const action of plan.autoExecute) {
    try {
      switch (action.type) {
        case 'sitemap-submit': {
          const result = await executeSitemapSubmission(orgId);
          if (result.submitted) {
            executed++;
            logger.info('[Enhancement] Sitemap submitted', {
              orgId,
              sitemapUrl: result.sitemapUrl,
            });
          }
          break;
        }
        case 'indexing-request': {
          // Extract URLs from the action description or use a default approach
          const result = await executeIndexingRequests(orgId, []);
          executed += result.submitted;
          logger.info('[Enhancement] Indexing requests sent', {
            orgId,
            submitted: result.submitted,
            skipped: result.skipped,
          });
          break;
        }
        default:
          // Other types should not appear in autoExecute
          break;
      }
    } catch (err) {
      logger.warn('[Enhancement] Action failed', {
        type: action.type,
        error: err,
      });
      errors++;
    }
  }

  return { executed, errors };
}
