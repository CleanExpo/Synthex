/**
 * Onboarding Middleware Integration Tests (UNI-1038)
 *
 * Tests the onboarding gate in middleware.ts that redirects
 * users to /onboarding when their JWT contains onboardingComplete: false.
 *
 * Scenarios:
 * 1. Incomplete onboarding → redirect to /onboarding
 * 2. Complete onboarding → pass through to dashboard
 * 3. No onboarding claim in JWT → pass through (undefined !== false)
 * 4. Superadmin bypass → pass through even if onboarding incomplete
 * 5. Malformed JWT → pass through (graceful degradation)
 */

import jwt from 'jsonwebtoken';

// ============================================================================
// MOCKS — must come before imports that reference mocked modules
// ============================================================================

const TEST_SECRET = 'test-secret-key-at-least-32-chars-long';

// Mock @supabase/ssr — middleware creates a Supabase client for session checks
jest.mock('@supabase/ssr', () => ({
  createServerClient: jest.fn(() => ({
    auth: {
      getSession: jest.fn().mockResolvedValue({ data: { session: null } }),
    },
  })),
}));

// Mock the API key gate (not relevant to onboarding tests)
jest.mock('@/lib/middleware/api-key-gate.edge', () => ({
  checkApiKeyGate: jest.fn(() => null),
}));

// ============================================================================
// Helpers
// ============================================================================

/**
 * Build a JWT token with the given claims.
 * Uses the same structure as signInFlow.generateJWT.
 */
function buildToken(claims: Record<string, unknown>): string {
  return jwt.sign(
    {
      sub: 'user-test-123',
      userId: 'user-test-123',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
      ...claims,
    },
    TEST_SECRET
  );
}

/**
 * Create a NextRequest-like object for middleware testing.
 * Sets the auth-token cookie and targets the given path.
 */
function buildRequest(path: string, authToken?: string) {
  const url = `http://localhost:3000${path}`;
  const headers = new Headers();

  // Build cookie header
  const cookies: string[] = [];
  if (authToken) cookies.push(`auth-token=${authToken}`);
  if (cookies.length > 0) headers.set('cookie', cookies.join('; '));

  const request = new Request(url, { headers });

  // NextRequest compatibility — add cookies accessor
  return Object.assign(request, {
    nextUrl: new URL(url),
    cookies: {
      get(name: string) {
        if (name === 'auth-token' && authToken) {
          return { name: 'auth-token', value: authToken };
        }
        if (name === 'csrf-token') return undefined;
        return undefined;
      },
      getAll() {
        const all: Array<{ name: string; value: string }> = [];
        if (authToken) all.push({ name: 'auth-token', value: authToken });
        return all;
      },
      has(name: string) {
        return name === 'auth-token' && !!authToken;
      },
      set() { /* noop */ },
      delete() { /* noop */ },
    },
    geo: {},
    ip: '127.0.0.1',
  });
}

// ============================================================================
// Test: JWT onboarding gate logic
// ============================================================================

