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
        .mockResolvedValue({
          clientId: 'configured',
          clientSecret: 'configured',
        }),
      now,
      clients: ['carsi'],
    });

    const carsi = report.clients[0];
    const facebook = carsi.platforms.find(
      platform => platform.platform === 'facebook'
    );

    expect(facebook?.blockers).toContain('duplicate_active_connections');
    expect(facebook?.activeConnectionCount).toBe(2);
    expect(JSON.stringify(report)).not.toContain('plain-facebook-token-one');
    expect(JSON.stringify(report)).not.toContain('plain-facebook-token-two');
  });

  it('blocks expired owned social tokens until the refresh job has actually run', async () => {
    const config = getOwnedSocialClientConfig('restoreassist');
    expect(config).toBeDefined();

    const now = new Date('2026-06-12T00:00:00.000Z');
    const prisma = {
      organization: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'org-restoreassist',
            slug: 'restoreassist',
            name: 'RestoreAssist',
            website: 'https://restoreassist.app',
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
            id: 'conn-youtube-expired',
            organizationId: 'org-restoreassist',
            platform: 'youtube',
            isActive: true,
            deletedAt: null,
            accessToken: 'plain-youtube-token',
            refreshToken: 'plain-youtube-refresh-token',
            expiresAt: new Date('2026-06-11T23:00:00.000Z'),
            scope: 'https://www.googleapis.com/auth/youtube.upload',
            profileId: 'UCseWy5OySgZzJUIMKZ-kT5Q',
            profileName: 'Ai Restore Assist',
            accountType: 'business',
            metadata: { publishReadiness: 'eligible' },
            updatedAt: new Date('2026-06-12T00:00:00.000Z'),
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
        .mockResolvedValue({
          clientId: 'configured',
          clientSecret: 'configured',
        }),
      now,
      clients: ['restoreassist'],
    });

    const restoreAssist = report.clients[0];
    const youtube = restoreAssist.platforms.find(
      platform => platform.platform === 'youtube'
    );

    expect(restoreAssist.status).toBe('blocked');
    expect(youtube?.status).toBe('blocked');
    expect(youtube?.connection?.tokenStatus).toBe('expired');
    expect(youtube?.blockers).toContain('oauth_token_refresh_required');
    expect(youtube?.actions).toContain(
      'Run social token refresh for youtube on restoreassist'
    );
  });

  it('blocks active Meta connections that lack publishing scopes', async () => {
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
            id: 'conn-facebook-readonly',
            organizationId: 'org-carsi',
            platform: 'facebook',
            isActive: true,
            deletedAt: null,
            accessToken: 'plain-facebook-token',
            refreshToken: null,
            expiresAt: null,
            scope: 'public_profile,email,pages_show_list,pages_read_engagement',
            profileId: '107529017631636',
            profileName: 'CARSI',
            accountType: 'business_page',
            metadata: { publishReadiness: 'eligible' },
            updatedAt: new Date('2026-06-12T00:00:00.000Z'),
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
        .mockResolvedValue({
          clientId: 'configured',
          clientSecret: 'configured',
        }),
      now,
      clients: ['carsi'],
    });

    const facebook = report.clients[0].platforms.find(
      platform => platform.platform === 'facebook'
    );

    expect(facebook?.status).toBe('blocked');
    expect(facebook?.blockers).toContain('oauth_scope_missing');
    expect(facebook?.actions).toContain(
      'Reconnect facebook OAuth with publishing scopes: pages_manage_posts'
    );
  });

  it('mirrors the live publish gate: an auto-publish LinkedIn org connection is ready without an allowlist entry (E5)', async () => {
    const config = getOwnedSocialClientConfig('carsi');
    expect(config).toBeDefined();

    const now = new Date('2026-07-09T00:00:00.000Z');
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
            id: 'conn-linkedin-org',
            organizationId: 'org-carsi',
            platform: 'linkedin',
            isActive: true,
            deletedAt: null,
            accessToken: 'plain-linkedin-token',
            refreshToken: null,
            expiresAt: null,
            // Fully-scoped org connection with the NUMERIC organisation id —
            // exactly what E1/E2 produce for the CARSI company page.
            scope: 'openid profile email w_member_social w_organization_social',
            profileId: '112760720',
            profileName: 'CARSI',
            accountType: 'business_page',
            metadata: { publishReadiness: 'eligible' },
            updatedAt: new Date('2026-07-09T00:00:00.000Z'),
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
        .mockResolvedValue({
          clientId: 'configured',
          clientSecret: 'configured',
        }),
      now,
      clients: ['carsi'],
    });

    const linkedin = report.clients[0].platforms.find(
      platform => platform.platform === 'linkedin'
    );

    // The live route (evaluateOwnedConnectionPublishGate) auto-enables this
    // connection; the audit must not re-report the retired allowlist model.
    expect(linkedin?.blockers ?? []).not.toContain(
      'owned_profile_allowlist_missing'
    );
    expect(linkedin?.blockers ?? []).not.toContain(
      'active_profile_not_allowlisted'
    );
    expect(linkedin?.blockers ?? []).not.toContain(
      'owned_page_publish_gate_blocked'
    );
    expect(linkedin?.status).toBe('ready');
  });

  it('surfaces credential intake evidence when 1Password has no matching client socials', async () => {
    const config = getOwnedSocialClientConfig('ccw');
    expect(config).toBeDefined();

    const now = new Date('2026-06-12T00:00:00.000Z');
    const prisma = {
      organization: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'org-ccw',
            slug: 'ccw',
            name: 'CCW',
            website: 'https://ccwonline.com.au',
            status: 'active',
            settings: {
              socialPublishing: {
                ...buildOwnedPagePolicy(config!, now),
                credentialIntakeRequired: true,
                credentialSearch: {
                  onePassword: {
                    checkedQueries: [
                      'ccw',
                      'carpet cleaners warehouse',
                      'carpet cleaners',
                    ],
                    status: 'not_found_in_1password_inventory',
                    actionRequired:
                      'Add verified CCW social account items to 1Password before Synthex can store account-scoped references.',
                  },
                },
              },
            },
            socialHandles: {},
          },
        ]),
      },
      platformConnection: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      vaultSecret: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    const report = await buildSocialLaunchReadinessReport({
      prisma: prisma as any,
      getPlatformOAuthCredentials: jest.fn().mockResolvedValue(null),
      now,
      clients: ['ccw'],
    });

    expect(report.clients[0].status).toBe('needs_intake');
    expect(report.clients[0].intakeNotes).toEqual([
      '1Password inventory search found no verified social account item. Checked: ccw, carpet cleaners warehouse, carpet cleaners.',
      'Add verified CCW social account items to 1Password before Synthex can store account-scoped references.',
    ]);
  });
});
