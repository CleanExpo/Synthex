import {
  resolveTelegramChannelConfig,
  sendEscalation,
  NotificationChannel,
  AlertManager,
  AlertSeverity,
  neutraliseSlackMentions,
  type Alert,
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
  global.fetch = jest.fn(async () =>
    textResponse('{"ok":true}')
  ) as unknown as typeof fetch;
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
  ] as const)(
    'reroutes %s approval=%s away from Telegram',
    async (priority, requiresApproval, channel) => {
      const result = await sendEscalation({
        channel: NotificationChannel.TELEGRAM,
        message: 'Review this alert',
        priority,
        requiresApproval,
      });
      expect(result).toMatchObject({
        sent: true,
        channel: NotificationChannel.SLACK,
      });
      expect(global.fetch).toHaveBeenCalledTimes(1);
      const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
      expect(url).toBe('https://slack.com/api/chat.postMessage');
      expect(JSON.parse(init.body).channel).toBe(channel);
    }
  );

  it('keeps explicit urgent approvals on Telegram', async () => {
    const result = await sendEscalation({
      channel: NotificationChannel.TELEGRAM,
      message: 'Urgent approval required',
      priority: 'urgent',
      requiresApproval: true,
    });
    expect(result).toMatchObject({
      sent: true,
      channel: NotificationChannel.TELEGRAM,
    });
    expect(global.fetch).toHaveBeenCalledTimes(2);
    const calls = (global.fetch as jest.Mock).mock.calls;
    expect(calls[0][0]).toBe('https://slack.com/api/chat.postMessage');
    expect(JSON.parse(calls[0][1].body).channel).toBe('C0C8GB2TBMW');
    expect(calls[1][0]).toContain('api.telegram.org');
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
    expect(neutraliseSlackMentions(message)).not.toMatch(
      /<[@!]|@here|@channel/
    );
    await sendEscalation({
      channel: NotificationChannel.SLACK,
      message,
      priority: 'routine',
      requiresApproval: true,
    });
    const payload = JSON.parse(
      (global.fetch as jest.Mock).mock.calls[0][1].body
    );
    expect(JSON.stringify(payload)).not.toMatch(/<[@!]|@here|@channel/);
    expect(payload).toMatchObject({
      channel: 'C0C8GB2TBMW',
      link_names: false,
      parse: 'none',
    });
  });

  it('never sends an approval to the legacy ops webhook', async () => {
    delete process.env.ALERT_SLACK_BOT_TOKEN;
    delete process.env.ALERT_SLACK_APPROVALS_WEBHOOK_URL;
    process.env.ALERT_SLACK_WEBHOOK_URL =
      'https://hooks.slack.com/services/test/ops';
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
    process.env.ALERT_SLACK_APPROVALS_WEBHOOK_URL =
      'https://hooks.slack.com/services/test/approvals';
    await sendEscalation({
      channel: NotificationChannel.SLACK,
      message: 'Please review',
      priority: 'routine',
      requiresApproval: true,
    });
    expect((global.fetch as jest.Mock).mock.calls[0][0]).toBe(
      process.env.ALERT_SLACK_APPROVALS_WEBHOOK_URL
    );
  });

  it('treats Slack HTTP 200 with ok=false as a delivery failure', async () => {
    global.fetch = jest.fn(async () =>
      textResponse('{"ok":false,"error":"channel_not_found"}')
    ) as unknown as typeof fetch;
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
    for (const channel of manager.getChannels())
      manager.removeChannel(channel.type);
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
    expect(
      JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body).channel
    ).toBe('C0C8GB2TBMW');
    (global.fetch as jest.Mock).mockClear();
    await manager.sendAlert({
      title: 'Critical monitoring',
      message: 'FYI',
      severity: AlertSeverity.CRITICAL,
      source: 'test',
    });
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect((global.fetch as jest.Mock).mock.calls[0][0]).toBe(
      'https://slack.com/api/chat.postMessage'
    );
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
    expect((global.fetch as jest.Mock).mock.calls.map(([url]) => url)).toEqual(
      expect.arrayContaining([
        'https://slack.com/api/chat.postMessage',
        `https://api.telegram.org/bot${VALID_BOT_TOKEN}/sendMessage`,
      ])
    );
  });
});

