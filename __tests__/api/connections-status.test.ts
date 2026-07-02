import { buildConnectionStatusManifest } from '@/lib/connections/status';

jest.mock('next/server', () => {
  class NextResponse extends Response {
    static json(body: unknown, init?: ResponseInit): NextResponse {
      const headers = new Headers({ 'content-type': 'application/json' });
      if (init?.headers) {
        const extra = init.headers as Record<string, string>;
        Object.entries(extra).forEach(([key, value]) =>
          headers.set(key, value)
        );
      }
      return new NextResponse(JSON.stringify(body), {
        status: init?.status ?? 200,
        headers,
      });
    }
  }

  return { NextResponse };
});

describe('connection status manifest', () => {
  it('builds a metadata-only Mission Control manifest from env presence', () => {
    const manifest = buildConnectionStatusManifest(
      {
        NEXT_PUBLIC_APP_URL: 'https://synthex.social',
        DATABASE_URL: 'postgres://secret-value',
        DIRECT_URL: 'postgres://direct-secret',
        REDIS_URL: 'redis://cache-secret',
        REDIS_TOKEN: 'redis-token',
        LINEAR_API_KEY: 'lin_api_secret',
        LINEAR_WEBHOOK_SECRET: 'linear-webhook-secret',
        OBSIDIAN_ENABLED: 'true',
        OBSIDIAN_API_KEY: 'obsidian-secret',
        UNITE_HUB_API_URL: 'https://unite.example',
        UNITE_HUB_API_KEY: 'unite-secret',
        TELEGRAM_BOT_TOKEN: 'telegram-secret',
        TELEGRAM_CHAT_ID: '123',
        HERMES_LINEAR_TEAM_ID: 'team-1',
        ANTHROPIC_API_KEY: 'anthropic-secret',
        GOOGLE_CLIENT_ID: 'google-client',
        STRIPE_SECRET_KEY: 'stripe-secret',
        STRIPE_WEBHOOK_SECRET: 'stripe-webhook',
        SENTRY_DSN: 'sentry-secret',
      },
      new Date('2026-06-16T00:00:00.000Z')
    );

    expect(manifest.source).toBe('synthex:connection-status');
    expect(manifest.project).toMatchObject({
      id: 'synthex',
      name: 'Synthex',
      productionUrl: 'https://synthex.social',
    });
    expect(manifest.summary.total).toBe(manifest.connections.length);
    expect(manifest.summary.blocked).toBe(1);
    expect(manifest.connections).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'database',
          label: 'Database',
          state: 'ready',
          safeForMissionControl: true,
        }),
        expect.objectContaining({
          id: 'social_publishing',
          state: 'blocked',
        }),
      ])
    );
  });

  it('does not expose credential names or values in the manifest body', () => {
    const manifest = buildConnectionStatusManifest(
      {
        DATABASE_URL: 'postgres://super-secret',
        LINEAR_API_KEY: 'lin_api_super_secret',
        UNITE_HUB_API_KEY: 'unite-super-secret',
        STRIPE_SECRET_KEY: 'sk_live_super_secret',
        NEXT_PUBLIC_APP_URL: 'https://synthex.social',
      },
      new Date('2026-06-16T00:00:00.000Z')
    );

    const body = JSON.stringify(manifest);

    expect(body).not.toContain('super-secret');
    expect(body).not.toContain('lin_api_');
    expect(body).not.toContain('sk_live_');
    expect(body).not.toContain('DATABASE_URL');
    expect(body).not.toContain('STRIPE_SECRET_KEY');
  });

  it('serves the manifest through GET', async () => {
    const { GET } = await import('@/app/api/v1/connections/status/route');

    const response = await GET();
    const body = JSON.parse(await response.text()) as {
      source: string;
      connections: unknown[];
    };

    expect(response.status).toBe(200);
    expect(body.source).toBe('synthex:connection-status');
    expect(body.connections.length).toBeGreaterThan(0);
  });
});
