/**
 * AT-031 — Twitter/X OAuth token-column misuse regression tests.
 *
 * Proves OAuth 2.0 refresh tokens are never mapped to OAuth 1.0a accessSecret,
 * and legacy OAuth 1.0a secrets still resolve from the correct column.
 */

jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

const twitterMockClient = {
  v2: {
    me: jest.fn(),
    tweet: jest.fn(),
  },
  v1: { uploadMedia: jest.fn() },
};

jest.mock('twitter-api-v2', () => ({
  TwitterApi: jest.fn(function () {
    return twitterMockClient;
  }),
}));

const mockCreatePost = jest.fn();
const mockIsConfigured = jest.fn();

jest.mock('@/lib/social', () => ({
  createPlatformService: jest.fn(),
}));

import { TwitterApi } from 'twitter-api-v2';
import {
  buildTwitterPlatformCredentials,
  isTwitterOAuth2Connection,
  resolveTwitterOAuthVersion,
} from '@/lib/social/twitter-oauth-credentials';
import { TwitterSyncService } from '@/lib/social/twitter-sync-service';
import { createPlatformService } from '@/lib/social';
import { publishToTwitter } from '@/lib/publish/platformAdapters/twitter';

describe('resolveTwitterOAuthVersion', () => {
  it('detects OAuth 2.0 from metadata.tokenType bearer', () => {
    expect(resolveTwitterOAuthVersion({ tokenType: 'bearer' }, null)).toBe(
      '2.0'
    );
  });

  it('detects OAuth 2.0 from metadata.oauthVersion', () => {
    expect(resolveTwitterOAuthVersion({ oauthVersion: '2.0' }, null)).toBe(
      '2.0'
    );
  });

  it('detects OAuth 2.0 from expiresAt when metadata is empty', () => {
    expect(resolveTwitterOAuthVersion({}, new Date())).toBe('2.0');
  });

  it('defaults to OAuth 1.0a for legacy rows without bearer/expiry metadata', () => {
    expect(resolveTwitterOAuthVersion({}, null)).toBe('1.0a');
  });
});

describe('buildTwitterPlatformCredentials', () => {
  it('maps OAuth 2.0 refreshToken without accessSecret', () => {
    const creds = buildTwitterPlatformCredentials({
      accessToken: 'access-2',
      refreshTokenDecrypted: 'refresh-2',
      expiresAt: new Date('2026-08-05T12:00:00Z'),
      metadata: { tokenType: 'bearer' },
    });

    expect(creds.oauthVersion).toBe('2.0');
    expect(creds.refreshToken).toBe('refresh-2');
    expect(creds.accessSecret).toBeUndefined();
  });

  it('maps OAuth 1.0a access secret from refreshToken column (legacy)', () => {
    const creds = buildTwitterPlatformCredentials({
      accessToken: 'access-1',
      refreshTokenDecrypted: 'secret-1',
      metadata: {},
    });

    expect(creds.oauthVersion).toBe('1.0a');
    expect(creds.accessSecret).toBe('secret-1');
    expect(creds.refreshToken).toBeUndefined();
  });

  it('prefers metadata.accessSecret for OAuth 1.0a when present', () => {
    const creds = buildTwitterPlatformCredentials({
      accessToken: 'access-1',
      refreshTokenDecrypted: 'legacy-column-secret',
      accessSecretDecrypted: 'metadata-secret',
      metadata: { oauthVersion: '1.0a' },
    });

    expect(creds.accessSecret).toBe('metadata-secret');
  });
});

