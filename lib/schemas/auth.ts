/**
 * Authentication Zod Schemas
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - JWT_SECRET: Token signing key (CRITICAL)
 * - NEXT_PUBLIC_APP_URL: Application URL (PUBLIC)
 *
 * @module lib/schemas/auth
 */

import { z } from 'zod';

// =============================================================================
// Common Validators
// =============================================================================

export const emailSchema = z
  .string()
  .email('Invalid email address')
  .min(5, 'Email must be at least 5 characters')
  .max(255, 'Email must not exceed 255 characters')
  .transform((val) => val.toLowerCase().trim());

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must not exceed 128 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character');

export const usernameSchema = z
  .string()
  .min(3, 'Username must be at least 3 characters')
  .max(30, 'Username must not exceed 30 characters')
  .regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, underscores, and hyphens');

export const uuidSchema = z.string().uuid('Invalid ID format');

// =============================================================================
// Login Schema
// =============================================================================

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().optional().default(false),
});

export type LoginInput = z.infer<typeof loginSchema>;

// =============================================================================
// Signup Schema
// =============================================================================

export const signupSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  confirmPassword: z.string().min(1, 'Please confirm your password'),
  name: z.string().min(2, 'Name must be at least 2 characters').max(100, 'Name must not exceed 100 characters'),
  acceptTerms: z.boolean().refine((val) => val === true, {
    message: 'You must accept the terms and conditions',
  }),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

export type SignupInput = z.infer<typeof signupSchema>;

// =============================================================================
// Password Reset Schemas
// =============================================================================

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  password: passwordSchema,
  confirmPassword: z.string().min(1, 'Please confirm your password'),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

// =============================================================================
// Profile Update Schema
// =============================================================================

export const profileUpdateSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100).optional(),
  email: emailSchema.optional(),
  avatar: z.string().url('Invalid avatar URL').optional().nullable(),
  bio: z.string().max(500, 'Bio must not exceed 500 characters').optional().nullable(),
  company: z.string().max(100, 'Company name must not exceed 100 characters').optional().nullable(),
  website: z.string().url('Invalid website URL').optional().nullable(),
  timezone: z.string().optional(),
  language: z.enum(['en', 'es', 'fr', 'de', 'pt', 'it', 'ja', 'zh', 'ko']).optional().default('en'),
  preferences: z.object({
    emailNotifications: z.boolean().optional(),
    pushNotifications: z.boolean().optional(),
    marketingEmails: z.boolean().optional(),
    theme: z.enum(['light', 'dark', 'system']).optional(),
  }).optional(),
});

export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;

// =============================================================================
// OAuth Schemas
// =============================================================================

export const oauthPlatformSchema = z.enum([
  'google',
  'twitter',
  'linkedin',
  'instagram',
  'facebook',
  'tiktok',
  'github',
]);

export type OAuthPlatform = z.infer<typeof oauthPlatformSchema>;

export const oauthInitiateSchema = z.object({
  platform: oauthPlatformSchema,
  redirectUri: z.string().url('Invalid redirect URI').optional(),
  state: z.string().optional(),
});

export type OAuthInitiateInput = z.infer<typeof oauthInitiateSchema>;

export const oauthCallbackSchema = z.object({
  code: z.string().min(1, 'Authorization code is required'),
  state: z.string().min(1, 'State parameter is required'),
  error: z.string().optional(),
  errorDescription: z.string().optional(),
});

export type OAuthCallbackInput = z.infer<typeof oauthCallbackSchema>;

export const oauthStateSchema = z.object({
  userId: z.string().uuid().nullable(),
  email: z.string().email().nullable(),
  platform: oauthPlatformSchema,
  timestamp: z.number(),
  nonce: z.string().optional(),
});

export type OAuthStateData = z.infer<typeof oauthStateSchema>;

// =============================================================================
// API Key Schemas
// =============================================================================

export const createApiKeySchema = z.object({
  name: z.string().min(1, 'API key name is required').max(50, 'Name must not exceed 50 characters'),
  expiresAt: z.string().datetime().optional().nullable(),
  permissions: z.array(z.enum(['read', 'write', 'delete', 'admin'])).optional().default(['read']),
});

export type CreateApiKeyInput = z.infer<typeof createApiKeySchema>;

export const revokeApiKeySchema = z.object({
  keyId: uuidSchema,
});

export type RevokeApiKeyInput = z.infer<typeof revokeApiKeySchema>;

// =============================================================================
// Session Schema
// =============================================================================

export const sessionSchema = z.object({
  userId: uuidSchema,
  email: emailSchema,
  name: z.string().optional(),
  role: z.enum(['user', 'admin', 'superadmin']).default('user'),
  permissions: z.array(z.string()).optional(),
  tier: z.enum(['free', 'professional', 'business', 'enterprise']).default('free'),
  expiresAt: z.number(),
  iat: z.number(),
});

export type SessionData = z.infer<typeof sessionSchema>;

// =============================================================================
// Email Verification Schema
// =============================================================================

export const verifyEmailSchema = z.object({
  token: z.string().min(1, 'Verification token is required'),
  email: emailSchema.optional(),
});

export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;

export const resendVerificationSchema = z.object({
  email: emailSchema,
});

export type ResendVerificationInput = z.infer<typeof resendVerificationSchema>;

// =============================================================================
// Two-Factor Authentication Schemas
// =============================================================================

export const enable2FASchema = z.object({
  method: z.enum(['totp', 'sms', 'email']).default('totp'),
  phoneNumber: z.string().optional(),
});

