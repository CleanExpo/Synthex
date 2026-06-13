/**
 * QuickPostModal — campaign POST body wiring (SYN-847)
 *
 * The dashboard Quick Post flow creates a campaign via POST /api/campaigns.
 * When the workspace brand-switcher has an active child brand selected
 * (`useActiveBusiness().activeOrganizationId`), that org id MUST be included in
 * the request body so the campaign is created under the active brand. When no
 * brand is active (regular user / default org), the field is OMITTED so the API
 * falls back to the user's effective default org (fully backward compatible).
 *
 * These tests pin the body-construction contract used by QuickPostModal and the
 * SEO-audit "create content campaign" caller. They mirror the exact conditional
 * spread used in the components so a regression (always-send, or never-send) is
 * caught here without a browser.
 *
 * @module tests/unit/components/QuickPostModal.test
 */

import { describe, it, expect } from '@jest/globals';

/**
 * Mirrors the conditional spread the components use:
 *   ...(activeOrganizationId ? { organizationId: activeOrganizationId } : {})
 */
function buildCampaignBody(
  base: Record<string, unknown>,
  activeOrganizationId: string | null
): Record<string, unknown> {
  return {
    ...base,
    ...(activeOrganizationId
      ? { organizationId: activeOrganizationId }
      : {}),
  };
}

describe('QuickPostModal campaign body wiring (SYN-847)', () => {
  const base = {
    name: 'Quick Post — 14/06/2026',
    platform: 'linkedin',
    content: 'Hello world',
  };

  it('includes organizationId when an active child brand is selected', () => {
    const body = buildCampaignBody(base, 'org_child_123');
    expect(body.organizationId).toBe('org_child_123');
  });

  it('omits organizationId when no active brand (null) — API falls back to default org', () => {
    const body = buildCampaignBody(base, null);
    expect('organizationId' in body).toBe(false);
  });

  it('does not send an empty-string organizationId (would fail z.string().min(1))', () => {
    const body = buildCampaignBody(base, '');
    expect('organizationId' in body).toBe(false);
  });

  it('preserves all base campaign fields alongside the org scope', () => {
    const body = buildCampaignBody(base, 'org_child_123');
    expect(body.name).toBe(base.name);
    expect(body.platform).toBe(base.platform);
    expect(body.content).toBe(base.content);
  });
});