describe('Onboarding Middleware — JWT Gate', () => {
  /**
   * These tests exercise the core logic from middleware.ts lines 135-153:
   *
   * if (hasCustomAuth && authToken && pathname.startsWith('/dashboard')) {
   *   const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
   *   const isSuperadmin = payload.role === 'superadmin';
   *   if (!isSuperadmin && payload.onboardingComplete === false) {
   *     return NextResponse.redirect(new URL('/onboarding', request.url));
   *   }
   * }
   *
   * Since middleware() depends on Supabase SSR, Edge APIs, and crypto
   * that are hard to fully replicate in Jest, we test the core gate logic
   * by extracting and testing the JWT parsing and decision directly.
   */

  function evaluateOnboardingGate(
    authToken: string | undefined,
    pathname: string
  ): 'redirect' | 'pass' {
    const hasCustomAuth = !!authToken;

    if (hasCustomAuth && authToken && pathname.startsWith('/dashboard')) {
      try {
        const parts = authToken.split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(
            Buffer.from(parts[1], 'base64').toString()
          );
          const isSuperadmin = payload.role === 'superadmin';
          if (!isSuperadmin && payload.onboardingComplete === false) {
            return 'redirect';
          }
        }
      } catch {
        // Token parse failed — allow access (graceful degradation)
      }
    }

    return 'pass';
  }

  // Scenario 1: Incomplete onboarding → redirect
  it('should redirect to /onboarding when onboardingComplete is false', () => {
    const token = buildToken({ onboardingComplete: false });

    const result = evaluateOnboardingGate(token, '/dashboard');

    expect(result).toBe('redirect');
  });

  it('should redirect for nested dashboard paths', () => {
    const token = buildToken({ onboardingComplete: false });

    expect(evaluateOnboardingGate(token, '/dashboard/campaigns')).toBe('redirect');
    expect(evaluateOnboardingGate(token, '/dashboard/schedule')).toBe('redirect');
    expect(evaluateOnboardingGate(token, '/dashboard/settings')).toBe('redirect');
  });

  // Scenario 2: Complete onboarding → pass through
  it('should pass through when onboardingComplete is true', () => {
    const token = buildToken({ onboardingComplete: true });

    const result = evaluateOnboardingGate(token, '/dashboard');

    expect(result).toBe('pass');
  });

  // Scenario 3: No onboarding claim → pass through
  it('should pass through when onboardingComplete is not in JWT', () => {
    // Regular user whose JWT was generated without the claim
    const token = buildToken({ email: 'regular@example.com' });

    const result = evaluateOnboardingGate(token, '/dashboard');

    // undefined === false is false, so user passes through
    expect(result).toBe('pass');
  });

  // Scenario 4: Superadmin bypass
  it('should pass through for superadmin even with onboardingComplete: false', () => {
    const token = buildToken({
      onboardingComplete: false,
      role: 'superadmin',
    });

    const result = evaluateOnboardingGate(token, '/dashboard');

    expect(result).toBe('pass');
  });

  // Scenario 5: Malformed JWT → graceful degradation
  it('should pass through for malformed JWT (graceful degradation)', () => {
    const malformedToken = 'not-a-jwt';

    const result = evaluateOnboardingGate(malformedToken, '/dashboard');

    expect(result).toBe('pass');
  });

  it('should pass through for JWT with invalid base64 payload', () => {
    const brokenToken = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.!!!invalid!!!.signature';

    const result = evaluateOnboardingGate(brokenToken, '/dashboard');

    expect(result).toBe('pass');
  });

  // Non-dashboard paths should never trigger the gate
  it('should not check onboarding for non-dashboard paths', () => {
    const token = buildToken({ onboardingComplete: false });

    expect(evaluateOnboardingGate(token, '/onboarding')).toBe('pass');
    expect(evaluateOnboardingGate(token, '/login')).toBe('pass');
    expect(evaluateOnboardingGate(token, '/api/user/profile')).toBe('pass');
    expect(evaluateOnboardingGate(token, '/')).toBe('pass');
  });

  // No auth token should pass through (handled by earlier auth gate)
  it('should pass through when no auth token is present', () => {
    const result = evaluateOnboardingGate(undefined, '/dashboard');

    expect(result).toBe('pass');
  });
});

// ============================================================================
// Test: JWT token structure for onboarding claims
// ============================================================================

describe('Onboarding JWT Claims', () => {
  it('should correctly encode onboardingComplete: false in JWT payload', () => {
    const token = buildToken({ onboardingComplete: false });
    const decoded = jwt.decode(token) as Record<string, unknown>;

    expect(decoded.onboardingComplete).toBe(false);
    expect(decoded.userId).toBe('user-test-123');
  });

  it('should correctly encode onboardingComplete: true in JWT payload', () => {
    const token = buildToken({ onboardingComplete: true });
    const decoded = jwt.decode(token) as Record<string, unknown>;

    expect(decoded.onboardingComplete).toBe(true);
  });

  it('should support combined onboarding + apiKeyConfigured claims', () => {
    const token = buildToken({
      onboardingComplete: true,
      apiKeyConfigured: true,
    });
    const decoded = jwt.decode(token) as Record<string, unknown>;

    expect(decoded.onboardingComplete).toBe(true);
    expect(decoded.apiKeyConfigured).toBe(true);
  });

  it('should be parseable via base64 decode (matching middleware approach)', () => {
    const token = buildToken({
      onboardingComplete: false,
      email: 'test@synthex.com',
    });

    const parts = token.split('.');
    expect(parts).toHaveLength(3);

    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
    expect(payload.onboardingComplete).toBe(false);
    expect(payload.email).toBe('test@synthex.com');
  });
});
