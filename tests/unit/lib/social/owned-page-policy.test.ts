import {
  buildOwnedPagePolicy,
  evaluateOwnedConnectionPublishGate,
  getOwnedProfileAllowlist,
  getOwnedSocialClientConfig,
  isAdhocPostNowPlatform,
  isBusinessSocialAccountType,
  OWNED_PAGE_ACCOUNT_TYPE,
} from '@/lib/social/owned-page-policy';

describe('owned page social policy', () => {
  it('returns the CARSI owned Facebook allowlist from organization settings', () => {
    const config = getOwnedSocialClientConfig('carsi');
    expect(config).toBeDefined();

    const policy = buildOwnedPagePolicy(
      config!,
      new Date('2026-06-12T00:00:00.000Z')
    );

    expect(getOwnedProfileAllowlist({ socialPublishing: policy }, 'facebook')).toEqual([
      '107529017631636',
    ]);
    expect(policy.organicOnly).toBe(true);
    expect(policy.adSpendEnabled).toBe(false);
    expect(policy.directPlatformRoutesDisabled).toBe(true);
  });

  it('classifies only business/page/company connections as publishable account types', () => {
    expect(isBusinessSocialAccountType('business')).toBe(true);
    expect(isBusinessSocialAccountType('business_page')).toBe(true);
    expect(isBusinessSocialAccountType('company')).toBe(true);
    expect(isBusinessSocialAccountType('personal')).toBe(false);
  });

  it('tracks RestoreAssist YouTube as an owned publishable channel', () => {
    const config = getOwnedSocialClientConfig('restoreassist');
    expect(config?.socialHandles.youtube).toBe(
      'https://www.youtube.com/channel/UCseWy5OySgZzJUIMKZ-kT5Q'
    );
    expect(config?.allowedProfileIds.youtube).toEqual([
      'UCseWy5OySgZzJUIMKZ-kT5Q',
    ]);
  });
});

describe('ad-hoc post-now publish gate (evaluateOwnedConnectionPublishGate)', () => {
  it('only treats the live v1 auto-publish platforms as ad-hoc post-now platforms', () => {
    expect(isAdhocPostNowPlatform('facebook')).toBe(true);
    expect(isAdhocPostNowPlatform('instagram')).toBe(true);
    expect(isAdhocPostNowPlatform('linkedin')).toBe(true);
    // Not yet auto-publish in v1 → still require the manual allowlist.
    expect(isAdhocPostNowPlatform('twitter')).toBe(false);
    expect(isAdhocPostNowPlatform('youtube')).toBe(false);
    expect(isAdhocPostNowPlatform('reddit')).toBe(false);
  });

  it('auto-enables post-now for a freshly-connected team account in the active org (no manual allowlist)', () => {
    // Simulates a connection the team just made: v1 platform, owned-page
    // accountType set on connect, real profileId, and NO allowlist entry
    // (the manual enforce script never ran).
    const decision = evaluateOwnedConnectionPublishGate({
      hasOrganization: true,
      platform: 'instagram',
      accountType: OWNED_PAGE_ACCOUNT_TYPE,
      profileId: 'team_ig_123',
      allowedProfileIds: [],
    });
    expect(decision.allowed).toBe(true);
    expect(decision.basis).toBe('owned-active-org');
  });

  it('still honors the explicit owned-page allowlist (legacy manual script)', () => {
    const decision = evaluateOwnedConnectionPublishGate({
      hasOrganization: true,
      platform: 'facebook',
      accountType: 'business',
      profileId: '107529017631636',
      allowedProfileIds: ['107529017631636'],
    });
    expect(decision.allowed).toBe(true);
    expect(decision.basis).toBe('allowlisted');
  });

  it('denies when there is no active organization context (403 path)', () => {
    const decision = evaluateOwnedConnectionPublishGate({
      hasOrganization: false,
      platform: 'instagram',
      accountType: OWNED_PAGE_ACCOUNT_TYPE,
      profileId: 'team_ig_123',
      allowedProfileIds: [],
    });
    expect(decision.allowed).toBe(false);
    expect(decision.basis).toBeNull();
  });

  it('denies when the connection has no profile identity (cannot establish ownership)', () => {
    const decision = evaluateOwnedConnectionPublishGate({
      hasOrganization: true,
      platform: 'facebook',
      accountType: OWNED_PAGE_ACCOUNT_TYPE,
      profileId: null,
      allowedProfileIds: [],
    });
    expect(decision.allowed).toBe(false);
    expect(decision.basis).toBeNull();
  });

  it('denies a non-v1 platform that is not on the manual allowlist (no auto-open)', () => {
    // The active-org scope is satisfied, but auto-enable is bounded to IG/FB/LinkedIn.
    // A connected-but-not-allowlisted YouTube/Reddit/Twitter account stays blocked
    // until the manual owned-page allowlist is populated.
    const decision = evaluateOwnedConnectionPublishGate({
      hasOrganization: true,
      platform: 'youtube',
      accountType: OWNED_PAGE_ACCOUNT_TYPE,
      profileId: 'some_channel',
      allowedProfileIds: [],
    });
    expect(decision.allowed).toBe(false);
    expect(decision.basis).toBeNull();
  });
});
