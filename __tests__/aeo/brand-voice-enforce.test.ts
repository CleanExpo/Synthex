/**
 * Tests for brand-voice-enforce mechanical gate.
 * Spec: docs/aeo/brand-voice-enforce-spec-2026-05-16.md §6.
 *
 * Fixtures live in __tests__/aeo/fixtures/*.json so non-engineers can add
 * cases without touching code.
 */

import fs from 'fs';
import path from 'path';

import {
  enforceBrandVoice,
  type BrandVoiceEnforceInput,
} from '@/lib/aeo/brand-voice-enforce';
import { fleschKincaidGrade } from '@/lib/aeo/flesch-kincaid';

interface Fixture {
  name: string;
  input: BrandVoiceEnforceInput;
  canonicalNap?: { businessName: string; phone?: string; address?: string };
  freshnessHoursAgo?: number;
  expect: { pass: boolean; reasonPrefix: string | null };
}

const FIXTURE_DIR = path.join(__dirname, 'fixtures');

function loadFixture(name: string): Fixture {
  const raw = fs.readFileSync(path.join(FIXTURE_DIR, name), 'utf-8');
  return JSON.parse(raw) as Fixture;
}

function runFixture(fixture: Fixture, nowMs: number) {
  return enforceBrandVoice(fixture.input, {
    lookupCanonicalNap: async () => fixture.canonicalNap ?? null,
    lookupMentionFreshness: async () =>
      typeof fixture.freshnessHoursAgo === 'number'
        ? { lastSeenAt: new Date(nowMs - fixture.freshnessHoursAgo * 60 * 60 * 1000) }
        : null,
    now: () => new Date(nowMs),
    trackingEnabled: false,
  });
}

describe('brand-voice-enforce mechanical gate', () => {
  const NOW = new Date('2026-05-16T00:00:00Z').getTime();

  const cases: Array<{ file: string }> = [
    { file: 'dr-sms-forbidden-word.json' },
    { file: 'dr-sms-pronoun-leak.json' },
    { file: 'dr-sms-clean-passes.json' },
    { file: 'ra-outreach-reading-level-fail.json' },
    { file: 'ra-outreach-cadence-long-sentence.json' },
    { file: 'dr-sms-too-long.json' },
    { file: 'dr-sms-missing-job-id.json' },
    { file: 'dr-sms-nap-mismatch.json' },
    { file: 'dr-outreach-stale-mention.json' },
    { file: 'nrpg-gbp-post-pronoun-allowed.json' },
    { file: 'edge-empty-candidate.json' },
    { file: 'edge-unicode-cadence.json' },
  ];

  describe.each(cases)('fixture: $file', ({ file }) => {
    it('matches expected pass/reason contract', async () => {
      const fixture = loadFixture(file);
      const result = await runFixture(fixture, NOW);

      expect(result.brand).toBe(fixture.input.brand);
      expect(result.surface).toBe(fixture.input.surface);
      expect(result.pass).toBe(fixture.expect.pass);
      expect(typeof result.durationMs).toBe('number');

      if (fixture.expect.reasonPrefix) {
        expect(
          result.reasons.some((r) => r.startsWith(fixture.expect.reasonPrefix!)),
        ).toBe(true);
      } else {
        expect(result.reasons).toEqual([]);
      }
    });
  });

  describe('contract guarantees', () => {
    it('throws on unknown brand (caller bug — never silent fallback)', async () => {
      await expect(
        enforceBrandVoice(
          { brand: 'definitely-not-a-brand' as never, candidate: 'hi', surface: 'sms', sourceOfTruthJobId: 'x' },
          { trackingEnabled: false },
        ),
      ).rejects.toThrow(/unknown brand/);
    });

    it('reason strings follow stable Rn: format', async () => {
      const result = await enforceBrandVoice(
        {
          brand: 'dr',
          candidate: 'We finished the job. Reply STOP to opt out.',
          surface: 'sms',
          sourceOfTruthJobId: 'x',
        },
        { trackingEnabled: false },
      );
      expect(result.pass).toBe(false);
      for (const r of result.reasons) {
        expect(r).toMatch(/^R\d:/);
      }
    });

    it('NAP canonical missing → skip-with-evidence, NOT auto-fail', async () => {
      const result = await enforceBrandVoice(
        {
          brand: 'dr',
          candidate: 'Job 42 complete. Reply STOP to opt out.',
          surface: 'sms',
          sourceOfTruthJobId: 'x',
          napCitation: { businessName: 'Anything' },
        },
        { lookupCanonicalNap: async () => null, trackingEnabled: false },
      );
      expect(result.pass).toBe(true);
      expect(result.evidence_urls).toContain('nap_canonical_missing');
    });

    it('mention freshness row missing → skip-with-evidence, NOT auto-fail', async () => {
      const result = await enforceBrandVoice(
        {
          brand: 'dr',
          candidate: 'Brief note on the matter.',
          surface: 'outreach',
          mentionRef: { mentionId: 'm', sourceUrl: 'https://e.com' },
        },
        { lookupMentionFreshness: async () => null, trackingEnabled: false },
      );
      expect(result.pass).toBe(true);
      expect(result.evidence_urls).toContain('mention_unknown');
    });
  });

  describe('flesch-kincaid helper', () => {
    it('returns 0 grade for empty input', () => {
      expect(fleschKincaidGrade('').grade).toBe(0);
    });

    it('grades short simple text below grade 8', () => {
      const { grade } = fleschKincaidGrade('Hi. Job done. Thanks.');
      expect(grade).toBeLessThan(8);
    });

    it('grades long polysyllabic sentence above grade 8', () => {
      const { grade } = fleschKincaidGrade(
        'Notwithstanding contemporaneous deliberations regarding multidimensional methodologies, organisational reconciliations proceed.',
      );
      expect(grade).toBeGreaterThan(8);
    });
  });
});
