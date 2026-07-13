import { NextRequest } from 'next/server';

import { APISecurityChecker } from '@/lib/security/api-security-checker';

/**
 * Regression: the body-size check (policy.maxBodySize) must NOT consume the
 * request body. When a POST has no content-length header, getBodySize used to
 * `await request.text()` on the ORIGINAL request, so the route's later
 * `request.json()` threw "Body is unusable: Body has already been read".
 * Reproduced live on POST /api/ai-websites/generate. Fixed by reading a clone.
 *
 * Models undici's one-shot body: each reader can be consumed once; clone()
 * yields an INDEPENDENT reader. So reading a clone leaves the original intact,
 * while reading the original directly would break the route.
 */
function makeConsumableRequest(bodyObj: unknown): NextRequest {
  const payload = JSON.stringify(bodyObj);
  const oneShot = () => {
    let read = false;
    const guard = () => {
      if (read) {
        throw new TypeError('Body is unusable: Body has already been read');
      }
      read = true;
    };
    return {
      text: async () => {
        guard();
        return payload;
      },
      json: async () => {
        guard();
        return JSON.parse(payload);
      },
    };
  };

  const original = oneShot();
  const request = {
    method: 'POST',
    url: 'https://example.com/api/test',
    headers: new Headers(), // deliberately NO content-length
    ip: '127.0.0.1',
    nextUrl: { pathname: '/api/test' },
    body: {}, // truthy so the maxBodySize gate runs getBodySize
    text: original.text,
    json: original.json,
    clone: () => oneShot(),
  };
  return request as unknown as NextRequest;
}

describe('APISecurityChecker — body-size check does not consume the body', () => {
  it('leaves the body readable for the route when there is no content-length', async () => {
    const request = makeConsumableRequest({ hello: 'world' });
    expect(request.headers.get('content-length')).toBeNull();

    const result = await APISecurityChecker.check(request, {
      requireAuth: false,
      requireHTTPS: false,
      maxBodySize: 1_048_576,
    });
    expect(result.allowed).toBe(true);

    // The route must still be able to read the body after the security check.
    await expect(request.json()).resolves.toEqual({ hello: 'world' });
  });
});
