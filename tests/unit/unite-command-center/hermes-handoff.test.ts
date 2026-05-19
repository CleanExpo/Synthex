import { buildHermesHandoffPacket } from '@/lib/unite-command-center';

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
