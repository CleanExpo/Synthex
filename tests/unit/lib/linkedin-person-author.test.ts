/**
 * LinkedIn personal-profile author URN.
 *
 * Synthex connects LinkedIn with OpenID scopes (openid profile email
 * w_member_social). Those scopes cannot read the legacy `/v2/me` endpoint —
 * every call returned 403 "Not enough permissions to access: me.GET.NO_VERSION"
 * and 100 production posts failed on it. The member id is the OpenID `sub`,
 * which the OAuth callback already stores as platformUserId.
 */

import {
  describe,
  it,
  expect,
  jest,
  beforeEach,
  afterEach,
} from '@jest/globals';
import { LinkedInService } from '@/lib/social/linkedin-service';

describe('LinkedInService person author URN', () => {
  const realFetch = global.fetch;
  let calls: string[];
  let postedAuthor: string | undefined;
  let userInfoSub: string | undefined;

  beforeEach(() => {
    calls = [];
    postedAuthor = undefined;
    userInfoSub = 'fetchedSub42';
    global.fetch = jest.fn(async (input: unknown, init?: RequestInit) => {
      const url = String(input);
      calls.push(url);
      if (url.endsWith('/v2/me') || url.includes('/v2/me?')) {
        return {
          ok: false,
          status: 403,
          headers: new Headers(),
          text: async () => '{"status":403,"code":"ACCESS_DENIED"}',
          json: async () => ({ status: 403 }),
        } as unknown as Response;
      }
      if (url.endsWith('/v2/userinfo')) {
        return {
          ok: true,
          status: 200,
          headers: new Headers(),
          json: async () => ({ sub: userInfoSub }),
        } as unknown as Response;
      }
      if (url.endsWith('/v2/ugcPosts')) {
        postedAuthor = JSON.parse(String(init?.body)).author;
        return {
          ok: true,
          status: 201,
          headers: new Headers({ 'x-restli-id': 'urn:li:share:1' }),
          json: async () => ({ id: 'urn:li:share:1' }),
        } as unknown as Response;
      }
      throw new Error(`unexpected fetch ${url}`);
    }) as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = realFetch;
  });

  function service(platformUserId?: string) {
    const s = new LinkedInService();
    s.initialize({
      accessToken: 'access-token',
      platformUserId,
      expiresAt: new Date('2099-01-01T00:00:00.000Z'),
    });
    return s;
  }

  it('posts as the stored OpenID sub without a profile lookup', async () => {
    const result = await service('aBcD-123_xyz').createPost({ text: 'hi' });

    expect(result.success).toBe(true);
    expect(postedAuthor).toBe('urn:li:person:aBcD-123_xyz');
    expect(calls.some(u => u.includes('/v2/me'))).toBe(false);
  });

  it('falls back to /v2/userinfo when no member id is stored', async () => {
    const result = await service().createPost({ text: 'hi' });

    expect(result.success).toBe(true);
    expect(postedAuthor).toBe('urn:li:person:fetchedSub42');
    expect(calls.some(u => u.includes('/v2/me'))).toBe(false);
  });

  it('fails without posting when /v2/userinfo has no sub', async () => {
    userInfoSub = undefined;
    const result = await service().createPost({ text: 'hi' });

    expect(result.success).toBe(false);
    expect(postedAuthor).toBeUndefined();
  });

  it('validates credentials against /v2/userinfo', async () => {
    await expect(service('aBcD-123_xyz').validateCredentials()).resolves.toBe(
      true
    );
    expect(calls.some(u => u.includes('/v2/me'))).toBe(false);
  });
});
