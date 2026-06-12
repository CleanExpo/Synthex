import { buildSocialLaunchReadinessReport } from '@/scripts/social-launch-readiness';
import {
  buildOwnedPagePolicy,
  getOwnedSocialClientConfig,
} from '@/lib/social/owned-page-policy';

describe('social launch readiness audit', () => {
  it('detects duplicate active connections without exposing token values', async () => {
    const config = getOwnedSocialClientConfig('carsi');
    expect(config).toBeDefined();

    const now = new Date('2026-06-12T00:00:00.000Z');
    const prisma = {
      organization: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'org-carsi',
            slug: 'carsi',
            name: 'CARSI',
            website: 'https://carsi.com.au',
            status: 'active',
            settings: {
              socialPublishing: buildOwnedPagePolicy(config!, now),
            },
            socialHandles: config!.socialHandles,
          },
        ]),
      },
      platformConnection: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'conn-facebook-1',
            organizationId: 'org-carsi',
            platform: 'facebook',
            isActive: true,
            deletedAt: null,
            accessToken: 'plain-facebook-token-one',
            refreshToken: null,
            expiresAt: null,
            scope: 'pages_manage_posts',
            profileId: '107529017631636',
            profileName: 'CARSI',
            accountType: 'business_page',
            metadata: { publishReadiness: 'eligible' },
            updatedAt: new Date('2026-06-12T00:00:00.000Z'),
          },
          {
            id: 'conn-facebook-2',
            organizationId: 'org-carsi',
            platform: 'facebook',
            isActive: true,
            deletedAt: null,
            accessToken: 'plain-facebook-token-two',
            refreshToken: null,
            expiresAt: null,
            scope: 'pages_manage_posts',
            profileId: '107529017631636',
            profileName: 'CARSI Duplicate',
            accountType: 'business_page',
            metadata: { publishReadiness: 'eligible' },
            updatedAt: new Date('2026-06-12T00:01:00.000Z'),
          },
        ]),
      },
      vaultSecret: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    const report = await buildSocialLaunchReadinessReport({
      prisma: prisma as any,
      getPlatformOAuthCredentials: jest
        .fn()
        .mockResolvedValue({ clientId: 'configured', clientSecret: 'configured' }),
      now,
      clients: ['carsi'],
    });

    const carsi = report.clients[0];
    const facebook = carsi.platforms.find(platform => platform.platform === 'facebook');

    expect(facebook?.blockers).toContain('duplicate_active_connections');
    expect(facebook?.activeConnectionCount).toBe(2);
    expect(JSON.stringify(report)).not.toContain('plain-facebook-token-one');
    expect(JSON.stringify(report)).not.toContain('plain-facebook-token-two');
  });
});
