/**
 * @internal Server-only endpoint — not called directly by frontend UI.
 * Used by: automated content safety pipeline; called server-side before publishing posts.
 */

/**
 * Content Moderation API
 *
 * @description Content safety checking and compliance verification
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - NEXT_PUBLIC_SUPABASE_URL: Supabase URL (PUBLIC)
 * - SUPABASE_SERVICE_ROLE_KEY: Supabase service role key (SECRET)
 *
 * FAILURE MODE: Flags content for human review if check fails
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { APISecurityChecker, DEFAULT_POLICIES } from '@/lib/security/api-security-checker';
import { auditLogger } from '@/lib/security/audit-logger';
import { contentSafety, BrandGuidelines } from '@/lib/moderation/content-safety';
import { logger } from '@/lib/logger';

// Request validation schemas
const ModerationCheckSchema = z.object({
  content: z.string().min(1).max(10000),
  platform: z.enum(['twitter', 'instagram', 'linkedin', 'facebook', 'tiktok', 'youtube']).optional(),
  mediaUrls: z.array(z.string().url()).optional(),
  checkType: z.enum(['full', 'quick']).default('full'),
  isPaidPromotion: z.boolean().default(false),
  targetAudience: z.enum(['general', 'children', 'adults']).default('general'),
  brandGuidelines: z.object({
    companyName: z.string(),
    competitors: z.array(z.string()).optional(),
    blockedWords: z.array(z.string()).optional(),
    requiredDisclosures: z.array(z.string()).optional(),
    toneOfVoice: z.enum(['professional', 'casual', 'friendly', 'authoritative']).optional(),
    sensitiveTopics: z.array(z.string()).optional(),
    approvedHashtags: z.array(z.string()).optional(),
    blockedHashtags: z.array(z.string()).optional(),
  }).optional(),
});

const QuickCheckSchema = z.object({
  content: z.string().min(1).max(10000),
});

const FTCCheckSchema = z.object({
  content: z.string().min(1).max(10000),
  isPaidPromotion: z.boolean().default(false),
  hasAffiliateLinks: z.boolean().default(false),
  isGifted: z.boolean().default(false),
});

const SubmitReviewSchema = z.object({
  contentId: z.string(),
  content: z.string().min(1).max(10000),
  notes: z.string().max(1000).optional(),
});

/**
 * POST /api/moderation/check
 * Perform content moderation check
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
      403
    );
  }

  const userId = security.context.userId!;
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || 'full';

  try {
    const body = await request.json();

    switch (action) {
      case 'quick': {
        // Quick safety check
        const validated = QuickCheckSchema.parse(body);
        const result = await contentSafety.quickCheck(validated.content);

        return APISecurityChecker.createSecureResponse({
          ...result,
          action: 'quick',
        });
      }

      case 'ftc': {
        // FTC disclosure check
        const validated = FTCCheckSchema.parse(body);
        const result = contentSafety.checkFTCDisclosureRequired(validated.content, {
          isPaidPromotion: validated.isPaidPromotion,
          hasAffiliateLinks: validated.hasAffiliateLinks,
          isGifted: validated.isGifted,
        });

        return APISecurityChecker.createSecureResponse({
          ...result,
          action: 'ftc',
        });
      }

      case 'submit-review': {
        // Submit for human review
        const validated = SubmitReviewSchema.parse(body);

        // First, run moderation check
        const moderationResult = await contentSafety.moderateContent(
          userId,
          validated.content,
          { checkType: 'full' }
        );

        // Submit for review
        const reviewResult = await contentSafety.submitForReview(
          userId,
          validated.contentId,
          validated.content,
          moderationResult,
          validated.notes
        );

        await auditLogger.logData(
          'create',
          'moderation',
          validated.contentId,
          userId,
          'success',
          {
            action: 'CONTENT_REVIEW_SUBMIT',
            reviewId: reviewResult.reviewId,
          }
        );

        return APISecurityChecker.createSecureResponse({
          success: true,
          ...reviewResult,
          moderationResult,
        });
      }

      case 'full':
      default: {
        // Full moderation check
        const validated = ModerationCheckSchema.parse(body);

        const result = await contentSafety.moderateContent(
          userId,
          validated.content,
          {
            platform: validated.platform,
            mediaUrls: validated.mediaUrls,
            brandGuidelines: validated.brandGuidelines as BrandGuidelines | undefined,
            checkType: validated.checkType,
            isPaidPromotion: validated.isPaidPromotion,
            targetAudience: validated.targetAudience,
          }
        );

        // Audit log for flagged content
        if (!result.approved || result.requiresHumanReview) {
          await auditLogger.logData(
            'read',
            'moderation',
            undefined,
            userId,
            'warning',
            {
              action: 'CONTENT_FLAGGED',
              riskLevel: result.riskLevel,
              blockedReasons: result.blockedReasons,
              requiresHumanReview: result.requiresHumanReview,
            }
          );
        }

        return APISecurityChecker.createSecureResponse({
          ...result,
          action: 'full',
        });
      }
    }
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return APISecurityChecker.createSecureResponse(
        { error: 'Validation error', details: error.errors },
        400
      );
    }

    logger.error('Moderation check error:', { error });
    return APISecurityChecker.createSecureResponse(
      { error: 'Internal server error' },
      500
    );
  }
}

/**
 * GET /api/moderation/check
 * Get moderation history
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
      403
    );
  }

  const userId = security.context.userId!;
  const { searchParams } = new URL(request.url);

  try {
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const onlyFlagged = searchParams.get('onlyFlagged') === 'true';

    const history = await contentSafety.getModerationHistory(userId, {
      limit,
      offset,
      onlyFlagged,
    });

    return APISecurityChecker.createSecureResponse({
      history,
      limit,
      offset,
      total: history.length, // Would need count query for accurate total
    });
  } catch (error: unknown) {
    logger.error('Moderation history error:', { error });
    return APISecurityChecker.createSecureResponse(
      { error: 'Internal server error' },
      500
    );
  }
}

/**
 * PUT /api/moderation/check
 * Update brand guidelines or moderation settings
 */
