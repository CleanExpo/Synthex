/**
 * Unit tests — lib/marketing-agency/brand-style (SYN-40).
 *
 * Covers the full validateBrandStyle matrix (incl. rejection cases), the
 * curated font manifest, safe-zone grid coherence, deterministic
 * BrandOverlaySpec building, the additive withBrandOverlay composition
 * (prompt byte-identical — brand fields never enter prompt text), and
 * BrandDNA seeding fallbacks.
 */
import {
  BRAND_FONTS,
  CTA_TEXT_MAX_LENGTH,
  DEFAULT_BRAND_FONT_ID,
  DEFAULT_PRESET_NAME,
  FALLBACK_PRIMARY_COLOR,
  HEX_COLOR_REGEX,
  OVERLAY_GRID_POSITIONS,
  SAFE_ZONES,
  buildBrandOverlaySpec,
  getBrandFont,
  isAllowedLogoUrl,
  isBrandFontId,
  seedBrandPresetFromDna,
  validateBrandStyle,
  withBrandOverlay,
  type BrandStyleInput,
} from '@/lib/marketing-agency/brand-style';
import { buildAdGenerationRequest } from '@/lib/marketing-agency/artlist/ad-templates';

const ALLOWED_HOSTS = ['assets.example.com', '.supabase.co'] as const;

function validStyle(overrides: Partial<BrandStyleInput> = {}): BrandStyleInput {
  return {
    name: 'Launch preset',
    primaryColor: '#1A2B3C',
    secondaryColor: '#ffffff',
    accentColor: '#00ff00',
    font: 'inter',
    logoUrl: 'https://assets.example.com/logo.png',
    ctaText: 'Shop now',
    ...overrides,
  };
}

describe('BRAND_FONTS manifest', () => {
  test('is curated: 10-15 fonts with unique ids and non-empty stacks', () => {
    expect(BRAND_FONTS.length).toBeGreaterThanOrEqual(10);
    expect(BRAND_FONTS.length).toBeLessThanOrEqual(15);
    const ids = BRAND_FONTS.map(f => f.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const f of BRAND_FONTS) expect(f.stack.length).toBeGreaterThan(0);
  });

  test('default font is in the manifest; lookup helpers agree', () => {
    expect(isBrandFontId(DEFAULT_BRAND_FONT_ID)).toBe(true);
    expect(getBrandFont(DEFAULT_BRAND_FONT_ID)?.id).toBe(DEFAULT_BRAND_FONT_ID);
    expect(isBrandFontId('comic-sans')).toBe(false);
    expect(getBrandFont('comic-sans')).toBeUndefined();
  });
});

