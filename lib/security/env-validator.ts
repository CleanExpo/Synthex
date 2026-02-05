/**
 * CRITICAL SECURITY MODULE - Environment Variable Validator
 * 
 * ⚠️ SECURITY CONSTRAINTS:
 * 1. NEVER log sensitive values (only show first/last 3 chars)
 * 2. NEVER expose env vars to client unless prefixed with NEXT_PUBLIC_
 * 3. ALWAYS validate format and type of env variables
 * 4. ALWAYS fail fast if required variables are missing
 * 5. NEVER commit .env files to version control
 * 
 * This module MUST be imported and validated before any other code runs
 */

import { z } from 'zod';
import crypto from 'crypto';

// ============================================
// SECURITY CLASSIFICATION LEVELS
// ============================================
export enum SecurityLevel {
  PUBLIC = 'PUBLIC',        // Safe for client-side (NEXT_PUBLIC_*)
  INTERNAL = 'INTERNAL',    // Server-side only
  SECRET = 'SECRET',        // Sensitive data (API keys, passwords)
  CRITICAL = 'CRITICAL'     // Highly sensitive (DB URLs, private keys)
}

// ============================================
// ENVIRONMENT VARIABLE DEFINITIONS
// ============================================
interface EnvVarDefinition {
  key: string;
  description: string;
  required: boolean;
  securityLevel: SecurityLevel;
  validator: z.ZodSchema;
  defaultValue?: string;
  example: string;
  errorMessage?: string;
  dependsOn?: string[];  // Other env vars this depends on
  conflictsWith?: string[]; // Env vars that conflict with this
}

