/**
 * Content Management Zod Schemas
 *
 * Validates all content-related API requests including
 * posts, campaigns, scheduling, and AI generation.
 *
 * @module lib/schemas/content
 */

import { z } from 'zod';

// =============================================================================
// Common Validators
// =============================================================================

export const uuidSchema = z.string().uuid('Invalid ID format');

export const platformSchema = z.enum([
  'twitter',
  'linkedin',
  'instagram',
  'facebook',
  'tiktok',
  'threads',
  'youtube',
  'pinterest',
]);

export type Platform = z.infer<typeof platformSchema>;

export const contentTypeSchema = z.enum([
  'post',
  'story',
  'reel',
  'video',
  'carousel',
  'thread',
  'article',
  'poll',
]);

export type ContentType = z.infer<typeof contentTypeSchema>;

export const contentStatusSchema = z.enum([
  'draft',
  'scheduled',
  'published',
  'failed',
  'archived',
  'pending_review',
]);

export type ContentStatus = z.infer<typeof contentStatusSchema>;

// =============================================================================
// Post Creation Schema
// =============================================================================

export const createPostSchema = z.object({
  content: z
    .string()
    .min(1, 'Content is required')
    .max(10000, 'Content must not exceed 10,000 characters'),
  platforms: z
    .array(platformSchema)
    .min(1, 'At least one platform is required')
    .max(10, 'Maximum 10 platforms allowed'),
  contentType: contentTypeSchema.optional().default('post'),
  scheduledAt: z.string().datetime().optional().nullable(),
  timezone: z.string().optional().default('UTC'),
  media: z
    .array(
      z.object({
        url: z.string().url('Invalid media URL'),
        type: z.enum(['image', 'video', 'gif']),
        altText: z.string().max(500).optional(),
        thumbnail: z.string().url().optional(),
      })
    )
    .max(10, 'Maximum 10 media items allowed')
    .optional(),
  hashtags: z.array(z.string().max(50)).max(30, 'Maximum 30 hashtags allowed').optional(),
  mentions: z.array(z.string().max(100)).max(50, 'Maximum 50 mentions allowed').optional(),
  location: z
    .object({
      name: z.string().max(200),
      latitude: z.number().min(-90).max(90).optional(),
      longitude: z.number().min(-180).max(180).optional(),
    })
    .optional(),
  campaignId: uuidSchema.optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type CreatePostInput = z.infer<typeof createPostSchema>;

// =============================================================================
// Post Update Schema
// =============================================================================

export const updatePostSchema = z.object({
  id: uuidSchema,
  content: z.string().min(1).max(10000).optional(),
  platforms: z.array(platformSchema).min(1).max(10).optional(),
  contentType: contentTypeSchema.optional(),
  scheduledAt: z.string().datetime().optional().nullable(),
  status: contentStatusSchema.optional(),
  media: z
    .array(
      z.object({
        url: z.string().url(),
        type: z.enum(['image', 'video', 'gif']),
        altText: z.string().max(500).optional(),
      })
    )
    .max(10)
    .optional(),
  hashtags: z.array(z.string().max(50)).max(30).optional(),
  mentions: z.array(z.string().max(100)).max(50).optional(),
});

export type UpdatePostInput = z.infer<typeof updatePostSchema>;

// =============================================================================
// Campaign Schemas
// =============================================================================

export const createCampaignSchema = z.object({
  name: z.string().min(1, 'Campaign name is required').max(200, 'Name must not exceed 200 characters'),
  description: z.string().max(2000, 'Description must not exceed 2,000 characters').optional(),
  platforms: z.array(platformSchema).min(1).max(10),
  startDate: z.string().datetime('Invalid start date'),
  endDate: z.string().datetime('Invalid end date').optional(),
  budget: z
    .object({
      amount: z.number().positive('Budget must be positive'),
      currency: z.enum(['USD', 'EUR', 'GBP', 'AUD', 'CAD']).default('USD'),
    })
    .optional(),
  goals: z
    .array(
      z.object({
        type: z.enum(['reach', 'engagement', 'conversions', 'traffic', 'awareness']),
        target: z.number().positive(),
        metric: z.string(),
      })
    )
    .optional(),
  targetAudience: z
    .object({
      ageRange: z.object({
        min: z.number().min(13).max(100).optional(),
        max: z.number().min(13).max(100).optional(),
      }).optional(),
      locations: z.array(z.string()).optional(),
      interests: z.array(z.string()).optional(),
      languages: z.array(z.string()).optional(),
    })
    .optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
  status: z.enum(['draft', 'active', 'paused', 'completed', 'archived']).optional().default('draft'),
});

export type CreateCampaignInput = z.infer<typeof createCampaignSchema>;

export const updateCampaignSchema = createCampaignSchema.partial().extend({
  id: uuidSchema,
});

export type UpdateCampaignInput = z.infer<typeof updateCampaignSchema>;

// =============================================================================
// Scheduling Schemas
// =============================================================================

export const schedulePostSchema = z.object({
  postId: uuidSchema,
  scheduledAt: z.string().datetime('Invalid schedule date'),
  timezone: z.string().optional().default('UTC'),
  repeatConfig: z
    .object({
      frequency: z.enum(['daily', 'weekly', 'monthly', 'custom']),
      interval: z.number().min(1).max(365).optional(),
      endDate: z.string().datetime().optional(),
      daysOfWeek: z.array(z.number().min(0).max(6)).optional(),
      maxOccurrences: z.number().min(1).max(100).optional(),
    })
    .optional(),
});

export type SchedulePostInput = z.infer<typeof schedulePostSchema>;

export const bulkScheduleSchema = z.object({
  posts: z.array(
    z.object({
      postId: uuidSchema,
      scheduledAt: z.string().datetime(),
    })
  ).min(1, 'At least one post is required').max(100, 'Maximum 100 posts per bulk operation'),
  timezone: z.string().optional().default('UTC'),
});

export type BulkScheduleInput = z.infer<typeof bulkScheduleSchema>;

// =============================================================================
// AI Content Generation Schemas
// =============================================================================

export const generateContentSchema = z.object({
  prompt: z.string().min(1, 'Prompt is required').max(5000, 'Prompt must not exceed 5,000 characters'),
  platform: platformSchema.optional(),
  contentType: contentTypeSchema.optional().default('post'),
  tone: z
    .enum([
      'professional',
      'casual',
      'humorous',
      'inspirational',
      'educational',
      'promotional',
      'conversational',
    ])
    .optional()
    .default('professional'),
  length: z.enum(['short', 'medium', 'long']).optional().default('medium'),
  language: z.string().min(2).max(5).optional().default('en'),
  includeHashtags: z.boolean().optional().default(true),
  includeEmoji: z.boolean().optional().default(true),
  brandVoice: z
    .object({
      keywords: z.array(z.string()).optional(),
      avoidWords: z.array(z.string()).optional(),
      style: z.string().max(500).optional(),
    })
    .optional(),
  variations: z.number().min(1).max(5).optional().default(1),
  targetAudience: z.string().max(500).optional(),
  callToAction: z.string().max(200).optional(),
});

export type GenerateContentInput = z.infer<typeof generateContentSchema>;

export const optimizeContentSchema = z.object({
  content: z.string().min(1, 'Content is required').max(10000),
  platform: platformSchema,
  optimizationType: z.enum(['engagement', 'reach', 'conversions', 'seo']).optional().default('engagement'),
  currentMetrics: z
    .object({
      likes: z.number().optional(),
      comments: z.number().optional(),
      shares: z.number().optional(),
      reach: z.number().optional(),
    })
    .optional(),
});

export type OptimizeContentInput = z.infer<typeof optimizeContentSchema>;

export const generateHashtagsSchema = z.object({
  content: z.string().min(1, 'Content is required').max(5000),
  platform: platformSchema.optional(),
  count: z.number().min(1).max(30).optional().default(10),
  style: z.enum(['trending', 'niche', 'branded', 'mixed']).optional().default('mixed'),
});

export type GenerateHashtagsInput = z.infer<typeof generateHashtagsSchema>;

export const translateContentSchema = z.object({
  content: z.string().min(1, 'Content is required').max(10000),
  sourceLanguage: z.string().min(2).max(5).optional(),
  targetLanguage: z.string().min(2).max(5),
  preserveHashtags: z.boolean().optional().default(true),
  preserveMentions: z.boolean().optional().default(true),
  localizeEmoji: z.boolean().optional().default(false),
});

export type TranslateContentInput = z.infer<typeof translateContentSchema>;

// =============================================================================
// Content Query Schemas
// =============================================================================

export const listPostsSchema = z.object({
  page: z.coerce.number().min(1).optional().default(1),
  limit: z.coerce.number().min(1).max(100).optional().default(20),
  status: contentStatusSchema.optional(),
  platform: platformSchema.optional(),
  campaignId: uuidSchema.optional(),
  search: z.string().max(200).optional(),
  sortBy: z.enum(['createdAt', 'scheduledAt', 'publishedAt', 'engagement']).optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

export type ListPostsInput = z.infer<typeof listPostsSchema>;

export const listCampaignsSchema = z.object({
  page: z.coerce.number().min(1).optional().default(1),
  limit: z.coerce.number().min(1).max(100).optional().default(20),
  status: z.enum(['draft', 'active', 'paused', 'completed', 'archived']).optional(),
  platform: platformSchema.optional(),
  search: z.string().max(200).optional(),
  sortBy: z.enum(['createdAt', 'startDate', 'endDate', 'name']).optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

export type ListCampaignsInput = z.infer<typeof listCampaignsSchema>;

// =============================================================================
// Bulk Operations Schemas
// =============================================================================

export const bulkDeleteSchema = z.object({
  ids: z.array(uuidSchema).min(1, 'At least one ID is required').max(100, 'Maximum 100 items per operation'),
});

export type BulkDeleteInput = z.infer<typeof bulkDeleteSchema>;

export const bulkArchiveSchema = z.object({
  ids: z.array(uuidSchema).min(1).max(100),
});

export type BulkArchiveInput = z.infer<typeof bulkArchiveSchema>;

export const bulkUpdateStatusSchema = z.object({
  ids: z.array(uuidSchema).min(1).max(100),
  status: contentStatusSchema,
});

export type BulkUpdateStatusInput = z.infer<typeof bulkUpdateStatusSchema>;

// =============================================================================
// Validation Helpers
// =============================================================================

/**
 * Validate and parse post creation input
 */
export function validateCreatePost(data: unknown): CreatePostInput {
  return createPostSchema.parse(data);
}

/**
 * Validate and parse content generation input
 */
export function validateGenerateContent(data: unknown): GenerateContentInput {
  return generateContentSchema.parse(data);
}

/**
 * Validate and parse campaign creation input
 */
export function validateCreateCampaign(data: unknown): CreateCampaignInput {
  return createCampaignSchema.parse(data);
}

/**
 * Platform-specific content length validation
 */
export const platformLimits: Record<Platform, { maxLength: number; maxHashtags: number; maxMedia: number }> = {
  twitter: { maxLength: 280, maxHashtags: 5, maxMedia: 4 },
  linkedin: { maxLength: 3000, maxHashtags: 10, maxMedia: 20 },
  instagram: { maxLength: 2200, maxHashtags: 30, maxMedia: 10 },
  facebook: { maxLength: 63206, maxHashtags: 10, maxMedia: 10 },
  tiktok: { maxLength: 2200, maxHashtags: 10, maxMedia: 1 },
  threads: { maxLength: 500, maxHashtags: 5, maxMedia: 10 },
  youtube: { maxLength: 5000, maxHashtags: 15, maxMedia: 1 },
  pinterest: { maxLength: 500, maxHashtags: 20, maxMedia: 5 },
};

/**
 * Validate content against platform-specific limits
 */
export function validatePlatformLimits(
  content: string,
  platform: Platform,
  hashtags?: string[],
  media?: unknown[]
): { valid: boolean; errors: string[] } {
  const limits = platformLimits[platform];
  const errors: string[] = [];

  if (content.length > limits.maxLength) {
    errors.push(`Content exceeds ${platform} character limit (${limits.maxLength})`);
  }

  if (hashtags && hashtags.length > limits.maxHashtags) {
    errors.push(`Too many hashtags for ${platform} (max: ${limits.maxHashtags})`);
  }

  if (media && media.length > limits.maxMedia) {
    errors.push(`Too many media items for ${platform} (max: ${limits.maxMedia})`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// =============================================================================
// API Response Schemas (for contract testing)
// =============================================================================

/**
 * Base post response shape
 */
export const postResponseSchema = z.object({
  id: z.string().uuid(),
  content: z.string(),
  status: contentStatusSchema,
  platform: platformSchema.nullable().optional(),
  platforms: z.array(platformSchema).optional(),
  scheduledAt: z.union([z.date(), z.string().datetime(), z.null()]).optional(),
  publishedAt: z.union([z.date(), z.string().datetime(), z.null()]).optional(),
  createdAt: z.union([z.date(), z.string().datetime()]),
  updatedAt: z.union([z.date(), z.string().datetime()]),
  campaignId: z.string().uuid().nullable().optional(),
  metadata: z.record(z.unknown()).nullable().optional(),
});

export type PostResponse = z.infer<typeof postResponseSchema>;

/**
 * Create post API response
 */
export const createPostResponseSchema = z.object({
  success: z.literal(true),
  message: z.string().optional(),
  data: postResponseSchema,
});

export type CreatePostResponse = z.infer<typeof createPostResponseSchema>;

/**
 * List posts API response
 */
export const listPostsResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(postResponseSchema),
  pagination: z.object({
    page: z.number(),
    limit: z.number(),
    total: z.number(),
    totalPages: z.number(),
  }).optional(),
});

export type ListPostsResponse = z.infer<typeof listPostsResponseSchema>;

/**
 * Base campaign response shape
 */
export const campaignResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable().optional(),
  status: z.enum(['draft', 'active', 'paused', 'completed', 'archived']),
  platform: platformSchema.nullable().optional(),
  platforms: z.array(platformSchema).optional(),
  startDate: z.union([z.date(), z.string().datetime()]).nullable().optional(),
  endDate: z.union([z.date(), z.string().datetime()]).nullable().optional(),
  createdAt: z.union([z.date(), z.string().datetime()]),
  updatedAt: z.union([z.date(), z.string().datetime()]),
  userId: z.string().uuid(),
  _count: z.object({
    posts: z.number(),
  }).optional(),
});

export type CampaignResponse = z.infer<typeof campaignResponseSchema>;

/**
 * Create campaign API response
 */
export const createCampaignResponseSchema = z.object({
  success: z.literal(true),
  message: z.string().optional(),
  data: campaignResponseSchema,
});

export type CreateCampaignResponse = z.infer<typeof createCampaignResponseSchema>;

/**
 * List campaigns API response
 */
export const listCampaignsResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(campaignResponseSchema),
  pagination: z.object({
    page: z.number(),
    limit: z.number(),
    total: z.number(),
    totalPages: z.number(),
  }).optional(),
});

export type ListCampaignsResponse = z.infer<typeof listCampaignsResponseSchema>;

/**
 * Generic content error response
 */
export const contentErrorResponseSchema = z.object({
  success: z.literal(false).optional(),
  error: z.string(),
  message: z.string().optional(),
  details: z.array(z.object({
    field: z.string().optional(),
    message: z.string(),
  })).optional(),
});

export type ContentErrorResponse = z.infer<typeof contentErrorResponseSchema>;

/**
 * AI content generation response
 */
export const generateContentResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    content: z.string(),
    hashtags: z.array(z.string()).optional(),
    variations: z.array(z.string()).optional(),
    metadata: z.record(z.unknown()).optional(),
  }),
});

export type GenerateContentResponse = z.infer<typeof generateContentResponseSchema>;
