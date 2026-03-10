/**
 * SEO Audit API
 *
 * Performs comprehensive SEO audits on websites.
 * Protected by authentication and subscription checks.
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - JWT_SECRET: Token signing key (CRITICAL)
 * - DATABASE_URL: PostgreSQL connection (CRITICAL)
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { APISecurityChecker, DEFAULT_POLICIES } from '@/lib/security/api-security-checker';
import { subscriptionService, PLAN_LIMITS } from '@/lib/stripe/subscription-service';
import { logger } from '@/lib/logger';

// Request validation schema
const AuditRequestSchema = z.object({
  url: z.string().url('Invalid URL provided'),
  depth: z.number().min(1).max(10).optional().default(3),
  includeSchemaCheck: z.boolean().optional().default(true),
  includeCoreWebVitals: z.boolean().optional().default(true),
  includeContentAnalysis: z.boolean().optional().default(true),
});

/**
 * Perform a real SEO audit using Google PageSpeed Insights API.
 * Falls back to basic HTML analysis if PageSpeed API fails.
 *
 * ENVIRONMENT VARIABLES (OPTIONAL):
 * - GOOGLE_PAGESPEED_API_KEY: For higher rate limits (PUBLIC, optional)
 */
async function performSEOAudit(url: string, options: Omit<z.infer<typeof AuditRequestSchema>, 'url'>) {
  const domain = new URL(url).hostname;
  const issues: { severity: string; title: string; description: string; recommendation: string; affectedPages: string[] }[] = [];

  // -- Core Web Vitals via Google PageSpeed Insights API --
  let cwv = null;
  let performanceScore = 0;
  let accessibilityScore = 0;
  let seoScore = 0;
  let bestPracticesScore = 0;

  if (options.includeCoreWebVitals) {
    try {
      const apiKey = process.env.GOOGLE_PAGESPEED_API_KEY;
      const psiUrl = new URL('https://www.googleapis.com/pagespeedonline/v5/runPagespeed');
      psiUrl.searchParams.set('url', url);
      psiUrl.searchParams.set('strategy', 'mobile');
      psiUrl.searchParams.set('category', 'PERFORMANCE');
      psiUrl.searchParams.set('category', 'ACCESSIBILITY');
      psiUrl.searchParams.set('category', 'SEO');
      psiUrl.searchParams.set('category', 'BEST_PRACTICES');
      if (apiKey) psiUrl.searchParams.set('key', apiKey);

      const psiRes = await fetch(psiUrl.toString(), { signal: AbortSignal.timeout(30000) });

      if (psiRes.ok) {
        const psi = await psiRes.json();

        // Extract Lighthouse scores
        const categories = psi.lighthouseResult?.categories;
        performanceScore = Math.round((categories?.performance?.score || 0) * 100);
        accessibilityScore = Math.round((categories?.accessibility?.score || 0) * 100);
        seoScore = Math.round((categories?.seo?.score || 0) * 100);
        bestPracticesScore = Math.round((categories?.['best-practices']?.score || 0) * 100);

        // Extract Core Web Vitals from field data or lab data
        const fieldMetrics = psi.loadingExperience?.metrics;
        const labAudits = psi.lighthouseResult?.audits;

        const lcpValue = fieldMetrics?.LARGEST_CONTENTFUL_PAINT_MS?.percentile
          ? fieldMetrics.LARGEST_CONTENTFUL_PAINT_MS.percentile / 1000
          : labAudits?.['largest-contentful-paint']?.numericValue
            ? labAudits['largest-contentful-paint'].numericValue / 1000
            : null;

        const clsValue = fieldMetrics?.CUMULATIVE_LAYOUT_SHIFT_SCORE?.percentile
          ? fieldMetrics.CUMULATIVE_LAYOUT_SHIFT_SCORE.percentile / 100
          : labAudits?.['cumulative-layout-shift']?.numericValue ?? null;

        const inpValue = fieldMetrics?.INTERACTION_TO_NEXT_PAINT?.percentile ?? null;

        const fidValue = fieldMetrics?.FIRST_INPUT_DELAY_MS?.percentile ?? null;

        function rateMetric(value: number | null, good: number, poor: number): string {
          if (value === null) return 'no-data';
          return value <= good ? 'good' : value <= poor ? 'needs-improvement' : 'poor';
        }

        cwv = {
          lcp: { value: lcpValue, rating: rateMetric(lcpValue, 2.5, 4.0) },
          fid: { value: fidValue, rating: rateMetric(fidValue, 100, 300) },
          cls: { value: clsValue, rating: rateMetric(clsValue, 0.1, 0.25) },
          inp: { value: inpValue, rating: rateMetric(inpValue, 200, 500) },
        };

        // Extract failed Lighthouse audits as issues
        const audits = psi.lighthouseResult?.audits || {};
        for (const [key, audit] of Object.entries(audits) as [string, any][]) {
          if (audit.score !== null && audit.score < 0.5 && audit.title) {
            const severity = audit.score === 0 ? 'critical' : 'major';
            issues.push({
              severity,
              title: audit.title,
              description: audit.description?.replace(/<[^>]*>/g, '').slice(0, 200) || '',
              recommendation: audit.details?.items?.[0]?.node?.explanation || `Improve ${audit.title}`,
              affectedPages: [url],
            });
          }
        }
      }
    } catch (error) {
      logger.warn('PageSpeed Insights API failed, using partial data:', { error });
    }
  }

  // -- Basic HTML analysis via fetch --
  let schemaData = null;
  try {
    const pageRes = await fetch(url, {
      headers: { 'User-Agent': 'SynthexBot/1.0 (+https://synthex.social)' },
      signal: AbortSignal.timeout(15000),
    });

    if (pageRes.ok) {
      const html = await pageRes.text();

      // Check meta description
      if (!html.match(/<meta[^>]+name=["']description["'][^>]*>/i)) {
        issues.push({
          severity: 'critical',
          title: 'Missing meta description',
          description: 'The page is missing a meta description tag',
          recommendation: 'Add a unique meta description between 150-160 characters',
          affectedPages: [url],
        });
      }

      // Check title tag
      const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
      if (!titleMatch || !titleMatch[1].trim()) {
        issues.push({
          severity: 'critical',
          title: 'Missing or empty title tag',
          description: 'The page is missing a title tag',
          recommendation: 'Add a unique title tag between 50-60 characters',
          affectedPages: [url],
        });
      } else if (titleMatch[1].length > 70) {
        issues.push({
          severity: 'minor',
          title: 'Title tag too long',
          description: `Title tag is ${titleMatch[1].length} characters (recommended max: 60)`,
          recommendation: 'Shorten the title to 50-60 characters',
          affectedPages: [url],
        });
      }

      // Check images without alt text
      const imgMatches = html.match(/<img[^>]*>/gi) || [];
      const missingAlt = imgMatches.filter(img => !img.match(/alt=["'][^"']+["']/i));
      if (missingAlt.length > 0) {
        issues.push({
          severity: 'minor',
          title: 'Images missing alt text',
          description: `${missingAlt.length} image(s) are missing alt text`,
          recommendation: 'Add descriptive alt text to all images for accessibility and SEO',
          affectedPages: [url],
        });
      }

      // Check viewport meta
      if (!html.match(/<meta[^>]+name=["']viewport["'][^>]*>/i)) {
        issues.push({
          severity: 'major',
          title: 'Missing viewport meta tag',
          description: 'Page may not be mobile-friendly without viewport meta',
          recommendation: 'Add <meta name="viewport" content="width=device-width, initial-scale=1">',
          affectedPages: [url],
        });
      }

      // Check for canonical tag
      if (!html.match(/<link[^>]+rel=["']canonical["'][^>]*>/i)) {
        issues.push({
          severity: 'minor',
          title: 'Missing canonical tag',
          description: 'No canonical URL specified — may cause duplicate content issues',
          recommendation: 'Add a <link rel="canonical"> tag pointing to the preferred URL',
          affectedPages: [url],
        });
      }

      // Schema detection
      if (options.includeSchemaCheck) {
        const schemaTypes: string[] = [];
        const ldJsonMatches = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || [];
        for (const block of ldJsonMatches) {
          const content = block.replace(/<\/?script[^>]*>/gi, '');
          try {
            const parsed = JSON.parse(content);
            if (parsed['@type']) schemaTypes.push(parsed['@type']);
            if (parsed['@graph']) {
              for (const item of parsed['@graph']) {
                if (item['@type']) schemaTypes.push(item['@type']);
              }
            }
          } catch { /* malformed JSON-LD */ }
        }

        const recommendations: string[] = [];
        if (!schemaTypes.includes('Organization') && !schemaTypes.includes('LocalBusiness')) {
          recommendations.push('Add Organization or LocalBusiness schema');
        }
        if (!schemaTypes.includes('BreadcrumbList')) {
          recommendations.push('Add BreadcrumbList schema for navigation');
        }
        if (!schemaTypes.includes('WebSite')) {
          recommendations.push('Add WebSite schema with search action');
        }

        schemaData = {
          detected: schemaTypes.length > 0 ? schemaTypes : ['None detected'],
          valid: schemaTypes.length > 0,
          recommendations,
        };
      }
    }
  } catch (error) {
    logger.warn('HTML fetch failed for SEO analysis:', { error });
  }

  // Categorize issues
  const critical = issues.filter(i => i.severity === 'critical');
  const major = issues.filter(i => i.severity === 'major');
  const minor = issues.filter(i => i.severity === 'minor');
  const info = issues.filter(i => i.severity === 'info');

  // Calculate composite score
  const overallScore = seoScore > 0
    ? Math.round((performanceScore * 0.3 + seoScore * 0.4 + accessibilityScore * 0.15 + bestPracticesScore * 0.15))
    : Math.max(0, 100 - (critical.length * 15) - (major.length * 8) - (minor.length * 2));

  return {
    url,
    domain,
    timestamp: new Date().toISOString(),
    score: overallScore,
    crawledPages: 1,
    lighthouse: {
      performance: performanceScore,
      seo: seoScore,
      accessibility: accessibilityScore,
      bestPractices: bestPracticesScore,
    },
    issues: {
      critical: critical.length,
      major: major.length,
      minor: minor.length,
      info: info.length,
    },
    categories: {
      technical: {
        score: performanceScore || Math.max(0, 100 - critical.length * 20 - major.length * 10),
        issues: issues.filter(i => ['Missing viewport', 'Slow', 'Missing canonical'].some(t => i.title.includes(t)) || i.severity === 'critical'),
      },
      onPage: {
        score: seoScore || Math.max(0, 100 - minor.length * 5),
        issues: issues.filter(i => i.title.includes('alt text') || i.title.includes('title') || i.title.includes('meta')),
      },
      content: {
        score: bestPracticesScore || 85,
        issues: info,
      },
      coreWebVitals: cwv,
      schema: schemaData,
    },
  };
}

/**
 * POST /api/seo/audit
 * Run a comprehensive SEO audit
 */
export async function POST(request: NextRequest) {
  // Security check
  const security = await APISecurityChecker.check(
    request,
    DEFAULT_POLICIES.AUTHENTICATED_WRITE
  );

  if (!security.allowed) {
    return APISecurityChecker.createSecureResponse(
      { error: security.error },
      security.error === 'Authentication required' ? 401 : 403
    );
  }

  try {
    const userId = security.context.userId;
    if (!userId) {
      return APISecurityChecker.createSecureResponse(
        { error: 'User ID not found' },
        401
      );
    }

    // Check subscription — Professional plan or higher required
    const ALLOWED_PLANS = ['professional', 'business', 'custom'];
    const subscription = await subscriptionService.getSubscription(userId);
    if (!subscription || !ALLOWED_PLANS.includes(subscription.plan)) {
      return APISecurityChecker.createSecureResponse(
        {
          error: 'This feature requires a Professional or Business plan.',
          upgrade: true,
        },
        403
      );
    }

    // Check audit limits using real usage count
    const planLimits = PLAN_LIMITS[subscription.plan] || PLAN_LIMITS.free;
    const usageCount = await prisma.sEOAudit.count({
      where: {
        userId,
        createdAt: {
          gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1), // Start of current month
        },
      },
    });

    if (planLimits.maxSeoAudits !== -1 && usageCount >= planLimits.maxSeoAudits) {
      return APISecurityChecker.createSecureResponse(
        { error: 'Monthly audit limit reached', upgradeRequired: true },
        429
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validationResult = AuditRequestSchema.safeParse(body);

    if (!validationResult.success) {
      return APISecurityChecker.createSecureResponse(
        {
          success: false,
          error: 'Invalid request',
          details: validationResult.error.errors,
        },
        400
      );
    }

    const { url, depth, includeSchemaCheck, includeCoreWebVitals, includeContentAnalysis } = validationResult.data;

    // Perform the audit (async — must be awaited)
    const auditResult = await performSEOAudit(url, {
      depth,
      includeSchemaCheck,
      includeCoreWebVitals,
      includeContentAnalysis,
    });

    // Store audit result in database for history
    await prisma.sEOAudit.create({
      data: {
        userId,
        url,
        auditType: 'full',
        overallScore: auditResult.score,
        technicalScore: auditResult.lighthouse,
        recommendations: auditResult.issues,
        rawData: auditResult,
      },
    });

    return APISecurityChecker.createSecureResponse({
      success: true,
      audit: auditResult,
      limits: {
        used: usageCount + 1, // Including this audit
        remaining: planLimits.maxSeoAudits === -1 ? 'unlimited' : planLimits.maxSeoAudits - usageCount - 1,
      },
    });
  } catch (error) {
    logger.error('SEO Audit API error:', error);
    return APISecurityChecker.createSecureResponse(
      { error: 'Failed to perform SEO audit' },
      500
    );
  }
}

/**
 * GET /api/seo/audit
 * Get audit history
 */
export async function GET(request: NextRequest) {
  // Security check
  const security = await APISecurityChecker.check(
    request,
    DEFAULT_POLICIES.AUTHENTICATED_READ
  );

  if (!security.allowed) {
    return APISecurityChecker.createSecureResponse(
      { error: security.error },
      security.error === 'Authentication required' ? 401 : 403
    );
  }

  try {
    const userId = security.context.userId;
    if (!userId) {
      return APISecurityChecker.createSecureResponse(
        { error: 'User ID not found' },
        401
      );
    }

    // Check subscription — Professional plan or higher required
    const ALLOWED_PLANS = ['professional', 'business', 'custom'];
    const subscription = await subscriptionService.getSubscription(userId);
    if (!subscription || !ALLOWED_PLANS.includes(subscription.plan)) {
      return APISecurityChecker.createSecureResponse(
        {
          error: 'This feature requires a Professional or Business plan.',
          upgrade: true,
        },
        403
      );
    }

    // Fetch actual audit history from database
    const audits = await prisma.sEOAudit.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        url: true,
        overallScore: true,
        auditType: true,
        recommendations: true,
        createdAt: true,
      },
    });

    if (audits.length === 0) {
      return APISecurityChecker.createSecureResponse({
        success: true,
        audits: [],
        total: 0,
        message: 'No SEO audits have been run yet. Run your first audit to start building history.',
      });
    }

    return APISecurityChecker.createSecureResponse({
      success: true,
      audits,
      total: audits.length,
    });
  } catch (error) {
    logger.error('SEO Audit history error:', error);
    return APISecurityChecker.createSecureResponse(
      { error: 'Failed to fetch audit history' },
      500
    );
  }
}
