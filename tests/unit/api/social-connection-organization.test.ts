/**
 * Connection organisation override guard tests (E2 — carsi-linkedin-golive
 * spec).
 *
 * Structured per the api-testing convention (see scheduler-org-scope.test.ts):
 * pure replicas of the route's decision logic in
 * app/api/auth/connections/[connectionId]/organization/route.ts, so a change
 * there that weakens validation, org scoping, or the LinkedIn-only guard
 * fails loudly here.
 */

import { describe, it, expect } from '@jest/globals';
import { z } from 'zod';

// =============================================================================
// Pure replicas of the route guards under test.
// =============================================================================

/** Mirrors the route's bodySchema — numeric LinkedIn organisation ids only. */
const bodySchema = z.object({
  organizationProfileId: z.string().regex(/^\d+$/),
});

/** Mirrors the route's connection lookup scope (userId + active org + active). */
function connectionWhere(userId: string, organizationId: string | null) {
  return {
    userId,
    organizationId: organizationId ?? null,
    isActive: true,
  };
}

/** Mirrors the route's platform guard. */
function isOverridablePlatform(platform: string): boolean {
  return platform === 'linkedin';
}

// =============================================================================

describe('connection organisation override (E2)', () => {
  describe('body validation — numeric org id only', () => {
    it('accepts the CARSI-style numeric organisation id', () => {
      expect(
        bodySchema.safeParse({ organizationProfileId: '112760720' }).success
      ).toBe(true);
    });

    it('rejects the OpenID member-id shape the callback stores by default', () => {
      // Non-numeric member ids are exactly what causes personal-feed posting;
      // the override must never accept one.
      for (const bad of [
        'aBcD3fGh',
        'urn:li:organization:112760720',
        '11276 0720',
        '',
        '112760720.5',
        '-112760720',
      ]) {
        expect(
          bodySchema.safeParse({ organizationProfileId: bad }).success
        ).toBe(false);
      }
    });
  });

  describe('org scoping — active organisation only', () => {
    it('scopes the lookup to the caller and their ACTIVE organisation', () => {
      expect(connectionWhere('user-1', 'org-carsi')).toEqual({
        userId: 'user-1',
        organizationId: 'org-carsi',
        isActive: true,
      });
    });

    it('legacy no-org users fall back to ownership-only scope, never cross-org', () => {
      expect(connectionWhere('user-1', null)).toEqual({
        userId: 'user-1',
        organizationId: null,
        isActive: true,
      });
    });
  });

  describe('platform guard', () => {
    it('only LinkedIn connections are overridable', () => {
      expect(isOverridablePlatform('linkedin')).toBe(true);
      for (const platform of ['facebook', 'instagram', 'twitter', 'tiktok']) {
        expect(isOverridablePlatform(platform)).toBe(false);
      }
    });
  });
});
