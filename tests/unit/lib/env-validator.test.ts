/**
 * Unit Tests for Environment Variable Validator
 *
 * Tests the security validation of environment variables.
 */

import { SecurityLevel, ENV_VAR_DEFINITIONS, EnvValidator } from '../../../lib/security/env-validator';

describe('Environment Variable Validator', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    // Reset the singleton instance
    (EnvValidator as any).instance = null;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('SecurityLevel enum', () => {
    it('should have all expected security levels', () => {
      expect(SecurityLevel.PUBLIC).toBe('PUBLIC');
      expect(SecurityLevel.INTERNAL).toBe('INTERNAL');
      expect(SecurityLevel.SECRET).toBe('SECRET');
      expect(SecurityLevel.CRITICAL).toBe('CRITICAL');
    });
  });

  describe('ENV_VAR_DEFINITIONS', () => {
    it('should define DATABASE_URL as CRITICAL and required', () => {
      const dbUrl = ENV_VAR_DEFINITIONS.find(d => d.key === 'DATABASE_URL');

      expect(dbUrl).toBeDefined();
      expect(dbUrl?.required).toBe(true);
      expect(dbUrl?.securityLevel).toBe(SecurityLevel.CRITICAL);
    });

    it('should define JWT_SECRET as CRITICAL and required', () => {
      const jwtSecret = ENV_VAR_DEFINITIONS.find(d => d.key === 'JWT_SECRET');

      expect(jwtSecret).toBeDefined();
      expect(jwtSecret?.required).toBe(true);
      expect(jwtSecret?.securityLevel).toBe(SecurityLevel.CRITICAL);
    });

    it('should define NEXT_PUBLIC_SUPABASE_URL as PUBLIC', () => {
      const supabaseUrl = ENV_VAR_DEFINITIONS.find(d => d.key === 'NEXT_PUBLIC_SUPABASE_URL');

      expect(supabaseUrl).toBeDefined();
      expect(supabaseUrl?.securityLevel).toBe(SecurityLevel.PUBLIC);
    });

    it('should define OPENROUTER_API_KEY as SECRET', () => {
      const openrouterKey = ENV_VAR_DEFINITIONS.find(d => d.key === 'OPENROUTER_API_KEY');

      expect(openrouterKey).toBeDefined();
      expect(openrouterKey?.securityLevel).toBe(SecurityLevel.SECRET);
    });

    it('should have example values for all definitions', () => {
      ENV_VAR_DEFINITIONS.forEach(def => {
        expect(def.example).toBeDefined();
        expect(def.example.length).toBeGreaterThan(0);
      });
    });

    it('should have descriptions for all definitions', () => {
      ENV_VAR_DEFINITIONS.forEach(def => {
        expect(def.description).toBeDefined();
        expect(def.description.length).toBeGreaterThan(0);
      });
    });

    it('should define social platform OAuth variables', () => {
      const twitterClientId = ENV_VAR_DEFINITIONS.find(d => d.key === 'TWITTER_CLIENT_ID');
      const facebookClientId = ENV_VAR_DEFINITIONS.find(d => d.key === 'FACEBOOK_CLIENT_ID');
      const linkedinClientId = ENV_VAR_DEFINITIONS.find(d => d.key === 'LINKEDIN_CLIENT_ID');
      const tiktokClientKey = ENV_VAR_DEFINITIONS.find(d => d.key === 'TIKTOK_CLIENT_KEY');

      expect(twitterClientId).toBeDefined();
      expect(facebookClientId).toBeDefined();
      expect(linkedinClientId).toBeDefined();
      expect(tiktokClientKey).toBeDefined();
    });

    it('should define Stripe price ID variables', () => {
      const professionalPriceId = ENV_VAR_DEFINITIONS.find(d => d.key === 'STRIPE_PROFESSIONAL_PRICE_ID');
      const businessPriceId = ENV_VAR_DEFINITIONS.find(d => d.key === 'STRIPE_BUSINESS_PRICE_ID');
      const customPriceId = ENV_VAR_DEFINITIONS.find(d => d.key === 'STRIPE_CUSTOM_PRICE_ID');

      expect(professionalPriceId).toBeDefined();
      expect(businessPriceId).toBeDefined();
      expect(customPriceId).toBeDefined();
    });
  });

  describe('EnvValidator', () => {
    describe('getInstance', () => {
      it('should return singleton instance', () => {
        const instance1 = EnvValidator.getInstance();
        const instance2 = EnvValidator.getInstance();

        expect(instance1).toBe(instance2);
      });
    });

    describe('validate', () => {
      it('should return valid: false when required vars are missing', () => {
        process.env = {};

        const validator = EnvValidator.getInstance();
        const result = validator.validate(false);

        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.summary.missingRequired.length).toBeGreaterThan(0);
      });

      it('should include DATABASE_URL in missing required when not set', () => {
        process.env = {};

        const validator = EnvValidator.getInstance();
        const result = validator.validate(false);

        expect(result.summary.missingRequired).toContain('DATABASE_URL');
      });

      it('should include JWT_SECRET in missing required when not set', () => {
        process.env = {};

        const validator = EnvValidator.getInstance();
        const result = validator.validate(false);

        expect(result.summary.missingRequired).toContain('JWT_SECRET');
      });

      it('should cache validation result', () => {
        process.env = {};

        const validator = EnvValidator.getInstance();
        const result1 = validator.validate(false);
        const result2 = validator.validate(false);

        expect(result1).toBe(result2);
      });

      it('should throw when throwOnError is true and validation fails', () => {
        process.env = {};
        jest.resetModules();
        (EnvValidator as any).instance = null;

        const validator = EnvValidator.getInstance();

        expect(() => validator.validate(true)).toThrow('Environment validation failed');
      });
    });

    describe('safeLog', () => {
      it('should mask SECRET level values', () => {
        process.env = {
          ...originalEnv,
          OPENROUTER_API_KEY: 'sk-or-v1-abcdefghijklmnopqrstuvwxyz',
        };
        jest.resetModules();
        (EnvValidator as any).instance = null;

        const validator = EnvValidator.getInstance();
        const masked = validator.safeLog('OPENROUTER_API_KEY');

        expect(masked).not.toBe('sk-or-v1-abcdefghijklmnopqrstuvwxyz');
        expect(masked).toContain('***');
        expect(masked.length).toBeLessThan('sk-or-v1-abcdefghijklmnopqrstuvwxyz'.length);
      });

      it('should not mask PUBLIC level values', () => {
        process.env = {
          ...originalEnv,
          NEXT_PUBLIC_APP_URL: 'https://example.com',
        };
        jest.resetModules();
        (EnvValidator as any).instance = null;

        const validator = EnvValidator.getInstance();
        const value = validator.safeLog('NEXT_PUBLIC_APP_URL');

        expect(value).toBe('https://example.com');
      });

      it('should return NOT_SET for undefined vars', () => {
        process.env = {};
        jest.resetModules();
        (EnvValidator as any).instance = null;

        const validator = EnvValidator.getInstance();
        const value = validator.safeLog('DATABASE_URL');

        expect(value).toBe('NOT_SET');
      });

      it('should return UNDEFINED for unknown vars', () => {
        const validator = EnvValidator.getInstance();
        const value = validator.safeLog('UNKNOWN_VAR');

        expect(value).toBe('UNDEFINED');
      });
    });

    describe('generateEnvExample', () => {
      it('should generate valid env example content', () => {
        const validator = EnvValidator.getInstance();
        const content = validator.generateEnvExample();

        expect(content).toContain('DATABASE_URL');
        expect(content).toContain('JWT_SECRET');
        expect(content).toContain('CRITICAL');
        expect(content).toContain('REQUIRED');
        expect(content).toContain('SECURITY WARNINGS');
      });

      it('should include security level for each variable', () => {
        const validator = EnvValidator.getInstance();
        const content = validator.generateEnvExample();

        expect(content).toContain('Security: CRITICAL');
        expect(content).toContain('Security: SECRET');
        expect(content).toContain('Security: PUBLIC');
      });
    });

    describe('get', () => {
      it('should return value for defined var', () => {
        process.env = {
          ...originalEnv,
          DATABASE_URL: 'postgresql://user:pass@host:5432/db',
        };
        jest.resetModules();
        (EnvValidator as any).instance = null;

        const validator = EnvValidator.getInstance();
        validator.validate(false);

        const value = validator.get('DATABASE_URL');
        expect(value).toBe('postgresql://user:pass@host:5432/db');
      });

      it('should throw for undefined env var name', () => {
        // Set minimal valid env to pass validation
        process.env = {
          DATABASE_URL: 'postgresql://user:pass@host:5432/db',
          JWT_SECRET: 'a-very-long-secret-that-is-at-least-32-chars-base64==',
          NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
          NEXT_PUBLIC_SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test-key-value',
          OPENROUTER_API_KEY: 'sk-or-v1-test-key-value',
        };
        jest.resetModules();
        (EnvValidator as any).instance = null;

        const validator = EnvValidator.getInstance();
        validator.validate(false);

        expect(() => validator.get('UNDEFINED_VAR_NAME')).toThrow('Undefined env var');
      });
    });
  });

  describe('Security Report', () => {
    it('should detect weak secrets', () => {
      process.env = {
        ...originalEnv,
        DATABASE_URL: 'postgresql://user:pass@host:5432/db',
        JWT_SECRET: 'short', // Too short
        NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test',
        OPENROUTER_API_KEY: 'sk-or-v1-test',
      };
      jest.resetModules();
      (EnvValidator as any).instance = null;

      const validator = EnvValidator.getInstance();
      const result = validator.validate(false);

      expect(result.securityReport.weakSecrets.length).toBeGreaterThan(0);
    });

    it('should provide recommendations', () => {
      process.env = {};
      jest.resetModules();
      (EnvValidator as any).instance = null;

      const validator = EnvValidator.getInstance();
      const result = validator.validate(false);

      expect(result.securityReport.recommendations.length).toBeGreaterThan(0);
    });

    it('should track public exposure', () => {
      process.env = {
        ...originalEnv,
        NEXT_PUBLIC_APP_URL: 'https://example.com',
        NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test',
      };
      jest.resetModules();
      (EnvValidator as any).instance = null;

      const validator = EnvValidator.getInstance();
      const result = validator.validate(false);

      expect(result.securityReport.publicExposure).toContain('NEXT_PUBLIC_APP_URL');
      expect(result.securityReport.publicExposure).toContain('NEXT_PUBLIC_SUPABASE_URL');
    });
  });
});
