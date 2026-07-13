import {
  generateSite,
  type BusinessProfile,
  type SiteBrand,
} from '@/lib/site-generator';

// DR-shaped brand: pronoun-banning voice (mirrors the disaster-recovery preset
// that forbids first-person copy), so the trust block must survive brand-voice
// validation the same way page copy does.
const brand: SiteBrand = {
  slug: 'disaster-recovery',
  displayName: 'Disaster Recovery',
  legalName: 'Disaster Recovery Pty Ltd',
  tagline: 'Coverage when it counts',
  logoPrimary: 'https://disasterrecovery.com.au/logo.svg',
  forbiddenWords: ['cheap', 'synergy'],
};

const baseProfile: BusinessProfile = {
  name: 'Disaster Recovery',
  url: 'https://disasterrecovery.com.au',
  telephone: '+61730000000',
  address: {
    addressLocality: 'Brisbane',
    addressRegion: 'QLD',
    addressCountry: 'AU',
  },
  services: [
    { slug: 'water-damage', label: 'water damage restoration' },
    { slug: 'mould', label: 'mould remediation' },
  ],
};

describe('site generator — trust block (certifications) + call CTA', () => {
  it('renders a trust block listing the certifications', () => {
    const profile: BusinessProfile = {
      ...baseProfile,
      certifications: ['IICRC-certified technicians', 'AS/NZS 4849 compliant'],
    };
    const r = generateSite({ brand, profile });

    expect(r.ok).toBe(true);
    expect(r.html).toContain('class="trust"');
    expect(r.html).toContain('IICRC-certified technicians');
    expect(r.html).toContain('AS/NZS 4849 compliant');
  });

  it('renders a tel: call CTA in the trust block when a phone is present (call-primary)', () => {
    const profile: BusinessProfile = {
      ...baseProfile,
      certifications: ['IICRC-certified technicians'],
    };
    const r = generateSite({ brand, profile });
    // call-primary: the profile phone is a reachable tel: link
    expect(r.html).toContain('href="tel:+61730000000"');
  });

  it('emits hasCredential on the LocalBusiness for each certification', () => {
    const profile: BusinessProfile = {
      ...baseProfile,
      certifications: ['IICRC-certified technicians', 'AS/NZS 4849 compliant'],
    };
    const r = generateSite({ brand, profile });
    const graph = r.jsonLd['@graph'] as Array<Record<string, unknown>>;
    const lb = graph.find(n => n['@type'] === 'LocalBusiness')!;
    const creds = lb.hasCredential as Array<Record<string, unknown>>;
    expect(creds.map(c => c.name)).toEqual([
      'IICRC-certified technicians',
      'AS/NZS 4849 compliant',
    ]);
  });

  it('BLOCKS a certification that smuggles an ACL §18 superlative', () => {
    const profile: BusinessProfile = {
      ...baseProfile,
      certifications: ["Australia's best restorer"],
    };
    const r = generateSite({ brand, profile });
    expect(r.ok).toBe(false);
    expect(
      r.validations.some(
        v => v.rule === 'category-claim' && v.severity === 'block'
      )
    ).toBe(true);
  });

  it('renders a call-only trust block when a phone but no certifications is present', () => {
    // baseProfile has a phone, no certs → call-primary CTA, no credential list.
    const r = generateSite({ brand, profile: baseProfile });
    expect(r.ok).toBe(true);
    expect(r.html).toContain('class="trust"');
    expect(r.html).toContain('href="tel:+61730000000"');
    expect(r.html).not.toContain('class="certifications"');
    const graph = r.jsonLd['@graph'] as Array<Record<string, unknown>>;
    const lb = graph.find(n => n['@type'] === 'LocalBusiness')!;
    expect(lb.hasCredential).toBeUndefined();
  });

  it('renders no trust block when there is neither a phone nor certifications', () => {
    const { telephone: _omit, ...noPhone } = baseProfile;
    const r = generateSite({ brand, profile: noPhone });
    expect(r.ok).toBe(true);
    expect(r.html).not.toContain('class="trust"');
    const graph = r.jsonLd['@graph'] as Array<Record<string, unknown>>;
    const lb = graph.find(n => n['@type'] === 'LocalBusiness')!;
    expect(lb.hasCredential).toBeUndefined();
  });
});
