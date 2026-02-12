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
import { APISecurityChecker, DEFAULT_POLICIES } from '@/lib/security/api-security-checker';
import { subscriptionService, PLAN_LIMITS } from '@/lib/stripe/subscription-service';

// Request validation schema
const AuditRequestSchema = z.object({
  url: z.string().url('Invalid URL provided'),
  depth: z.number().min(1).max(10).optional().default(3),
  includeSchemaCheck: z.boolean().optional().default(true),
  includeCoreWebVitals: z.boolean().optional().default(true),
  includeContentAnalysis: z.boolean().optional().default(true),
});

// Mock SEO audit data - In production, this would use actual crawling/analysis
function performSEOAudit(url: string, options: Omit<z.infer<typeof AuditRequestSchema>, 'url'>) {
  const domain = new URL(url).hostname;

  return {
    url,
    domain,
    timestamp: new Date().toISOString(),
    score: Math.floor(70 + Math.random() * 25),
    crawledPages: Math.floor(5 + Math.random() * 20),
    issues: {
      critical: Math.floor(Math.random() * 3),
      major: Math.floor(Math.random() * 8),
      minor: Math.floor(5 + Math.random() * 15),
      info: Math.floor(10 + Math.random() * 20),
    },
    categories: {
      technical: {
        score: Math.floor(70 + Math.random() * 30),
        issues: [
          {
            severity: 'critical',
            title: 'Missing meta description',
            description: 'Home page is missing a meta description tag',
            recommendation: 'Add a unique meta description between 150-160 characters',
            affectedPages: [url],
          },
          {
            severity: 'major',
            title: 'Slow page load time',
            description: 'Page load time exceeds 3 seconds',
            recommendation: 'Optimize images and enable compression',
            affectedPages: [`${url}/features`],
          },
        ],
      },
      onPage: {
        score: Math.floor(75 + Math.random() * 25),
        issues: [
          {
            severity: 'minor',
            title: 'Missing alt text',
            description: '5 images are missing alt text',
            recommendation: 'Add descriptive alt text to all images',
            affectedPages: [`${url}/about`, `${url}/team`],
          },
        ],
      },
      content: {
        score: Math.floor(80 + Math.random() * 20),
        issues: [
          {
            severity: 'info',
            title: 'Short content',
            description: 'Some pages have less than 300 words',
            recommendation: 'Expand content to provide more value',
            affectedPages: [`${url}/contact`],
          },
        ],
      },
      coreWebVitals: options.includeCoreWebVitals ? {
        lcp: { value: 2.1 + Math.random() * 1.5, rating: 'good' },
        fid: { value: 50 + Math.random() * 100, rating: 'good' },
        cls: { value: 0.05 + Math.random() * 0.15, rating: 'good' },
        inp: { value: 150 + Math.random() * 100, rating: 'needs-improvement' },
      } : null,
      schema: options.includeSchemaCheck ? {
        detected: ['Organization', 'WebSite'],
        valid: true,
        recommendations: ['Add LocalBusiness schema', 'Add BreadcrumbList schema'],
      } : null,
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

    // Get subscription
    const subscription = await subscriptionService.getOrCreateSubscription(userId);

    // Check if user has SEO access
    if (subscription.plan === 'free') {
      return APISecurityChecker.createSecureResponse(
        {
          success: false,
          error: 'SEO audits require a paid subscription',
          upgradeRequired: true,
          requiredPlan: 'professional',
        },
        402
      );
    }

    // Check audit limits
    const planLimits = PLAN_LIMITS[subscription.plan] || PLAN_LIMITS.free;
    // TODO: Track and check actual usage
    // if (planLimits.maxSeoAudits !== -1 && usage >= planLimits.maxSeoAudits) {
    //   return APISecurityChecker.createSecureResponse(
    //     { error: 'Monthly audit limit reached', upgradeRequired: true },
    //     429
    //   );
    // }

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

    // Perform the audit
    const auditResult = performSEOAudit(url, {
      depth,
      includeSchemaCheck,
      includeCoreWebVitals,
      includeContentAnalysis,
    });

    // TODO: Store audit result in database for history

    return APISecurityChecker.createSecureResponse({
      success: true,
      audit: auditResult,
      limits: {
        used: 1, // TODO: Track actual usage
        remaining: planLimits.maxSeoAudits === -1 ? 'unlimited' : planLimits.maxSeoAudits - 1,
      },
    });
  } catch (error) {
    console.error('SEO Audit API error:', error);
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

    // Get subscription
    const subscription = await subscriptionService.getOrCreateSubscription(userId);

    if (subscription.plan === 'free') {
      return APISecurityChecker.createSecureResponse(
        {
          success: false,
          error: 'SEO audits require a paid subscription',
          upgradeRequired: true,
        },
        402
      );
    }

    // TODO: Fetch actual audit history from database
    const mockHistory = [
      {
        id: '1',
        url: 'https://synthex.social',
        score: 92,
        issues: { total: 8, critical: 0, major: 2, minor: 6 },
        createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: '2',
        url: 'https://synthex.social/pricing',
        score: 87,
        issues: { total: 15, critical: 1, major: 4, minor: 10 },
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      },
    ];

    return APISecurityChecker.createSecureResponse({
      success: true,
      audits: mockHistory,
      total: mockHistory.length,
    });
  } catch (error) {
    console.error('SEO Audit history error:', error);
    return APISecurityChecker.createSecureResponse(
      { error: 'Failed to fetch audit history' },
      500
    );
  }
}
