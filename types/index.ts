/**
 * Shared Types Barrel Export
 *
 * Central re-export of all domain types used across the SYNTHEX codebase.
 * Import from '@/types' for a single, consistent import path.
 *
 * @module types
 */

// =============================================================================
// Auth Types (canonical definitions)
// =============================================================================
export type {
  AuthUser,
  AuthSession,
  AuthResult,
  AuthResponse,
} from './auth';

// =============================================================================
// AI Provider Types
// =============================================================================
export type {
  AIMessage,
  AICompletionRequest,
  AICompletionResponse,
  ModelPresets,
  AIProvider,
} from '@/lib/ai/providers/base-provider';

// =============================================================================
// Content Generation Types
// =============================================================================
export type {
  ContentRequest,
  GeneratedContent,
  ContentVariation,
} from '@/lib/ai/content-generator';

// =============================================================================
// Analytics Types
// =============================================================================
export type {
  AnalyticsEvent,
  EventType,
  EngagementMetrics,
  UserAnalytics,
  PlatformAnalytics,
  ContentPerformance,
} from '@/lib/analytics/analytics-tracker';

// =============================================================================
// Middleware Types
// =============================================================================
// Session types (stub - src/middleware/session was removed)
export interface SessionUser {
  id: string;
  email?: string;
  name?: string;
}

export interface RedisSessionData {
  userId: string;
  expiresAt: number;
  data?: Record<string, unknown>;
}

// Rate limit types (from consolidated module)
export type { RateLimitConfig } from '@/lib/rate-limit';

// Stub for RateLimitInfo (not in new module)
export interface RateLimitInfo {
  remaining: number;
  limit: number;
  reset: number;
}

// =============================================================================
// Schema-derived Types (Zod-validated)
// =============================================================================
export type {
  // Auth schemas
  LoginInput,
  SignupInput,
  ForgotPasswordInput,
  ResetPasswordInput,
  ProfileUpdateInput,
  OAuthPlatform,
  OAuthInitiateInput,
  OAuthCallbackInput,
  OAuthStateData,
  CreateApiKeyInput,
  RevokeApiKeyInput,
  SessionData as JWTSessionData,
  VerifyEmailInput,
  ResendVerificationInput,
  Enable2FAInput,
  Verify2FAInput,
  Disable2FAInput,

  // Content schemas
  ContentPlatform,
  ContentType,
  ContentStatus,
  CreatePostInput,
  UpdatePostInput,
  CreateCampaignInput,
  UpdateCampaignInput,
  SchedulePostInput,
  BulkScheduleInput,
  GenerateContentInput,
  OptimizeContentInput,
  GenerateHashtagsInput,
  TranslateContentInput,
  ListPostsInput,
  ListCampaignsInput,
  BulkDeleteInput,
  BulkArchiveInput,
  BulkUpdateStatusInput,

  // Analytics schemas
  AnalyticsPlatform,
  DateRange,
  Granularity,
  MetricType,
  DashboardQueryInput,
  EngagementQueryInput,
  PerformanceQueryInput,
  RealtimeQueryInput,
  InsightsQueryInput,
  ComparisonQueryInput,
  TrendsQueryInput,
  ExportFormat,
  ExportQueryInput,
  BulkExportInput,
  GenerateReportInput,
  AudienceQueryInput,
  CompetitorAnalysisInput,
} from '@/lib/schemas';