// ============================================
// COMPREHENSIVE ENV VAR SCHEMA
// ============================================
export const ENV_VAR_DEFINITIONS: EnvVarDefinition[] = [
  // ========== DATABASE ==========
  {
    key: 'DATABASE_URL',
    description: 'PostgreSQL connection string with credentials',
    required: true,
    securityLevel: SecurityLevel.CRITICAL,
    validator: z.string()
      .min(1, 'DATABASE_URL cannot be empty')
      .regex(
        /^postgres(ql)?:\/\/[^:]+:[^@]+@[^:]+:\d+\/\w+/,
        'Invalid PostgreSQL connection string format'
      ),
    example: 'postgresql://user:password@host:5432/dbname',
    errorMessage: 'Database connection will fail - check credentials and format'
  },

  // ========== AUTHENTICATION ==========
  {
    key: 'JWT_SECRET',
    description: 'Secret key for signing JWT tokens (min 32 chars)',
    required: true,
    securityLevel: SecurityLevel.CRITICAL,
    validator: z.string()
      .min(32, 'JWT_SECRET must be at least 32 characters')
      .regex(/^[A-Za-z0-9+/=]+$/, 'JWT_SECRET must be base64 encoded'),
    example: 'base64EncodedRandomStringAtLeast32CharsLong==',
    errorMessage: 'Authentication will be compromised - generate with: openssl rand -base64 32'
  },

  {
    key: 'FIELD_ENCRYPTION_KEY',
    description: 'AES-256 encryption key for sensitive database fields (64 hex chars = 32 bytes)',
    required: true,
    securityLevel: SecurityLevel.CRITICAL,
    validator: z.string()
      .length(64, 'FIELD_ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes)')
      .regex(/^[A-Fa-f0-9]+$/, 'FIELD_ENCRYPTION_KEY must be valid hex encoding'),
    example: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    errorMessage: 'OAuth tokens and API keys cannot be encrypted - generate with: openssl rand -hex 32'
  },

  {
    key: 'NEXTAUTH_SECRET',
    description: 'NextAuth.js secret for session encryption',
    required: false,
    securityLevel: SecurityLevel.CRITICAL,
    validator: z.string().min(32).optional(),
    example: 'generated-random-string-for-nextauth',
    dependsOn: ['NEXTAUTH_URL']
  },

  {
    key: 'NEXTAUTH_URL',
    description: 'Canonical URL of the site for NextAuth',
    required: false,
    securityLevel: SecurityLevel.INTERNAL,
    validator: z.string().url().optional(),
    example: 'https://synthex.vercel.app',
    defaultValue: process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined
  },

  // ========== SUPABASE ==========
  {
    key: 'NEXT_PUBLIC_SUPABASE_URL',
    description: 'Supabase project URL (public)',
    required: true,
    securityLevel: SecurityLevel.PUBLIC,
    validator: z.string()
      .url()
      .regex(/\.supabase\.co$/, 'Must be a valid Supabase URL'),
    example: 'https://project.supabase.co'
  },

  {
    key: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    description: 'Supabase anonymous/public key (safe for client)',
    required: true,
    securityLevel: SecurityLevel.PUBLIC,
    validator: z.string()
      .min(30, 'Invalid Supabase anon key')
      .regex(/^eyJ/, 'Must be a valid JWT token'),
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
  },

  {
    key: 'SUPABASE_SERVICE_ROLE_KEY',
    description: 'Supabase service role key (NEVER expose to client)',
    required: false,
    securityLevel: SecurityLevel.CRITICAL,
    validator: z.string()
      .min(30)
      .regex(/^eyJ/, 'Must be a valid JWT token')
      .optional(),
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    errorMessage: 'Admin operations will fail - keep this SECRET!'
  },

  // ========== AI/LLM SERVICES ==========
  {
    key: 'OPENROUTER_API_KEY',
    description: 'OpenRouter API key for AI services',
    required: true,
    securityLevel: SecurityLevel.SECRET,
    validator: z.string()
      .min(20)
      .regex(/^sk-or-/, 'Must start with sk-or-'),
    example: 'sk-or-v1-xxxxxxxxxxxxx',
    errorMessage: 'AI features will be disabled'
  },

  {
    key: 'OPENAI_API_KEY',
    description: 'OpenAI API key (alternative to OpenRouter)',
    required: false,
    securityLevel: SecurityLevel.SECRET,
    validator: z.string()
      .regex(/^sk-[A-Za-z0-9]{48}$/, 'Invalid OpenAI API key format')
      .optional(),
    example: 'sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    conflictsWith: ['ANTHROPIC_API_KEY']
  },

  {
    key: 'ANTHROPIC_API_KEY',
    description: 'Anthropic Claude API key',
    required: false,
    securityLevel: SecurityLevel.SECRET,
    validator: z.string()
      .regex(/^sk-ant-/, 'Must start with sk-ant-')
      .optional(),
    example: 'sk-ant-xxxxxxxxxxxxx',
    conflictsWith: ['OPENAI_API_KEY']
  },

  // ========== PAYMENT PROCESSING ==========
  {
    key: 'STRIPE_SECRET_KEY',
    description: 'Stripe secret key for payment processing',
    required: false,
    securityLevel: SecurityLevel.CRITICAL,
    validator: z.string()
      .regex(/^sk_(test|live)_/, 'Must be valid Stripe secret key')
      .optional(),
    example: 'sk_test_xxxxxxxxxx or sk_live_xxxxxxxxxx',
    dependsOn: ['STRIPE_PUBLISHABLE_KEY', 'STRIPE_WEBHOOK_SECRET']
  },

  {
    key: 'STRIPE_PUBLISHABLE_KEY',
    description: 'Stripe publishable key (safe for client)',
    required: false,
    securityLevel: SecurityLevel.PUBLIC,
    validator: z.string()
      .regex(/^pk_(test|live)_/, 'Must be valid Stripe publishable key')
      .optional(),
    example: 'pk_test_xxxxxxxxxx or pk_live_xxxxxxxxxx'
  },

  {
    key: 'STRIPE_WEBHOOK_SECRET',
    description: 'Stripe webhook endpoint secret',
    required: false,
    securityLevel: SecurityLevel.SECRET,
    validator: z.string()
      .regex(/^whsec_/, 'Must start with whsec_')
      .optional(),
    example: 'whsec_xxxxxxxxxx'
  },

  {
    key: 'STRIPE_PROFESSIONAL_PRICE_ID',
    description: 'Stripe price ID for Professional plan',
    required: false,
    securityLevel: SecurityLevel.INTERNAL,
    validator: z.string()
      .regex(/^price_/, 'Must be a valid Stripe price ID')
      .optional(),
    example: 'price_1xxxxxxxxxxxxxxxxx',
    dependsOn: ['STRIPE_SECRET_KEY']
  },

  {
    key: 'STRIPE_BUSINESS_PRICE_ID',
    description: 'Stripe price ID for Business plan',
    required: false,
    securityLevel: SecurityLevel.INTERNAL,
    validator: z.string()
      .regex(/^price_/, 'Must be a valid Stripe price ID')
      .optional(),
    example: 'price_1xxxxxxxxxxxxxxxxx',
    dependsOn: ['STRIPE_SECRET_KEY']
  },

  {
    key: 'STRIPE_CUSTOM_PRICE_ID',
    description: 'Stripe price ID for Custom/Enterprise plan',
    required: false,
    securityLevel: SecurityLevel.INTERNAL,
    validator: z.string()
      .regex(/^price_/, 'Must be a valid Stripe price ID')
      .optional(),
    example: 'price_1xxxxxxxxxxxxxxxxx',
    dependsOn: ['STRIPE_SECRET_KEY']
  },

  // ========== EMAIL SERVICE ==========
  {
    key: 'EMAIL_PROVIDER',
    description: 'Email service provider',
    required: false,
    securityLevel: SecurityLevel.INTERNAL,
    validator: z.enum(['smtp', 'sendgrid', 'mailgun', 'ses']).optional(),
    example: 'smtp',
    dependsOn: ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS']
  },

  {
    key: 'SMTP_HOST',
    description: 'SMTP server hostname',
    required: false,
    securityLevel: SecurityLevel.INTERNAL,
    validator: z.string().min(1).optional(),
    example: 'smtp.gmail.com'
  },

  {
    key: 'SMTP_PORT',
    description: 'SMTP server port',
    required: false,
    securityLevel: SecurityLevel.INTERNAL,
    validator: z.string().regex(/^\d+$/).optional(),
    example: '587',
    defaultValue: '587'
  },

  {
    key: 'SMTP_USER',
    description: 'SMTP authentication username',
    required: false,
    securityLevel: SecurityLevel.SECRET,
    validator: z.string().email().optional(),
    example: 'your-email@gmail.com'
  },

  {
    key: 'SMTP_PASS',
    description: 'SMTP authentication password',
    required: false,
    securityLevel: SecurityLevel.SECRET,
    validator: z.string().min(1).optional(),
    example: 'your-app-specific-password'
  },

  // ========== OAUTH PROVIDERS ==========
  {
    key: 'GOOGLE_CLIENT_ID',
    description: 'Google OAuth client ID',
    required: false,
    securityLevel: SecurityLevel.INTERNAL,
    validator: z.string()
      .regex(/\.apps\.googleusercontent\.com$/)
      .optional(),
    example: 'xxxxx.apps.googleusercontent.com',
    dependsOn: ['GOOGLE_CLIENT_SECRET']
  },

  {
    key: 'GOOGLE_CLIENT_SECRET',
    description: 'Google OAuth client secret',
    required: false,
    securityLevel: SecurityLevel.SECRET,
    validator: z.string().min(20).optional(),
    example: 'GOCSPX-xxxxxxxxxxxxx'
  },

  // ========== TWITTER/X OAUTH ==========
  {
    key: 'TWITTER_CLIENT_ID',
    description: 'Twitter/X OAuth 2.0 client ID',
    required: false,
    securityLevel: SecurityLevel.INTERNAL,
    validator: z.string().min(10).optional(),
    example: 'xxxxxxxxxxxxxxxxxxxxxxxx',
    dependsOn: ['TWITTER_CLIENT_SECRET']
  },

  {
    key: 'TWITTER_CLIENT_SECRET',
    description: 'Twitter/X OAuth 2.0 client secret',
    required: false,
    securityLevel: SecurityLevel.SECRET,
    validator: z.string().min(20).optional(),
    example: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'
  },

  // ========== META (FACEBOOK/INSTAGRAM) OAUTH ==========
  {
    key: 'FACEBOOK_CLIENT_ID',
    description: 'Meta/Facebook OAuth app ID',
    required: false,
    securityLevel: SecurityLevel.INTERNAL,
    validator: z.string().regex(/^\d+$/).optional(),
    example: '1234567890123456',
    dependsOn: ['FACEBOOK_CLIENT_SECRET']
  },

  {
    key: 'FACEBOOK_CLIENT_SECRET',
    description: 'Meta/Facebook OAuth app secret',
    required: false,
    securityLevel: SecurityLevel.SECRET,
    validator: z.string().min(20).optional(),
    example: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'
  },

  // ========== LINKEDIN OAUTH ==========
  {
    key: 'LINKEDIN_CLIENT_ID',
    description: 'LinkedIn OAuth client ID',
    required: false,
    securityLevel: SecurityLevel.INTERNAL,
    validator: z.string().min(10).optional(),
    example: 'xxxxxxxxxxxx',
    dependsOn: ['LINKEDIN_CLIENT_SECRET']
  },

  {
    key: 'LINKEDIN_CLIENT_SECRET',
    description: 'LinkedIn OAuth client secret',
    required: false,
    securityLevel: SecurityLevel.SECRET,
    validator: z.string().min(10).optional(),
    example: 'xxxxxxxxxxxxxxxx'
  },

  // ========== TIKTOK OAUTH ==========
  {
    key: 'TIKTOK_CLIENT_KEY',
    description: 'TikTok OAuth client key',
    required: false,
    securityLevel: SecurityLevel.INTERNAL,
    validator: z.string().min(10).optional(),
    example: 'xxxxxxxxxxxxxxxxxxxx',
    dependsOn: ['TIKTOK_CLIENT_SECRET']
  },

  {
    key: 'TIKTOK_CLIENT_SECRET',
    description: 'TikTok OAuth client secret',
    required: false,
    securityLevel: SecurityLevel.SECRET,
    validator: z.string().min(20).optional(),
    example: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'
  },

  // ========== MONITORING & ANALYTICS ==========
  {
    key: 'SENTRY_DSN',
    description: 'Sentry error tracking DSN',
    required: false,
    securityLevel: SecurityLevel.INTERNAL,
    validator: z.string()
      .url()
      .regex(/sentry\.io/)
      .optional(),
    example: 'https://xxx@xxx.ingest.sentry.io/xxx'
  },

  {
    key: 'NEXT_PUBLIC_GA_ID',
    description: 'Google Analytics tracking ID',
    required: false,
    securityLevel: SecurityLevel.PUBLIC,
    validator: z.string()
      .regex(/^(G|UA)-/)
      .optional(),
    example: 'G-XXXXXXXXXX or UA-XXXXXXXXX-X'
  },

  // ========== APPLICATION CONFIG ==========
  {
    key: 'NEXT_PUBLIC_APP_URL',
    description: 'Public application URL',
    required: false,
    securityLevel: SecurityLevel.PUBLIC,
    validator: z.string().url().optional(),
    example: 'https://synthex.vercel.app',
    defaultValue: process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000'
  },

  {
    key: 'NODE_ENV',
    description: 'Node environment',
    required: false,
    securityLevel: SecurityLevel.INTERNAL,
    validator: z.enum(['development', 'test', 'production']).optional(),
    example: 'production',
    defaultValue: 'development'
  },

  // ========== REDIS/CACHING ==========
  {
    key: 'REDIS_URL',
    description: 'Redis connection URL for caching',
    required: false,
    securityLevel: SecurityLevel.SECRET,
    validator: z.string()
      .regex(/^redis(s)?:\/\//)
      .optional(),
    example: 'redis://username:password@host:6379'
  },

  // ========== RATE LIMITING ==========
  {
    key: 'RATE_LIMIT_MAX',
    description: 'Maximum requests per window',
    required: false,
    securityLevel: SecurityLevel.INTERNAL,
    validator: z.string().regex(/^\d+$/).optional(),
    example: '100',
    defaultValue: '100'
  },

  {
    key: 'RATE_LIMIT_WINDOW_MS',
    description: 'Rate limit window in milliseconds',
    required: false,
    securityLevel: SecurityLevel.INTERNAL,
    validator: z.string().regex(/^\d+$/).optional(),
    example: '900000',
    defaultValue: '900000' // 15 minutes
  }
];

// ============================================
// VALIDATION RESULT TYPES
// ============================================
export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  summary: ValidationSummary;
  securityReport: SecurityReport;
}

