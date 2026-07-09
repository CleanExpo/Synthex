/**
 * LinkedIn organisation resolution tests (E1 — carsi-linkedin-golive spec).
 *
 * Pins the connect-time behaviour that makes company-page publishing work:
 * a `w_organization_social` connection with exactly ONE admin'd organisation
 * resolves to that organisation's NUMERIC id; anything else keeps the member
 * id (never guesses) and surfaces the admin org ids for the manual override.
 */

import { describe, it, expect, jest, afterEach } from '@jest/globals';
import {
  extractAdminOrganizationIds,
  resolveLinkedInOrganizationProfile,
  scopeGrantsOrganizationSocial,
} from '@/lib/social/linkedin-organization';

describe('scopeGrantsOrganizationSocial', () => {
  it('accepts space- and comma-delimited scope strings', () => {
    expect(
      scopeGrantsOrganizationSocial(
        'openid profile email w_member_social w_organization_social'
      )
    ).toBe(true);
    expect(
      scopeGrantsOrganizationSocial('openid,profile,w_organization_social')
    ).toBe(true);
  });

  it('rejects member-only, empty, and missing scopes', () => {
    expect(
      scopeGrantsOrganizationSocial('openid profile email w_member_social')
    ).toBe(false);
    expect(scopeGrantsOrganizationSocial('')).toBe(false);
    expect(scopeGrantsOrganizationSocial(null)).toBe(false);
    expect(scopeGrantsOrganizationSocial(undefined)).toBe(false);
  });

  it('does not match a substring of another scope name', () => {
    expect(scopeGrantsOrganizationSocial('rw_organization_social_extra')).toBe(
      false
    );
  });
});

describe('extractAdminOrganizationIds', () => {
  it('extracts numeric ids from organisation URNs and dedupes', () => {
    expect(
      extractAdminOrganizationIds({
        elements: [
          { organization: 'urn:li:organization:112760720' },
          { organization: 'urn:li:organization:112760720' },
          { organization: 'urn:li:organization:99887766' },
        ],
      })
    ).toEqual(['112760720', '99887766']);
  });

  it('ignores malformed entries and non-organisation URNs', () => {
    expect(
      extractAdminOrganizationIds({
        elements: [
          { organization: 'urn:li:person:AbC123' },
          { organization: 'urn:li:organization:not-numeric' },
          { organization: 42 },
          {},
          null,
        ],
      })
    ).toEqual([]);
  });

  it('returns [] for empty, missing, or non-object responses', () => {
    expect(extractAdminOrganizationIds({ elements: [] })).toEqual([]);
    expect(extractAdminOrganizationIds({})).toEqual([]);
    expect(extractAdminOrganizationIds(null)).toEqual([]);
    expect(extractAdminOrganizationIds('nope')).toEqual([]);
  });
});

describe('resolveLinkedInOrganizationProfile', () => {
  const realFetch = global.fetch;

  afterEach(() => {
    global.fetch = realFetch;
  });

  function mockFetchOnce(
    response: Partial<Response> & { json?: () => unknown }
  ) {
    const fetchMock = jest.fn(async () => response as Response);
    global.fetch = fetchMock as unknown as typeof fetch;
    return fetchMock;
  }

  it('does not call LinkedIn at all without the organisation scope', async () => {
    const fetchMock = mockFetchOnce({ ok: true });
    const result = await resolveLinkedInOrganizationProfile({
      accessToken: 'token',
      grantedScope: 'openid profile email w_member_social',
    });
    expect(result).toEqual({ organizationId: null, adminOrganizationIds: [] });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('resolves the org id when exactly one admin organisation exists', async () => {
    mockFetchOnce({
      ok: true,
      json: async () => ({
        elements: [{ organization: 'urn:li:organization:112760720' }],
      }),
    });
    const result = await resolveLinkedInOrganizationProfile({
      accessToken: 'token',
      grantedScope: 'w_organization_social',
    });
    expect(result.organizationId).toBe('112760720');
    expect(result.adminOrganizationIds).toEqual(['112760720']);
  });

  it('keeps organizationId null (never guesses) with multiple admin orgs', async () => {
    mockFetchOnce({
      ok: true,
      json: async () => ({
        elements: [
          { organization: 'urn:li:organization:1' },
          { organization: 'urn:li:organization:2' },
        ],
      }),
    });
    const result = await resolveLinkedInOrganizationProfile({
      accessToken: 'token',
      grantedScope: 'w_organization_social',
    });
    expect(result.organizationId).toBeNull();
    expect(result.adminOrganizationIds).toEqual(['1', '2']);
  });

  it('degrades to the member-id fallback on API failure and thrown errors', async () => {
    mockFetchOnce({ ok: false, status: 403 });
    expect(
      await resolveLinkedInOrganizationProfile({
        accessToken: 'token',
        grantedScope: 'w_organization_social',
      })
    ).toEqual({ organizationId: null, adminOrganizationIds: [] });

    global.fetch = jest.fn(async () => {
      throw new Error('network down');
    }) as unknown as typeof fetch;
    expect(
      await resolveLinkedInOrganizationProfile({
        accessToken: 'token',
        grantedScope: 'w_organization_social',
      })
    ).toEqual({ organizationId: null, adminOrganizationIds: [] });
  });
});
