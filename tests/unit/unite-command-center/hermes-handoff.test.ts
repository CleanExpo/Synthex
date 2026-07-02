import {
  buildHermesHandoffPacket,
  buildHermesHandoffReadiness,
  collectHermesRuntimeStatus,
} from '@/lib/unite-command-center';

describe('buildHermesHandoffPacket', () => {
  it('allows Telegram draft intake when gateway and Telegram are ready', () => {
    const packet = buildHermesHandoffPacket({
      gatewayRunning: true,
      telegramConfigured: true,
      whatsappConfigured: false,
      scheduledJobsActive: 47,
    });

    expect(packet.status).toBe('ready');
    expect(packet.sourceMap).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          channel: 'telegram',
          mode: 'draft_bridge',
          route: '/api/command-centre/intake',
        }),
        expect.objectContaining({
          channel: 'whatsapp',
          mode: 'blocked',
        }),
      ])
    );
  });

  it('keeps all unsafe execution categories blocked', () => {
    const packet = buildHermesHandoffPacket({
      gatewayRunning: true,
      telegramConfigured: true,
      whatsappConfigured: true,
      scheduledJobsActive: 47,
    });

    expect(packet.blockedActions).toEqual(
      expect.arrayContaining([
        'production deployments',
        'public publishing',
        'ad spend',
        'private data broadcast',
        'unaudited code commits',
      ])
    );
  });

  it('blocks live intake when the Hermes gateway is down', () => {
    const packet = buildHermesHandoffPacket({
      gatewayRunning: false,
      telegramConfigured: true,
      whatsappConfigured: true,
      scheduledJobsActive: 0,
    });

    expect(packet.status).toBe('blocked');
    expect(
      packet.sourceMap.find(entry => entry.channel === 'telegram')
    ).toMatchObject({ mode: 'blocked' });
    expect(packet.nextCheckpoint).toContain('Restore Hermes gateway');
  });

  it('blocks WhatsApp draft intake when the gateway is down', () => {
    const packet = buildHermesHandoffPacket({
      gatewayRunning: false,
      telegramConfigured: false,
      whatsappConfigured: true,
      scheduledJobsActive: 0,
    });

    expect(
      packet.sourceMap.find(entry => entry.channel === 'whatsapp')
    ).toMatchObject({ mode: 'blocked' });
  });
});

describe('collectHermesRuntimeStatus', () => {
  it('reads presence only — never a secret value', () => {
    const runtime = collectHermesRuntimeStatus({
      TELEGRAM_BOT_TOKEN: 'super-secret-token',
      TELEGRAM_CHAT_ID: '12345',
      WHATSAPP_ACCESS_TOKEN: 'wa-secret',
      WHATSAPP_PHONE_NUMBER_ID: '67890',
    });

    expect(runtime).toEqual({
      gatewayRunning: true,
      telegramConfigured: true,
      whatsappConfigured: true,
      scheduledJobsActive: 0,
    });
  });
});

describe('buildHermesHandoffReadiness', () => {
  it('reports ready with no missing config when every channel is present', () => {
    const readiness = buildHermesHandoffReadiness({
      TELEGRAM_BOT_TOKEN: 't',
      TELEGRAM_CHAT_ID: 'c',
      WHATSAPP_ACCESS_TOKEN: 'w',
      WHATSAPP_PHONE_NUMBER_ID: 'p',
    });

    expect(readiness.status).toBe('ready');
    expect(readiness.missing).toEqual([]);
    expect(readiness.sourceOfTruth).toMatch(/no secret values/i);
  });

  it('blocks and lists every missing channel when config is absent', () => {
    const readiness = buildHermesHandoffReadiness({});

    expect(readiness.status).toBe('blocked');
    expect(readiness.runtime.gatewayRunning).toBe(false);
    expect(readiness.missing).toEqual(
      expect.arrayContaining([
        expect.stringContaining('TELEGRAM_BOT_TOKEN'),
        expect.stringContaining('WHATSAPP_ACCESS_TOKEN'),
      ])
    );
  });

  it('reports blocked when the runtime gateway is unavailable even with Telegram chat set', () => {
    const readiness = buildHermesHandoffReadiness({
      TELEGRAM_CHAT_ID: 'c',
    });

    expect(readiness.runtime.gatewayRunning).toBe(false);
    expect(readiness.status).toBe('blocked');
  });

  it('handles a partial-channel state: Telegram ready, WhatsApp missing', () => {
    const readiness = buildHermesHandoffReadiness({
      TELEGRAM_BOT_TOKEN: 't',
      TELEGRAM_CHAT_ID: 'c',
    });

    expect(readiness.status).toBe('ready');
    expect(readiness.runtime.telegramConfigured).toBe(true);
    expect(readiness.runtime.whatsappConfigured).toBe(false);
    expect(readiness.missing).toEqual([
      expect.stringContaining('WhatsApp'),
    ]);
    expect(
      readiness.packet.sourceMap.find(entry => entry.channel === 'whatsapp')
    ).toMatchObject({ mode: 'blocked' });
    expect(
      readiness.packet.sourceMap.find(entry => entry.channel === 'telegram')
    ).toMatchObject({ mode: 'draft_bridge' });
  });
});
