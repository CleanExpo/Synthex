import {
  resolveTelegramChannelConfig,
  sendEscalation,
  NotificationChannel,
} from '@/lib/alerts/notification-channels';

// Keep a copy of the process env shape for deterministic tests.
const BASE_ENV = { ...process.env };
const VALID_BOT_TOKEN = '123456789:ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghi';
const VALID_CHAT_ID = '-1001234567890';

const originalFetch = global.fetch;

function textResponse(body: string, status = 200): Response {
  const response = new Response(body, {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

  Object.defineProperty(response, 'ok', {
    value: status >= 200 && status < 300,
    configurable: true,
  });

  return response;
}

function resetEnv() {
  for (const key of Object.keys(process.env)) {
    delete process.env[key];
  }
  for (const [key, value] of Object.entries(BASE_ENV)) {
    if (value === undefined) continue;
    process.env[key] = value;
  }
  delete process.env.HERMES_ESCALATION_DRY_RUN;
}

beforeEach(() => {
  resetEnv();
  jest.resetAllMocks();
  global.fetch = jest.fn(async () => textResponse('{}')) as unknown as typeof fetch;
});

afterAll(() => {
  resetEnv();
  global.fetch = originalFetch;
});

describe('resolveTelegramChannelConfig', () => {
  it('accepts valid legacy Telegram credentials', () => {
    const result = resolveTelegramChannelConfig({
      TELEGRAM_BOT_TOKEN: VALID_BOT_TOKEN,
      TELEGRAM_CHAT_ID: VALID_CHAT_ID,
    });

    expect(result.valid).toBe(true);
    expect(result.source).toBe('legacy');
    expect(result.config).toMatchObject({
      botToken: VALID_BOT_TOKEN,
      chatId: VALID_CHAT_ID,
      parseMode: 'MarkdownV2',
    });
  });

  it('falls back to SYNTHEX credentials when legacy values are invalid', () => {
    const result = resolveTelegramChannelConfig({
      TELEGRAM_BOT_TOKEN: 'invalid-token',
      TELEGRAM_CHAT_ID: 'invalid-chat',
      SYNTHEX_TELEGRAM_BOT_TOKEN: VALID_BOT_TOKEN,
      SYNTHEX_TELEGRAM_CHAT_ID: VALID_CHAT_ID,
    });

    expect(result.valid).toBe(true);
    expect(result.source).toBe('synthex');
    expect(result.config?.botToken).toBe(VALID_BOT_TOKEN);
  });

  it('flags invalid bot token format and blocks Telegram send', async () => {
    process.env.TELEGRAM_BOT_TOKEN = 'bad-token';
    process.env.TELEGRAM_CHAT_ID = VALID_CHAT_ID;

    const result = await sendEscalation({
      channel: NotificationChannel.TELEGRAM,
      message: 'Telegram outage test',
      priority: 'urgent',
    });

    expect(result.sent).toBe(false);
    expect(result.error).toContain('format invalid');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('sends to Telegram when credentials are valid', async () => {
    process.env.TELEGRAM_BOT_TOKEN = VALID_BOT_TOKEN;
    process.env.TELEGRAM_CHAT_ID = VALID_CHAT_ID;

    const result = await sendEscalation({
      channel: NotificationChannel.TELEGRAM,
      message: 'Telegram outage test',
      priority: 'routine',
    });

    expect(result.sent).toBe(true);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});
