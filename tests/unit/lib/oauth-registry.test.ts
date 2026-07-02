import {
  getOAuthProvider,
  getSupportedPlatforms,
  isSupportedPlatform,
} from '@/lib/oauth';

describe('OAuth provider registry', () => {
  it('includes Google integration platforms used by the connections API', () => {
    expect(getSupportedPlatforms()).toEqual(
      expect.arrayContaining([
        'googleanalytics',
        'searchconsole',
        'googlebusiness',
        'googledrive',
      ])
    );
    expect(isSupportedPlatform('googleanalytics')).toBe(true);
    expect(getOAuthProvider('googleanalytics')).toBeDefined();
  });
});