export interface ValidationError {
  key: string;
  message: string;
  securityLevel: SecurityLevel;
  suggestion?: string;
}

export interface ValidationWarning {
  key: string;
  message: string;
  impact?: string;
}

export interface ValidationSummary {
  totalRequired: number;
  totalOptional: number;
  missingRequired: string[];
  missingOptional: string[];
  configured: string[];
}

export interface SecurityReport {
  exposedSecrets: string[];
  weakSecrets: string[];
  publicExposure: string[];
  recommendations: string[];
}

// ============================================
// MAIN VALIDATOR CLASS
// ============================================
export class EnvValidator {
  private static instance: EnvValidator;
  private validated: boolean = false;
  private validationResult: ValidationResult | null = null;

  private constructor() {}

  public static getInstance(): EnvValidator {
    if (!EnvValidator.instance) {
      EnvValidator.instance = new EnvValidator();
    }
    return EnvValidator.instance;
  }

  /**
   * Validates all environment variables
   * MUST be called at application startup
   */
  public validate(throwOnError: boolean = true): ValidationResult {
    if (this.validated && this.validationResult) {
      return this.validationResult;
    }

    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const configured: string[] = [];
    const missingRequired: string[] = [];
    const missingOptional: string[] = [];

    // Validate each defined env var
    for (const def of ENV_VAR_DEFINITIONS) {
      const value = process.env[def.key];

      if (!value) {
        if (def.required) {
          missingRequired.push(def.key);
          errors.push({
            key: def.key,
            message: `Required env var ${def.key} is missing`,
            securityLevel: def.securityLevel,
            suggestion: `Set ${def.key}=${def.example}`
          });
        } else {
          missingOptional.push(def.key);
          warnings.push({
            key: def.key,
            message: `Optional env var ${def.key} not configured`,
            impact: def.errorMessage || 'Feature may be limited'
          });
        }
        continue;
      }

      // Validate format
      try {
        def.validator.parse(value);
        configured.push(def.key);
      } catch (error) {
        errors.push({
          key: def.key,
          message: `Invalid format for ${def.key}: ${error}`,
          securityLevel: def.securityLevel,
          suggestion: `Expected format: ${def.example}`
        });
      }

      // Check dependencies
      if (def.dependsOn) {
        for (const dep of def.dependsOn) {
          if (!process.env[dep]) {
            warnings.push({
              key: def.key,
              message: `${def.key} depends on ${dep} which is not set`,
              impact: 'Feature may not work correctly'
            });
          }
        }
      }

      // Check conflicts
      if (def.conflictsWith) {
        for (const conflict of def.conflictsWith) {
          if (process.env[conflict]) {
            warnings.push({
              key: def.key,
              message: `${def.key} conflicts with ${conflict} (both are set)`,
              impact: 'May cause unexpected behavior'
            });
          }
        }
      }
    }

    // Generate security report
    const securityReport = this.generateSecurityReport();

    const result: ValidationResult = {
      isValid: errors.length === 0,
      errors,
      warnings,
      summary: {
        totalRequired: ENV_VAR_DEFINITIONS.filter(d => d.required).length,
        totalOptional: ENV_VAR_DEFINITIONS.filter(d => !d.required).length,
        missingRequired,
        missingOptional,
        configured
      },
      securityReport
    };

    this.validationResult = result;
    this.validated = true;

    if (throwOnError && !result.isValid) {
      this.printValidationReport(result);
      throw new Error('Environment validation failed! See report above.');
    }

    return result;
  }

