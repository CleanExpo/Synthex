/**
 * Competitive Intelligence API
 *
 * @description Analyze competitors and benchmark performance
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - NEXT_PUBLIC_SUPABASE_URL: Supabase URL (PUBLIC)
 * - SUPABASE_SERVICE_ROLE_KEY: Supabase service role key (SECRET)
 *
 * FAILURE MODE: Returns error response with details
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { APISecurityChecker, DEFAULT_POLICIES } from '@/lib/security/api-security-checker';
import { auditLogger } from '@/lib/security/audit-logger';
import { competitiveIntel, Platform } from '@/lib/services/competitive-intel';
import { logger } from '@/lib/logger';

// Request validation schemas
const AddCompetitorSchema = z.object({
  name: z.string().min(1).max(100),
  handles: z.record(z.string()).optional(),
  website: z.string().url().optional(),
  industry: z.string().optional(),
  notes: z.string().optional(),
});

const BenchmarkSchema = z.object({
  competitorIds: z.array(z.string()).optional(),
  platforms: z.array(z.string()).optional(),
  period: z.object({
    start: z.string().datetime(),
    end: z.string().datetime(),
  }).optional(),
});

const HashtagAnalysisSchema = z.object({
  platform: z.string(),
  competitorIds: z.array(z.string()).optional(),
  limit: z.number().min(1).max(100).optional(),
});

const ContentGapsSchema = z.object({
  platform: z.string(),
  competitorIds: z.array(z.string()).optional(),
});

const SentimentSchema = z.object({
  platform: z.string(),
  competitorIds: z.array(z.string()).optional(),
});

/**
 * GET /api/intelligence/competitors
 * Get competitors or analysis
 */
export async function GET(request: NextRequest) {
  const security = await APISecurityChecker.check(
    request,
    DEFAULT_POLICIES.AUTHENTICATED_READ
  );

  if (!security.allowed) {
    return APISecurityChecker.createSecureResponse(
      { error: security.error },
      403
    );
  }

  const userId = security.context.userId!;
  const { searchParams } = new URL(request.url);

  try {
    const action = searchParams.get('action') || 'list';

    // List competitors
    if (action === 'list') {
      const activeOnly = searchParams.get('activeOnly') === 'true';
      const platform = searchParams.get('platform') as Platform | undefined;

      const competitors = await competitiveIntel.getCompetitors(userId, {
        activeOnly,
        platform,
      });

      return APISecurityChecker.createSecureResponse({
        competitors,
        total: competitors.length,
      });
    }

    // Get competitor profile
    if (action === 'profile') {
      const competitorId = searchParams.get('competitorId');
      const platform = searchParams.get('platform') as Platform;

      if (!competitorId || !platform) {
        return APISecurityChecker.createSecureResponse(
          { error: 'Competitor ID and platform are required' },
          400
        );
      }

      const profile = await competitiveIntel.getCompetitorProfile(
        competitorId,
        platform
      );

      if (!profile) {
        return APISecurityChecker.createSecureResponse(
          { error: 'Profile not found' },
          404
        );
      }

      return APISecurityChecker.createSecureResponse({ profile });
    }

    // Get competitor content
    if (action === 'content') {
      const competitorId = searchParams.get('competitorId');
      const platform = searchParams.get('platform') as Platform;
      const limit = parseInt(searchParams.get('limit') || '50', 10);

      if (!competitorId || !platform) {
        return APISecurityChecker.createSecureResponse(
          { error: 'Competitor ID and platform are required' },
          400
        );
      }

      const content = await competitiveIntel.analyzeCompetitorContent(
        competitorId,
        platform,
        { limit }
      );

      return APISecurityChecker.createSecureResponse({
        content,
        total: content.length,
      });
    }

    // Get strategic insights
    if (action === 'insights') {
      const platforms = searchParams.get('platforms')?.split(',') as Platform[] | undefined;

      const insights = await competitiveIntel.getStrategicInsights(userId, {
        platforms,
      });

      return APISecurityChecker.createSecureResponse({ insights });
    }

    return APISecurityChecker.createSecureResponse(
      { error: 'Invalid action' },
      400
    );
  } catch (error: unknown) {
    logger.error('Competitors GET error:', { error });
    return APISecurityChecker.createSecureResponse(
      { error: 'Internal server error' },
      500
    );
  }
}

/**
 * POST /api/intelligence/competitors
 * Add competitor or run analysis
 */
