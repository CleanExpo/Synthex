import { createMockNextRequest } from '@/tests/helpers/mock-request';

jest.mock('next/server', () => {
  class MockCookies {
    private readonly store = new Map<
      string,
      { value: string; options?: unknown }
    >();

    set(name: string, value: string, options?: unknown) {
      this.store.set(name, { value, options });
    }

    get(name: string) {
      return this.store.get(name);
    }
  }

  class MockNextResponse {
    readonly cookies = new MockCookies();
    readonly headers = new Map<string, string>();
    readonly status: number;

    constructor(status = 200) {
      this.status = status;
    }

    static redirect(url: URL) {
      const response = new MockNextResponse(307);
      response.headers.set('location', url.toString());
      return response;
    }

    static json(_body: unknown, init: { status?: number } = {}) {
      return new MockNextResponse(init.status ?? 200);
    }
  }

  return {
    NextRequest: class MockNextRequest {},
    NextResponse: MockNextResponse,
  };
});

const mockGeneratePKCEChallenge = jest.fn();
const mockGenerateState = jest.fn();
const mockStorePKCEState = jest.fn();
const mockRetrievePKCEState = jest.fn();
const mockGetUserIdFromRequestOrCookies = jest.fn();
const mockFindUserByProviderAccount = jest.fn();
const mockFindUserByEmail = jest.fn();
const mockLinkAccount = jest.fn();
const mockCreateAccount = jest.fn();
const mockAuthenticate = jest.fn();
const mockCreateUser = jest.fn();

jest.mock('@/lib/auth/pkce', () => ({
  generatePKCEChallenge: (...args: unknown[]) =>
    mockGeneratePKCEChallenge(...args),
  generateState: (...args: unknown[]) => mockGenerateState(...args),
  storePKCEState: (...args: unknown[]) => mockStorePKCEState(...args),
  retrievePKCEState: (...args: unknown[]) => mockRetrievePKCEState(...args),
}));

jest.mock('@/lib/auth/jwt-utils', () => ({
  getUserIdFromRequestOrCookies: (...args: unknown[]) =>
    mockGetUserIdFromRequestOrCookies(...args),
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
  default: {
    user: { create: (...args: unknown[]) => mockCreateUser(...args) },
  },
}));

