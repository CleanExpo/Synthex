import {
  resolveTelegramChannelConfig,
  sendEscalation,
  NotificationChannel,
  AlertManager,
  AlertSeverity,
  neutraliseSlackMentions,
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
  global.fetch = jest.fn(async () => textResponse('{"ok":true}')) as unknown as typeof fetch;
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
      requiresApproval: true,
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
      priority: 'urgent',
      requiresApproval: true,
    });

    expect(result.sent).toBe(true);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});

describe('approval routing policy', () => {
  beforeEach(() => {
    process.env.TELEGRAM_BOT_TOKEN = VALID_BOT_TOKEN;
    process.env.TELEGRAM_CHAT_ID = VALID_CHAT_ID;
    process.env.ALERT_SLACK_BOT_TOKEN = 'test-slack-token';
  });

  it.each([
    ['routine', false, '#ops-alerts'],
    ['urgent', false, '#ops-alerts'],
    ['routine', true, 'C0C8GB2TBMW'],
  ] as const)('reroutes %s approval=%s away from Telegram', async (priority, requiresApproval, channel) => {
    const result = await sendEscalation({
      channel: NotificationChannel.TELEGRAM,
      message: 'Review this alert',
      priority,
      requiresApproval,
    });
    expect(result).toMatchObject({ sent: true, channel: NotificationChannel.SLACK });
    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toBe('https://slack.com/api/chat.postMessage');
    expect(JSON.parse(init.body).channel).toBe(channel);
  });

  it('keeps explicit urgent approvals on Telegram', async () => {
    const result = await sendEscalation({
      channel: NotificationChannel.TELEGRAM,
      message: 'Urgent approval required',
      priority: 'urgent',
      requiresApproval: true,
    });
    expect(result).toMatchObject({ sent: true, channel: NotificationChannel.TELEGRAM });
    expect((global.fetch as jest.Mock).mock.calls[0][0]).toContain('api.telegram.org');
  });

  it('keeps owner identity independent of legacy outbound targets', () => {
    const result = resolveTelegramChannelConfig({
      TELEGRAM_BOT_TOKEN: VALID_BOT_TOKEN,
      TELEGRAM_OWNER_ID: '123456789',
    });
    expect(result.config?.chatId).toBe('123456789');
    const separated = resolveTelegramChannelConfig({
      TELEGRAM_BOT_TOKEN: VALID_BOT_TOKEN,
      TELEGRAM_OWNER_ID: '123456789',
      TELEGRAM_URGENT_APPROVAL_CHAT_ID: VALID_CHAT_ID,
    });
    expect(separated.config?.chatId).toBe(VALID_CHAT_ID);
  });

  it('neutralises user and mass mentions in all Slack content', async () => {
    const message = '<@U123ABC> <!here> @here @channel <!subteam^S123>';
    expect(neutraliseSlackMentions(message)).not.toMatch(/<[@!]|@here|@channel/);
    await sendEscalation({
      channel: NotificationChannel.SLACK,
      message,
      priority: 'routine',
      requiresApproval: true,
    });
    const payload = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(JSON.stringify(payload)).not.toMatch(/<[@!]|@here|@channel/);
    expect(payload).toMatchObject({ channel: 'C0C8GB2TBMW', link_names: false, parse: 'none' });
  });

  it('never sends an approval to the legacy ops webhook', async () => {
    delete process.env.ALERT_SLACK_BOT_TOKEN;
    delete process.env.ALERT_SLACK_APPROVALS_WEBHOOK_URL;
    process.env.ALERT_SLACK_WEBHOOK_URL = 'https://hooks.slack.com/services/test/ops';
    const result = await sendEscalation({
      channel: NotificationChannel.SLACK,
      message: 'Author input required',
      priority: 'routine',
      requiresApproval: true,
    });
    expect(result.sent).toBe(false);
    expect(result.error).toContain('approvals destination');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('uses the separate approvals webhook when configured', async () => {
    delete process.env.ALERT_SLACK_BOT_TOKEN;
    process.env.ALERT_SLACK_APPROVALS_WEBHOOK_URL = 'https://hooks.slack.com/services/test/approvals';
    await sendEscalation({
      channel: NotificationChannel.SLACK,
      message: 'Please review',
      priority: 'routine',
      requiresApproval: true,
    });
    expect((global.fetch as jest.Mock).mock.calls[0][0]).toBe(process.env.ALERT_SLACK_APPROVALS_WEBHOOK_URL);
  });

  it('treats Slack HTTP 200 with ok=false as a delivery failure', async () => {
    global.fetch = jest.fn(async () => textResponse('{"ok":false,"error":"channel_not_found"}')) as unknown as typeof fetch;
    const result = await sendEscalation({
      channel: NotificationChannel.SLACK,
      message: 'FYI',
      priority: 'routine',
    });
    expect(result.sent).toBe(false);
    expect(result.error).toContain('channel_not_found');
  });

  it('filters AlertManager Telegram traffic without hiding low-severity Slack asks', async () => {
    const manager = AlertManager.getInstance();
    for (const channel of manager.getChannels()) manager.removeChannel(channel.type);
    manager.addChannel({
      type: NotificationChannel.TELEGRAM,
      enabled: true,
      minSeverity: AlertSeverity.ERROR,
      config: { botToken: VALID_BOT_TOKEN, chatId: VALID_CHAT_ID },
    });
    manager.addChannel({
      type: NotificationChannel.SLACK,
      enabled: true,
      minSeverity: AlertSeverity.ERROR,
      config: { botToken: 'test-slack-token' },
    });
    await manager.sendAlert({
      title: 'Routine decision',
      message: 'Review',
      severity: AlertSeverity.INFO,
      source: 'test',
      requiresApproval: true,
    });
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body).channel).toBe('C0C8GB2TBMW');
    (global.fetch as jest.Mock).mockClear();
    await manager.sendAlert({
      title: 'Critical monitoring',
      message: 'FYI',
      severity: AlertSeverity.CRITICAL,
      source: 'test',
    });
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect((global.fetch as jest.Mock).mock.calls[0][0]).toBe('https://slack.com/api/chat.postMessage');
    (global.fetch as jest.Mock).mockClear();
    await manager.sendAlert({
      title: 'Urgent approval',
      message: 'Review now',
      severity: AlertSeverity.INFO,
      source: 'test',
      urgent: true,
      requiresApproval: true,
    });
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect((global.fetch as jest.Mock).mock.calls.map(([url]) => url)).toEqual(expect.arrayContaining([
      'https://slack.com/api/chat.postMessage',
      `https://api.telegram.org/bot${VALID_BOT_TOKEN}/sendMessage`,
    ]));
  });
});
