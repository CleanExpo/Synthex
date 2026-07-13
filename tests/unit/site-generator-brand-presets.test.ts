import {
  SITE_BRAND_PRESETS,
  generateSite,
  getSiteBrandPreset,
  type BusinessProfile,
} from '@/lib/site-generator';

const EXPECTED_SLUGS = [
  'carsi',
  'disaster-recovery',
  'nrpg',
  'restoreassist',
] as const;

// A minimal valid profile. FAQs are supplied (real data wins) because the
// deterministic default FAQ scaffold uses customer-voice first person ("How do
// I get a quote?"), which the estate presets' pronoun ban would block.
const profile: BusinessProfile = {
  name: 'Sample Restorations',
  url: 'https://samplerestorations.com.au',
  address: {
    addressLocality: 'Brisbane',
    addressRegion: 'QLD',
    addressCountry: 'AU',
  },
  services: [
    { slug: 'water-damage', label: 'water damage restoration' },
    { slug: 'mould-remediation', label: 'mould remediation' },
  ],
  faqs: [
    {
      question: 'How fast can a job start?',
      answer:
        'Call the team and the earliest available time is confirmed on the spot.',
    },
    {
      question: 'Does the quote cover the full job?',
      answer:
        'Yes. Each job is assessed on site and the written quote reflects the actual work.',
    },
  ],
};

describe('brand presets — registry shape', () => {
  it('contains exactly the four portfolio business presets', () => {
    expect(SITE_BRAND_PRESETS.map(p => p.slug).sort()).toEqual([
      ...EXPECTED_SLUGS,
    ]);
  });

  it.each(SITE_BRAND_PRESETS.map(p => p.slug))(
    'the "%s" preset has the required SiteBrand fields',
    slug => {
      const preset = getSiteBrandPreset(slug)!;
      expect(preset.slug).toBe(slug);
      expect(preset.displayName.length).toBeGreaterThan(0);
      expect(Array.isArray(preset.forbiddenWords)).toBe(true);
      expect(preset.forbiddenWords.length).toBeGreaterThan(0);
    }
  );

  it('slugs are unique and kebab-case', () => {
    const slugs = SITE_BRAND_PRESETS.map(p => p.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const slug of slugs) {
      expect(slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
  });

  it('forbiddenWords are lower-case', () => {
    for (const preset of SITE_BRAND_PRESETS) {
      for (const word of preset.forbiddenWords) {
        expect(word).toBe(word.toLowerCase());
      }
    }
  });

  it('looks up a preset by slug and misses unknown slugs', () => {
    expect(getSiteBrandPreset('disaster-recovery')?.displayName).toBe(
      'Disaster Recovery'
    );
    expect(getSiteBrandPreset('nope')).toBeUndefined();
  });
});

describe('brand presets → generateSite produces a valid, on-brand site', () => {
  it.each(SITE_BRAND_PRESETS.map(p => p.slug))(
    'the "%s" preset passes every validator',
    slug => {
      const preset = getSiteBrandPreset(slug)!;
      const r = generateSite({ brand: preset, profile });

      expect(r.validations.filter(v => v.severity === 'block')).toHaveLength(0);
      expect(r.ok).toBe(true);
      expect(r.slug).toBe('water-damage');
    }
  );
});