describe('TwitterSyncService.initialize — OAuth version routing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.TWITTER_API_KEY = 'app-key';
    process.env.TWITTER_API_SECRET = 'app-secret';
    process.env.TWITTER_CLIENT_ID = 'client-id';
    process.env.TWITTER_CLIENT_SECRET = 'client-secret';
  });

  afterEach(() => {
    delete process.env.TWITTER_API_KEY;
    delete process.env.TWITTER_API_SECRET;
    delete process.env.TWITTER_CLIENT_ID;
    delete process.env.TWITTER_CLIENT_SECRET;
  });

  it('uses OAuth 2.0 bearer client when refreshToken is an OAuth 2 refresh token', () => {
    const service = new TwitterSyncService();
    service.initialize(
      buildTwitterPlatformCredentials({
        accessToken: 'oauth2-access',
        refreshTokenDecrypted: 'oauth2-refresh',
        expiresAt: new Date(Date.now() + 3600_000),
        metadata: { tokenType: 'bearer' },
      })
    );

    expect(service.isConfigured()).toBe(true);
    expect(TwitterApi).toHaveBeenCalledWith('oauth2-access');
    expect(TwitterApi).not.toHaveBeenCalledWith(
      expect.objectContaining({ accessSecret: 'oauth2-refresh' })
    );
  });

  it('uses OAuth 1.0a signing when accessSecret is provided', () => {
    const service = new TwitterSyncService();
    service.initialize(
      buildTwitterPlatformCredentials({
        accessToken: 'oauth1-access',
        refreshTokenDecrypted: 'oauth1-secret',
        metadata: {},
      })
    );

    expect(service.isConfigured()).toBe(true);
    expect(TwitterApi).toHaveBeenCalledWith({
      appKey: 'app-key',
      appSecret: 'app-secret',
      accessToken: 'oauth1-access',
      accessSecret: 'oauth1-secret',
    });
  });
});

describe('publishToTwitter — credential wiring', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.TWITTER_API_KEY = 'app-key';
    process.env.TWITTER_API_SECRET = 'app-secret';
    twitterMockClient.v2.me.mockResolvedValue({
      data: { id: '1', username: 'user' },
    });
    twitterMockClient.v2.tweet.mockResolvedValue({ data: { id: 'tw-1' } });
    (createPlatformService as jest.Mock).mockImplementation(
      (_platform, credentials) => {
        const service = new TwitterSyncService();
        service.initialize(credentials);
        return service;
      }
    );
  });

  afterEach(() => {
    delete process.env.TWITTER_API_KEY;
    delete process.env.TWITTER_API_SECRET;
  });

  it('does not pass OAuth 2.0 refresh token as accessSecret', async () => {
    await publishToTwitter({
      accessToken: 'oauth2-access',
      refreshToken: 'oauth2-refresh',
      expiresAt: new Date(Date.now() + 3600_000),
      metadata: { tokenType: 'bearer' },
      text: 'hello oauth2',
    });

    expect(TwitterApi).toHaveBeenCalledWith('oauth2-access');
    expect(TwitterApi).not.toHaveBeenCalledWith(
      expect.objectContaining({ accessSecret: 'oauth2-refresh' })
    );
  });

  it('passes OAuth 1.0a accessTokenSecret to the signing client', async () => {
    await publishToTwitter({
      accessToken: 'oauth1-access',
      accessTokenSecret: 'oauth1-secret',
      metadata: {},
      text: 'hello oauth1',
    });

    expect(TwitterApi).toHaveBeenCalledWith({
      appKey: 'app-key',
      appSecret: 'app-secret',
      accessToken: 'oauth1-access',
      accessSecret: 'oauth1-secret',
    });
  });

  it('passes connectionId to createPlatformService for OAuth 2.0 queue publishes', async () => {
    await publishToTwitter({
      accessToken: 'oauth2-access',
      refreshToken: 'oauth2-refresh',
      expiresAt: new Date(Date.now() + 3600_000),
      metadata: { tokenType: 'bearer' },
      connectionId: 'conn-queue-oauth2',
      text: 'scheduled tweet',
    });

    expect(createPlatformService).toHaveBeenCalledWith(
      'twitter',
      expect.objectContaining({
        oauthVersion: '2.0',
        refreshToken: 'oauth2-refresh',
      }),
      { connectionId: 'conn-queue-oauth2' }
    );
  });
});

describe('isTwitterOAuth2Connection', () => {
  it('returns true for bearer metadata', () => {
    expect(isTwitterOAuth2Connection({ tokenType: 'bearer' })).toBe(true);
  });

  it('returns false for legacy OAuth 1.0a metadata', () => {
    expect(isTwitterOAuth2Connection({})).toBe(false);
  });
});
