/**
 * Common API Response Schemas
 *
 * Shared Zod schemas for response patterns used across all API routes.
 * Most routes follow: { success: true, data: T } or { error: string }
 *
 * @module lib/schemas/common
 */

import { z } from 'zod';

// =============================================================================
// Shared Primitives
// =============================================================================

export const uuidSchema = z.string().uuid();
export const dateStringSchema = z.string().datetime().or(z.string());
export const nullableDateSchema = dateStringSchema.nullable().optional();

// =============================================================================
// Pagination Schema
// =============================================================================

export const paginationSchema = z.object({
  page: z.number().int().positive(),
  limit: z.number().int().positive(),
  total: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
});
export type Pagination = z.infer<typeof paginationSchema>;

// =============================================================================
// Success Response Wrappers
// =============================================================================

/** Generic success response: { success: true } */
export const successResponseSchema = z.object({
  success: z.literal(true),
  message: z.string().optional(),
});

/** Success response with data: { success: true, data: T } */
export function dataResponseSchema<T extends z.ZodTypeAny>(dataSchema: T) {
  return z.object({
    success: z.literal(true),
    data: dataSchema,
    message: z.string().optional(),
  });
}

/** Success response with paginated data */
export function paginatedResponseSchema<T extends z.ZodTypeAny>(itemSchema: T) {
  return z.object({
    success: z.literal(true),
    data: z.array(itemSchema),
    pagination: paginationSchema.optional(),
    total: z.number().optional(),
    message: z.string().optional(),
  });
}

// =============================================================================
// Error Response Schemas
// =============================================================================

/** Standard error response */
export const errorResponseSchema = z.object({
  error: z.string(),
  message: z.string().optional(),
  details: z
    .array(
      z.object({
        field: z.string(),
        message: z.string(),
      })
    )
    .optional(),
  code: z.string().optional(),
});
export type ErrorResponse = z.infer<typeof errorResponseSchema>;

/** Error with success: false */
export const failureResponseSchema = z.object({
  success: z.literal(false),
  error: z.string(),
  message: z.string().optional(),
});

// =============================================================================
// Platform Enum
// =============================================================================

export const platformEnumSchema = z.enum([
  'youtube',
  'instagram',
  'tiktok',
  'twitter',
  'facebook',
  'linkedin',
  'pinterest',
  'reddit',
  'threads',
]);
export type PlatformEnum = z.infer<typeof platformEnumSchema>;

// =============================================================================
// Platform Connection Schemas
// =============================================================================

export const platformConnectionSchema = z.object({
  id: z.string(),
  platform: platformEnumSchema,
  platformUserId: z.string().optional().nullable(),
  platformUsername: z.string().optional().nullable(),
  isActive: z.boolean(),
  connectedAt: dateStringSchema.optional(),
  metadata: z.record(z.unknown()).optional().nullable(),
});
export type PlatformConnection = z.infer<typeof platformConnectionSchema>;

export const listPlatformConnectionsResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(platformConnectionSchema),
});

// =============================================================================
// SEO/GEO Schemas
// =============================================================================

export const seoAuditSchema = z.object({
  id: z.string(),
  url: z.string().optional(),
  score: z.number().min(0).max(100).optional(),
  status: z.string().optional(),
  issues: z.array(z.object({
    type: z.string(),
    severity: z.string().optional(),
    message: z.string(),
    recommendation: z.string().optional(),
  })).optional(),
  createdAt: dateStringSchema.optional(),
});

export const seoAuditResponseSchema = z.object({
  success: z.literal(true),
  data: seoAuditSchema.or(z.array(seoAuditSchema)),
});

export const geoAnalysisSchema = z.object({
  id: z.string(),
  query: z.string().optional(),
  score: z.number().optional(),
  citability: z.number().optional(),
  recommendations: z.array(z.string()).optional(),
  createdAt: dateStringSchema.optional(),
});

export const geoAnalysisResponseSchema = z.object({
  success: z.literal(true),
  data: geoAnalysisSchema.or(z.array(geoAnalysisSchema)),
});

// =============================================================================
// Monetization Schemas
// =============================================================================

export const revenueEntrySchema = z.object({
  id: z.string(),
  amount: z.number().or(z.string()),
  currency: z.string().optional(),
  source: z.string().optional(),
  platform: z.string().optional(),
  date: dateStringSchema.optional(),
  status: z.string().optional(),
});

export const sponsorSchema = z.object({
  id: z.string(),
  name: z.string(),
  contactEmail: z.string().optional().nullable(),
  status: z.string().optional(),
  totalDeals: z.number().optional(),
  totalRevenue: z.number().or(z.string()).optional(),
  createdAt: dateStringSchema.optional(),
});

export const affiliateSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  shortCode: z.string().optional(),
  destinationUrl: z.string().optional(),
  clicks: z.number().optional(),
  conversions: z.number().optional(),
  revenue: z.number().or(z.string()).optional(),
  isActive: z.boolean().optional(),
  createdAt: dateStringSchema.optional(),
});

export const revenueResponseSchema = paginatedResponseSchema(revenueEntrySchema);
export const sponsorResponseSchema = paginatedResponseSchema(sponsorSchema);
export const affiliateResponseSchema = paginatedResponseSchema(affiliateSchema);

// =============================================================================
// AI Schemas
// =============================================================================

export const aiConversationSchema = z.object({
  id: z.string(),
  title: z.string().optional().nullable(),
  createdAt: dateStringSchema.optional(),
  updatedAt: dateStringSchema.optional(),
  messageCount: z.number().optional(),
});

export const aiMessageSchema = z.object({
  id: z.string(),
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string(),
  createdAt: dateStringSchema.optional(),
});

export const aiChatResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    message: aiMessageSchema.optional(),
    conversation: aiConversationSchema.optional(),
  }).or(z.object({
    response: z.string(),
    conversationId: z.string().optional(),
  })),
});

// =============================================================================
// Report Schemas
// =============================================================================

export const reportSchema = z.object({
  id: z.string(),
  title: z.string(),
  type: z.string().optional(),
  status: z.string().optional(),
  data: z.unknown().optional(),
  createdAt: dateStringSchema.optional(),
});

export const reportResponseSchema = paginatedResponseSchema(reportSchema);

// =============================================================================
// Team/Organization Schemas
// =============================================================================

export const teamMemberSchema = z.object({
  id: z.string(),
  userId: z.string().optional(),
  name: z.string().optional().nullable(),
  email: z.string().optional(),
  role: z.string().optional(),
  joinedAt: dateStringSchema.optional(),
});

export const organizationSchema = z.object({
  id: z.string(),
  name: z.string(),
  industry: z.string().optional().nullable(),
  teamSize: z.string().optional().nullable(),
  createdAt: dateStringSchema.optional(),
});

// =============================================================================
// Health Check Schema
// =============================================================================

export const healthCheckResponseSchema = z.object({
  status: z.string(),
  timestamp: z.string().optional(),
  uptime: z.number().optional(),
  services: z.record(z.object({
    status: z.string(),
    latency: z.number().optional(),
  })).optional(),
}).or(z.object({
  ok: z.boolean(),
}));