  /**
   * Generates a security report for env vars
   */
  private generateSecurityReport(): SecurityReport {
    const exposedSecrets: string[] = [];
    const weakSecrets: string[] = [];
    const publicExposure: string[] = [];
    const recommendations: string[] = [];

    // Check for exposed secrets
    for (const def of ENV_VAR_DEFINITIONS) {
      const value = process.env[def.key];
      if (!value) continue;

      // Check if secret is exposed to client
      if (def.securityLevel === SecurityLevel.SECRET || 
          def.securityLevel === SecurityLevel.CRITICAL) {
        if (def.key.startsWith('NEXT_PUBLIC_')) {
          exposedSecrets.push(def.key);
          recommendations.push(`CRITICAL: Remove NEXT_PUBLIC_ prefix from ${def.key}`);
        }
      }

      // Check for weak secrets
      if (def.securityLevel === SecurityLevel.CRITICAL) {
        if (value.length < 32) {
          weakSecrets.push(def.key);
          recommendations.push(`Strengthen ${def.key} (min 32 chars)`);
        }
        if (/^(password|secret|123456|admin)/i.test(value)) {
          weakSecrets.push(def.key);
          recommendations.push(`${def.key} contains weak/common pattern`);
        }
      }

      // Check public exposure
      if (def.key.startsWith('NEXT_PUBLIC_')) {
        publicExposure.push(def.key);
      }
    }

    // General recommendations
    if (!process.env.SENTRY_DSN) {
      recommendations.push('Add error tracking with Sentry');
    }
    if (!process.env.REDIS_URL) {
      recommendations.push('Add Redis for caching and rate limiting');
    }

    return {
      exposedSecrets,
      weakSecrets,
      publicExposure,
      recommendations
    };
  }