export async function POST(request: NextRequest) {
  const security = await APISecurityChecker.check(
    request,
    DEFAULT_POLICIES.AUTHENTICATED_WRITE
  );

  if (!security.allowed) {
    return APISecurityChecker.createSecureResponse(
      { error: security.error },
      403
    );
  }

  const userId = security.context.userId!;
  const { searchParams } = new URL(request.url);

  try {
    const body = await request.json();
    const action = searchParams.get('action') || 'add';

    // Add competitor
    if (action === 'add') {
      const validated = AddCompetitorSchema.parse(body);

      const competitor = await competitiveIntel.addCompetitor(userId, {
        name: validated.name,
        handles: validated.handles as Partial<Record<Platform, string>>,
        website: validated.website,
        industry: validated.industry,
        notes: validated.notes,
      });

      await auditLogger.logData(
        'create',
        'intelligence',
        competitor.id,
        userId,
        'success',
        { action: 'COMPETITOR_ADD', name: competitor.name }
      );

      return APISecurityChecker.createSecureResponse({ competitor }, 201);
    }

    // Generate benchmark report
    if (action === 'benchmark') {
      const validated = BenchmarkSchema.parse(body);

      const report = await competitiveIntel.generateBenchmarkReport(userId, {
        competitorIds: validated.competitorIds,
        platforms: validated.platforms as Platform[],
        period: validated.period
          ? {
              start: new Date(validated.period.start),
              end: new Date(validated.period.end),
            }
          : undefined,
      });

      await auditLogger.logData(
        'read',
        'intelligence',
        undefined,
        userId,
        'success',
        {
          action: 'BENCHMARK_REPORT_GENERATED',
          competitors: report.competitors.length,
          platforms: report.platforms,
        }
      );

      return APISecurityChecker.createSecureResponse({ report });
    }

    // Analyze hashtags
    if (action === 'hashtags') {
      const validated = HashtagAnalysisSchema.parse(body);

      const analysis = await competitiveIntel.analyzeHashtags(
        userId,
        validated.platform as Platform,
        {
          competitorIds: validated.competitorIds,
          limit: validated.limit,
        }
      );

      return APISecurityChecker.createSecureResponse({
        hashtags: analysis,
        total: analysis.length,
      });
    }

    // Identify content gaps
    if (action === 'gaps') {
      const validated = ContentGapsSchema.parse(body);

      const gaps = await competitiveIntel.identifyContentGaps(
        userId,
        validated.platform as Platform,
        {
          competitorIds: validated.competitorIds,
        }
      );

      return APISecurityChecker.createSecureResponse({
        gaps,
        total: gaps.length,
      });
    }

    // Compare sentiment
    if (action === 'sentiment') {
      const validated = SentimentSchema.parse(body);

      const comparison = await competitiveIntel.compareSentiment(
        userId,
        validated.platform as Platform,
        {
          competitorIds: validated.competitorIds,
        }
      );

      return APISecurityChecker.createSecureResponse({
        sentiment: comparison,
        total: comparison.length,
      });
    }

    return APISecurityChecker.createSecureResponse(
      { error: 'Invalid action' },
      400
    );
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return APISecurityChecker.createSecureResponse(
        { error: 'Validation error', details: error.errors },
        400
      );
    }

    logger.error('Competitors POST error:', { error });
    return APISecurityChecker.createSecureResponse(
      { error: 'Internal server error' },
      500
    );
  }
}

/**
 * DELETE /api/intelligence/competitors
 * Remove a competitor
 */
export async function DELETE(request: NextRequest) {
  const security = await APISecurityChecker.check(
    request,
    DEFAULT_POLICIES.AUTHENTICATED_WRITE
  );

  if (!security.allowed) {
    return APISecurityChecker.createSecureResponse(
      { error: security.error },
      403
    );
  }

  const userId = security.context.userId!;
  const { searchParams } = new URL(request.url);

  try {
    const competitorId = searchParams.get('competitorId') || searchParams.get('id');

    if (!competitorId) {
      return APISecurityChecker.createSecureResponse(
        { error: 'Competitor ID is required' },
        400
      );
    }

    // Soft delete - set as inactive
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { error } = await supabase
      .from('competitors')
      .update({ is_active: false })
      .eq('id', competitorId)
      .eq('user_id', userId);

    if (error) throw error;

    await auditLogger.logData(
      'delete',
      'intelligence',
      competitorId,
      userId,
      'success',
      { action: 'COMPETITOR_REMOVE' }
    );

    return APISecurityChecker.createSecureResponse({ success: true });
  } catch (error: unknown) {
    logger.error('Competitors DELETE error:', { error });
    return APISecurityChecker.createSecureResponse(
      { error: 'Internal server error' },
      500
    );
  }
}
