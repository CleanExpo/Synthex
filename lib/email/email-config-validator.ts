/**
 * Email Configuration Validator
 * Validates and provides defaults for email service configuration
 */

import { z } from 'zod';

// Email provider enum
export const EmailProviders = {
  SENDGRID: 'sendgrid',
  MAILGUN: 'mailgun',
  POSTMARK: 'postmark',
  SES: 'ses',
  SMTP: 'smtp',
  RESEND: 'resend',
  MOCK: 'mock',
} as const;

export type EmailProvider = typeof EmailProviders[keyof typeof EmailProviders];

// Email configuration schema
const emailConfigSchema = z.object({
  // Core settings
  provider: z.enum(['sendgrid', 'mailgun', 'postmark', 'ses', 'smtp', 'resend', 'mock']).default('mock'),
  enabled: z.boolean().default(true),
  
  // Default email settings
  fromAddress: z.string().email().default('noreply@synthex.social'),
  fromName: z.string().default('Synthex'),
  replyTo: z.string().email().optional(),
  
  // Provider-specific credentials
  sendgridApiKey: z.string().optional(),
  sendgridWelcomeTemplateId: z.string().optional(),
  sendgridResetPasswordTemplateId: z.string().optional(),
  sendgridVerificationTemplateId: z.string().optional(),
  
  mailgunApiKey: z.string().optional(),
  mailgunDomain: z.string().optional(),
  mailgunHost: z.string().default('api.mailgun.net'),
  
  postmarkApiKey: z.string().optional(),
  postmarkServerToken: z.string().optional(),
  postmarkMessageStream: z.string().default('outbound'),
  
  awsSesRegion: z.string().default('us-east-1'),
  awsSesAccessKeyId: z.string().optional(),
  awsSesSecretAccessKey: z.string().optional(),
  
  resendApiKey: z.string().optional(),
  
  smtpHost: z.string().optional(),
  smtpPort: z.number().default(587),
  smtpSecure: z.boolean().default(false),
  smtpUser: z.string().optional(),
  smtpPassword: z.string().optional(),
  
  // Rate limiting
  rateLimitMax: z.number().default(100),
  rateLimitWindowMs: z.number().default(3600000), // 1 hour
  
  // Queue settings
  queueEnabled: z.boolean().default(false),
  retryAttempts: z.number().default(3),
  retryDelayMs: z.number().default(5000),
  
  // Development settings
  devEmailRecipient: z.string().email().optional(),
  devEmailLogEnabled: z.boolean().default(true),
  testMode: z.boolean().default(false),
  
  // Tracking settings
  trackOpens: z.boolean().default(true),
  trackClicks: z.boolean().default(true),
  trackBounces: z.boolean().default(true),
  
  // Webhook settings
  webhookUrl: z.string().url().optional(),
  webhookSecret: z.string().optional(),
});

export type EmailConfig = z.infer<typeof emailConfigSchema>;

/**
 * Loads and validates email configuration from environment variables
 */
export function loadEmailConfig(): EmailConfig {
  const config = {
    // Core settings
    provider: process.env.EMAIL_PROVIDER,
    enabled: process.env.EMAIL_ENABLED === 'true',
    
    // Default email settings
    fromAddress: process.env.EMAIL_FROM_ADDRESS,
    fromName: process.env.EMAIL_FROM_NAME,
    replyTo: process.env.EMAIL_REPLY_TO,
    
    // SendGrid
    sendgridApiKey: process.env.SENDGRID_API_KEY,
    sendgridWelcomeTemplateId: process.env.SENDGRID_WELCOME_TEMPLATE_ID,
    sendgridResetPasswordTemplateId: process.env.SENDGRID_RESET_PASSWORD_TEMPLATE_ID,
    sendgridVerificationTemplateId: process.env.SENDGRID_VERIFICATION_TEMPLATE_ID,
    
    // Mailgun
    mailgunApiKey: process.env.MAILGUN_API_KEY,
    mailgunDomain: process.env.MAILGUN_DOMAIN,
    mailgunHost: process.env.MAILGUN_HOST,
    
    // Postmark
    postmarkApiKey: process.env.POSTMARK_API_KEY,
    postmarkServerToken: process.env.POSTMARK_SERVER_TOKEN,
    postmarkMessageStream: process.env.POSTMARK_MESSAGE_STREAM,
    
    // AWS SES
    awsSesRegion: process.env.AWS_SES_REGION,
    awsSesAccessKeyId: process.env.AWS_SES_ACCESS_KEY_ID,
    awsSesSecretAccessKey: process.env.AWS_SES_SECRET_ACCESS_KEY,
    
    // Resend
    resendApiKey: process.env.RESEND_API_KEY,
    
    // SMTP
    smtpHost: process.env.SMTP_HOST,
    smtpPort: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : undefined,
    smtpSecure: process.env.SMTP_SECURE === 'true',
    smtpUser: process.env.SMTP_USER,
    smtpPassword: process.env.SMTP_PASSWORD,
    
    // Rate limiting
    rateLimitMax: process.env.EMAIL_RATE_LIMIT_MAX ? parseInt(process.env.EMAIL_RATE_LIMIT_MAX, 10) : undefined,
    rateLimitWindowMs: process.env.EMAIL_RATE_LIMIT_WINDOW_MS ? parseInt(process.env.EMAIL_RATE_LIMIT_WINDOW_MS, 10) : undefined,
    
    // Queue settings
    queueEnabled: process.env.EMAIL_QUEUE_ENABLED === 'true',
    retryAttempts: process.env.EMAIL_RETRY_ATTEMPTS ? parseInt(process.env.EMAIL_RETRY_ATTEMPTS, 10) : undefined,
    retryDelayMs: process.env.EMAIL_RETRY_DELAY_MS ? parseInt(process.env.EMAIL_RETRY_DELAY_MS, 10) : undefined,
    
    // Development settings
    devEmailRecipient: process.env.DEV_EMAIL_RECIPIENT,
    devEmailLogEnabled: process.env.DEV_EMAIL_LOG_ENABLED === 'true',
    testMode: process.env.EMAIL_TEST_MODE === 'true',
    
    // Tracking settings
    trackOpens: process.env.EMAIL_TRACK_OPENS === 'true',
    trackClicks: process.env.EMAIL_TRACK_CLICKS === 'true',
    trackBounces: process.env.EMAIL_TRACK_BOUNCES === 'true',
    
    // Webhook settings
    webhookUrl: process.env.EMAIL_WEBHOOK_URL,
    webhookSecret: process.env.EMAIL_WEBHOOK_SECRET,
  };
  
  // Filter out undefined values
  const cleanConfig = Object.fromEntries(
    Object.entries(config).filter(([_, value]) => value !== undefined)
  );
  
  return emailConfigSchema.parse(cleanConfig);
}

