import { createMockNextRequest } from '../../helpers/mock-request';

const mockSecurityCheck = jest.fn();

jest.mock('@/lib/security/api-security-checker', () => ({
  APISecurityChecker: {
    check: (...args: unknown[]) => mockSecurityCheck(...args),
  },
  DEFAULT_POLICIES: {
    AUTHENTICATED_READ: { requireAuth: true, allowRead: true },
  },
}));

import { GET } from '@/app/api/command-centre/hermes-handoff/route';

const URL = 'http://localhost:3008/api/command-centre/hermes-handoff';
const ORIGINAL_ENV = process.env;

describe('GET /api/command-centre/hermes-handoff', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...ORIGINAL_ENV };
    mockSecurityCheck.mockResolvedValue({
      allowed: true,
      context: { userId: 'user-1' },
    });
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it('rejects unauthenticated requests', async () => {
    mockSecurityCheck.mockResolvedValueOnce({
      allowed: false,
      error: 'Unauthorized',
      context: {},
    });

    const response = await GET(createMockNextRequest({ url: URL }) as never);

    expect(response.status).toBe(401);
  });

  it('reports ready when Hermes channels are configured', async () => {
    process.env.TELEGRAM_BOT_TOKEN = 't';
    process.env.TELEGRAM_CHAT_ID = 'c';
    process.env.WHATSAPP_ACCESS_TOKEN = 'w';
    process.env.WHATSAPP_PHONE_NUMBER_ID = 'p';

    const response = await GET(createMockNextRequest({ url: URL }) as never);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe('ready');
    expect(body.missing).toEqual([]);
    expect(typeof body.checkedAt).toBe('string');
  });

  it('reports blocked with missing-config detail when runtime is unavailable', async () => {
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_CHAT_ID;
    delete process.env.WHATSAPP_ACCESS_TOKEN;
    delete process.env.WHATSAPP_PHONE_NUMBER_ID;

    const response = await GET(createMockNextRequest({ url: URL }) as never);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe('blocked');
    expect(body.missing.length).toBeGreaterThan(0);
  });

  it('never returns a secret value in the response', async () => {
    process.env.TELEGRAM_BOT_TOKEN = 'super-secret-token-value';
    process.env.TELEGRAM_CHAT_ID = 'chat-secret';
    process.env.WHATSAPP_ACCESS_TOKEN = 'wa-secret-value';
    process.env.WHATSAPP_PHONE_NUMBER_ID = 'phone-secret';

    const response = await GET(createMockNextRequest({ url: URL }) as never);
    const raw = JSON.stringify(await response.json());

    expect(raw).not.toContain('super-secret-token-value');
    expect(raw).not.toContain('wa-secret-value');
  });
});
