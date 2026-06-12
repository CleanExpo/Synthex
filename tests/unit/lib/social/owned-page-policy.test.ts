import {
  buildOwnedPagePolicy,
  getOwnedProfileAllowlist,
  getOwnedSocialClientConfig,
  isBusinessSocialAccountType,
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
