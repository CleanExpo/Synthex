/**
 * Public card events route: no personal data, same-origin only, honest
 * NOT_PROVISIONED, and the organisation is never taken from the request.
 */
import { NextRequest } from 'next/server';

const recordCardEvent = jest.fn();
const findCardBinding = jest.fn();
jest.mock('@/lib/auth/rate-limit', () => ({
  checkRateLimit: async () => ({ ok: true }),
  extractClientIp: () => '203.0.113.1',
}));
jest.mock('@/lib/learning-loop/store', () => {
  const actual = jest.requireActual('@/lib/learning-loop/store');
  return {
    ...actual,
    findCardBinding: (...a: unknown[]) => findCardBinding(...a),
    recordCardEvent: (...a: unknown[]) => recordCardEvent(...a),
  };
});
jest.mock('@/lib/logger', () => ({
  logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));

import { POST } from '@/app/api/card/[slug]/events/route';
import { LearningLoopError } from '@/lib/learning-loop/store';

const ORIGIN = 'http://localhost:3000';
const good = {
  sessionId: '7d444840-9dc0-41b0-a6c4-5d1f4b0d8b3e',
  type: 'need_selected',
  variant: 'story',
  needId: 'maps',
};
const binding = {
  organizationId: 'org-from-authorisation',
  workspaceId: 'ws',
  goalContractId: 'gc',
  experimentId: 'exp',
  dataClass: 'preview',
  bioPageOwnerId: 'u',
};

function call(
  body: unknown,
  {
    origin = ORIGIN,
    slug = 'phill',
  }: { origin?: string | null; slug?: string } = {}
) {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
  };
  if (origin) headers.origin = origin;
  const req = new NextRequest(`${ORIGIN}/api/card/${slug}/events`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  return POST(req, { params: Promise.resolve({ slug }) });
}

beforeEach(() => {
  recordCardEvent.mockReset().mockResolvedValue({ id: 'evt-1' });
  findCardBinding.mockReset().mockResolvedValue(binding);
});

it('records a valid event under the organisation from the authorisation row', async () => {
  const res = await call({ ...good, organizationId: undefined });
  expect(res.status).toBe(201);
  expect(recordCardEvent).toHaveBeenCalledWith(
    binding,
    expect.objectContaining({ type: 'need_selected' })
  );
});

it('rejects any extra field, so an email or an organisation id cannot be smuggled in', async () => {
  expect((await call({ ...good, email: 'a@b.com' })).status).toBe(400);
  expect((await call({ ...good, organizationId: 'org-attacker' })).status).toBe(
    400
  );
  expect(recordCardEvent).not.toHaveBeenCalled();
});

it('refuses a request with no origin or a foreign origin', async () => {
  expect((await call(good, { origin: null })).status).toBe(403);
  expect((await call(good, { origin: 'https://evil.example' })).status).toBe(
    403
  );
});

it('rejects a session id that is not a random uuid, an unknown need, or a rating on the wrong event', async () => {
  expect((await call({ ...good, sessionId: 'phill@example.com' })).status).toBe(
    400
  );
  expect((await call({ ...good, needId: 'free-prize' })).status).toBe(400);
  expect((await call({ ...good, rating: 'useful' })).status).toBe(400);
  expect((await call({ ...good, type: 'action_rated' })).status).toBe(400);
});

it('answers 503 FEATURE_NOT_PROVISIONED when the card has no authorised experiment', async () => {
  findCardBinding.mockRejectedValue(
    new LearningLoopError('NOT_PROVISIONED', 'none')
  );
  const res = await call(good);
  expect(res.status).toBe(503);
  expect((await res.json()).error).toBe('FEATURE_NOT_PROVISIONED');
});

it('refuses a card whose page sits in another organisation', async () => {
  findCardBinding.mockRejectedValue(
    new LearningLoopError('FORBIDDEN', 'cross-org')
  );
  expect((await call(good)).status).toBe(409);
  expect(recordCardEvent).not.toHaveBeenCalled();
});

it('404s an unknown card', async () => {
  expect((await call(good, { slug: 'nobody' })).status).toBe(404);
});
