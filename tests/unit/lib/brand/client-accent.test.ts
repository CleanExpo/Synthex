/**
 * Cross-brand leak guard — client-facing collateral must never carry Synthex's
 * brand colour. Review-request emails and published SEO articles go out under
 * the client's business name, so they render the client's own `primaryColor`,
 * or a neutral slate when the client hasn't set one.
 */

import { resolveClientAccent } from '@/lib/brand/client-accent';
import { injectLayoutSignals } from '@/lib/content/layout-renderer';

const SYNTHEX_ORANGE = '#ff6b35';
const LEGACY_SYNTHEX_ORANGE = '#f97316';
const NEUTRAL_ACCENT = '#334155';

describe('resolveClientAccent', () => {
  it('uses the organisation colour when it is a valid hex', () => {
    expect(resolveClientAccent('#1D4ED8').accent).toBe('#1d4ed8');
  });

  it.each([undefined, null, '', '   ', 'blue', '#fff', '#1d4ed', '#gggggg'])(
    'falls back to the neutral accent for %p',
    value => {
      expect(resolveClientAccent(value).accent).toBe(NEUTRAL_ACCENT);
    }
  );

  it('never falls back to a Synthex brand colour', () => {
    const { accent, tint, border, ink } = resolveClientAccent(null);
    for (const colour of [accent, tint, border, ink]) {
      expect(colour).not.toBe(SYNTHEX_ORANGE);
      expect(colour).not.toBe(LEGACY_SYNTHEX_ORANGE);
    }
  });

  it('derives a light tint, a mid border, and dark ink from the accent', () => {
    const { accent, tint, border, ink } = resolveClientAccent('#1d4ed8');
    expect(accent).toBe('#1d4ed8');
    expect(luminance(tint)).toBeGreaterThan(luminance(border));
    expect(luminance(border)).toBeGreaterThan(luminance(accent));
    expect(luminance(accent)).toBeGreaterThan(luminance(ink));
  });
});

describe('injectLayoutSignals — published article branding', () => {
  const author = {
    name: 'Jane Smith',
    credential: 'Restoration Technician',
    experienceYears: 12,
    gbpLink: 'https://maps.google.com/?cid=123',
  };

  const article =
    '<article><p>Opening paragraph.</p><h2>Section</h2><p>Body.</p></article>';

  function render(primaryColor?: string | null): string {
    return injectLayoutSignals(
      article,
      {
        name: 'Acme Restoration',
        suburb: 'Brisbane',
        phone: '0700000000',
        primaryColor,
      },
      author,
      'blog_local_authority',
      'geo'
    );
  }

  it("renders the client's colour, not Synthex orange", () => {
    const html = render('#1d4ed8');
    expect(html).toContain('#1d4ed8');
    expect(html.toLowerCase()).not.toContain(LEGACY_SYNTHEX_ORANGE);
    expect(html.toLowerCase()).not.toContain(SYNTHEX_ORANGE);
  });

  it('renders neutral when the client has no brand colour set', () => {
    const html = render(null);
    expect(html).toContain(NEUTRAL_ACCENT);
    expect(html.toLowerCase()).not.toContain(LEGACY_SYNTHEX_ORANGE);
    expect(html.toLowerCase()).not.toContain(SYNTHEX_ORANGE);
  });

  it('drops the whole orange tint family from the CTA block', () => {
    const html = render('#1d4ed8').toLowerCase();
    for (const legacyTint of ['#fff7ed', '#fdba74', '#9a3412']) {
      expect(html).not.toContain(legacyTint);
    }
  });
});

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map(offset =>
    parseInt(hex.slice(offset, offset + 2), 16)
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
