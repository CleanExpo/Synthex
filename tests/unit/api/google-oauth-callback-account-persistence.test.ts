import { createMockNextRequest } from '@/tests/helpers/mock-request';

const mockRetrievePKCEState = jest.fn();
const mockFindUserByProviderAccount = jest.fn();
const mockFindUserByEmail = jest.fn();
const mockLinkAccount = jest.fn();
const mockCreateAccount = jest.fn();
const mockAuthenticate = jest.fn();
const mockCreateUser = jest.fn();

jest.mock('@/lib/auth/pkce', () => ({
  retrievePKCEState: (...args: unknown[]) => mockRetrievePKCEState(...args),
}));

jest.mock('@/lib/auth/account-service', () => ({
  accountService: {
    findUserByProviderAccount: (...args: unknown[]) =>
      mockFindUserByProviderAccount(...args),
    findUserByEmail: (...args: unknown[]) => mockFindUserByEmail(...args),
    linkAccount: (...args: unknown[]) => mockLinkAccount(...args),
    createAccount: (...args: unknown[]) => mockCreateAccount(...args),
  },
}));

jest.mock('@/lib/auth/signInFlow', () => ({
  signInFlow: {
    authenticate: (...args: unknown[]) => mockAuthenticate(...args),
  },
}));

jest.mock('@/lib/auth/invite-gate', () => ({
  isInviteOnlyMode: () => false,
  hasInviteEvidence: jest.fn(),
}));

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: { user: { create: (...args: unknown[]) => mockCreateUser(...args) } },
}));

jest.mock('@/lib/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));

const originalFetch = global.fetch;
const originalEnv = { ...process.env };

beforeEach(() => {
  jest.clearAllMocks();
  process.env = {
    ...originalEnv,
    NODE_ENV: 'test',
    GOOGLE_CLIENT_ID: 'google-client-id',
    GOOGLE_CLIENT_SECRET: 'google-client-secret',
    NEXT_PUBLIC_APP_URL: 'http://localhost:3008',
  };
  mockRetrievePKCEState.mockResolvedValue({
    state: 'state-1',
    codeVerifier: 'verifier',
    provider: 'google',
    redirectUri: 'http://localhost:3008/api/auth/oauth/google/callback',
  });
  mockFindUserByProviderAccount.mockResolvedValue({
    userId: 'user-1',
    email: 'phill@example.com',
  });
  mockFindUserByEmail.mockResolvedValue(null);
  mockLinkAccount.mockResolvedValue({ success: true });
  mockCreateAccount.mockResolvedValue({ id: 'account-1' });
  mockCreateUser.mockResolvedValue({
    id: 'user-1',
    email: 'phill@example.com',
  });
  mockAuthenticate.mockResolvedValue({
    success: true,
    session: {
      accessToken: 'synthex-session-token',
      user: {
        id: 'user-1',
        email: 'phill@example.com',
        name: 'Phill',
        avatar: 'https://example.com/avatar.png',
      },
    },
  });
  global.fetch = jest.fn(async (url: unknown) => {
    const target = String(url);
    if (target.includes('oauth2.googleapis.com/token')) {
      return {
        ok: true,
        json: async () => ({
          access_token: 'google-access-token',
          refresh_token: 'google-refresh-token',
          expires_in: 3600,
          token_type: 'Bearer',
          scope: 'openid email profile',
          id_token: 'google-id-token',
        }),
      } as Response;
    }
    if (target.includes('googleapis.com/oauth2/v2/userinfo')) {
      return {
        ok: true,
        json: async () => ({
          id: 'google-user-123',
          email: 'phill@example.com',
          verified_email: true,
          name: 'Phill',
          picture: 'https://example.com/avatar.png',
        }),
      } as Response;
    }
    return { ok: false, status: 404, json: async () => ({}) } as Response;
  }) as typeof global.fetch;
});

afterAll(() => {
  global.fetch = originalFetch;
  process.env = originalEnv;
});

describe('Google OAuth sign-in callback', () => {
  it('rejects a PKCE state created for another provider', async () => {
    mockRetrievePKCEState.mockResolvedValue({
      state: 'state-1',
      codeVerifier: 'verifier',
      provider: 'github',
      redirectUri: 'http://localhost:3008/api/auth/oauth/google/callback',
    });

    const response = await import('@/app/api/auth/oauth/google/callback/route').then(
      ({ GET }) =>
        GET(
          createMockNextRequest({
            url: 'http://localhost:3008/api/auth/oauth/google/callback?code=auth-code&state=state-1',
          })
        )
    );
    expect(response.headers.get('location')).toContain(
      'error=Invalid+or+expired+state'
    );
    expect(global.fetch).not.toHaveBeenCalled();
    expect(mockAuthenticate).not.toHaveBeenCalled();
  });

  it('persists the Google account before issuing the Synthex session', async () => {
    const { GET } = await import('@/app/api/auth/oauth/google/callback/route');
    const response = await GET(
      createMockNextRequest({
        url: 'http://localhost:3008/api/auth/oauth/google/callback?code=auth-code&state=state-1',
      })
    );

    expect(response.headers.get('location')).toBe(
      'http://localhost:3008/dashboard?auth=success'
    );
    expect(mockLinkAccount).toHaveBeenCalledWith(
      'user-1',
      'google',
      expect.objectContaining({ id: 'google-user-123' }),
      expect.objectContaining({
        accessToken: 'google-access-token',
        refreshToken: 'google-refresh-token',
      })
    );
    expect(mockAuthenticate).toHaveBeenCalledWith('oauth', {
      provider: 'google',
      oauthUser: expect.objectContaining({ id: 'google-user-123' }),
    });
    expect(response.headers.get('set-cookie')).toContain('auth-token=synthex-session-token');
  });

  it.each([false, undefined])(
    'rejects a Google profile without positive email verification (%s)',
    async verifiedEmail => {
      global.fetch = jest.fn(async (url: unknown) => {
        if (String(url).includes('oauth2.googleapis.com/token')) {
          return {
            ok: true,
            json: async () => ({ access_token: 'google-access-token' }),
          } as Response;
        }
        return {
          ok: true,
          json: async () => ({
            id: 'google-user-123',
            email: 'phill@example.com',
            verified_email: verifiedEmail,
          }),
        } as Response;
      }) as typeof global.fetch;

      const { GET } = await import('@/app/api/auth/oauth/google/callback/route');
      const response = await GET(
        createMockNextRequest({
          url: 'http://localhost:3008/api/auth/oauth/google/callback?code=auth-code&state=state-1',
        })
      );

      expect(response.status).toBeGreaterThanOrEqual(300);
      expect(response.status).toBeLessThan(400);
      expect(response.headers.get('set-cookie') || '').not.toContain('auth-token');
      expect(mockLinkAccount).not.toHaveBeenCalled();
      expect(mockCreateAccount).not.toHaveBeenCalled();
      expect(mockAuthenticate).not.toHaveBeenCalled();
    }
  );

  it('does not issue a session when account persistence fails', async () => {
    mockLinkAccount.mockResolvedValue({
      success: false,
      error: 'Google account is already linked to another user',
    });
    const { GET } = await import('@/app/api/auth/oauth/google/callback/route');
    const response = await GET(
      createMockNextRequest({
        url: 'http://localhost:3008/api/auth/oauth/google/callback?code=auth-code&state=state-1',
      })
    );

    expect(response.headers.get('location')).toContain(
      'error=Google+account+is+already+linked+to+another+user'
    );
    expect(response.headers.get('set-cookie') || '').not.toContain('auth-token');
    expect(mockAuthenticate).not.toHaveBeenCalled();
  });
});
