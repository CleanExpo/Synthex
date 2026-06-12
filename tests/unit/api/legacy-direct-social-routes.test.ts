import fs from 'node:fs';
import path from 'node:path';

const DIRECT_SOCIAL_POST_ROUTES = [
  'facebook',
  'instagram',
  'linkedin',
  'pinterest',
  'reddit',
  'threads',
  'tiktok',
  'youtube',
];

describe('legacy direct social posting routes', () => {
  it('keeps platform-specific POST routes disabled by default', () => {
    for (const platform of DIRECT_SOCIAL_POST_ROUTES) {
      const routePath = path.join(
        process.cwd(),
        'app',
        'api',
        'social',
        platform,
        'post',
        'route.ts'
      );
      const source = fs.readFileSync(routePath, 'utf8');

      expect(source).toContain('SYNTHEX_ENABLE_LEGACY_DIRECT_SOCIAL_POSTS');
      expect(source).toContain('/api/social/post');
      expect(source).toContain('organization-scoped page ownership');
    }
  });
});

