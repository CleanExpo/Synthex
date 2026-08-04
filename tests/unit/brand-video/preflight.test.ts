/**
 * Brand-asset preflight — SYN-1113.
 *
 * The gap this closes: `brand` was a free string that reached the database and
 * then the worker, which used it once in a log line and applied no tokens. So a
 * job for a brand that does not exist rendered happily, spent on voiceover and
 * images, and reported success — the output simply had no brand in it.
 *
 * Pure and provider-free: the preflight reads `brand-config` and the committed
 * logo baseline, and touches neither the filesystem nor the network.
 */
import { preflightBrandAssets } from '@/lib/brand-video/preflight';
import { brands } from '@unite-group/brand-config';

describe('preflightBrandAssets — brand resolution', () => {
  it('accepts every brand that brand-config actually defines', () => {
    // Parameterised off the real record so a newly added brand is covered
    // without editing this test.
    for (const slug of Object.keys(brands)) {
      expect(preflightBrandAssets(slug).slug).toBe(slug);
    }
  });

  it('refuses a brand that does not exist', () => {
    const result = preflightBrandAssets('Coca-Cola');

    expect(result.ok).toBe(false);
    expect(result.slug).toBeNull();
    expect(result.findings[0].code).toBe('unknown-brand');
  });

  it('names the valid brands when it refuses, so the caller can correct it', () => {
    const result = preflightBrandAssets('asdf');

    expect(result.findings[0].message).toContain('synthex');
  });

  it('refuses empty and whitespace-only input', () => {
    // Zod's min(1) catches the empty string, but not '   '.
    for (const input of ['', '   ']) {
      expect(preflightBrandAssets(input).ok).toBe(false);
    }
  });

  it('normalises casing and spacing rather than refusing on formatting', () => {
    expect(preflightBrandAssets('  John Coutis  ').slug).toBe('john-coutis');
    expect(preflightBrandAssets('SYNTHEX').slug).toBe('synthex');
  });

  it('does not accept a brand by display name or a partial match', () => {
    // 'RestoreAssist' is the display name of slug 'ra'; accepting it would put a
    // value in the database that brand-config cannot resolve.
    for (const input of ['RestoreAssist', 'synth', 'synthex-social']) {
      expect(preflightBrandAssets(input).slug).toBeNull();
    }
  });
});

describe('preflightBrandAssets — unapproved tokens', () => {
  it('refuses john-coutis, whose tokens are still a proposal', () => {
    // Previously discoverable only by reading a comment in the colour block.
    const result = preflightBrandAssets('john-coutis');

    expect(result.ok).toBe(false);
    expect(result.findings.map(f => f.code)).toContain('unapproved-tokens');
  });

  it('still resolves the slug it refuses, so the caller can report which brand', () => {
    expect(preflightBrandAssets('john-coutis').slug).toBe('john-coutis');
  });

  it('passes brands whose tokens are signed off', () => {
    // Absent tokenStatus means confirmed; only john-coutis is a proposal today.
    const confirmed = Object.keys(brands).filter(s => s !== 'john-coutis');

    for (const slug of confirmed) {
      expect(preflightBrandAssets(slug).ok).toBe(true);
    }
  });

  it('agrees with brand-config about which brands are proposals', () => {
    // Guards the two from drifting: flipping tokenStatus in brand-config must
    // change the preflight's verdict, with no second list to update here.
    for (const [slug, config] of Object.entries(brands)) {
      const refused = preflightBrandAssets(slug)
        .findings.map(f => f.code)
        .includes('unapproved-tokens');

      expect(refused).toBe(config.tokenStatus === 'proposal');
    }
  });
});

describe('preflightBrandAssets — declared logo assets', () => {
  it('warns about declared logo files that do not exist without blocking', () => {
    // All 21 declared brand logos are absent (SYN-1133). Nothing reads
    // `brand.logo` at runtime, so blocking would refuse work that never needed
    // the file — but staying silent is how they went missing unnoticed.
    const result = preflightBrandAssets('synthex');

    expect(result.ok).toBe(true);
    expect(result.warnings.map(w => w.code)).toContain('missing-logo-assets');
  });

  it('lists the absent files so the gap is actionable', () => {
    const warning = preflightBrandAssets('synthex').warnings.find(
      w => w.code === 'missing-logo-assets'
    );

    expect(warning?.message).toContain('logos/synthex/primary.svg');
  });

  it('reports missing logos as warnings, never as blocking findings', () => {
    for (const slug of Object.keys(brands)) {
      const codes = preflightBrandAssets(slug).findings.map(f => f.code);

      expect(codes).not.toContain('missing-logo-assets');
    }
  });
});
