/**
 * g9 — the Studio reads its per-business configuration from the organisation
 * record, not from a hardcoded registry. A business that exists in the vault is
 * usable in the Studio without a code change, and a business with no real
 * avatar / voice / consent gets `video: null` — never a PLACEHOLDER id that a
 * live HeyGen key would then be called with.
 */

import {
  resolveStudioClient,
  toClientStudioConfig,
  StudioVideoNotConfiguredError,
  DEFAULT_STUDIO_PLATFORMS,
  type StudioOrganizationRecord,
} from '@/lib/marketing-agency/studio/clients';

const EMPTY_ENV: NodeJS.ProcessEnv = {};

function org(
  overrides: Partial<StudioOrganizationRecord> = {}
): StudioOrganizationRecord {
  return {
    id: 'org-ccw',
    name: 'Carpet Cleaners Warehouse',
    slug: 'ccw',
    website: 'https://ccwonline.com.au',
    settings: null,
    ...overrides,
  };
}

describe('resolveStudioClient — org-driven, no registry', () => {
  it('makes a business that exists in the vault usable with no code change', () => {
    const client = resolveStudioClient(org(), EMPTY_ENV);

    expect(client.organizationId).toBe('org-ccw');
    expect(client.clientSlug).toBe('ccw');
    expect(client.displayName).toBe('Carpet Cleaners Warehouse');
    expect(client.platforms).toEqual(DEFAULT_STUDIO_PLATFORMS);
    // The funnel defaults to the business website until settings.studio names one.
    expect(client.funnelUrl).toBe('https://ccwonline.com.au');
    expect(client.configSource).toBe('none');
    expect(client.warnings).toEqual([]);
  });

  it('never substitutes a placeholder avatar / voice / consent for an unconfigured business', () => {
    const client = resolveStudioClient(org(), EMPTY_ENV);

    expect(client.video).toBeNull();
    expect(JSON.stringify(client)).not.toMatch(/PLACEHOLDER/);
    // The stock ElevenLabs 'Rachel' voice was the old silent fallback.
    expect(JSON.stringify(client)).not.toContain('21m00Tcm4TlvDq8ikWAM');
  });

  it('reads avatar, voice, consent, platforms and funnel from settings.studio', () => {
    const client = resolveStudioClient(
      org({
        settings: {
          studio: {
            displayName: 'CCW',
            platforms: ['linkedin', 'facebook'],
            funnelUrl: 'https://ccwonline.com.au/collections/sale',
            avatarId: 'avatar_real_123',
            voiceId: 'voice_real_456',
            consent: {
              subjectName: 'A. Presenter',
              sourceRef: 'consent/ccw-2026-08-01.pdf',
              confirmedAt: '2026-08-01T00:00:00.000Z',
              avatarId: 'avatar_real_123',
              voiceId: 'voice_real_456',
            },
          },
        },
      }),
      EMPTY_ENV
    );

    expect(client.displayName).toBe('CCW');
    expect(client.platforms).toEqual(['linkedin', 'facebook']);
    expect(client.funnelUrl).toBe('https://ccwonline.com.au/collections/sale');
    expect(client.configSource).toBe('org_settings');
    expect(client.video).toEqual({
      avatarId: 'avatar_real_123',
      voiceId: 'voice_real_456',
      consent: {
        subjectName: 'A. Presenter',
        sourceRef: 'consent/ccw-2026-08-01.pdf',
        confirmedAt: '2026-08-01T00:00:00.000Z',
        avatarId: 'avatar_real_123',
        voiceId: 'voice_real_456',
      },
    });
  });

  it('refuses to render when the consent does not name the configured avatar and voice', async () => {
    // A consent recorded for one presenter never authorises a render of
    // another: a later partial write of avatarId alone is refused here, the
    // only place that survives every write path.
    const client = resolveStudioClient(
      org({
        settings: {
          studio: {
            avatarId: 'avatar_other_person',
            voiceId: 'voice_real_456',
            consent: {
              subjectName: 'A. Presenter',
              sourceRef: 'consent/ccw-2026-08-01.pdf',
              confirmedAt: '2026-08-01T00:00:00.000Z',
              avatarId: 'avatar_real_123',
              voiceId: 'voice_real_456',
            },
          },
        },
      }),
      EMPTY_ENV
    );

    expect(client.video).toBeNull();
    expect(client.configSource).toBe('none');
    expect(client.warnings.join(' ')).toMatch(/consent does not name/);
  });

  it('refuses a consent that names no avatar at all', () => {
    const client = resolveStudioClient(
      org({
        settings: {
          studio: {
            avatarId: 'avatar_real_123',
            voiceId: 'voice_real_456',
            consent: {
              subjectName: 'A. Presenter',
              sourceRef: 'consent/ccw-2026-08-01.pdf',
              confirmedAt: '2026-08-01T00:00:00.000Z',
            },
          },
        },
      }),
      EMPTY_ENV
    );
    expect(client.video).toBeNull();
  });

  it('rejects a settings funnel whose scheme is not http(s) with the same predicate as the website fallback', () => {
    const client = resolveStudioClient(
      org({
        website: 'https://ccwonline.com.au',
        settings: { studio: { funnelUrl: 'javascript:alert(1)' } },
      }),
      EMPTY_ENV
    );
    // The whole studio object is invalid and ignored; the website still serves.
    expect(client.funnelUrl).toBe('https://ccwonline.com.au');
    expect(client.warnings.join(' ')).toMatch(/settings\.studio.*funnelUrl/);
  });

  it('records a warning instead of silently ignoring an invalid settings.studio', () => {
    const client = resolveStudioClient(
      org({
        settings: { studio: { funnelUrl: 'not a url', platforms: 'linkedin' } },
      }),
      EMPTY_ENV
    );

    // Still a usable board — but the operator can see why video / funnel are off.
    expect(client.organizationId).toBe('org-ccw');
    expect(client.video).toBeNull();
    expect(client.warnings.length).toBeGreaterThan(0);
    expect(client.warnings.join(' ')).toMatch(/settings\.studio/);
  });

  it('does not turn a bare-domain website into a funnel link: no link, and the board says why', () => {
    // A website typed into a profile form is free text; only an absolute
    // http(s) URL can be tagged and published. Before this, every approval for
    // such a business failed with "Invalid URL" and told the operator to retry.
    const client = resolveStudioClient(
      org({ website: 'www.ccwonline.com.au' }),
      EMPTY_ENV
    );

    expect(client.funnelUrl).toBeNull();
    expect(client.warnings).toEqual([
      expect.stringMatching(/website is not an absolute http\(s\) URL/),
    ]);
  });

  it('refuses a non-http scheme as a funnel link too', () => {
    const client = resolveStudioClient(
      org({ website: 'javascript:alert(1)' }),
      EMPTY_ENV
    );
    expect(client.funnelUrl).toBeNull();
    expect(client.warnings).toHaveLength(1);
  });

  it('bounds settings.studio.platforms to the nine supported platforms', () => {
    const client = resolveStudioClient(
      org({
        settings: {
          studio: { platforms: Array.from({ length: 10 }, () => 'linkedin') },
        },
      }),
      EMPTY_ENV
    );
    expect(client.platforms).toEqual(DEFAULT_STUDIO_PLATFORMS);
    expect(client.warnings.join(' ')).toMatch(/settings\.studio.*platforms/);
  });

  it('honours the legacy env layer for the two original businesses when it is complete', () => {
    const client = resolveStudioClient(
      org({ id: 'org-carsi', name: 'CARSI', slug: 'carsi', website: null }),
      {
        CARSI_HEYGEN_AVATAR_ID: 'avatar_carsi',
        CARSI_ELEVENLABS_VOICE_ID: 'voice_carsi',
        CARSI_CONSENT_REF: 'consent/carsi.pdf',
        CARSI_PRESENTER_NAME: 'CARSI Presenter',
        CARSI_CONSENT_CONFIRMED_AT: '2026-06-11T00:00:00.000Z',
      }
    );

    expect(client.configSource).toBe('env');
    expect(client.video).toEqual({
      avatarId: 'avatar_carsi',
      voiceId: 'voice_carsi',
      consent: {
        subjectName: 'CARSI Presenter',
        sourceRef: 'consent/carsi.pdf',
        confirmedAt: '2026-06-11T00:00:00.000Z',
        // One presenter per prefix: the consent names that avatar and voice.
        avatarId: 'avatar_carsi',
        voiceId: 'voice_carsi',
      },
    });
    expect(client.funnelUrl).toBeNull();
  });

  it('treats a partial env layer as not configured rather than filling the gaps', () => {
    const client = resolveStudioClient(
      org({ id: 'org-ra', name: 'RestoreAssist', slug: 'restoreassist' }),
      { RA_HEYGEN_AVATAR_ID: 'avatar_ra' } // voice + consent absent
    );

    expect(client.video).toBeNull();
    expect(client.configSource).toBe('none');
    expect(client.warnings.join(' ')).toMatch(/RA_ELEVENLABS_VOICE_ID/);
    expect(JSON.stringify(client)).not.toMatch(/PLACEHOLDER/);
  });

  it('prefers settings.studio over the env layer when both exist', () => {
    const client = resolveStudioClient(
      org({
        id: 'org-ra',
        name: 'RestoreAssist',
        slug: 'restoreassist',
        settings: {
          studio: {
            avatarId: 'avatar_from_settings',
            voiceId: 'voice_from_settings',
            consent: {
              subjectName: 'P',
              sourceRef: 'r',
              confirmedAt: '2026-08-01T00:00:00.000Z',
              avatarId: 'avatar_from_settings',
              voiceId: 'voice_from_settings',
            },
          },
        },
      }),
      {
        RA_HEYGEN_AVATAR_ID: 'avatar_from_env',
        RA_ELEVENLABS_VOICE_ID: 'voice_from_env',
        RA_CONSENT_REF: 'ref',
        RA_PRESENTER_NAME: 'N',
        RA_CONSENT_CONFIRMED_AT: '2026-06-01T00:00:00.000Z',
      }
    );

    expect(client.configSource).toBe('org_settings');
    expect(client.video?.avatarId).toBe('avatar_from_settings');
  });
});