export type Enable2FAInput = z.infer<typeof enable2FASchema>;

export const verify2FASchema = z.object({
  code: z.string().length(6, 'Verification code must be 6 digits').regex(/^\d+$/, 'Code must be numeric'),
  method: z.enum(['totp', 'sms', 'email', 'recovery']).optional(),
});

export type Verify2FAInput = z.infer<typeof verify2FASchema>;

export const disable2FASchema = z.object({
  code: z.string().min(1, 'Verification code is required'),
  password: z.string().min(1, 'Password is required for confirmation'),
});

export type Disable2FAInput = z.infer<typeof disable2FASchema>;

// =============================================================================
// Validation Helpers
// =============================================================================

/**
 * Validate and parse login input
 */
export function validateLogin(data: unknown): LoginInput {
  return loginSchema.parse(data);
}

/**
 * Validate and parse signup input
 */
export function validateSignup(data: unknown): SignupInput {
  return signupSchema.parse(data);
}

/**
 * Validate and parse OAuth callback
 */
export function validateOAuthCallback(data: unknown): OAuthCallbackInput {
  return oauthCallbackSchema.parse(data);
}

/**
 * Safe parse with error handling
 */
export function safeValidate<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; errors: z.ZodError } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, errors: result.error };
}

/**
 * Format Zod errors for API responses
 */
export function formatZodErrors(error: z.ZodError): Record<string, string[]> {
  const formatted: Record<string, string[]> = {};

  for (const issue of error.issues) {
    const path = issue.path.join('.') || 'root';
    if (!formatted[path]) {
      formatted[path] = [];
    }
    formatted[path].push(issue.message);
  }

  return formatted;
}

// =============================================================================
// API Response Schemas (for contract testing)
// =============================================================================

/**
 * Base user response shape returned by auth endpoints
 */
export const userResponseSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string().nullable().optional(),
  avatar: z.string().url().nullable().optional(),
  emailVerified: z.union([z.date(), z.string().datetime(), z.null()]).optional(),
});

export type UserResponse = z.infer<typeof userResponseSchema>;

/**
 * Login API response schema
 * POST /api/auth/login
 */
export const loginResponseSchema = z.object({
  success: z.literal(true),
  message: z.string(),
  user: userResponseSchema,
  token: z.string(),
});

export type LoginResponse = z.infer<typeof loginResponseSchema>;

/**
 * Signup API response schema
 * POST /api/auth/signup
 */
export const signupResponseSchema = z.object({
  success: z.literal(true),
  user: userResponseSchema,
  message: z.string(),
  requiresVerification: z.boolean(),
});

export type SignupResponse = z.infer<typeof signupResponseSchema>;

/**
 * Get user API response schema
 * GET /api/auth/user
 */
export const getUserResponseSchema = z.object({
  success: z.literal(true),
  user: userResponseSchema.extend({
    createdAt: z.union([z.date(), z.string().datetime()]).optional(),
    lastLogin: z.union([z.date(), z.string().datetime()]).nullable().optional(),
    preferences: z.record(z.unknown()).nullable().optional(),
    organizationId: z.string().uuid().nullable().optional(),
    isMultiBusinessOwner: z.boolean().optional(),
    activeOrganizationId: z.string().uuid().nullable().optional(),
    organization: z.object({
      id: z.string().uuid(),
      name: z.string(),
      slug: z.string(),
      plan: z.string().nullable().optional(),
    }).nullable().optional(),
    unreadNotifications: z.number().optional(),
    totalCampaigns: z.number().optional(),
    totalProjects: z.number().optional(),
    ownedBusinessCount: z.number().optional(),
  }),
});

export type GetUserResponse = z.infer<typeof getUserResponseSchema>;

/**
 * Update user API response schema
 * PUT /api/auth/user
 */
export const updateUserResponseSchema = z.object({
  success: z.literal(true),
  message: z.string(),
  user: userResponseSchema.extend({
    preferences: z.record(z.unknown()).nullable().optional(),
  }),
});

export type UpdateUserResponse = z.infer<typeof updateUserResponseSchema>;

/**
 * Generic auth error response schema
 */
export const authErrorResponseSchema = z.object({
  error: z.string(),
  message: z.string().optional(),
  details: z.array(z.object({
    field: z.string().optional(),
    path: z.array(z.string()).optional(),
    message: z.string(),
  })).optional(),
});

export type AuthErrorResponse = z.infer<typeof authErrorResponseSchema>;

/**
 * Password reset request response
 * POST /api/auth/request-reset
 */
export const requestResetResponseSchema = z.object({
  success: z.literal(true),
  message: z.string(),
});

export type RequestResetResponse = z.infer<typeof requestResetResponseSchema>;

/**
 * Password reset response
 * POST /api/auth/reset
 */
export const resetPasswordResponseSchema = z.object({
  success: z.literal(true),
  message: z.string(),
});

export type ResetPasswordResponse = z.infer<typeof resetPasswordResponseSchema>;

/**
 * Email verification response
 * POST /api/auth/verify-email
 */
export const verifyEmailResponseSchema = z.object({
  success: z.literal(true),
  message: z.string(),
});

export type VerifyEmailResponse = z.infer<typeof verifyEmailResponseSchema>;

/**
 * Logout response
 * POST /api/auth/logout
 */
export const logoutResponseSchema = z.object({
  success: z.literal(true),
  message: z.string(),
});

export type LogoutResponse = z.infer<typeof logoutResponseSchema>;
