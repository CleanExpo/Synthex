import {
  getCommandCentreProviderReadiness,
  getProviderEnvKeyNames,
} from '@/lib/unite-command-center';

describe('getCommandCentreProviderReadiness', () => {
  it('keeps optional missing providers draft-only', () => {
    const providers = getCommandCentreProviderReadiness({});

    expect(providers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ provider: 'plaud', mode: 'draft' }),
        expect.objectContaining({ provider: 'pipedream', mode: 'draft' }),
        expect.objectContaining({ provider: 'apify', mode: 'draft' }),
      ])
    );
  });

  it('blocks missing providers required for live operation', () => {
    const providers = getCommandCentreProviderReadiness({});

    expect(providers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ provider: 'telegram', mode: 'blocked' }),
        expect.objectContaining({ provider: 'whatsapp', mode: 'blocked' }),
        expect.objectContaining({ provider: 'heygen', mode: 'blocked' }),
      ])
    );
  });

  it('marks a provider live only when all required env names are present', () => {
    const providers = getCommandCentreProviderReadiness({
      TELEGRAM_BOT_TOKEN: 'set',
      TELEGRAM_CHAT_ID: 'set',
      APIFY_API_TOKEN: 'set',
    });

    expect(providers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ provider: 'telegram', mode: 'live' }),
        expect.objectContaining({ provider: 'apify', mode: 'live' }),
      ])
    );
  });

  it('returns defensive copies of provider env key names', () => {
    const first = getProviderEnvKeyNames();
    first.telegram.push('MUTATED_TOKEN');

    const second = getProviderEnvKeyNames();

    expect(second.telegram).not.toContain('MUTATED_TOKEN');
  });
});
