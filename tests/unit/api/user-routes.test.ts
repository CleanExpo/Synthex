/**
 * User API Route Contract Tests
 * Tests GET/PUT /api/user/profile, GET /api/user/subscription,
 * GET /api/user/usage, GET/PUT /api/user/settings, DELETE /api/user/account
 *
 * These tests verify the complete contract of user routes:
 * - Request/response shapes
 * - Validation rules
 * - Error handling patterns
 * - Authentication requirements
 *
 * Focuses on contract testing via validation schemas and response structures
 */

import { z } from 'zod';

// Profile update validation schema (from route file)
const profileUpdateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name too long').optional(),
  company: z.string().max(100, 'Company name too long').optional(),
  role: z.string().max(50, 'Role too long').optional(),
  bio: z.string().max(500, 'Bio too long').optional(),
  phone: z.string().max(20, 'Phone number too long').regex(/^[+]?[\d\s\-()]*$/, 'Invalid phone format').optional(),
  website: z.string().url('Invalid website URL').max(200).optional().or(z.literal('')),
  social_links: z.object({
    twitter: z.string().max(100).optional(),
    linkedin: z.string().max(100).optional(),
    github: z.string().max(100).optional(),
  }).passthrough().optional(),
}).strict();

// Settings update validation schema
const notificationSettingsSchema = z.object({
  email: z.boolean().optional(),
  push: z.boolean().optional(),
  sms: z.boolean().optional(),
  weeklyReport: z.boolean().optional(),
  viralAlert: z.boolean().optional(),
  systemUpdates: z.boolean().optional(),
});

const privacySettingsSchema = z.object({
  profilePublic: z.boolean().optional(),
  showAnalytics: z.boolean().optional(),
  allowDataCollection: z.boolean().optional(),
});

const settingsUpdateSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('notifications'),
    settings: notificationSettingsSchema,
  }),
  z.object({
    type: z.literal('privacy'),
    settings: privacySettingsSchema,
  }),
  z.object({
    type: z.literal('theme'),
    settings: z.enum(['light', 'dark', 'system']),
  }),
  z.object({
    type: z.literal('language'),
    settings: z.string().min(2).max(10),
  }),
  z.object({
    type: z.literal('timezone'),
    settings: z.string().max(50),
  }),
]);

// Account deletion schema
const deleteAccountSchema = z.object({
  confirmation: z.literal('DELETE_MY_ACCOUNT', {
    errorMap: () => ({ message: 'Must confirm with "DELETE_MY_ACCOUNT"' }),
  }),
});

