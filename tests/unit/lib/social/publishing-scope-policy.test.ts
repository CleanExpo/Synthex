import {
  checkPublishingScopes,
  parseOAuthScope,
} from '@/lib/social/publishing-scope-policy';

describe('publishing scope policy', () => {
  it('parses comma and space separated OAuth scopes', () => {
    expect(parseOAuthScope('pages_show_list,pages_manage_posts email')).toEqual([
      'pages_show_list',
      'pages_manage_posts',
      'email',
    ]);
  });

  it('requires Facebook page publishing scopes before posting', () => {
    expect(
      checkPublishingScopes(
        'facebook',
        'public_profile,email,pages_show_list,pages_read_engagement'
      )
    ).toMatchObject({
      ok: false,
      missing: ['pages_manage_posts'],
    });
  });

  it('accepts either classic or business Instagram publishing scopes', () => {
    expect(
      checkPublishingScopes(
        'instagram',
        'instagram_business_basic instagram_business_content_publish pages_show_list pages_read_engagement'
      )
    ).toMatchObject({ ok: true, missing: [] });
  });
});