describe('validateBrandStyle — acceptance', () => {
  test('accepts a fully valid style and normalises optionals', () => {
    const result = validateBrandStyle(validStyle(), {
      allowedLogoHosts: ALLOWED_HOSTS,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toEqual({
      name: 'Launch preset',
      primaryColor: '#1A2B3C',
      secondaryColor: '#ffffff',
      accentColor: '#00ff00',
      font: 'inter',
      logoUrl: 'https://assets.example.com/logo.png',
      ctaText: 'Shop now',
    });
  });

  test('accepts minimal style (primary + font only)', () => {
    const result = validateBrandStyle({
      primaryColor: '#000000',
      font: 'roboto',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.secondaryColor).toBeNull();
    expect(result.value.logoUrl).toBeNull();
    expect(result.value.ctaText).toBeNull();
    expect(result.value.name).toBeNull();
  });

  test('CTA text at exactly the cap is accepted', () => {
    const result = validateBrandStyle(
      validStyle({ ctaText: 'x'.repeat(CTA_TEXT_MAX_LENGTH) }),
      { allowedLogoHosts: ALLOWED_HOSTS }
    );
    expect(result.ok).toBe(true);
  });
});

describe('validateBrandStyle — rejection matrix', () => {
  const rejects: Array<[string, Partial<BrandStyleInput>, string]> = [
    ['named colour word', { primaryColor: 'red' }, 'primaryColor'],
    ['3-digit shorthand hex', { primaryColor: '#abc' }, 'primaryColor'],
    ['8-digit hex (alpha)', { primaryColor: '#11223344' }, 'primaryColor'],
    ['non-hex digits', { primaryColor: '#GGGGGG' }, 'primaryColor'],
    ['missing #', { primaryColor: '1A2B3C' }, 'primaryColor'],
    ['bad secondary', { secondaryColor: 'blue' }, 'secondaryColor'],
    ['bad accent', { accentColor: '#12' }, 'accentColor'],
    ['font not in manifest', { font: 'comic-sans' }, 'font'],
    ['free-text font stack', { font: 'Inter, sans-serif' }, 'font'],
    [
      'CTA over the cap',
      { ctaText: 'x'.repeat(CTA_TEXT_MAX_LENGTH + 1) },
      'ctaText',
    ],
    ['whitespace-only CTA', { ctaText: '   ' }, 'ctaText'],
    [
      'http (non-https) logo',
      { logoUrl: 'http://assets.example.com/logo.png' },
      'logoUrl',
    ],
    [
      'https on non-allowlisted origin',
      { logoUrl: 'https://evil.example.net/logo.png' },
      'logoUrl',
    ],
    ['unparseable logo URL', { logoUrl: 'not a url' }, 'logoUrl'],
    ['javascript: scheme logo', { logoUrl: 'javascript:alert(1)' }, 'logoUrl'],
    ['whitespace-only name', { name: '   ' }, 'name'],
    ['name over 80 chars', { name: 'n'.repeat(81) }, 'name'],
  ];

  test.each(rejects)('rejects %s', (_label, overrides, field) => {
    const result = validateBrandStyle(validStyle(overrides), {
      allowedLogoHosts: ALLOWED_HOSTS,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.map(i => i.field)).toContain(field);
  });

  test('collects ALL issues in one pass (matrix, not first-failure)', () => {
    const result = validateBrandStyle(
      {
        primaryColor: 'red',
        secondaryColor: 'blue',
        font: 'comic-sans',
        logoUrl: 'http://x.com/l.png',
        ctaText: 'x'.repeat(CTA_TEXT_MAX_LENGTH + 1),
      },
      { allowedLogoHosts: ALLOWED_HOSTS }
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const fields = result.issues.map(i => i.field).sort();
    expect(fields).toEqual([
      'ctaText',
      'font',
      'logoUrl',
      'primaryColor',
      'secondaryColor',
    ]);
  });
});

describe('isAllowedLogoUrl', () => {
  test('suffix entries match subdomains; exact entries match only that host', () => {
    expect(
      isAllowedLogoUrl(
        'https://xyz.supabase.co/storage/logo.png',
        ALLOWED_HOSTS
      )
    ).toBe(true);
    expect(
      isAllowedLogoUrl('https://assets.example.com/a.png', ALLOWED_HOSTS)
    ).toBe(true);
    // exact entry must not match a sub-subdomain
    expect(
      isAllowedLogoUrl('https://sub.assets.example.com/a.png', ALLOWED_HOSTS)
    ).toBe(false);
    // suffix must not match a lookalike registered elsewhere
    expect(
      isAllowedLogoUrl('https://evilsupabase.co/a.png', ALLOWED_HOSTS)
    ).toBe(false);
  });
});

describe('SAFE_ZONES', () => {
  test('every aspect ratio has coherent defaults inside its allowed cells', () => {
    for (const zone of Object.values(SAFE_ZONES)) {
      expect(zone.ctaPositions).toContain(zone.defaultCtaPosition);
      expect(zone.logoPositions).toContain(zone.defaultLogoPosition);
      for (const p of [...zone.ctaPositions, ...zone.logoPositions]) {
        expect(OVERLAY_GRID_POSITIONS).toContain(p);
      }
      for (const inset of Object.values(zone.margin)) {
        expect(inset).toBeGreaterThanOrEqual(0);
        expect(inset).toBeLessThan(0.5);
      }
    }
  });

  test('covers exactly the three template aspect ratios', () => {
    expect(Object.keys(SAFE_ZONES).sort()).toEqual(['16:9', '1:1', '9:16']);
  });
});

describe('buildBrandOverlaySpec', () => {
  test('builds a deterministic spec with per-ratio safe-zone defaults', () => {
    const a = buildBrandOverlaySpec(validStyle(), {
      aspectRatio: '9:16',
      allowedLogoHosts: ALLOWED_HOSTS,
    });
    const b = buildBrandOverlaySpec(validStyle(), {
      aspectRatio: '9:16',
      allowedLogoHosts: ALLOWED_HOSTS,
    });
    expect(a).toEqual(b); // same input → same output
    expect(a.ok).toBe(true);
    if (!a.ok) return;
    expect(a.spec).toMatchObject({
      version: 1,
      aspectRatio: '9:16',
      colors: { primary: '#1A2B3C', secondary: '#ffffff', accent: '#00ff00' },
      font: { id: 'inter' },
      logo: {
        url: 'https://assets.example.com/logo.png',
        placement: SAFE_ZONES['9:16'].defaultLogoPosition,
      },
      cta: {
        text: 'Shop now',
        position: SAFE_ZONES['9:16'].defaultCtaPosition,
      },
      safeZone: SAFE_ZONES['9:16'].margin,
    });
  });

  test('omits logo/cta blocks when the style has none', () => {
    const built = buildBrandOverlaySpec(
      { primaryColor: '#123456', font: 'lato' },
      { aspectRatio: '1:1' }
    );
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.spec.logo).toBeNull();
    expect(built.spec.cta).toBeNull();
  });

  test('respects explicit in-zone positions', () => {
    const built = buildBrandOverlaySpec(validStyle(), {
      aspectRatio: '16:9',
      ctaPosition: 'bottom-left',
      logoPlacement: 'top-left',
      allowedLogoHosts: ALLOWED_HOSTS,
    });
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.spec.cta?.position).toBe('bottom-left');
    expect(built.spec.logo?.placement).toBe('top-left');
  });

  test('rejects a CTA position outside the safe zone for the ratio', () => {
    const built = buildBrandOverlaySpec(validStyle(), {
      aspectRatio: '9:16',
      ctaPosition: 'top-left', // 9:16 top band is reserved for platform chrome
      allowedLogoHosts: ALLOWED_HOSTS,
    });
    expect(built.ok).toBe(false);
    if (built.ok) return;
    expect(built.issues.map(i => i.field)).toContain('ctaPosition');
  });

  test('rejects a logo placement outside the safe zone for the ratio', () => {
    const built = buildBrandOverlaySpec(validStyle(), {
      aspectRatio: '9:16',
      logoPlacement: 'bottom-center',
      allowedLogoHosts: ALLOWED_HOSTS,
    });
    expect(built.ok).toBe(false);
    if (built.ok) return;
    expect(built.issues.map(i => i.field)).toContain('logoPlacement');
  });

  test('carries style issues through (invalid style never yields a spec)', () => {
    const built = buildBrandOverlaySpec(validStyle({ primaryColor: 'red' }), {
      aspectRatio: '1:1',
      allowedLogoHosts: ALLOWED_HOSTS,
    });
    expect(built.ok).toBe(false);
    if (built.ok) return;
    expect(built.issues.map(i => i.field)).toContain('primaryColor');
  });
});

describe('withBrandOverlay — additive composition', () => {
  test('prompt and every substrate field pass through byte-identical', () => {
    const request = buildAdGenerationRequest('3d-product-spin', {
      productName: 'Aurora Lamp',
    });
    const built = buildBrandOverlaySpec(validStyle(), {
      aspectRatio: request.aspectRatio,
      allowedLogoHosts: ALLOWED_HOSTS,
    });
    expect(built.ok).toBe(true);
    if (!built.ok) return;

    const branded = withBrandOverlay(request, built.spec);

    // The overlay rides alongside; the request is untouched.
    expect(branded.brandOverlay).toBe(built.spec);
    const { brandOverlay: _overlay, ...passthrough } = branded;
    expect(passthrough).toEqual(request);

    // Brand fields NEVER enter prompt text.
    expect(branded.prompt).toBe(request.prompt);
    expect(branded.prompt).not.toContain('#1A2B3C');
    expect(branded.prompt).not.toContain('Shop now');
    expect(branded.prompt).not.toContain('inter');
    expect(branded.prompt).not.toContain('logo.png');

    // No mutation of the original request object.
    expect('brandOverlay' in request).toBe(false);
  });
});

describe('seedBrandPresetFromDna', () => {
  test('null DNA → deterministic fallbacks', () => {
    const seed = seedBrandPresetFromDna(null, {
      allowedLogoHosts: ALLOWED_HOSTS,
    });
    expect(seed).toEqual({
      name: DEFAULT_PRESET_NAME,
      primaryColor: FALLBACK_PRIMARY_COLOR,
      secondaryColor: null,
      accentColor: null,
      font: DEFAULT_BRAND_FONT_ID,
      logoUrl: null,
      ctaText: null,
      isDefault: true,
    });
    expect(HEX_COLOR_REGEX.test(seed.primaryColor)).toBe(true);
  });

  test('valid DNA colours + allowlisted logo carry through', () => {
    const seed = seedBrandPresetFromDna(
      {
        businessName: 'Aurora Coffee',
        primaryColour: '#aa1122',
        secondaryColour: '#334455',
        neutralColour: '#dddddd',
        logoUrl: 'https://xyz.supabase.co/storage/v1/logo.png',
      },
      { allowedLogoHosts: ALLOWED_HOSTS }
    );
    expect(seed.name).toBe('Aurora Coffee default');
    expect(seed.primaryColor).toBe('#aa1122');
    expect(seed.secondaryColor).toBe('#334455');
    expect(seed.accentColor).toBe('#dddddd');
    expect(seed.logoUrl).toBe('https://xyz.supabase.co/storage/v1/logo.png');
  });

  test('invalid DNA values degrade field-by-field, disallowed logo dropped', () => {
    const seed = seedBrandPresetFromDna(
      {
        businessName: '  ',
        primaryColour: 'burgundy',
        secondaryColour: '#12345G',
        neutralColour: null,
        logoUrl: 'https://client-site.example.org/logo.svg', // extracted, not allowlisted
      },
      { allowedLogoHosts: ALLOWED_HOSTS }
    );
    expect(seed.name).toBe(DEFAULT_PRESET_NAME);
    expect(seed.primaryColor).toBe(FALLBACK_PRIMARY_COLOR);
    expect(seed.secondaryColor).toBeNull();
    expect(seed.logoUrl).toBeNull();
  });

  test('seeded preset ALWAYS passes validateBrandStyle', () => {
    const sources = [
      null,
      { primaryColour: 'nope', logoUrl: 'http://x.y/l.png' },
      {
        businessName: 'B'.repeat(200),
        primaryColour: '#010203',
        logoUrl: 'https://xyz.supabase.co/l.png',
      },
    ];
    for (const dna of sources) {
      const seed = seedBrandPresetFromDna(dna, {
        allowedLogoHosts: ALLOWED_HOSTS,
      });
      const validated = validateBrandStyle(seed, {
        allowedLogoHosts: ALLOWED_HOSTS,
      });
      expect(validated.ok).toBe(true);
    }
  });
});
