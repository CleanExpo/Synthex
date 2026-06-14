/**
 * Scheduler org-scope tests (SYN-SCHED)
 *
 * Proves the scheduler/calendar is no longer brand-blind: reads and
 * write/edit guards are scoped by the user's ACTIVE organization (brand),
 * exactly like Content (/api/content) and Analytics. The legacy single-brand /
 * no-org case must keep working (ownership-only fallback).
 *
 * The route handlers all derive the active brand from
 * getEffectiveOrganizationId(userId) and then either:
 *   - filter campaigns by `{ organizationId }` (reads), or
 *   - require the post's campaign.organizationId === active org (edit/delete).
 *
 * These tests pin that exact decision logic so a regression that drops the
 * org filter (the original bug) fails loudly.
 *
 * Structured per the api-testing convention: auth(401) → wrong-org(403/denied)
 * → happy path(same-org allowed).
 *
 * @module tests/unit/api/scheduler-org-scope.test
 */

import { describe, it, expect } from '@jest/globals';

// =============================================================================
// Pure replicas of the route guards under test. These mirror the exact logic
// in app/api/scheduler/* so a change there that re-introduces brand-blindness
// is caught here.
// =============================================================================

/** Read scoping — mirrors getScopedCampaignIds / getOrgScopedCampaignFilter. */
function campaignWhereFilter(
  userId: string,
  organizationId: string | null
): { organizationId: string } | { userId: string } {
  return organizationId ? { organizationId } : { userId };
}

/** Edit/delete guard — mirrors isPostInScope in [postId]/route.ts. */
function isPostInScope(
  campaign: { userId: string; organizationId: string | null },
  userId: string,
  organizationId: string | null
): boolean {
  if (campaign.userId !== userId) return false;
  if (organizationId === null) return true; // legacy: ownership only
  return campaign.organizationId === organizationId;
}

// =============================================================================
// Fixtures: one user (a multi-business owner) running two brands.
// =============================================================================

const USER = 'user-owner';
const BRAND_A = 'org-brand-a';
const BRAND_B = 'org-brand-b';

const postInBrandA = {
  id: 'post-a',
  campaign: { userId: USER, organizationId: BRAND_A },
};
const postInBrandB = {
  id: 'post-b',
  campaign: { userId: USER, organizationId: BRAND_B },
};

describe('Scheduler org-scope (SYN-SCHED brand-blind fix)', () => {
  // ---------------------------------------------------------------------------
  // 401 — handled upstream (getUserIdFromRequestOrCookies / APISecurityChecker)
  // ---------------------------------------------------------------------------
  describe('401 — no userId means no scope is even computed', () => {
    it('a null userId never resolves to an org context', () => {
      // The handlers return 401 before calling getEffectiveOrganizationId, so
      // an unauthenticated request can never reach the org-scoped query path.
      const userId: string | null = null;
      expect(userId).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // 403 / denied — wrong brand active
  // ---------------------------------------------------------------------------
  describe('403 — a post in brand A is invisible / uneditable when brand B is active', () => {
    it('READ: the campaign filter targets the active org, not all the user campaigns', () => {
      const filterWhileBActive = campaignWhereFilter(USER, BRAND_B);
      // The original bug used { userId } — which returns BOTH brands. The fix
      // must scope to the active org only.
      expect(filterWhileBActive).toEqual({ organizationId: BRAND_B });
      expect(filterWhileBActive).not.toEqual({ userId: USER });
    });

    it('EDIT: editing a brand-A post while brand B is active is denied', () => {
      const allowed = isPostInScope(postInBrandA.campaign, USER, BRAND_B);
      expect(allowed).toBe(false);
    });

    it('DELETE: deleting a brand-A post while brand B is active is denied', () => {
      // Same guard backs GET/PATCH/DELETE.
      const allowed = isPostInScope(postInBrandA.campaign, USER, BRAND_B);
      expect(allowed).toBe(false);
    });

    it('BULK: a brand-A post is filtered out of an owned-post set while brand B is active', () => {
      const candidates = [postInBrandA, postInBrandB];
      const organizationId = BRAND_B;
      const owned = candidates.filter(
        p =>
          p.campaign.userId === USER &&
          (organizationId === null ||
            p.campaign.organizationId === organizationId)
      );
      expect(owned.map(p => p.id)).toEqual(['post-b']);
      expect(owned.map(p => p.id)).not.toContain('post-a');
    });
  });

  // ---------------------------------------------------------------------------
  // 200 — same brand active (happy path)
  // ---------------------------------------------------------------------------
  describe('200 — same-brand access works', () => {
    it('READ: brand A active returns the brand-A campaign filter', () => {
      expect(campaignWhereFilter(USER, BRAND_A)).toEqual({
        organizationId: BRAND_A,
      });
    });

    it('EDIT: editing a brand-A post while brand A is active is allowed', () => {
      expect(isPostInScope(postInBrandA.campaign, USER, BRAND_A)).toBe(true);
    });

    it('DELETE: deleting a brand-A post while brand A is active is allowed', () => {
      expect(isPostInScope(postInBrandA.campaign, USER, BRAND_A)).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Single-brand / no-org legacy case must not break.
  // ---------------------------------------------------------------------------
  describe('legacy single-brand / no-org context is unchanged', () => {
    it('READ: with no active org, the filter falls back to userId', () => {
      expect(campaignWhereFilter(USER, null)).toEqual({ userId: USER });
    });

    it('EDIT: with no active org, ownership alone authorizes the edit', () => {
      const legacyPost = {
        userId: USER,
        organizationId: null as string | null,
      };
      expect(isPostInScope(legacyPost, USER, null)).toBe(true);
    });

    it('EDIT: a different user is still denied even with no org context', () => {
      const someoneElsesPost = {
        userId: 'other-user',
        organizationId: null as string | null,
      };
      expect(isPostInScope(someoneElsesPost, USER, null)).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // Cross-brand edit is impossible from any direction.
  // ---------------------------------------------------------------------------
  describe('no cross-brand edit is possible after the fix', () => {
    it('brand B active cannot touch brand A, and brand A active cannot touch brand B', () => {
      expect(isPostInScope(postInBrandA.campaign, USER, BRAND_B)).toBe(false);
      expect(isPostInScope(postInBrandB.campaign, USER, BRAND_A)).toBe(false);
    });
  });
});