  /**
   * Prints a formatted validation report
   */
  public printValidationReport(result: ValidationResult): void {
    console.log('\n' + '='.repeat(60));
    console.log('🔒 ENVIRONMENT VARIABLE SECURITY REPORT');
    console.log('='.repeat(60));

    // Status
    console.log(`\n📊 Status: ${result.isValid ? '✅ VALID' : '❌ INVALID'}`);
    console.log(`   Required: ${result.summary.configured.length}/${result.summary.totalRequired}`);
    console.log(`   Optional: ${result.summary.totalOptional - result.summary.missingOptional.length}/${result.summary.totalOptional}`);

    // Errors
    if (result.errors.length > 0) {
      console.log('\n❌ CRITICAL ERRORS:');
      for (const error of result.errors) {
        console.log(`   ${error.key}: ${error instanceof Error ? error.message : String(error)}`);
        if (error.suggestion) {
          console.log(`      💡 ${error.suggestion}`);
        }
      }
    }

    // Warnings
    if (result.warnings.length > 0) {
      console.log('\n⚠️  WARNINGS:');
      for (const warning of result.warnings) {
        console.log(`   ${warning.key}: ${warning.message}`);
        if (warning.impact) {
          console.log(`      Impact: ${warning.impact}`);
        }
      }
    }

    // Security Report
    console.log('\n🔐 SECURITY ANALYSIS:');
    if (result.securityReport.exposedSecrets.length > 0) {
      console.log('   🚨 EXPOSED SECRETS:', result.securityReport.exposedSecrets.join(', '));
    }
    if (result.securityReport.weakSecrets.length > 0) {
      console.log('   ⚠️  WEAK SECRETS:', result.securityReport.weakSecrets.join(', '));
    }
    console.log('   📢 PUBLIC VARS:', result.securityReport.publicExposure.join(', '));

    // Recommendations
    if (result.securityReport.recommendations.length > 0) {
      console.log('\n💡 RECOMMENDATIONS:');
      for (const rec of result.securityReport.recommendations) {
        console.log(`   • ${rec}`);
      }
    }

    console.log('\n' + '='.repeat(60) + '\n');
  }

