#!/usr/bin/env npx tsx
/**
 * Google Configuration Validation Script
 *
 * Validates all Google-related environment variables and tests API connectivity.
 *
 * Usage:
 *   npm run validate:google
 *   npx tsx scripts/validate-google-config.ts
 *
 * Exit codes:
 *   0 - All checks passed
 *   1 - Critical errors (missing required vars)
 *   2 - Warnings only (missing optional vars)
 */

import { config } from 'dotenv';

// Load environment variables
config({ path: '.env.local' });
config({ path: '.env' });

// ============================================================================
// CONFIGURATION
// ============================================================================

interface ConfigItem {
  name: string;
  required: boolean;
  security: 'PUBLIC' | 'INTERNAL' | 'SECRET' | 'CRITICAL';
  validate?: (value: string) => { valid: boolean; message?: string };
  test?: () => Promise<{ success: boolean; message: string }>;
}

const GOOGLE_CONFIGS: ConfigItem[] = [
  // OAuth Credentials
  {
    name: 'GOOGLE_CLIENT_ID',
    required: true,
    security: 'SECRET',
    validate: (value) => {
      const valid = value.endsWith('.apps.googleusercontent.com');
      return {
        valid,
        message: valid ? undefined : 'Should end with .apps.googleusercontent.com',
      };
    },
  },
  {
    name: 'GOOGLE_CLIENT_SECRET',
    required: true,
    security: 'SECRET',
    validate: (value) => {
      const valid = value.startsWith('GOCSPX-') || value.length > 20;
      return {
        valid,
        message: valid ? undefined : 'Should start with GOCSPX- (newer format)',
      };
    },
  },

  // AI API Key
  {
    name: 'GOOGLE_AI_API_KEY',
    required: false,
    security: 'SECRET',
    validate: (value) => {
      const valid = value.startsWith('AIza');
      return {
        valid,
        message: valid ? undefined : 'Should start with AIza',
      };
    },
    test: async () => {
      const apiKey = process.env.GOOGLE_AI_API_KEY;
      if (!apiKey) return { success: false, message: 'Not configured' };

      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
        );
        if (response.ok) {
          return { success: true, message: 'API key valid - models endpoint accessible' };
        } else {
          const error = await response.json();
          return {
            success: false,
            message: `API error: ${error.error?.message || response.status}`,
          };
        }
      } catch (error) {
        return {
          success: false,
          message: `Network error: ${error instanceof Error ? error.message : 'Unknown'}`,
        };
      }
    },
  },

  // PageSpeed API Key
  {
    name: 'GOOGLE_PAGESPEED_API_KEY',
    required: false,
    security: 'SECRET',
    validate: (value) => {
      const valid = value.startsWith('AIza');
      return {
        valid,
        message: valid ? undefined : 'Should start with AIza',
      };
    },
    test: async () => {
      const apiKey = process.env.GOOGLE_PAGESPEED_API_KEY;
      if (!apiKey) return { success: false, message: 'Not configured' };

      try {
        const url = encodeURIComponent('https://www.google.com');
        const response = await fetch(
          `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${url}&key=${apiKey}&strategy=mobile`
        );
        if (response.ok) {
          return { success: true, message: 'API key valid - PageSpeed API accessible' };
        } else {
          const error = await response.json();
          return {
            success: false,
            message: `API error: ${error.error?.message || response.status}`,
          };
        }
      } catch (error) {
        return {
          success: false,
          message: `Network error: ${error instanceof Error ? error.message : 'Unknown'}`,
        };
      }
    },
  },

  // Maps/Places API Key
  {
    name: 'GOOGLE_API_KEY',
    required: false,
    security: 'SECRET',
    validate: (value) => {
      const valid = value.startsWith('AIza');
      return {
        valid,
        message: valid ? undefined : 'Should start with AIza',
      };
    },
  },

  // Service Account
  {
    name: 'GOOGLE_INDEXING_SERVICE_ACCOUNT_JSON',
    required: false,
    security: 'CRITICAL',
    validate: (value) => {
      try {
        const parsed = JSON.parse(value);
        const requiredFields = [
          'type',
          'project_id',
          'private_key_id',
          'private_key',
          'client_email',
          'client_id',
          'auth_uri',
          'token_uri',
        ];

        const missingFields = requiredFields.filter((f) => !parsed[f]);

        if (missingFields.length > 0) {
          return {
            valid: false,
            message: `Missing fields: ${missingFields.join(', ')}`,
          };
        }

        if (parsed.type !== 'service_account') {
          return {
            valid: false,
            message: `Invalid type: ${parsed.type} (expected service_account)`,
          };
        }

        return { valid: true };
      } catch {
        return { valid: false, message: 'Invalid JSON format' };
      }
    },
  },

  // Project ID
  {
    name: 'GOOGLE_CLOUD_PROJECT_ID',
    required: false,
    security: 'INTERNAL',
    validate: (value) => {
      const valid = /^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(value);
      return {
        valid,
        message: valid ? undefined : 'Should be 6-30 lowercase letters, digits, hyphens',
      };
    },
  },

  // Google Analytics
  {
    name: 'NEXT_PUBLIC_GA_ID',
    required: false,
    security: 'PUBLIC',
    validate: (value) => {
      const valid = value.startsWith('G-') || value.startsWith('UA-');
      return {
        valid,
        message: valid ? undefined : 'Should start with G- (GA4) or UA- (Universal)',
      };
    },
  },

  // OAuth Callback
  {
    name: 'GOOGLE_CALLBACK_URL',
    required: false,
    security: 'INTERNAL',
    validate: (value) => {
      try {
        const url = new URL(value);
        const valid = url.pathname.includes('/api/auth/callback/google');
        return {
          valid,
          message: valid ? undefined : 'Should include /api/auth/callback/google path',
        };
      } catch {
        return { valid: false, message: 'Invalid URL format' };
      }
    },
  },
];

