/**
 * Unit tests for BaseOAuthProvider token-expiry + refresh logic (SYN-963 #1).
 *
 * `isTokenExpired` (with its 5-minute safety buffer) and `getValidTokens`
 * (refresh-or-throw) are the shared decision points behind every platform OAuth
 * connection — exercised by app/api/auth/connections/route.ts but not unit-
 * tested directly. This pins their branches with a minimal concrete subclass.
 */
import { BaseOAuthProvider, OAuthError } from '@/lib/oauth/base-provider';
import type {
  OAuthConfig,
  OAuthTokens,
  OAuthUserInfo,
} from '@/lib/oauth/types';

const CONFIG: OAuthConfig = {
  clientId: 'id',
  clientSecret: 'secret',
  redirectUri: 'https://example.test/cb',
  scope: ['read'],
  authorizationUrl: 'https://example.test/auth',
  tokenUrl: 'https://example.test/token',
};

const refreshSpy = jest.fn<Promise<OAuthTokens>, [string]>();

class TestProvider extends BaseOAuthProvider {
  constructor() {
    super('linkedin', CONFIG);
  }
  async getUserInfo(): Promise<OAuthUserInfo> {
    return { id: 'u1' };
  }
  // Override the network refresh with a controllable stub.
  override async refreshAccessToken(refreshToken: string): Promise<OAuthTokens> {
    return refreshSpy(refreshToken);
  }
}

const provider = new TestProvider();
const minutesFromNow = (m: number) => new Date(Date.now() + m * 60 * 1000);

beforeEach(() => refreshSpy.mockReset());

describe('isTokenExpired', () => {
  it('treats a token with no expiry as never expired', () => {
    expect(provider.isTokenExpired({ accessToken: 'a' })).toBe(false);
  });

  it('treats a token expiring within the 5-minute buffer as expired', () => {
    expect(
      provider.isTokenExpired({ accessToken: 'a', expiresAt: minutesFromNow(3) }),
    ).toBe(true);
  });

  it('treats a token comfortably in the future as not expired', () => {
    expect(
      provider.isTokenExpired({ accessToken: 'a', expiresAt: minutesFromNow(30) }),
    ).toBe(false);
  });

  it('treats an already-past expiry as expired', () => {
    expect(
      provider.isTokenExpired({ accessToken: 'a', expiresAt: minutesFromNow(-10) }),
    ).toBe(true);
  });
});

describe('getValidTokens', () => {
  it('returns the tokens unchanged when not expired (no refresh)', async () => {
    const tokens: OAuthTokens = {
      accessToken: 'a',
      refreshToken: 'r',
      expiresAt: minutesFromNow(30),
    };
    const out = await provider.getValidTokens(tokens);
    expect(out).toBe(tokens);
    expect(refreshSpy).not.toHaveBeenCalled();
  });

  it('refreshes when expired and a refresh token is present', async () => {
    const refreshed: OAuthTokens = {
      accessToken: 'new',
      refreshToken: 'r',
      expiresAt: minutesFromNow(60),
    };
    refreshSpy.mockResolvedValue(refreshed);

    const out = await provider.getValidTokens({
      accessToken: 'old',
      refreshToken: 'r',
      expiresAt: minutesFromNow(-1),
    });
    expect(refreshSpy).toHaveBeenCalledWith('r');
    expect(out).toBe(refreshed);
  });

  it('throws NO_REFRESH_TOKEN when expired with no refresh token', async () => {
    await expect(
      provider.getValidTokens({ accessToken: 'old', expiresAt: minutesFromNow(-1) }),
    ).rejects.toMatchObject({ code: 'NO_REFRESH_TOKEN' });
    await expect(
      provider.getValidTokens({ accessToken: 'old', expiresAt: minutesFromNow(-1) }),
    ).rejects.toBeInstanceOf(OAuthError);
    expect(refreshSpy).not.toHaveBeenCalled();
  });
});