  /**
   * Gets a validated env var value with type safety
   */
  public get<T = string>(key: string): T {
    if (!this.validated) {
      this.validate();
    }

    const def = ENV_VAR_DEFINITIONS.find(d => d.key === key);
    if (!def) {
      throw new Error(`Undefined env var: ${key}`);
    }

    const value = process.env[key] || def.defaultValue;
    if (!value && def.required) {
      throw new Error(`Required env var ${key} is not set`);
    }

    return value as T;
  }

  /**
   * Safely logs an env var (masks sensitive values)
   */
  public safeLog(key: string): string {
    const def = ENV_VAR_DEFINITIONS.find(d => d.key === key);
    if (!def) return 'UNDEFINED';

    const value = process.env[key];
    if (!value) return 'NOT_SET';

    // Mask sensitive values
    if (def.securityLevel === SecurityLevel.SECRET || 
        def.securityLevel === SecurityLevel.CRITICAL) {
      if (value.length <= 10) return '***';
      return `${value.slice(0, 3)}***${value.slice(-3)}`;
    }

    return value;
  }

  /**
   * Generates .env.example file
   */
  public generateEnvExample(): string {
    let content = '# ===========================================\n';
    content += '# SYNTHEX ENVIRONMENT VARIABLES\n';
    content += '# ===========================================\n';
    content += '# Generated: ' + new Date().toISOString() + '\n';
    content += '# \n';
    content += '# ⚠️  SECURITY WARNINGS:\n';
    content += '# 1. NEVER commit .env files to version control\n';
    content += '# 2. NEVER expose SECRET/CRITICAL vars to client\n';
    content += '# 3. ALWAYS use strong, random values for secrets\n';
    content += '# 4. ALWAYS validate env vars at startup\n';
    content += '# ===========================================\n\n';

    const grouped = {
      DATABASE: [] as EnvVarDefinition[],
      AUTH: [] as EnvVarDefinition[],
      AI: [] as EnvVarDefinition[],
      PAYMENT: [] as EnvVarDefinition[],
      EMAIL: [] as EnvVarDefinition[],
      OAUTH: [] as EnvVarDefinition[],
      MONITORING: [] as EnvVarDefinition[],
      APP: [] as EnvVarDefinition[],
      OTHER: [] as EnvVarDefinition[]
    };

    // Group env vars by category
    for (const def of ENV_VAR_DEFINITIONS) {
      if (def.key.includes('DATABASE') || def.key.includes('DB')) {
        grouped.DATABASE.push(def);
      } else if (def.key.includes('JWT') || def.key.includes('AUTH')) {
        grouped.AUTH.push(def);
      } else if (def.key.includes('OPENROUTER') || def.key.includes('OPENAI') || def.key.includes('ANTHROPIC')) {
        grouped.AI.push(def);
      } else if (def.key.includes('STRIPE')) {
        grouped.PAYMENT.push(def);
      } else if (def.key.includes('SMTP') || def.key.includes('EMAIL')) {
        grouped.EMAIL.push(def);
      } else if (def.key.includes('GOOGLE')) {
        grouped.OAUTH.push(def);
      } else if (def.key.includes('SENTRY') || def.key.includes('GA')) {
        grouped.MONITORING.push(def);
      } else if (def.key.includes('APP') || def.key.includes('NODE')) {
        grouped.APP.push(def);
      } else {
        grouped.OTHER.push(def);
      }
    }

    // Generate content for each group
    for (const [category, defs] of Object.entries(grouped)) {
      if (defs.length === 0) continue;

      content += `# ========== ${category} ==========\n`;
      for (const def of defs) {
        content += `# ${def.description}\n`;
        content += `# Security: ${def.securityLevel}${def.required ? ' [REQUIRED]' : ' [OPTIONAL]'}\n`;
        if (def.dependsOn) {
          content += `# Depends on: ${def.dependsOn.join(', ')}\n`;
        }
        if (def.conflictsWith) {
          content += `# Conflicts with: ${def.conflictsWith.join(', ')}\n`;
        }
        content += `${def.key}=${def.example}\n\n`;
      }
    }

    return content;
  }
}

// ============================================
// RUNTIME VALIDATION MIDDLEWARE
// ============================================
export function validateEnvMiddleware() {
  const validator = EnvValidator.getInstance();
  const result = validator.validate(false);

  return (req: any, res: any, next: any) => {
    // Attach validation result to request
    req.envValidation = result;

    // Block requests if critical errors
    if (!result.isValid && result.errors.some(e => e.securityLevel === SecurityLevel.CRITICAL)) {
      return res.status(500).json({
        error: 'Server configuration error',
        message: 'Critical environment variables are not properly configured'
      });
    }

    next();
  };
}

// ============================================
// EXPORT SINGLETON INSTANCE
// ============================================
export const envValidator = EnvValidator.getInstance();