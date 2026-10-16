/**
 * @jest-environment node
 *
 * REE Phase 2 — shared evidence states (REE-SPEC §6) and honest schema copy.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  EVIDENCE_STATES,
  EVIDENCE_STATE_LABELS,
  formatReading,
  notObserved,
  observed,
  observedNumber,
  type EvidenceReading,
} from '@/lib/ree/evidence-state';
import { analyzeForHealing } from '@/lib/experiments/self-healer';
import { suggestExperiments } from '@/lib/experiments/experiment-designer';
import { analyzeSchema } from '@/lib/geo/schema-enhancer';

jest.mock('@/lib/prisma', () => ({
  prisma: { healingAction: { createMany: jest.fn() } },
}));

const PROMISE =
  /improves? rich results?|rich results? eligibility|GEO compliance|strong GEO|AI citability/i;

describe('evidence states', () => {
  it('has exactly the six REE states', () => {
    expect([...EVIDENCE_STATES]).toEqual([
      'OBSERVED',
      'UNAVAILABLE',
      'UNAUTHORISED',
      'UNSUPPORTED',
      'STALE',
      'PARTIAL',
    ]);
  });

  it.each(Object.entries(EVIDENCE_STATE_LABELS))(
    '%s renders its label, never a number',
    (state, label) => {
      const reading = notObserved<number>(state as never, 'test', 'reason');
      expect(reading.value).toBeNull();
      expect(formatReading(reading)).toBe(label);
      expect(formatReading(reading)).not.toMatch(/\d/);
    }
  );

  it('keeps a measured zero and negative values', () => {
    expect(formatReading(observed(0, 'test'))).toBe('0');
    expect(formatReading(observed(-3, 'test'))).toBe('-3');
  });

  it.each([undefined, null, NaN, Infinity, '5'])(
    'never turns %p into an observation',
    value => {
      const reading = observedNumber(value, 'test');
      expect(reading.state).toBe('UNAVAILABLE');
      expect(formatReading(reading)).toBe('Unavailable');
    }
  );

  it('does not render a non-finite value even if mislabelled OBSERVED', () => {
    const forged = {
      state: 'OBSERVED',
      value: NaN,
      source: 'test',
    } as EvidenceReading<number>;
    expect(formatReading(forged)).toBe('Unavailable');
  });
});

describe('schema copy makes no search-appearance promises', () => {
  it('self-healer missing-schema and low-score issues are neutral and diagnostic', async () => {
    const issues = await analyzeForHealing('https://example.com', 'u1', 'o1', {
      hasSchema: false,
      geoScore: 30,
    });
    const schema = issues.find(i => i.issueType === 'broken-schema');
    const geo = issues.find(i => i.issueType === 'low-geo-score');
    expect(schema?.estimatedImpact).toMatch(
      /does not guarantee rich results or AI citations/
    );
    expect(geo?.description).toMatch(/diagnostic/);
    expect(geo?.suggestedFix).toMatch(
      /Google no longer shows FAQ rich results/
    );
    for (const issue of [schema, geo]) {
      expect(JSON.stringify(issue)).not.toMatch(PROMISE);
      expect(JSON.stringify(issue)).not.toMatch(
        /rarely cited|AI search visibility/
      );
    }
  });

  it('experiment designer schema suggestion is neutral', () => {
    const suggestion = suggestExperiments('https://example.com', {
      hasSchema: false,
    } as never).find(s => s.experimentType === 'schema');
    expect(suggestion?.hypothesis).toMatch(
      /does not guarantee rich results or AI citations/
    );
    expect(`${suggestion?.hypothesis} ${suggestion?.rationale}`).not.toMatch(
      PROMISE
    );
  });

  it('schema enhancer explains FAQ retirement and drops GEO compliance', () => {
    const none = analyzeSchema('Plain page with no markup');
    expect(none[0].recommendation).toMatch(
      /does not guarantee search features or AI citations/
    );

    const qa = analyzeSchema(
      '<script type="application/ld+json">{"@context":"https://schema.org","@type":"Article","author":{}}</script>\nWhat is it?\nHow much?\nWhen?\n'
    );
    const faq = qa.find(i => i.type === 'missing_faq');
    expect(faq?.recommendation).toMatch(
      /Google no longer shows FAQ rich results/
    );
    const speakable = qa.find(i => i.type === 'missing_speakable');
    expect(speakable?.message).not.toMatch(/reduces|eligibility/);
    expect(JSON.stringify([...none, ...qa])).not.toMatch(PROMISE);
  });

  it('schema preview heading is not presented as a Google rich result', () => {
    const page = readFileSync(
      join(process.cwd(), 'app/dashboard/seo/schema/page.tsx'),
      'utf8'
    );
    expect(page).toContain('Structured Data Preview');
    expect(page).toContain('Google no longer shows FAQ rich results');
    expect(page).not.toContain('Rich Results Preview');
    expect(page).not.toContain(
      'How your schema may appear in Google Search results'
    );
  });
});