export async function PUT(request: NextRequest) {
  // Security check
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

  try {
    const body = await request.json();

    const guidelinesSchema = z.object({
      companyName: z.string().min(1),
      competitors: z.array(z.string()).optional(),
      blockedWords: z.array(z.string()).optional(),
      requiredDisclosures: z.array(z.string()).optional(),
      toneOfVoice: z.enum(['professional', 'casual', 'friendly', 'authoritative']).optional(),
      sensitiveTopics: z.array(z.string()).optional(),
      approvedHashtags: z.array(z.string()).optional(),
      blockedHashtags: z.array(z.string()).optional(),
    });

    const validated = guidelinesSchema.parse(body);

    // Import supabase client
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Upsert brand guidelines
    const { data, error } = await supabase
      .from('brand_guidelines')
      .upsert({
        user_id: userId,
        company_name: validated.companyName,
        competitors: validated.competitors || [],
        blocked_words: validated.blockedWords || [],
        required_disclosures: validated.requiredDisclosures || [],
        tone_of_voice: validated.toneOfVoice || 'professional',
        sensitive_topics: validated.sensitiveTopics || [],
        approved_hashtags: validated.approvedHashtags || [],
        blocked_hashtags: validated.blockedHashtags || [],
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    await auditLogger.logData(
      'update',
      'settings',
      undefined,
      userId,
      'success',
      {
        action: 'BRAND_GUIDELINES_UPDATE',
        companyName: validated.companyName,
      }
    );

    return APISecurityChecker.createSecureResponse({
      success: true,
      guidelines: validated,
    });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return APISecurityChecker.createSecureResponse(
        { error: 'Validation error', details: error.errors },
        400
      );
    }

    logger.error('Brand guidelines update error:', { error });
    return APISecurityChecker.createSecureResponse(
      { error: 'Internal server error' },
      500
    );
  }
}
