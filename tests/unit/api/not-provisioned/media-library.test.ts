/** @jest-environment node */
/**
 * /api/media/library — honest 503 while media_assets / media_folders are not
 * provisioned.
 *
 * lib/services/media-library.ts rejects every call with
 * MediaLibraryNotProvisionedError (no Prisma model backs either table). The
 * route never caught it, so every method answered a generic 500. It now
 * answers 503 FEATURE_NOT_PROVISIONED naming the missing table; any other
 * error keeps the 500.
 *
 * SEAM: the real route and the real service; only auth, audit and logging are
 * faked.
 */

jest.mock('@/lib/security/api-security-checker', () => ({
  APISecurityChecker: {
    check: async () => ({ allowed: true, context: { userId: 'u1' } }),
    createSecureResponse: (body: object, status = 200) =>
      new Response(JSON.stringify(body), { status }),
  },
  DEFAULT_POLICIES: {
    AUTHENTICATED_WRITE: 'AUTHENTICATED_WRITE',
    AUTHENTICATED_READ: 'AUTHENTICATED_READ',
  },
}));
jest.mock('@/lib/security/audit-logger', () => ({
  auditLogger: { logData: async () => undefined },
}));
jest.mock('@/lib/logger', () => ({
  logger: { info: () => {}, warn: () => {}, error: () => {} },
}));

import { GET, POST, PUT, DELETE } from '@/app/api/media/library/route';
import { mediaLibraryService } from '@/lib/services/media-library';
import { createMockNextRequest } from '../../../helpers/mock-request';

const BASE = 'https://synthex.example/api/media/library';

async function expect503(res: Response, table: string) {
  expect(res.status).toBe(503);
  const json = await res.json();
  expect(json.error).toBe('FEATURE_NOT_PROVISIONED');
  expect(json.message).toContain(table);
}

describe('/api/media/library while not provisioned', () => {
  it('GET list → 503 naming media_assets', async () => {
    await expect503(
      await GET(createMockNextRequest({ url: BASE })),
      'media_assets'
    );
  });

  it('GET folders → 503 naming media_folders', async () => {
    await expect503(
      await GET(createMockNextRequest({ url: `${BASE}?folders=true` })),
      'media_folders'
    );
  });

  it('POST asset → 503', async () => {
    await expect503(
      await POST(
        createMockNextRequest({
          method: 'POST',
          url: BASE,
          body: {
            type: 'image',
            provider: 'gemini',
            url: 'https://x.test/a.png',
          },
        })
      ),
      'media_assets'
    );
  });

  it('PUT asset → 503', async () => {
    await expect503(
      await PUT(
        createMockNextRequest({
          method: 'PUT',
          url: BASE,
          body: { id: 'a1', isFavorite: true },
        })
      ),
      'media_assets'
    );
  });

  it('DELETE asset → 503', async () => {
    await expect503(
      await DELETE(
        createMockNextRequest({
          method: 'DELETE',
          url: BASE,
          body: { id: 'a1' },
        })
      ),
      'media_assets'
    );
  });

  it('any other error keeps the 500', async () => {
    jest
      .spyOn(mediaLibraryService, 'getAssets')
      .mockRejectedValueOnce(new Error('connection reset'));
    const res = await GET(createMockNextRequest({ url: BASE }));
    expect(res.status).toBe(500);
  });
});
