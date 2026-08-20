/**
 * Unit tests — Edge proxy decision logic — SYN-792
 *
 * Regression coverage for the P0 redirect loop where /auth/login wrapped
 * itself in ?redirect=/auth/login and produced 50+ redirects.
 *
 * Tests target the pure `decide()` function rather than the NextResponse
 * wrapper — Jest stubs global Request/Response in tests/jest.setup.js,
 * which breaks NextResponse.redirect() header population.
 *
 * Next.js 16 renamed middleware.ts → proxy.ts. The file under test is
 * `proxy.ts` at the project root.
 */

import { decide, decodeAuthTokenPayload } from '@/proxy';

describe('SYN-792 — middleware decision logic', () => {
  describe('auth pages (short-circuit — the redirect-loop fix)', () => {
    it.each([
      ['/login', ''],
      ['/login', '?redirect=%2Fdashboard'],
      ['/auth/login', ''],
      ['/auth/login', '?redirect=%2Fauth%2Flogin'],
      ['/auth/login', '?redirect=%2Fagencies'],
      ['/signup', ''],
      ['/auth/signup', ''],
      ['/auth/callback', '?code=xyz'],
      ['/forgot-password', ''],
      ['/reset-password', '?token=abc'],
    ])('%s%s passes through unauthenticated', (pathname, search) => {
      expect(decide(pathname, search, [])).toEqual({ action: 'pass' });
    });

    it('/auth/login NEVER wraps itself — the exact bug regression', () => {
      const d = decide('/auth/login', '?redirect=%2Fauth%2Flogin', []);
      expect(d.action).toBe('pass');
    });
  });

  describe('public marketing pages (no auth)', () => {
    it.each([
      '/',
      '/agencies',
      '/pricing',
      '/features/platforms',
      '/features/ai-content',
      '/compare/hootsuite',
      '/blog',
      '/blog/some-post-slug',
      '/about',
      '/waitlist',
      '/benchmark',
    ])('%s passes through unauthenticated', path => {
      expect(decide(path, '', [])).toEqual({ action: 'pass' });
    });
  });

  describe('protected routes — auth required', () => {
    it.each([
      '/dashboard',
      '/dashboard/calendar',
      '/dashboard/analytics/overview',
      '/onboarding',
      '/onboarding/step-2',
      '/admin',
      '/admin/users',
    ])('%s redirects unauthenticated users to /login', path => {
      const d = decide(path, '', []);
      expect(d.action).toBe('redirect');
      if (d.action !== 'redirect') return;
      expect(d.target).toContain('/login');
      // Must never target /login itself — that's the loop
      expect(d.target).not.toContain('redirect=%2Flogin');
      expect(d.target).not.toContain('redirect=/login');
      expect(d.target).toContain(encodeURIComponent(path));
    });

    it('preserves query string on the return path', () => {
      const d = decide('/dashboard', '?tab=analytics&from=email', []);
      expect(d.action).toBe('redirect');
      if (d.action !== 'redirect') return;
      expect(d.target).toContain('tab%3Danalytics');
    });

    it('passes through users with a Supabase session cookie', () => {
      expect(
        decide('/dashboard', '', ['sb-project-ref-auth-token']).action
      ).toBe('pass');
    });

    it('rejects users whose cookies have no sb- prefix', () => {
      const d = decide('/dashboard', '', ['ga_analytics', 'ph_session']);
      expect(d.action).toBe('redirect');
    });
  });

  describe('onboarding gate — incomplete users cannot use the app', () => {
    const session = ['auth-token'];

    it('redirects incomplete users from /dashboard to /onboarding', () => {
      const d = decide('/dashboard', '', session, {
        onboardingComplete: false,
      });
      expect(d).toEqual({ action: 'redirect', target: '/onboarding' });
    });

    it('redirects incomplete users from nested dashboard routes', () => {
      expect(
        decide('/dashboard/calendar', '', session, {
          onboardingComplete: false,
        })
      ).toEqual({ action: 'redirect', target: '/onboarding' });
    });

    it('redirects incomplete users from /admin to /onboarding', () => {
      const d = decide('/admin', '', session, { onboardingComplete: false });
      expect(d).toEqual({ action: 'redirect', target: '/onboarding' });
    });

    it('lets incomplete users stay on /onboarding', () => {
      expect(
        decide('/onboarding', '', session, { onboardingComplete: false }).action
      ).toBe('pass');
      expect(
        decide('/onboarding/connect', '', session, {
          onboardingComplete: false,
        }).action
      ).toBe('pass');
    });

    it('lets completed users into /dashboard', () => {
      expect(
        decide('/dashboard', '', session, { onboardingComplete: true }).action
      ).toBe('pass');
    });

    it('lets superadmins through even when onboarding is incomplete', () => {
      expect(
        decide('/dashboard', '', session, {
          onboardingComplete: false,
          role: 'superadmin',
        }).action
      ).toBe('pass');
    });

    it('does not treat a missing onboarding claim as incomplete (legacy JWTs)', () => {
      expect(decide('/dashboard', '', session).action).toBe('pass');
    });
  });

  describe('decodeAuthTokenPayload', () => {
    function fakeJwt(payload: Record<string, unknown>): string {
      const header = Buffer.from(JSON.stringify({ alg: 'none' })).toString(
        'base64url'
      );
      const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
      return `${header}.${body}.sig`;
    }

    it('reads onboardingComplete from a JWT payload', () => {
      const token = fakeJwt({ onboardingComplete: false, role: 'member' });
      expect(decodeAuthTokenPayload(token)).toEqual({
        onboardingComplete: false,
        role: 'member',
      });
    });

    it('returns undefined for malformed tokens', () => {
      expect(decodeAuthTokenPayload('not-a-jwt')).toBeUndefined();
      expect(decodeAuthTokenPayload(undefined)).toBeUndefined();
    });
  });

  describe('SYN-779 — /benchmark public landing page', () => {
    it('/benchmark passes through unauthenticated', () => {
      expect(decide('/benchmark', '', [])).toEqual({ action: 'pass' });
    });

    it('/benchmark passes with UTM query string', () => {
      expect(
        decide('/benchmark', '?utm_source=benchmark_page&utm_medium=web', [])
      ).toEqual({ action: 'pass' });
    });
  });

  describe('API routes short-circuit (they do their own auth)', () => {
    it.each([
      '/api/health',
      '/api/ask-synthex',
      '/api/auth/callback',
      '/api/webhooks/stripe',
    ])('%s passes through', path => {
      expect(decide(path, '', []).action).toBe('pass');
    });
  });

  describe('Next.js framework paths', () => {
    it.each(['/_next/static/chunk.js', '/_next/image?url=/logo.png'])(
      '%s short-circuits',
      path => {
        expect(decide(path, '', []).action).toBe('pass');
      }
    );
  });
});
