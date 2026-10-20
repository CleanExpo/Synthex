/**
 * SEAM: POST handler of app/api/media/quote/route.ts called with a mock request.
 * Catches: 401 without a caller, 403 without an organisation, 400 on bad input,
 * 200 quote shape, 503 when the budget cannot be read (never a zero quote), and
 * no write on the path. Misses: the real auth stack and database (mocked).
 */
const mockUserId = jest.fn();
const mockFindUser = jest.fn();
const mockQuote = jest.fn();
const mockWrite = jest.fn();

jest.mock('@/lib/auth/jwt-utils', () => ({
  getUserIdFromRequestOrCookies: (...a: unknown[]) => mockUserId(...a),
}));
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    user: { findUnique: (...a: unknown[]) => mockFindUser(...a) },
    $executeRaw: (...a: unknown[]) => mockWrite('executeRaw', ...a),
    mediaSpendEvent: { createMany: (...a: unknown[]) => mockWrite(...a) },
  },
}));
jest.mock('@/lib/logger', () => ({
  logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));
jest.mock('@/lib/services/ai/media-quote', () => {
  const actual = jest.requireActual('@/lib/services/ai/media-quote');
  return { ...actual, quoteMedia: (...a: unknown[]) => mockQuote(...a) };
});

import { POST } from '@/app/api/media/quote/route';
import {
  MediaQuoteUnavailableError,
  MediaQuoteUnpriceableError,
} from '@/lib/services/ai/media-quote';
import { createMockNextRequest } from '../../helpers/mock-request';

const req = (body: object, headers: Record<string, string> = {}) =>
  createMockNextRequest({
    method: 'POST',
    url: 'http://localhost:3000/api/media/quote',
    body,
    headers,
  }) as never;

const goodImage = { kind: 'image', count: 2 };
const quote = {
  kind: 'image',
  model: 'flux-pro',
  count: 2,
  unitPriceUsd: 0.05,
  totalUsd: 0.1,
  holdUsd: 0.3,
  remainingBudgetUsd: 14,
  wouldBeAdmitted: true,
};

describe('POST /api/media/quote', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUserId.mockResolvedValue('user-1');
    mockFindUser.mockResolvedValue({
      organizationId: 'org-1',
      teamMemberships: [],
    });
    mockQuote.mockResolvedValue(quote);
  });

  it('401s with no caller, before touching the quote', async () => {
    mockUserId.mockResolvedValue(null);
    const res = await POST(req(goodImage));
    expect(res.status).toBe(401);
    expect(mockQuote).not.toHaveBeenCalled();
  });

  it('403s when the caller has no organisation', async () => {
    mockFindUser.mockResolvedValue({
      organizationId: null,
      teamMemberships: [],
    });
    const res = await POST(req(goodImage));
    expect(res.status).toBe(403);
    expect(mockQuote).not.toHaveBeenCalled();
  });

  it('400s on invalid input', async () => {
    const res = await POST(req({ kind: 'image', count: 99 }));
    expect(res.status).toBe(400);
    expect(mockQuote).not.toHaveBeenCalled();
  });

  it('400s on an unknown kind (text keeps its own cost cap)', async () => {
    const res = await POST(req({ kind: 'text', count: 1 }));
    expect(res.status).toBe(400);
  });

  it('quotes for the caller organisation, ignoring any organisation in the body', async () => {
    const res = await POST(req({ ...goodImage, organizationId: 'org-evil' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(quote);
    expect(mockQuote.mock.calls[0][0].organizationId).toBe('org-1');
    expect(mockQuote.mock.calls[0][0].initiatedBy).toBe('studio');
  });

  it('treats a machine key as an agent-initiated quote', async () => {
    await POST(req(goodImage, { authorization: 'Bearer smk_x' }));
    expect(mockQuote.mock.calls[0][0].initiatedBy).toBe('mcp');
  });

  it('503s when the budget cannot be read, never a zero quote', async () => {
    mockQuote.mockRejectedValue(
      new MediaQuoteUnavailableError(new Error('db'))
    );
    const res = await POST(req(goodImage));
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.totalUsd).toBeUndefined();
    expect(body.error).toBe('FEATURE_NOT_PROVISIONED');
  });

  it('422s a request that cannot be priced', async () => {
    mockQuote.mockRejectedValue(
      new MediaQuoteUnpriceableError(
        new Error('No draft model supports aspect=1:1')
      )
    );
    const res = await POST(
      req({
        kind: 'video',
        tier: 'draft',
        aspectRatio: '1:1',
        durationSeconds: 5,
        variants: 1,
      })
    );
    expect(res.status).toBe(422);
  });

  it('writes nothing', async () => {
    await POST(req(goodImage));
    expect(mockWrite).not.toHaveBeenCalled();
  });
});
