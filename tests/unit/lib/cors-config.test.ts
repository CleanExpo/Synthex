/**
 * Unit tests for lib/security/cors-config.ts
 *
 * Tests CorsValidator class logic and helper functions.
 * No external dependencies — all logic is pure class/function code.
 */

import {
  CorsValidator,
  DEFAULT_CORS_CONFIG,
  STRICT_CORS_CONFIG,
  PUBLIC_CORS_CONFIG,
  applyCorsHeaders,
  createPreflightResponse,
  type CorsConfig,
} from '@/lib/security/cors-config';

// ── Custom config used across tests ─────────────────────────────────────────
const CUSTOM_CONFIG: CorsConfig = {
  allowedOrigins: ['https://allowed.example.com', 'https://other.example.com'],
  allowedMethods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['X-RateLimit-Limit'],
  credentials: true,
  maxAge: 3600,
  allowNoOrigin: false,
};

// ── CorsValidator.validate ───────────────────────────────────────────────────
describe('CorsValidator.validate', () => {
  let validator: CorsValidator;

  beforeEach(() => {
    validator = new CorsValidator(CUSTOM_CONFIG);
  });

  it('returns allowed=true for a whitelisted origin', () => {
    const result = validator.validate('https://allowed.example.com', 'GET');
    expect(result.allowed).toBe(true);
    expect(result.headers['Access-Control-Allow-Origin']).toBe(
      'https://allowed.example.com'
    );
  });

  it('returns allowed=false for an unknown origin', () => {
    const result = validator.validate('https://evil.com', 'GET');
    expect(result.allowed).toBe(false);
    expect(result.headers).toEqual({});
  });

  it('returns allowed=false when method is not in allowedMethods', () => {
    const result = validator.validate('https://allowed.example.com', 'DELETE');
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/DELETE/i);
  });

  it('returns allowed=false when origin is null and allowNoOrigin is false', () => {
    const result = validator.validate(null, 'GET');
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/Origin header required/i);
  });

  it('returns allowed=true with * header when origin is null and allowNoOrigin is true', () => {
    const publicValidator = new CorsValidator(PUBLIC_CORS_CONFIG);
    const result = publicValidator.validate(null, 'GET');
    expect(result.allowed).toBe(true);
    expect(result.headers['Access-Control-Allow-Origin']).toBe('*');
  });

  it('sets Access-Control-Allow-Credentials to true for credentialled config', () => {
    const result = validator.validate('https://allowed.example.com', 'GET');
    expect(result.allowed).toBe(true);
    expect(result.headers['Access-Control-Allow-Credentials']).toBe('true');
  });

  it('does NOT set credentials header for public (no-credentials) config', () => {
    const publicValidator = new CorsValidator(PUBLIC_CORS_CONFIG);
    const result = publicValidator.validate('https://any.com', 'GET');
    expect(result.allowed).toBe(true);
    expect(result.headers['Access-Control-Allow-Credentials']).toBeUndefined();
  });

  it('returns allowed=true for wildcard config regardless of origin', () => {
    const publicValidator = new CorsValidator(PUBLIC_CORS_CONFIG);
    const result = publicValidator.validate('https://random-domain.io', 'GET');
    expect(result.allowed).toBe(true);
  });

  it('includes Vary: Origin header', () => {
    const result = validator.validate('https://allowed.example.com', 'GET');
    expect(result.headers['Vary']).toBe('Origin');
  });

  it('is case-insensitive for HTTP method', () => {
    const result = validator.validate('https://allowed.example.com', 'get');
    expect(result.allowed).toBe(true);
  });

  it('strips trailing slash from origin before matching', () => {
    const result = validator.validate('https://allowed.example.com/', 'GET');
    expect(result.allowed).toBe(true);
  });
});

// ── Wildcard subdomain matching ──────────────────────────────────────────────
describe('CorsValidator wildcard subdomain matching', () => {
  it('allows subdomains when wildcard is configured', () => {
    const config: CorsConfig = {
      ...CUSTOM_CONFIG,
      allowedOrigins: ['*.synthex.social'],
    };
    const validator = new CorsValidator(config);

    expect(
      validator.validate('https://app.synthex.social', 'GET').allowed
    ).toBe(true);
    expect(
      validator.validate('https://dashboard.synthex.social', 'GET').allowed
    ).toBe(true);
  });

  it('does NOT allow unrelated domain with wildcard config', () => {
    const config: CorsConfig = {
      ...CUSTOM_CONFIG,
      allowedOrigins: ['*.synthex.social'],
    };
    const validator = new CorsValidator(config);

    expect(validator.validate('https://evil.com', 'GET').allowed).toBe(false);
  });
});

