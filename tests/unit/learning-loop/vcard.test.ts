/**
 * Public vCard: text values escaped (incl. CR), URL values left as working URIs, rate limited.
 */
import { NextRequest } from 'next/server';

let mockPage: unknown = null;
let mockLimited = 0;
jest.mock('@/lib/prisma', () => ({
  prisma: { linkBioPage: { findFirst: async () => mockPage } },
}));
jest.mock('@/lib/rate-limit', () => ({
  readDefault: async (
    _req: unknown,
    handler: () => Promise<Response>
  ): Promise<Response> => {
    mockLimited += 1;
    return handler();
  },
}));

import { GET } from '@/app/api/card/[slug]/vcard/route';

const call = () =>
  GET(new NextRequest('http://localhost:3000/api/card/phill/vcard'), {
    params: Promise.resolve({ slug: 'phill' }),
  });

beforeEach(() => {
  mockPage = null;
  mockLimited = 0;
});

it('escapes CR/LF in text values and leaves commas and semicolons in URLs working', async () => {
  mockPage = {
    title: 'Phill\r\nMcGurk; Unite',
    bio: 'Line one\rLine two',
    links: [{ title: 'Maps, reviews', url: 'https://example.com/a,b;c' }],
  };
  const body = await (await call()).text();
  expect(body).toContain(String.raw`FN:Phill\nMcGurk\; Unite`);
  expect(body).toContain(String.raw`NOTE:Line one\nLine two`);
  expect(body.replace(/\r\n/g, '')).not.toContain('\r');
  expect(body).toContain('item1.URL:https://example.com/a,b;c\r\n');
  expect(body).toContain(String.raw`item1.X-ABLabel:Maps\, reviews`);
});

it('goes through the readDefault rate limiter', async () => {
  await call();
  expect(mockLimited).toBe(1);
});
