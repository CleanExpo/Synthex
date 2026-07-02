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
  it('treats every caption-only auto-publish platform as an ad-hoc post-now platform', () => {
    expect(isAdhocPostNowPlatform('facebook')).toBe(true);
    expect(isAdhocPostNowPlatform('instagram')).toBe(true);
    expect(isAdhocPostNowPlatform('linkedin')).toBe(true);
    // SYN-P1: real caption-only publish clients are now auto-enabled.
    expect(isAdhocPostNowPlatform('twitter')).toBe(true);
    expect(isAdhocPostNowPlatform('threads')).toBe(true);
    // Real clients, but each needs extra metadata (subreddit/board/video) the
    // caption-only post-now flow does not supply → still require the manual
    // allowlist, no auto-open.
    expect(isAdhocPostNowPlatform('youtube')).toBe(false);
    expect(isAdhocPostNowPlatform('reddit')).toBe(false);
    expect(isAdhocPostNowPlatform('pinterest')).toBe(false);
    expect(isAdhocPostNowPlatform('tiktok')).toBe(false);
  });

  it('auto-enables post-now for a freshly-connected Twitter/X account (SYN-P1)', () => {
    const decision = evaluateOwnedConnectionPublishGate({
      hasOrganization: true,
      platform: 'twitter',
      accountType: OWNED_PAGE_ACCOUNT_TYPE,
      profileId: 'team_tw_123',
      allowedProfileIds: [],
    });
    expect(decision.allowed).toBe(true);
    expect(decision.basis).toBe('owned-active-org');
  });

  it('auto-enables post-now for a freshly-connected Threads account (SYN-P1)', () => {
    const decision = evaluateOwnedConnectionPublishGate({
      hasOrganization: true,
      platform: 'threads',
      accountType: OWNED_PAGE_ACCOUNT_TYPE,
      profileId: 'team_th_123',
      allowedProfileIds: [],
    });
    expect(decision.allowed).toBe(true);
    expect(decision.basis).toBe('owned-active-org');
  });

  it('still blocks Twitter/X with no profile identity even when org-scoped (ownership floor holds)', () => {
    const decision = evaluateOwnedConnectionPublishGate({
      hasOrganization: true,
      platform: 'twitter',
      accountType: OWNED_PAGE_ACCOUNT_TYPE,
      profileId: null,
      allowedProfileIds: [],
    });
    expect(decision.allowed).toBe(false);
    expect(decision.basis).toBeNull();
  });

  it('does NOT auto-open a metadata-requiring platform (pinterest) without the manual allowlist', () => {
    const decision = evaluateOwnedConnectionPublishGate({
      hasOrganization: true,
      platform: 'pinterest',
      accountType: OWNED_PAGE_ACCOUNT_TYPE,
      profileId: 'team_pin_123',
      allowedProfileIds: [],
    });
    expect(decision.allowed).toBe(false);
    expect(decision.basis).toBeNull();
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

  it('still publishes an ALLOWLISTED non-v1 platform (no regression to the legacy manual path)', () => {
    // RestoreAssist's owned YouTube channel is enabled via the manual allowlist,
    // not auto-enable. The relaxation must not break that legacy path.
    const decision = evaluateOwnedConnectionPublishGate({
      hasOrganization: true,
      platform: 'youtube',
      accountType: 'company',
      profileId: 'ra_owned_channel',
      allowedProfileIds: ['ra_owned_channel'],
    });
    expect(decision.allowed).toBe(true);
    expect(decision.basis).toBe('allowlisted');
  });

  it('denies a v1 platform connection that lacks a profileId even when org-scoped (cross-tenant/ownership floor holds)', () => {
    // Auto-enable for IG/FB/LinkedIn still requires a real profile identity; an
    // account that never resolved a profileId cannot establish ownership and is
    // blocked regardless of platform. This is the floor that, combined with the
    // caller's userId+organizationId+isActive query scope, prevents publishing
    // to any account the active org does not own.
    const decision = evaluateOwnedConnectionPublishGate({
      hasOrganization: true,
      platform: 'linkedin',
      accountType: OWNED_PAGE_ACCOUNT_TYPE,
      profileId: undefined,
      allowedProfileIds: [],
    });
    expect(decision.allowed).toBe(false);
    expect(decision.basis).toBeNull();
  });
});
