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
export type {
  SessionUser,
  SessionData as RedisSessionData,
} from '@/src/middleware/session';

export type {
  RateLimitConfig,
  RateLimitInfo,
} from '@/src/middleware/rate-limit';

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