describe('approval routing policy (#984)', () => {
  const alert: Alert = {
    title: 'Approval needed',
    message: 'Please review',
    severity: AlertSeverity.INFO,
    source: 'test',
  };
  let manager: AlertManager;

  beforeEach(() => {
    process.env.ALERT_SLACK_BOT_TOKEN = 'test-slack-token';
    process.env.TELEGRAM_BOT_TOKEN = VALID_BOT_TOKEN;
    process.env.TELEGRAM_CHAT_ID = VALID_CHAT_ID;
    manager = AlertManager.getInstance();
    for (const channel of manager.getChannels())
      manager.removeChannel(channel.type);
    manager.addChannel({
      type: NotificationChannel.SLACK,
      enabled: true,
      minSeverity: AlertSeverity.WARNING,
      config: { botToken: 'test-slack-token' },
    });
    manager.addChannel({
      type: NotificationChannel.TELEGRAM,
      enabled: true,
      minSeverity: AlertSeverity.ERROR,
      config: { botToken: VALID_BOT_TOKEN, chatId: VALID_CHAT_ID },
    });
  });

  function payload(call = 0) {
    return JSON.parse((global.fetch as jest.Mock).mock.calls[call][1].body);
  }

  it.each([
    { urgent: false, requiresApproval: false },
    { urgent: true, requiresApproval: false },
    { urgent: false, requiresApproval: true },
    {},
  ])(
    'never sends non-approval or non-urgent alerts to Telegram: %j',
    async flags => {
      // Even critical severity and an opt-out-looking env value cannot bypass policy.
      process.env.ALERT_TELEGRAM_URGENT_ONLY = 'false';
      await manager.sendAlert({
        ...alert,
        severity: AlertSeverity.CRITICAL,
        ...flags,
      });
      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect((global.fetch as jest.Mock).mock.calls[0][0]).toBe(
        'https://slack.com/api/chat.postMessage'
      );
      expect(payload().channel).toBe(
        flags.requiresApproval ? 'C0C8GB2TBMW' : '#ops-alerts'
      );
    }
  );

  it('delivers low-severity urgent approvals to Slack and Telegram', async () => {
    await manager.sendAlert({ ...alert, urgent: true, requiresApproval: true });
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(payload().channel).toBe('C0C8GB2TBMW');
    expect(payload(1).chat_id).toBe(VALID_CHAT_ID);
  });

  it('does not tag users or broadcast mentions from any Slack text field', async () => {
    const mentions = '<@U123> <!here> <!channel> @here @channel @everyone';
    await manager.sendAlert({
      ...alert,
      requiresApproval: true,
      title: mentions,
      message: mentions,
      source: mentions,
      tags: [mentions],
    });
    const sent = JSON.stringify(payload());
    expect(sent).not.toMatch(/<@U|<!here>|<!channel>|@here|@channel|@everyone/);
    expect(payload()).toMatchObject({
      channel: 'C0C8GB2TBMW',
      parse: 'none',
      link_names: false,
    });
  });

  it.each([
    [NotificationChannel.TELEGRAM, 'routine', true, 'C0C8GB2TBMW'],
    [NotificationChannel.TELEGRAM, 'urgent', false, '#ops-alerts'],
    [NotificationChannel.LINEAR, 'routine', false, '#ops-alerts'],
  ] as const)(
    'reroutes %s %s escalations to Slack',
    async (channel, priority, requiresApproval, target) => {
      const result = await sendEscalation({
        channel,
        message: 'Escalation',
        priority,
        requiresApproval,
      });
      expect(result).toEqual({
        sent: true,
        channel: NotificationChannel.SLACK,
      });
      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(payload().channel).toBe(target);
    }
  );

  it('also posts urgent Telegram approval asks to Slack approvals', async () => {
    await sendEscalation({
      channel: NotificationChannel.TELEGRAM,
      message: 'Approve?',
      priority: 'urgent',
      requiresApproval: true,
    });
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(payload().channel).toBe('C0C8GB2TBMW');
    expect(payload(1).chat_id).toBe(VALID_CHAT_ID);
  });

  it('cannot use Telegram as a fallback for monitoring', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(textResponse('{}', 500));
    await sendEscalation({
      channel: NotificationChannel.SLACK,
      message: 'Monitor',
      priority: 'urgent',
      fallback: NotificationChannel.TELEGRAM,
    });
    expect(global.fetch).toHaveBeenCalledTimes(2);
    for (const [url] of (global.fetch as jest.Mock).mock.calls)
      expect(url).toContain('slack.com');
  });

  it('reports Slack API failures even for HTTP 200', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      textResponse('{"ok":false,"error":"channel_not_found"}')
    );
    const result = await sendEscalation({
      channel: NotificationChannel.SLACK,
      message: 'Ask',
      priority: 'routine',
      requiresApproval: true,
    });
    expect(result.sent).toBe(false);
    expect(result.error).toContain('channel_not_found');
  });

  it('uses separate channel-bound webhooks and refuses the approvals webhook for FYI', async () => {
    delete process.env.ALERT_SLACK_BOT_TOKEN;
    process.env.ALERT_SLACK_APPROVALS_WEBHOOK_URL =
      'https://hooks.slack.test/approvals';
    delete process.env.ALERT_SLACK_WEBHOOK_URL;
    process.env.ALERT_SLACK_OPS_WEBHOOK_URL = 'https://hooks.slack.test/ops';
    await sendEscalation({
      channel: NotificationChannel.SLACK,
      message: 'Ask',
      priority: 'routine',
      requiresApproval: true,
    });
    await sendEscalation({
      channel: NotificationChannel.SLACK,
      message: 'FYI',
      priority: 'routine',
    });
    expect((global.fetch as jest.Mock).mock.calls.map(call => call[0])).toEqual(
      ['https://hooks.slack.test/approvals', 'https://hooks.slack.test/ops']
    );
    delete process.env.ALERT_SLACK_OPS_WEBHOOK_URL;
    expect(
      (
        await sendEscalation({
          channel: NotificationChannel.SLACK,
          message: 'FYI',
          priority: 'routine',
        })
      ).sent
    ).toBe(false);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('does not send a Telegram channel test as a routine alert', async () => {
    expect(
      (await manager.testChannel(NotificationChannel.TELEGRAM)).success
    ).toBe(false);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('keeps dry runs free of network requests', async () => {
    process.env.HERMES_ESCALATION_DRY_RUN = 'true';
    expect(
      await sendEscalation({
        channel: NotificationChannel.TELEGRAM,
        message: 'Digest',
        priority: 'routine',
      })
    ).toEqual({ sent: true, channel: NotificationChannel.SLACK });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('resolves the owner destination independently of legacy outbound chat IDs', () => {
    expect(
      resolveTelegramChannelConfig({
        TELEGRAM_BOT_TOKEN: VALID_BOT_TOKEN,
        TELEGRAM_OWNER_ID: '123456789',
        TELEGRAM_CHAT_ID: '-1009999999999',
      }).config?.chatId
    ).toBe('123456789');
    expect(
      resolveTelegramChannelConfig({
        TELEGRAM_BOT_TOKEN: VALID_BOT_TOKEN,
        TELEGRAM_OWNER_ID: '123456789',
      }).valid
    ).toBe(true);
  });
  it.each([true, false])(
    'only retries Slack after Telegram failure when its first delivery failed: %s',
    async slackDelivered => {
      const fetch = global.fetch as jest.Mock;
      fetch
        .mockResolvedValueOnce(
          textResponse(
            slackDelivered
              ? '{"ok":true}'
              : '{"ok":false,"error":"unavailable"}'
          )
        )
        .mockResolvedValueOnce(textResponse('{}', 500))
        .mockResolvedValueOnce(textResponse('{"ok":true}'));
      const result = await sendEscalation({
        channel: NotificationChannel.TELEGRAM,
        message: 'Approve?',
        priority: 'urgent',
        requiresApproval: true,
        fallback: NotificationChannel.SLACK,
      });
      expect(result.sent).toBe(false);
      expect(fetch).toHaveBeenCalledTimes(slackDelivered ? 2 : 3);
      expect(fetch.mock.calls[0][0]).toContain('slack.com');
      expect(fetch.mock.calls[1][0]).toContain('api.telegram.org');
      if (!slackDelivered)
        expect(fetch.mock.calls[2][0]).toContain('slack.com');
    }
  );
});