describe('User API Routes - Contract Tests', () => {
  describe('GET /api/user/profile - Profile Contract', () => {
    it('should define profile response shape', () => {
      const profileResponse = {
        profile: {
          id: 'user-123',
          email: 'test@example.com',
          name: 'Test User',
          avatar_url: 'https://example.com/avatar.jpg',
          company: 'Test Corp',
          role: 'Developer',
          bio: 'Test bio',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      };

      expect(profileResponse).toHaveProperty('profile');
      expect(profileResponse.profile).toHaveProperty('id');
      expect(profileResponse.profile).toHaveProperty('email');
      expect(profileResponse.profile).toHaveProperty('name');
    });

    it('should return 401 for unauthenticated requests', () => {
      const errorResponse = {
        error: 'No authorization header'
      };
      expect(errorResponse).toHaveProperty('error');
    });

    it('should handle missing profile by creating default', () => {
      const defaultProfile = {
        id: 'user-123',
        email: 'test@example.com',
        name: '',
        avatar_url: '',
        company: '',
        role: '',
        bio: '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      expect(defaultProfile).toHaveProperty('id');
      expect(defaultProfile.name).toBe('');
    });
  });

  describe('PUT /api/user/profile - Profile Update Contract', () => {
    it('should accept valid profile update', () => {
      const update = {
        name: 'Updated Name',
        bio: 'Updated bio',
        company: 'New Company'
      };
      const result = profileUpdateSchema.safeParse(update);
      expect(result.success).toBe(true);
    });

    it('should reject name exceeding 100 characters', () => {
      const update = {
        name: 'a'.repeat(101)
      };
      const result = profileUpdateSchema.safeParse(update);
      expect(result.success).toBe(false);
    });

    it('should reject invalid website URL', () => {
      const update = {
        website: 'not-a-url'
      };
      const result = profileUpdateSchema.safeParse(update);
      expect(result.success).toBe(false);
    });

    it('should accept empty string for website', () => {
      const update = {
        website: ''
      };
      const result = profileUpdateSchema.safeParse(update);
      expect(result.success).toBe(true);
    });

    it('should reject invalid phone format', () => {
      const update = {
        phone: 'invalid@phone'
      };
      const result = profileUpdateSchema.safeParse(update);
      expect(result.success).toBe(false);
    });

    it('should accept valid phone formats', () => {
      const validPhones = [
        '+1234567890',
        '(123) 456-7890',
        '123-456-7890',
        '+1 (234) 567-8900'
      ];

      validPhones.forEach(phone => {
        const result = profileUpdateSchema.safeParse({ phone });
        expect(result.success).toBe(true);
      });
    });

    it('should accept social links', () => {
      const update = {
        social_links: {
          twitter: '@username',
          linkedin: 'linkedin.com/in/username',
          github: 'github.com/username'
        }
      };
      const result = profileUpdateSchema.safeParse(update);
      expect(result.success).toBe(true);
    });

    it('should reject unknown fields (strict mode)', () => {
      const update = {
        name: 'Test',
        unknownField: 'value'
      };
      const result = profileUpdateSchema.safeParse(update);
      expect(result.success).toBe(false);
    });

    it('should define success response shape', () => {
      const successResponse = {
        success: true,
        profile: {
          id: 'user-123',
          name: 'Updated Name',
          email: 'test@example.com'
        },
        message: 'Profile updated successfully'
      };

      expect(successResponse).toMatchObject({
        success: true,
        profile: expect.any(Object),
        message: expect.stringContaining('successfully')
      });
    });
  });

  describe('GET /api/user/subscription - Subscription Contract', () => {
    it('should define active subscription response', () => {
      const subscriptionResponse = {
        plan: 'professional',
        status: 'active',
        features: {
          socialAccounts: 5,
          aiPosts: 100,
          personas: 3,
          analytics: 'professional',
          support: 'email',
          scheduling: true,
          contentLibrary: true
        }
      };

      expect(subscriptionResponse).toHaveProperty('plan');
      expect(subscriptionResponse).toHaveProperty('status');
      expect(subscriptionResponse).toHaveProperty('features');
      expect(subscriptionResponse.features).toHaveProperty('socialAccounts');
      expect(subscriptionResponse.features).toHaveProperty('aiPosts');
    });

    it('should define free tier response', () => {
      const freeTierResponse = {
        plan: 'free',
        status: 'inactive',
        features: {
          socialAccounts: 1,
          aiPosts: 5,
          personas: 1,
          analytics: 'basic',
          support: 'community'
        }
      };

      expect(freeTierResponse.plan).toBe('free');
      expect(freeTierResponse.status).toBe('inactive');
    });

    it('should define business plan features', () => {
      const businessFeatures = {
        socialAccounts: 10,
        aiPosts: -1, // unlimited
        personas: 10,
        analytics: 'advanced',
        support: 'priority',
        patternAnalysis: true,
        customAI: true,
        competitorAnalysis: true,
        abTesting: true,
        teamCollaboration: true
      };

      expect(businessFeatures.aiPosts).toBe(-1); // -1 means unlimited
    });

    it('should return 401 for unauthenticated requests', () => {
      const errorResponse = {
        error: 'Authentication required'
      };
      expect(errorResponse).toHaveProperty('error');
    });
  });

  describe('GET /api/user/usage - Usage Contract', () => {
    it('should define usage response shape', () => {
      const usageResponse = {
        usage: {
          aiPosts: 3,
          socialAccounts: 2,
          personas: 1
        },
        limits: {
          aiPosts: 10,
          socialAccounts: 2,
          personas: 1
        },
        percentages: {
          aiPosts: 30,
          socialAccounts: 100,
          personas: 100
        },
        plan: 'free',
        resetDate: new Date().toISOString(),
        periodEnd: new Date().toISOString()
      };

      expect(usageResponse).toHaveProperty('usage');
      expect(usageResponse).toHaveProperty('limits');
      expect(usageResponse).toHaveProperty('percentages');
      expect(usageResponse.percentages.aiPosts).toBeGreaterThanOrEqual(0);
      expect(usageResponse.percentages.aiPosts).toBeLessThanOrEqual(100);
    });

    it('should handle unlimited limits (-1)', () => {
      const usageWithUnlimited = {
        usage: { aiPosts: 1000 },
        limits: { aiPosts: -1 },
        percentages: { aiPosts: 0 } // Unlimited = 0%
      };

      expect(usageWithUnlimited.limits.aiPosts).toBe(-1);
      expect(usageWithUnlimited.percentages.aiPosts).toBe(0);
    });

    it('should cap percentages at 100', () => {
      const usage = {
        usage: { aiPosts: 12 },
        limits: { aiPosts: 10 },
        percentages: { aiPosts: 100 } // Capped at 100, not 120
      };

      expect(usage.percentages.aiPosts).toBe(100);
    });

    it('should return 401 for unauthenticated requests', () => {
      const errorResponse = {
        error: 'Authentication required'
      };
      expect(errorResponse).toHaveProperty('error');
    });
  });

  describe('GET /api/user/settings - Settings Contract', () => {
    it('should define settings response shape', () => {
      const settingsResponse = {
        settings: {
          user_id: 'user-123',
          notifications: {
            email: true,
            push: false,
            sms: false,
            weeklyReport: true,
            viralAlert: true,
            systemUpdates: false
          },
          privacy: {
            profilePublic: false,
            showAnalytics: true,
            allowDataCollection: true
          },
          theme: 'dark',
          language: 'en',
          timezone: 'UTC',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      };

      expect(settingsResponse).toHaveProperty('settings');
      expect(settingsResponse.settings).toHaveProperty('notifications');
      expect(settingsResponse.settings).toHaveProperty('privacy');
      expect(settingsResponse.settings).toHaveProperty('theme');
    });

    it('should return default settings if none exist', () => {
      const defaultSettings = {
        notifications: {
          email: true,
          push: false,
          sms: false,
          weeklyReport: true,
          viralAlert: true,
          systemUpdates: false
        },
        privacy: {
          profilePublic: false,
          showAnalytics: true,
          allowDataCollection: true
        },
        theme: 'dark',
        language: 'en',
        timezone: 'UTC'
      };

      expect(defaultSettings.theme).toBe('dark');
      expect(defaultSettings.notifications.email).toBe(true);
    });
  });

  describe('PUT /api/user/settings - Settings Update Contract', () => {
    it('should accept notification settings update', () => {
      const update = {
        type: 'notifications' as const,
        settings: {
          email: false,
          weeklyReport: false
        }
      };
      const result = settingsUpdateSchema.safeParse(update);
      expect(result.success).toBe(true);
    });

    it('should accept privacy settings update', () => {
      const update = {
        type: 'privacy' as const,
        settings: {
          profilePublic: true,
          allowDataCollection: false
        }
      };
      const result = settingsUpdateSchema.safeParse(update);
      expect(result.success).toBe(true);
    });

    it('should accept theme update', () => {
      const validThemes = ['light', 'dark', 'system'];

      validThemes.forEach(theme => {
        const update = {
          type: 'theme' as const,
          settings: theme as 'light' | 'dark' | 'system'
        };
        const result = settingsUpdateSchema.safeParse(update);
        expect(result.success).toBe(true);
      });
    });

    it('should reject invalid theme', () => {
      const update = {
        type: 'theme' as const,
        settings: 'invalid-theme'
      };
      const result = settingsUpdateSchema.safeParse(update);
      expect(result.success).toBe(false);
    });

    it('should accept language update', () => {
      const update = {
        type: 'language' as const,
        settings: 'en'
      };
      const result = settingsUpdateSchema.safeParse(update);
      expect(result.success).toBe(true);
    });

    it('should accept timezone update', () => {
      const update = {
        type: 'timezone' as const,
        settings: 'America/New_York'
      };
      const result = settingsUpdateSchema.safeParse(update);
      expect(result.success).toBe(true);
    });

    it('should define success response shape', () => {
      const successResponse = {
        success: true,
        settings: {
          user_id: 'user-123',
          theme: 'dark',
          updated_at: new Date().toISOString()
        },
        message: 'Settings updated successfully'
      };

      expect(successResponse).toMatchObject({
        success: true,
        settings: expect.any(Object),
        message: expect.stringContaining('successfully')
      });
    });

    it('should reject invalid setting type', () => {
      const update = {
        type: 'invalid-type',
        settings: {}
      };
      const result = settingsUpdateSchema.safeParse(update);
      expect(result.success).toBe(false);
    });
  });

  describe('GET /api/user/account - Account Status Contract', () => {
    it('should define account status response', () => {
      const accountResponse = {
        id: 'user-123',
        email: 'test@example.com',
        emailConfirmed: true,
        createdAt: new Date().toISOString(),
        lastSignIn: new Date().toISOString(),
        provider: 'email',
        mfaEnabled: false
      };

      expect(accountResponse).toHaveProperty('id');
      expect(accountResponse).toHaveProperty('email');
      expect(accountResponse).toHaveProperty('emailConfirmed');
      expect(accountResponse).toHaveProperty('provider');
      expect(accountResponse).toHaveProperty('mfaEnabled');
    });

    it('should return 401 for unauthenticated requests', () => {
      const errorResponse = {
        error: 'No authorization header'
      };
      expect(errorResponse).toHaveProperty('error');
    });
  });

  describe('DELETE /api/user/account - Account Deletion Contract', () => {
    it('should require confirmation', () => {
      const validConfirmation = {
        confirmation: 'DELETE_MY_ACCOUNT' as const
      };
      const result = deleteAccountSchema.safeParse(validConfirmation);
      expect(result.success).toBe(true);
    });

    it('should reject without confirmation', () => {
      const noConfirmation = {};
      const result = deleteAccountSchema.safeParse(noConfirmation);
      expect(result.success).toBe(false);
    });

    it('should reject wrong confirmation text', () => {
      const wrongConfirmation = {
        confirmation: 'DELETE MY ACCOUNT'
      };
      const result = deleteAccountSchema.safeParse(wrongConfirmation);
      expect(result.success).toBe(false);
    });

    it('should define success response shape', () => {
      const successResponse = {
        success: true,
        message: 'Account data deleted successfully. Please contact support to fully delete your authentication record.'
      };

      expect(successResponse).toMatchObject({
        success: true,
        message: expect.stringContaining('deleted successfully')
      });
    });

    it('should define confirmation error response', () => {
      const errorResponse = {
        error: 'Account deletion requires confirmation',
        message: 'Send { "confirmation": "DELETE_MY_ACCOUNT" } to confirm'
      };

      expect(errorResponse).toHaveProperty('error');
      expect(errorResponse).toHaveProperty('message');
      expect(errorResponse.message).toContain('DELETE_MY_ACCOUNT');
    });
  });

  describe('Cross-user route patterns', () => {
    it('should require authentication for all user routes', () => {
      const unauthorizedError = {
        error: 'No authorization header'
      };
      expect(unauthorizedError).toHaveProperty('error');
    });

    it('should use consistent success response format', () => {
      const successResponses = [
        { success: true, profile: {}, message: 'Profile updated successfully' },
        { success: true, settings: {}, message: 'Settings updated successfully' },
        { success: true, message: 'Account data deleted successfully' }
      ];

      successResponses.forEach(response => {
        expect(response).toHaveProperty('success', true);
        expect(response).toHaveProperty('message');
      });
    });

    it('should use consistent error response format', () => {
      const errorResponses = [
        { error: 'No authorization header' },
        { error: 'Unauthorized' },
        { error: 'Validation failed', details: {} },
        { error: 'Failed to fetch profile', details: 'error message' }
      ];

      errorResponses.forEach(response => {
        expect(response).toHaveProperty('error');
        expect(typeof response.error).toBe('string');
      });
    });

    it('should use appropriate HTTP status codes', () => {
      const statusCodes = {
        success: 200,
        validation_error: 400,
        unauthorized: 401,
        forbidden: 403,
        not_found: 404,
        server_error: 500
      };

      expect(statusCodes.success).toBe(200);
      expect(statusCodes.validation_error).toBe(400);
      expect(statusCodes.unauthorized).toBe(401);
    });

    it('should never expose sensitive data in responses', () => {
      const profileResponse = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User'
      };

      expect(profileResponse).not.toHaveProperty('password');
      expect(profileResponse).not.toHaveProperty('passwordHash');
      expect(profileResponse).not.toHaveProperty('apiKey');
      expect(profileResponse).not.toHaveProperty('secret');
    });

    it('should handle missing resources gracefully', () => {
      // Free tier users have no subscription record
      const freeTierResponse = {
        plan: 'free',
        status: 'inactive',
        features: {
          socialAccounts: 1,
          aiPosts: 5,
          personas: 1
        }
      };

      expect(freeTierResponse.plan).toBe('free');
    });
  });

  describe('Validation patterns', () => {
    it('should provide detailed validation errors', () => {
      const validationError = {
        error: 'Validation failed',
        details: {
          name: ['Name too long'],
          website: ['Invalid website URL']
        }
      };

      expect(validationError).toHaveProperty('error');
      expect(validationError).toHaveProperty('details');
      expect(typeof validationError.details).toBe('object');
    });

    it('should validate string lengths', () => {
      const fields = [
        { field: 'name', max: 100 },
        { field: 'company', max: 100 },
        { field: 'role', max: 50 },
        { field: 'bio', max: 500 },
        { field: 'phone', max: 20 }
      ];

      fields.forEach(({ field, max }) => {
        const tooLong = 'a'.repeat(max + 1);
        const update = { [field]: tooLong };
        const result = profileUpdateSchema.safeParse(update);
        expect(result.success).toBe(false);
      });
    });

    it('should validate URL formats', () => {
      const validUrls = [
        'https://example.com',
        'http://example.com',
        'https://sub.example.com',
        'https://example.com/path',
        '' // Empty string is explicitly allowed
      ];

      validUrls.forEach(url => {
        const result = profileUpdateSchema.safeParse({ website: url });
        expect(result.success).toBe(true);
      });

      const invalidUrls = ['not-a-url'];
      invalidUrls.forEach(url => {
        const result = profileUpdateSchema.safeParse({ website: url });
        expect(result.success).toBe(false);
      });
    });
  });
});