// ── CorsValidator.handlePreflight ────────────────────────────────────────────
describe('CorsValidator.handlePreflight', () => {
  let validator: CorsValidator;

  beforeEach(() => {
    validator = new CorsValidator(CUSTOM_CONFIG);
  });

  it('returns allowed=true for a valid preflight', () => {
    const result = validator.handlePreflight(
      'https://allowed.example.com',
      'POST',
      'Content-Type, Authorization'
    );
    expect(result.allowed).toBe(true);
    expect(result.headers['Access-Control-Max-Age']).toBe('3600');
  });

  it('returns allowed=false when origin is not whitelisted', () => {
    const result = validator.handlePreflight('https://evil.com', 'POST', null);
    expect(result.allowed).toBe(false);
  });

  it('returns allowed=false when requested method is not allowed', () => {
    const result = validator.handlePreflight(
      'https://allowed.example.com',
      'DELETE',
      null
    );
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/DELETE/i);
  });

  it('returns allowed=false when requested headers are not allowed', () => {
    const result = validator.handlePreflight(
      'https://allowed.example.com',
      'POST',
      'X-Custom-Header'
    );
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/x-custom-header/i);
  });

  it('passes when requestHeaders is null', () => {
    const result = validator.handlePreflight(
      'https://allowed.example.com',
      'POST',
      null
    );
    expect(result.allowed).toBe(true);
  });

  it('passes when requestMethod is null', () => {
    const result = validator.handlePreflight(
      'https://allowed.example.com',
      null,
      'Content-Type'
    );
    expect(result.allowed).toBe(true);
  });

  it('includes Access-Control-Max-Age in preflight response headers', () => {
    const result = validator.handlePreflight(
      'https://allowed.example.com',
      'GET',
      null
    );
    expect(result.headers['Access-Control-Max-Age']).toBeDefined();
  });
});

// ── createPreflightResponse ──────────────────────────────────────────────────
describe('createPreflightResponse', () => {
  it('returns 204 for a valid preflight', () => {
    const res = createPreflightResponse(
      'https://allowed.example.com',
      'POST',
      'Content-Type',
      CUSTOM_CONFIG
    );
    expect(res.status).toBe(204);
  });

  it('returns 403 for a blocked origin', () => {
    const res = createPreflightResponse(
      'https://evil.com',
      'POST',
      null,
      CUSTOM_CONFIG
    );
    expect(res.status).toBe(403);
  });
});

// ── applyCorsHeaders ─────────────────────────────────────────────────────────
describe('applyCorsHeaders', () => {
  it('sets Access-Control-Allow-Origin on allowed origin', () => {
    const response = new Response('ok', { status: 200 });
    const updated = applyCorsHeaders(
      response,
      'https://allowed.example.com',
      CUSTOM_CONFIG
    );
    expect(updated.headers.get('Access-Control-Allow-Origin')).toBe(
      'https://allowed.example.com'
    );
  });

  it('does not set CORS headers for blocked origin', () => {
    const response = new Response('ok', { status: 200 });
    const updated = applyCorsHeaders(
      response,
      'https://evil.com',
      CUSTOM_CONFIG
    );
    // In jsdom the header may return null or undefined for absent headers
    expect(
      updated.headers.get('Access-Control-Allow-Origin') ?? null
    ).toBeNull();
  });
});

// ── Exported config objects ──────────────────────────────────────────────────
describe('exported CORS config constants', () => {
  it('DEFAULT_CORS_CONFIG has credentials=true', () => {
    expect(DEFAULT_CORS_CONFIG.credentials).toBe(true);
  });

  it('STRICT_CORS_CONFIG allows only GET, POST, OPTIONS', () => {
    expect(STRICT_CORS_CONFIG.allowedMethods).toEqual([
      'GET',
      'POST',
      'OPTIONS',
    ]);
  });

  it('PUBLIC_CORS_CONFIG has allowedOrigins=*', () => {
    expect(PUBLIC_CORS_CONFIG.allowedOrigins).toBe('*');
  });

  it('PUBLIC_CORS_CONFIG has credentials=false', () => {
    expect(PUBLIC_CORS_CONFIG.credentials).toBe(false);
  });

  it('DEFAULT_CORS_CONFIG includes synthex.social', () => {
    expect(DEFAULT_CORS_CONFIG.allowedOrigins).toContain(
      'https://synthex.social'
    );
  });
});