// ============================================================================
// OUTPUT FORMATTING
// ============================================================================

const COLORS = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
};

function colorize(text: string, color: keyof typeof COLORS): string {
  // Check if colors are supported
  if (!process.stdout.isTTY) return text;
  return `${COLORS[color]}${text}${COLORS.reset}`;
}

function icon(type: 'pass' | 'fail' | 'warn' | 'info'): string {
  const icons = {
    pass: colorize('✓', 'green'),
    fail: colorize('✗', 'red'),
    warn: colorize('⚠', 'yellow'),
    info: colorize('ℹ', 'blue'),
  };
  return icons[type];
}

function maskValue(value: string, security: ConfigItem['security']): string {
  if (security === 'PUBLIC' || security === 'INTERNAL') {
    return value;
  }
  if (value.length <= 8) return '****';
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

// ============================================================================
// VALIDATION
// ============================================================================

interface ValidationResult {
  name: string;
  status: 'pass' | 'fail' | 'warn' | 'skip';
  value?: string;
  message?: string;
  testResult?: { success: boolean; message: string };
}

async function validateConfig(config: ConfigItem): Promise<ValidationResult> {
  const value = process.env[config.name];

  // Check if present
  if (!value || value.trim() === '') {
    return {
      name: config.name,
      status: config.required ? 'fail' : 'warn',
      message: config.required ? 'Required but not set' : 'Not configured (optional)',
    };
  }

  // Run format validation
  if (config.validate) {
    const validation = config.validate(value);
    if (!validation.valid) {
      return {
        name: config.name,
        status: 'warn',
        value: maskValue(value, config.security),
        message: validation.message,
      };
    }
  }

  // Run connectivity test if available
  let testResult: { success: boolean; message: string } | undefined;
  if (config.test) {
    testResult = await config.test();
  }

  return {
    name: config.name,
    status: testResult && !testResult.success ? 'warn' : 'pass',
    value: maskValue(value, config.security),
    testResult,
  };
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log('\n' + colorize('━'.repeat(60), 'dim'));
  console.log(colorize(' Google Configuration Validation', 'bold'));
  console.log(colorize('━'.repeat(60), 'dim') + '\n');

  const results: ValidationResult[] = [];
  let hasErrors = false;
  let hasWarnings = false;

  // Validate all configs
  for (const config of GOOGLE_CONFIGS) {
    const result = await validateConfig(config);
    results.push(result);

    if (result.status === 'fail') hasErrors = true;
    if (result.status === 'warn') hasWarnings = true;
  }

  // Display results
  console.log(colorize('Environment Variables:', 'bold') + '\n');

  for (const result of results) {
    if (result.status === 'skip') continue;

    const statusIcon = icon(result.status as 'pass' | 'fail' | 'warn');
    const name = colorize(result.name, result.status === 'pass' ? 'cyan' : 'reset');

    console.log(`  ${statusIcon} ${name}`);

    if (result.value) {
      console.log(`      Value: ${colorize(result.value, 'dim')}`);
    }

    if (result.message) {
      const msgColor = result.status === 'fail' ? 'red' : 'yellow';
      console.log(`      ${colorize(result.message, msgColor)}`);
    }

    if (result.testResult) {
      const testIcon = result.testResult.success ? icon('pass') : icon('warn');
      console.log(`      ${testIcon} API Test: ${result.testResult.message}`);
    }

    console.log();
  }

  // Check OAuth redirect URI configuration
  console.log(colorize('OAuth Configuration Check:', 'bold') + '\n');

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL;
  if (appUrl) {
    console.log(`  ${icon('info')} App URL: ${colorize(appUrl, 'cyan')}`);
    console.log(`  ${icon('info')} Expected redirect URIs:`);
    console.log(`      - ${appUrl}/api/auth/callback/google`);
    console.log(`      - ${appUrl}/api/auth/youtube/callback\n`);
  } else {
    console.log(`  ${icon('warn')} ${colorize('NEXT_PUBLIC_APP_URL not set', 'yellow')}`);
    console.log(`      Cannot verify redirect URI configuration\n`);
    hasWarnings = true;
  }

  // Summary
  console.log(colorize('━'.repeat(60), 'dim'));

  const passCount = results.filter((r) => r.status === 'pass').length;
  const failCount = results.filter((r) => r.status === 'fail').length;
  const warnCount = results.filter((r) => r.status === 'warn').length;

  console.log(`\n  Summary: ${passCount} passed, ${failCount} failed, ${warnCount} warnings\n`);

  if (hasErrors) {
    console.log(
      colorize('  ✗ Configuration has errors. Fix required variables before deployment.\n', 'red')
    );
    process.exit(1);
  } else if (hasWarnings) {
    console.log(
      colorize('  ⚠ Configuration has warnings. Review optional variables.\n', 'yellow')
    );
    process.exit(2);
  } else {
    console.log(colorize('  ✓ All Google configurations validated successfully!\n', 'green'));
    process.exit(0);
  }
}

main().catch((error) => {
  console.error('Validation script failed:', error);
  process.exit(1);
});