jest.mock('@/lib/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));

const originalFetch = global.fetch;
const originalEnv = { ...process.env };

function callbackRequest(state = 'state-1', binding?: string) {
  const browserBinding = arguments.length >= 2 ? binding : state;
  const request = createMockNextRequest({
    url: `http://localhost:3008/api/auth/oauth/google/callback?code=auth-code&state=${state}`,
  });
  request.cookies.get = (name: string) =>
    name === 'google-oauth-binding' && browserBinding
      ? { value: browserBinding }
      : undefined;
  return request;
}

beforeEach(() => {
  jest.clearAllMocks();
  process.env = {
    ...originalEnv,
    NODE_ENV: 'test',
    GOOGLE_CLIENT_ID: 'google-client-id',
    GOOGLE_CLIENT_SECRET: 'google-client-secret',
    FIELD_ENCRYPTION_KEY: 'a'.repeat(64),
    NEXT_PUBLIC_APP_URL: 'http://localhost:3008',
  };
  mockGeneratePKCEChallenge.mockReturnValue({
    codeVerifier: 'verifier',
    codeChallenge: 'challenge',
    codeChallengeMethod: 'S256',
  });
  mockGenerateState.mockReturnValue('state-1');
  mockStorePKCEState.mockResolvedValue(undefined);
  mockGetUserIdFromRequestOrCookies.mockResolvedValue('user-1');
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

describe('Google OAuth browser binding', () => {
  it('rejects the legacy public linkToUserId parameter', async () => {
    const { GET } = await import('@/app/api/auth/oauth/google/route');
    const response = await GET(
      createMockNextRequest({
        url: 'http://localhost:3008/api/auth/oauth/google?linkToUserId=attacker',
      })
    );

    expect(response.status).toBe(400);
    expect(mockGeneratePKCEChallenge).not.toHaveBeenCalled();
    expect(mockStorePKCEState).not.toHaveBeenCalled();
  });

  it('sets a short-lived host-only binding cookie for public sign-in', async () => {
    const { GET } = await import('@/app/api/auth/oauth/google/route');
    const response = await GET(
      createMockNextRequest({
        url: 'http://localhost:3008/api/auth/oauth/google',
      })
    );

    expect(response.status).toBe(200);
    expect(response.cookies.get('google-oauth-binding')?.value).toBe('state-1');
    expect(response.cookies.get('google-oauth-binding')?.options).toEqual(
      expect.objectContaining({
        httpOnly: true,
        secure: false,
        sameSite: 'lax',
        maxAge: 600,
        path: '/',
      })
    );
    expect(mockStorePKCEState).toHaveBeenCalledWith(
      'state-1',
      'verifier',
      'google',
      'http://localhost:3008/api/auth/oauth/google/callback',
      undefined
    );
  });

  it('sets a binding cookie for authenticated account linking', async () => {
    const { GET } = await import('@/app/api/auth/link/google/route');
    const response = await GET(
      createMockNextRequest({
        url: 'http://localhost:3008/api/auth/link/google',
      })
    );

    expect(response.status).toBe(200);
    expect(response.cookies.get('google-oauth-binding')?.value).toBe('state-1');
    expect(mockStorePKCEState).toHaveBeenCalledWith(
      'state-1',
      'verifier',
      'google',
      'http://localhost:3008/api/auth/oauth/google/callback',
      'user-1'
    );
  });
});

describe('Google OAuth callback browser binding', () => {
  it('rejects a missing browser binding before consuming PKCE or calling Google', async () => {
    const { GET } = await import('@/app/api/auth/oauth/google/callback/route');
    const response = await GET(callbackRequest('state-1', undefined));

    expect(response.status).toBe(307);
    expect(mockRetrievePKCEState).not.toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalled();
    expect(mockLinkAccount).not.toHaveBeenCalled();
    expect(mockAuthenticate).not.toHaveBeenCalled();
    expect(response.cookies.get('google-oauth-binding')?.value).toBe('');
  });

  it('rejects a mismatched browser binding before consuming PKCE or calling Google', async () => {
    const { GET } = await import('@/app/api/auth/oauth/google/callback/route');
    const response = await GET(callbackRequest('state-1', 'other-state'));

    expect(response.status).toBe(307);
    expect(mockRetrievePKCEState).not.toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalled();
    expect(mockLinkAccount).not.toHaveBeenCalled();
    expect(mockAuthenticate).not.toHaveBeenCalled();
    expect(response.cookies.get('google-oauth-binding')?.value).toBe('');
  });

  it('allows linking when the callback session belongs to the stored user', async () => {
    mockRetrievePKCEState.mockResolvedValue({
      state: 'state-1',
      codeVerifier: 'verifier',
      provider: 'google',
      redirectUri: 'http://localhost:3008/api/auth/oauth/google/callback',
      linkToUserId: 'user-1',
    });

    const { GET } = await import('@/app/api/auth/oauth/google/callback/route');
    const response = await GET(callbackRequest());

    expect(response.status).toBe(307);
    expect(mockGetUserIdFromRequestOrCookies).toHaveBeenCalled();
    expect(mockLinkAccount).toHaveBeenCalledWith(
      'user-1',
      'google',
      expect.objectContaining({ id: 'google-user-123' }),
      expect.objectContaining({ accessToken: 'google-access-token' })
    );
    expect(mockAuthenticate).not.toHaveBeenCalled();
    expect(response.cookies.get('google-oauth-binding')?.value).toBe('');
  });

  it('rejects linking when the callback session belongs to another user', async () => {
    mockRetrievePKCEState.mockResolvedValue({
      state: 'state-1',
      codeVerifier: 'verifier',
      provider: 'google',
      redirectUri: 'http://localhost:3008/api/auth/oauth/google/callback',
      linkToUserId: 'user-1',
    });
    mockGetUserIdFromRequestOrCookies.mockResolvedValue('user-2');

    const { GET } = await import('@/app/api/auth/oauth/google/callback/route');
    const response = await GET(callbackRequest());

    expect(response.status).toBe(307);
    expect(mockGetUserIdFromRequestOrCookies).toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalled();
    expect(mockLinkAccount).not.toHaveBeenCalled();
    expect(mockAuthenticate).not.toHaveBeenCalled();
    expect(response.cookies.get('google-oauth-binding')?.value).toBe('');
  });
});

describe('Google OAuth sign-in callback', () => {
  it('rejects a PKCE state created for another provider', async () => {
    mockRetrievePKCEState.mockResolvedValue({
      state: 'state-1',
      codeVerifier: 'verifier',
      provider: 'github',
      redirectUri: 'http://localhost:3008/api/auth/oauth/google/callback',
    });

    const response =
      await import('@/app/api/auth/oauth/google/callback/route').then(
        ({ GET }) => GET(callbackRequest())
      );
    expect(response.status).toBe(307);
    expect(global.fetch).not.toHaveBeenCalled();
    expect(mockAuthenticate).not.toHaveBeenCalled();
  });

  it('persists the Google account before issuing the Synthex session', async () => {
    const { GET } = await import('@/app/api/auth/oauth/google/callback/route');
    const response = await GET(callbackRequest());

    expect(response.status).toBe(307);
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
    expect(response.cookies.get('auth-token')?.value).toBe(
      'synthex-session-token'
    );
    expect(response.cookies.get('google-oauth-binding')?.value).toBe('');
  });

  it('persists a new user and Google account in one nested write', async () => {
    mockFindUserByProviderAccount.mockResolvedValue(null);

    const { GET } = await import('@/app/api/auth/oauth/google/callback/route');
    const response = await GET(callbackRequest());

    expect(response.status).toBe(307);
    expect(mockCreateUser).toHaveBeenCalledWith({
      data: expect.objectContaining({
        accounts: {
          create: expect.objectContaining({
            provider: 'google',
            providerAccountId: 'google-user-123',
            accessToken: expect.stringMatching(/^enc:v1:/),
            refreshToken: expect.stringMatching(/^enc:v1:/),
          }),
        },
      }),
    });
    expect(mockCreateAccount).not.toHaveBeenCalled();
    expect(mockAuthenticate).toHaveBeenCalled();
  });

  it('does not issue a session when atomic new-user persistence fails', async () => {
    mockFindUserByProviderAccount.mockResolvedValue(null);
    mockCreateUser.mockRejectedValue(new Error('account write failed'));

    const { GET } = await import('@/app/api/auth/oauth/google/callback/route');
    const response = await GET(callbackRequest());

    expect(response.status).toBe(307);
    expect(response.cookies.get('auth-token')).toBeUndefined();
    expect(mockCreateAccount).not.toHaveBeenCalled();
    expect(mockAuthenticate).not.toHaveBeenCalled();
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

      const { GET } =
        await import('@/app/api/auth/oauth/google/callback/route');
      const response = await GET(callbackRequest());

      expect(response.status).toBeGreaterThanOrEqual(300);
      expect(response.status).toBeLessThan(400);
      expect(response.cookies.get('auth-token')).toBeUndefined();
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
    const response = await GET(callbackRequest());

    expect(response.status).toBe(307);
    expect(response.cookies.get('auth-token')).toBeUndefined();
    expect(mockAuthenticate).not.toHaveBeenCalled();
  });
});
