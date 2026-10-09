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
import identityGaps from '@/config/brand-identity-gaps.json';

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
  it('reports no missing logo warnings after every brand variant is restored', () => {
    for (const slug of Object.keys(brands)) {
      expect(preflightBrandAssets(slug).warnings).toEqual([]);
    }
  });

  it('reports missing logos as warnings, never as blocking findings', () => {
    for (const slug of Object.keys(brands)) {
      const codes = preflightBrandAssets(slug).findings.map(f => f.code);

      expect(codes).not.toContain('missing-logo-assets');
    }
  });
});

describe('pending portfolio identity', () => {
  it.each(['ccw', 'CCWarehouse', 'Carpet Cleaners Warehouse'])(
    'refuses %s with an actionable approval gap before a job can be created',
    input => {
      const result = preflightBrandAssets(input);
      expect(result.ok).toBe(false);
      expect(result.slug).toBeNull();
      expect(result.findings.map(f => f.code)).toEqual(['unapproved-tokens']);
      expect(result.findings[0].message).toContain('ccw');
    }
  );
});

describe('recovered Synthex identity', () => {
  it('does not report missing logos once all declared variants exist', () => {
    expect(preflightBrandAssets('synthex').warnings).toEqual([]);
  });
});

it('keeps John blocked after visual approval while recording rights remain open', () => {
  const john = brands['john-coutis'];
  const previousStatus = john.tokenStatus;
  const gap = identityGaps['john-coutis'];
  const previousRequirements = gap.required;
  try {
    john.tokenStatus = 'confirmed';
    gap.required = [previousRequirements[1]];
    const result = preflightBrandAssets('john-coutis');
    expect(result.ok).toBe(false);
    expect(result.findings.map(f => f.code)).toEqual([
      'identity-approval-required',
    ]);
    expect(result.findings[0].message).toContain(
      'consented original recordings'
    );
  } finally {
    john.tokenStatus = previousStatus;
    gap.required = previousRequirements;
  }
});
