import {
  generateSiteWithCopy,
  type BusinessProfile,
  type CopyWriter,
  type CopyWriterInput,
  type SiteBrand,
  type SiteCopy,
} from '@/lib/site-generator';

const brand: SiteBrand = {
  slug: 'acme',
  displayName: 'Acme',
  legalName: 'Acme Pty Ltd',
  tagline: 'Local, fast, done right',
  logoPrimary: 'https://acme.com.au/logo.svg',
  forbiddenWords: ['cheap', 'synergy'],
};

const profile: BusinessProfile = {
  name: 'Acme Plumbing',
  legalName: 'Acme Plumbing Pty Ltd',
  url: 'https://acmeplumbing.com.au',
  telephone: '+61730000000',
  address: {
    streetAddress: '10 Trade St',
    addressLocality: 'Brisbane',
    addressRegion: 'QLD',
    postalCode: '4000',
    addressCountry: 'AU',
  },
  services: [
    { slug: 'blocked-drains', label: 'blocked drain clearing' },
    { slug: 'hot-water', label: 'hot water repairs' },
  ],
  rating: { value: 4.8, count: 213 },
};

const VALID_COPY: SiteCopy = {
  headline: 'Fast blocked drain clearing in Brisbane',
  intro: 'Our Brisbane team clears blocked drains the same day.',
  bodyParagraphs: ['We assess the blockage on site, then quote in writing.'],
  faqs: [],
};

// Frames AI as the actor → aid-rule block.
const AID_RULE_COPY: SiteCopy = {
  ...VALID_COPY,
  intro: 'AI repairs your blocked drains overnight.',
};

/** A CopyWriter that returns each queued copy in turn, recording every call. */
function scriptedWriter(queue: SiteCopy[]): CopyWriter & {
  calls: CopyWriterInput[];
} {
  const calls: CopyWriterInput[] = [];
  return {
    calls,
    async write(input) {
      calls.push(input);
      const next = queue[Math.min(calls.length - 1, queue.length - 1)];
      return next;
    },
  };
}

describe('generateSiteWithCopy — validator-gated LLM copy hook', () => {
  it('uses the LLM copy when it passes every validator (happy path)', async () => {
    const writer = scriptedWriter([VALID_COPY]);
    const r = await generateSiteWithCopy(writer, { brand, profile });

    expect(r.ok).toBe(true);
    expect(r.copy.headline).toBe(VALID_COPY.headline);
    expect(writer.calls).toHaveLength(1);
    // First pass carries no prior violations.
    expect(writer.calls[0].priorViolations).toHaveLength(0);
    // Hero service is resolved and handed to the writer.
    expect(writer.calls[0].heroService.slug).toBe('blocked-drains');
  });

  it('re-prompts with the violations and ships the repaired draft', async () => {
    const writer = scriptedWriter([AID_RULE_COPY, VALID_COPY]);
    const r = await generateSiteWithCopy(writer, { brand, profile });

    expect(r.ok).toBe(true);
    expect(r.copy.headline).toBe(VALID_COPY.headline);
    expect(writer.calls).toHaveLength(2);
    // The repair pass is told exactly what to fix.
    expect(
      writer.calls[1].priorViolations.some(v => v.rule === 'aid-rule')
    ).toBe(true);
  });

  it('falls back to deterministic copy when the LLM never complies', async () => {
    const writer = scriptedWriter([AID_RULE_COPY]);
    const r = await generateSiteWithCopy(
      writer,
      { brand, profile },
      { maxRepairs: 1 }
    );

    expect(r.ok).toBe(true);
    // Not the non-compliant draft — the deterministic template took over.
    expect(r.copy.intro).not.toBe(AID_RULE_COPY.intro);
    expect(r.copy.headline.toLowerCase()).toContain('blocked');
    // maxRepairs=1 → 2 attempts before fallback.
    expect(writer.calls).toHaveLength(2);
  });

  it('falls back to deterministic copy when the writer throws', async () => {
    let calls = 0;
    const writer: CopyWriter = {
      async write() {
        calls++;
        throw new Error('provider unavailable');
      },
    };
    const r = await generateSiteWithCopy(writer, { brand, profile });

    expect(r.ok).toBe(true);
    expect(r.copy.headline.toLowerCase()).toContain('blocked');
    // Throw stops the loop immediately — no retries.
    expect(calls).toBe(1);
  });

  it('throws when the profile has no services', async () => {
    const writer = scriptedWriter([VALID_COPY]);
    await expect(
      generateSiteWithCopy(writer, {
        brand,
        profile: { ...profile, services: [] },
      })
    ).rejects.toThrow(/at least one service/);
  });
});
