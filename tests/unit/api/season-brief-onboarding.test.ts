/**
 * Unit tests — SYN-548 Season Brief onboarding integration
 *
 * Tests the feature flag bypass and fallback rendering logic.
 * (Full React rendering tests are covered by Playwright e2e.)
 */

// ── SEASONAL_BRIEF_ENABLED — feature flag off skips the step ─────────────────

describe('SEASONAL_BRIEF_ENABLED feature flag', () => {
  const originalEnv = process.env.NEXT_PUBLIC_SEASONAL_BRIEF_ONBOARDING;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.NEXT_PUBLIC_SEASONAL_BRIEF_ONBOARDING;
    } else {
      process.env.NEXT_PUBLIC_SEASONAL_BRIEF_ONBOARDING = originalEnv;
    }
    jest.resetModules();
  });

  it('is enabled by default (env var not set)', async () => {
    delete process.env.NEXT_PUBLIC_SEASONAL_BRIEF_ONBOARDING;
    const { SEASONAL_BRIEF_ENABLED } =
      await import('@/lib/constants/onboarding');
    expect(SEASONAL_BRIEF_ENABLED).toBe(true);
  });

  it('is enabled when env var is "true"', async () => {
    process.env.NEXT_PUBLIC_SEASONAL_BRIEF_ONBOARDING = 'true';
    const { SEASONAL_BRIEF_ENABLED } =
      await import('@/lib/constants/onboarding');
    expect(SEASONAL_BRIEF_ENABLED).toBe(true);
  });

  it('is disabled when env var is "false"', async () => {
    process.env.NEXT_PUBLIC_SEASONAL_BRIEF_ONBOARDING = 'false';
    const { SEASONAL_BRIEF_ENABLED } =
      await import('@/lib/constants/onboarding');
    expect(SEASONAL_BRIEF_ENABLED).toBe(false);
  });
});

// ── Industry slug mapping ─────────────────────────────────────────────────────

describe('ONBOARDING_INDUSTRY_TO_SLUG mapping', () => {
  it('maps trades → plumbing-hvac', async () => {
    const { ONBOARDING_INDUSTRY_TO_SLUG } =
      await import('@/lib/constants/onboarding');
    expect(ONBOARDING_INDUSTRY_TO_SLUG['trades']).toBe('plumbing-hvac');
  });

  it('maps hospitality → cafe-coffee', async () => {
    const { ONBOARDING_INDUSTRY_TO_SLUG } =
      await import('@/lib/constants/onboarding');
    expect(ONBOARDING_INDUSTRY_TO_SLUG['hospitality']).toBe('cafe-coffee');
  });

  it('maps health-wellness → allied-health', async () => {
    const { ONBOARDING_INDUSTRY_TO_SLUG } =
      await import('@/lib/constants/onboarding');
    expect(ONBOARDING_INDUSTRY_TO_SLUG['health-wellness']).toBe(
      'allied-health'
    );
  });

  it('maps retail → retail-general', async () => {
    const { ONBOARDING_INDUSTRY_TO_SLUG } =
      await import('@/lib/constants/onboarding');
    expect(ONBOARDING_INDUSTRY_TO_SLUG['retail']).toBe('retail-general');
  });

  it('maps unknown industry → undefined (caller falls back to "general")', async () => {
    const { ONBOARDING_INDUSTRY_TO_SLUG } =
      await import('@/lib/constants/onboarding');
    expect(ONBOARDING_INDUSTRY_TO_SLUG['unknown-industry']).toBeUndefined();
  });

  it('maps "other" → general', async () => {
    const { ONBOARDING_INDUSTRY_TO_SLUG } =
      await import('@/lib/constants/onboarding');
    expect(ONBOARDING_INDUSTRY_TO_SLUG['other']).toBe('general');
  });
});

// ── Analytics event type coverage ────────────────────────────────────────────

describe('onboarding_season_brief_shown analytics event', () => {
  it('is included in OnboardingEventName union', async () => {
    // Type-level check — if this compiles, the event type is registered
    const { fireEvent } = await import('@/lib/analytics/onboarding-events');
    expect(typeof fireEvent).toBe('function');

    // Runtime: fires without error (window.gtag is undefined in jsdom — falls back to dataLayer)
    expect(() => {
      fireEvent('onboarding_season_brief_shown', {
        industry_slug: 'plumbing-hvac',
        signal_count: 4,
      });
    }).not.toThrow();
  });

  it('fires with signal_count 0 for the fallback (no signals) path', () => {
    const { fireEvent } = require('@/lib/analytics/onboarding-events');
    expect(() => {
      fireEvent('onboarding_season_brief_shown', {
        industry_slug: 'general',
        signal_count: 0,
      });
    }).not.toThrow();
  });
});