/**
 * Validates that required credentials are present for the selected provider
 */
export function validateProviderCredentials(config: EmailConfig): { 
  valid: boolean; 
  errors: string[] 
} {
  const errors: string[] = [];
  
  if (!config.enabled) {
    return { valid: true, errors: [] }; // Email is disabled, no validation needed
  }
  
  switch (config.provider) {
    case 'sendgrid':
      if (!config.sendgridApiKey) {
        errors.push('SENDGRID_API_KEY is required for SendGrid provider');
      }
      break;
      
    case 'mailgun':
      if (!config.mailgunApiKey) {
        errors.push('MAILGUN_API_KEY is required for Mailgun provider');
      }
      if (!config.mailgunDomain) {
        errors.push('MAILGUN_DOMAIN is required for Mailgun provider');
      }
      break;
      
    case 'postmark':
      if (!config.postmarkApiKey && !config.postmarkServerToken) {
        errors.push('POSTMARK_API_KEY or POSTMARK_SERVER_TOKEN is required for Postmark provider');
      }
      break;
      
    case 'ses':
      if (!config.awsSesAccessKeyId) {
        errors.push('AWS_SES_ACCESS_KEY_ID is required for AWS SES provider');
      }
      if (!config.awsSesSecretAccessKey) {
        errors.push('AWS_SES_SECRET_ACCESS_KEY is required for AWS SES provider');
      }
      break;
      
    case 'resend':
      if (!config.resendApiKey) {
        errors.push('RESEND_API_KEY is required for Resend provider');
      }
      break;
      
    case 'smtp':
      if (!config.smtpHost) {
        errors.push('SMTP_HOST is required for SMTP provider');
      }
      if (!config.smtpUser) {
        errors.push('SMTP_USER is required for SMTP provider');
      }
      if (!config.smtpPassword) {
        errors.push('SMTP_PASSWORD is required for SMTP provider');
      }
      break;
      
    case 'mock':
      // No credentials needed for mock provider
      break;
      
    default:
      errors.push(`Unknown email provider: ${config.provider}`);
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Gets environment-specific configuration overrides
 */
export function getEnvironmentOverrides(config: EmailConfig): Partial<EmailConfig> {
  const overrides: Partial<EmailConfig> = {};
  
  if (process.env.NODE_ENV === 'development') {
    // In development, use mock provider if no credentials are set
    const validation = validateProviderCredentials(config);
    if (!validation.valid && config.provider !== 'mock') {
      console.warn('Email provider credentials missing in development, switching to mock provider');
      overrides.provider = 'mock';
    }
    
    // Enable test mode in development unless explicitly disabled
    if (config.testMode === undefined) {
      overrides.testMode = true;
    }
    
    // Enable logging in development
    overrides.devEmailLogEnabled = true;
  }
  
  if (process.env.NODE_ENV === 'test') {
    // Always use mock provider in test environment
    overrides.provider = 'mock';
    overrides.testMode = true;
    overrides.enabled = false;
  }
  
  return overrides;
}

/**
 * Main function to get validated email configuration
 */
export function getEmailConfig(): EmailConfig & { isValid: boolean; validationErrors: string[] } {
  try {
    const baseConfig = loadEmailConfig();
    const overrides = getEnvironmentOverrides(baseConfig);
    const config = { ...baseConfig, ...overrides };
    const validation = validateProviderCredentials(config);
    
    return {
      ...config,
      isValid: validation.valid,
      validationErrors: validation.errors
    };
  } catch (error) {
    console.error('Failed to load email configuration:', error);
    
    // Return a safe default configuration
    return {
      ...emailConfigSchema.parse({}),
      isValid: false,
      validationErrors: ['Failed to load email configuration']
    };
  }
}
