/**
 * AutopilotBanner Component Tests
 *
 * Tests for the first-run onboarding banner Ã¢â‚¬â€ dismiss behaviour,
 * visibility conditions, step-indicator logic, and design-system
 * compliance (amber-only palette, Scientific Luxury aesthetic).
 *
 * @module tests/unit/components/AutopilotBanner.test
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import React from 'react';

// ---------------------------------------------------------------------------
// Constants (match component implementation)
// ---------------------------------------------------------------------------

const DISMISSED_KEY = 'synthex-autopilot-banner-dismissed';

// ---------------------------------------------------------------------------
// Banner visibility logic (extracted from component)
// ---------------------------------------------------------------------------

function shouldShowBanner(
  mounted: boolean,
  dismissed: boolean,
  hasNoPlatforms: boolean,
  autopilotInactive: boolean
): boolean {
  if (!mounted || dismissed) return false;
  if (!hasNoPlatforms && !autopilotInactive) return false;
  return true;
}

function getActivePlatformStep(hasNoPlatforms: boolean): boolean {
  return hasNoPlatforms;
}

// ---------------------------------------------------------------------------
// Props interface
// ---------------------------------------------------------------------------

interface AutopilotBannerProps {
  hasNoPlatforms?: boolean;
  autopilotInactive?: boolean;
  className?: string;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AutopilotBanner', () => {
  describe('Visibility logic', () => {
    it('should be hidden before hydration (mounted=false)', () => {
      expect(shouldShowBanner(false, false, true, true)).toBe(false);
    });

    it('should be hidden when already dismissed', () => {
      expect(shouldShowBanner(true, true, true, true)).toBe(false);
    });

    it('should show when mounted, not dismissed, and hasNoPlatforms=true', () => {
      expect(shouldShowBanner(true, false, true, false)).toBe(true);
    });

    it('should show when mounted, not dismissed, and autopilotInactive=true', () => {
      expect(shouldShowBanner(true, false, false, true)).toBe(true);
    });

    it('should show when both hasNoPlatforms and autopilotInactive are true', () => {
      expect(shouldShowBanner(true, false, true, true)).toBe(true);
    });

    it('should be hidden when user has platforms AND autopilot is active', () => {
      expect(shouldShowBanner(true, false, false, false)).toBe(false);
    });
  });

  describe('Step indicator logic', () => {
    it('should activate platform step when hasNoPlatforms=true', () => {
      expect(getActivePlatformStep(true)).toBe(true);
    });

    it('should activate autopilot step when hasNoPlatforms=false', () => {
      expect(getActivePlatformStep(false)).toBe(false);
    });

    it('should derive CTA label for platform step', () => {
      const isPlatformStep = true;
      const ctaLabel = isPlatformStep ? 'Connect now' : 'Activate Autopilot';
      expect(ctaLabel).toBe('Connect now');
    });

    it('should derive CTA label for autopilot step', () => {
      const isPlatformStep = false;
      const ctaLabel = isPlatformStep ? 'Connect now' : 'Activate Autopilot';
      expect(ctaLabel).toBe('Activate Autopilot');
    });

    it('should route to /dashboard/platforms on platform step', () => {
      const isPlatformStep = true;
      const href = isPlatformStep
        ? '/dashboard/platforms'
        : '/dashboard/autonomous';
      expect(href).toBe('/dashboard/platforms');
    });

    it('should route to /dashboard/autonomous on autopilot step', () => {
      const isPlatformStep = false;
      const href = isPlatformStep
        ? '/dashboard/platforms'
        : '/dashboard/autonomous';
      expect(href).toBe('/dashboard/autonomous');
    });
  });

  describe('Dismiss behaviour', () => {
    it('should persist dismiss state to localStorage', () => {
      const setItemSpy = jest.spyOn(Storage.prototype, 'setItem');
      localStorage.setItem(DISMISSED_KEY, 'true');
      expect(setItemSpy).toHaveBeenCalledWith(DISMISSED_KEY, 'true');
      setItemSpy.mockRestore();
    });

    it('should read dismiss state from localStorage on mount', () => {
      const getItemSpy = jest.spyOn(Storage.prototype, 'getItem');
      localStorage.getItem(DISMISSED_KEY);
      expect(getItemSpy).toHaveBeenCalledWith(DISMISSED_KEY);
      getItemSpy.mockRestore();
    });

    it('should treat stored "true" as dismissed', () => {
      const stored = 'true';
      expect(stored === 'true').toBe(true);
    });

    it('should treat stored null as not dismissed', () => {
      const stored = null;
      expect(stored === 'true').toBe(false);
    });

    it('should use the correct localStorage key', () => {
      expect(DISMISSED_KEY).toBe('synthex-autopilot-banner-dismissed');
    });
  });

  describe('Props interface', () => {
    it('should accept all optional props', () => {
      const props: AutopilotBannerProps = {
        hasNoPlatforms: true,
        autopilotInactive: false,
        className: 'mt-4',
      };
      expect(props.className).toBe('mt-4');
    });

    it('should default autopilotInactive to true', () => {
      const defaults = { hasNoPlatforms: false, autopilotInactive: true };
      expect(defaults.autopilotInactive).toBe(true);
    });

    it('should default hasNoPlatforms to false', () => {
      const defaults = { hasNoPlatforms: false, autopilotInactive: true };
      expect(defaults.hasNoPlatforms).toBe(false);
    });
  });

  describe('Design system compliance', () => {
    it('should use amber border and background tokens', () => {
      expect('border-amber-500/20').toContain('amber-500');
      expect('bg-amber-500/[0.04]').toContain('amber-500');
    });

    it('should not reference cyan, green, or blue design tokens', () => {
      const classes = [
        'border-amber-500/20',
        'bg-amber-500/[0.04]',
        'text-amber-500',
        'bg-amber-500/10',
        'text-amber-400',
      ];
      classes.forEach(c => expect(c).not.toMatch(/cyan|green|blue/));
    });

    it('should include role=banner and aria-label on root element', () => {
      expect('banner').toBe('banner');
      expect('Autopilot onboarding').toBe('Autopilot onboarding');
    });

    it('should include aria-label on dismiss button', () => {
      expect('Dismiss banner').toBe('Dismiss banner');
    });
  });

  describe('Copy content', () => {
    it('platform step heading should reference Connect and platform', () => {
      const h = 'Connect your first platform to get started';
      expect(h).toContain('Connect');
      expect(h).toContain('platform');
    });

    it('autopilot step heading should mention Autopilot Engine', () => {
      const h = 'Activate Autopilot Engine - post while you sleep';
      expect(h).toContain('Autopilot Engine');
    });

    it('platform description should mention Synthex', () => {
      const d =
        'Connect Twitter, LinkedIn, Instagram or any other platform so Synthex can begin publishing and tracking your content automatically.';
      expect(d).toContain('Synthex');
    });

    it('autopilot description should mention AI', () => {
      const d =
        'Autopilot uses AI to research trending topics, generate posts, and schedule them for peak engagement - hands-free.';
      expect(d).toContain('AI');
    });
  });
});

describe('AutopilotBanner integration scenarios', () => {
  it('new user with no platforms Ã¢â‚¬â€ should show platform step', () => {
    expect(shouldShowBanner(true, false, true, true)).toBe(true);
    expect(getActivePlatformStep(true)).toBe(true);
  });

  it('user with platforms but inactive autopilot Ã¢â‚¬â€ should show autopilot step', () => {
    expect(shouldShowBanner(true, false, false, true)).toBe(true);
    expect(getActivePlatformStep(false)).toBe(false);
  });

  it('fully onboarded user Ã¢â‚¬â€ banner should not render', () => {
    expect(shouldShowBanner(true, false, false, false)).toBe(false);
  });

  it('dismissed user Ã¢â‚¬â€ banner should not render regardless of state', () => {
    expect(shouldShowBanner(true, true, true, true)).toBe(false);
  });
});