describe('toClientStudioConfig — the video pipeline refuses an unconfigured business', () => {
  it('throws StudioVideoNotConfiguredError when video is null', () => {
    const client = resolveStudioClient(org(), EMPTY_ENV);
    expect(() => toClientStudioConfig(client)).toThrow(
      StudioVideoNotConfiguredError
    );
  });

  it('returns a ClientStudioConfig when video is configured', () => {
    const client = resolveStudioClient(
      org({
        settings: {
          studio: {
            avatarId: 'a',
            voiceId: 'v',
            consent: {
              subjectName: 's',
              sourceRef: 'r',
              confirmedAt: '2026-08-01T00:00:00.000Z',
              avatarId: 'a',
              voiceId: 'v',
            },
          },
        },
      }),
      EMPTY_ENV
    );
    const config = toClientStudioConfig(client);
    expect(config).toEqual({
      clientSlug: 'ccw',
      displayName: 'Carpet Cleaners Warehouse',
      avatarId: 'a',
      voiceId: 'v',
      consent: {
        subjectName: 's',
        sourceRef: 'r',
        confirmedAt: '2026-08-01T00:00:00.000Z',
        avatarId: 'a',
        voiceId: 'v',
      },
      platforms: DEFAULT_STUDIO_PLATFORMS,
    });
  });
});
