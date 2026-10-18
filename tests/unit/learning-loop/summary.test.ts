/**
 * Learning-loop summary and recommendation: each rule is tested with a case
 * that must fail it as well as one that passes, so the rules cannot be vacuous.
 */
import {
  differenceInterval,
  recommend,
  summarise,
  wilson,
  type CardEvent,
  type DataClass,
} from '@/lib/learning-loop/summary';
import { WHITE_RABBIT_CARD } from '@/lib/cards/white-rabbit';

const spec = { ...WHITE_RABBIT_CARD.experiment, minSessionsPerVariant: 3 };
let clock = 0;
function session(
  id: string,
  variant: string,
  steps: Array<Partial<CardEvent> & { type: CardEvent['type'] }>,
  dataClass: DataClass = 'pilot'
): CardEvent[] {
  return steps.map(s => ({
    sessionId: id,
    variant,
    dataClass,
    createdAt: new Date(Date.UTC(2026, 9, 18, 0, 0, clock++)).toISOString(),
    ...s,
  }));
}
const helped = (id: string, variant: string, dc: DataClass = 'pilot') =>
  session(
    id,
    variant,
    [
      { type: 'session_started' },
      { type: 'need_selected', needId: 'maps' },
      { type: 'action_shown', needId: 'maps' },
      { type: 'action_rated', rating: 'useful' },
      { type: 'contact_saved' },
    ],
    dc
  );
const notHelped = (id: string, variant: string) =>
  session(id, variant, [
    { type: 'session_started' },
    { type: 'need_selected', needId: 'calls' },
    { type: 'action_shown', needId: 'calls' },
    { type: 'action_rated', rating: 'not_useful' },
  ]);

describe('wilson', () => {
  it('matches the textbook interval for 8 of 10', () => {
    const w = wilson(8, 10);
    expect(w.rate).toBeCloseTo(0.8, 5);
    expect(w.low).toBeCloseTo(0.4902, 3);
    expect(w.high).toBeCloseTo(0.9433, 3);
  });
  it('has no interval without a denominator', () => {
    expect(wilson(0, 0)).toEqual({ rate: null, low: null, high: null });
  });
  it('difference interval contains zero for equal rates', () => {
    const d = differenceInterval(wilson(5, 10), wilson(5, 10));
    expect(d.rate).toBe(0);
    expect(d.low!).toBeLessThan(0);
    expect(d.high!).toBeGreaterThan(0);
  });
});

describe('summarise', () => {
  it('counts benefit only when a need was picked, an action shown and rated useful', () => {
    const ratedWithoutAction = session('s3', 'story', [
      { type: 'action_rated', rating: 'useful' },
    ]);
    const s = summarise(
      spec,
      [
        ...helped('s1', 'story'),
        ...notHelped('s2', 'story'),
        ...ratedWithoutAction,
      ],
      'pilot'
    );
    const story = s.variants.find(v => v.variant === 'story')!;
    expect(story.sessions).toBe(3);
    expect(story.useful).toBe(1);
    expect(story.qualifiedNextSteps).toBe(1);
  });

  it('keeps clicks and shares as diagnostics that never raise the useful count', () => {
    const clicker = session('c1', 'plain', [
      { type: 'session_started' },
      { type: 'brand_link_opened' },
      { type: 'shared' },
      { type: 'contact_saved' },
    ]);
    const s = summarise(spec, clicker, 'pilot');
    const plain = s.variants.find(v => v.variant === 'plain')!;
    expect(plain.useful).toBe(0);
    expect(plain.diagnostics).toEqual({
      contactSaved: 1,
      brandLinksOpened: 1,
      shared: 1,
    });
  });

  it('never mixes synthetic or preview data into a pilot result', () => {
    const s = summarise(
      spec,
      [
        ...helped('p1', 'story', 'synthetic'),
        ...helped('p2', 'story', 'preview'),
        ...notHelped('p3', 'story'),
      ],
      'pilot'
    );
    expect(s.sessions).toBe(1);
    expect(s.excludedByDataClass.synthetic).toBe(5);
    expect(s.excludedByDataClass.preview).toBe(5);
  });

  it('labels the claim: insufficient, observational for non-pilot data, causal only when randomised pilot meets the minimum', () => {
    const many = (dc: DataClass) =>
      ['story', 'plain'].flatMap(v =>
        [1, 2, 3].flatMap(i => helped(`${dc}-${v}-${i}`, v, dc))
      );
    expect(summarise(spec, helped('x', 'story'), 'pilot').claim).toBe(
      'insufficient_data'
    );
    expect(summarise(spec, many('preview'), 'preview').claim).toBe(
      'observational'
    );
    expect(summarise(spec, many('pilot'), 'pilot').claim).toBe('causal');
    expect(
      summarise({ ...spec, randomised: false }, many('pilot'), 'pilot').claim
    ).toBe('observational');
  });

  it('reports missing data instead of hiding it', () => {
    const shownNotRated = session(
      'u1',
      'story',
      [
        { type: 'need_selected', needId: 'maps' },
        { type: 'action_shown', needId: 'maps' },
      ],
      'preview'
    );
    const s = summarise(spec, shownNotRated, 'preview');
    expect(s.missingData.join(' ')).toMatch(/did not rate/);
    expect(s.missingData.join(' ')).toMatch(
      /no preview sessions for variant plain/
    );
    expect(s.missingData.join(' ')).toMatch(/not a customer result/);
  });
});

describe('recommend', () => {
  const pilot = (useful: number, not: number) =>
    summarise(
      spec,
      ['story', 'plain'].flatMap(v => [
        ...Array.from({ length: useful }, (_, i) =>
          helped(`${v}-u${i}`, v)
        ).flat(),
        ...Array.from({ length: not }, (_, i) =>
          notHelped(`${v}-n${i}`, v)
        ).flat(),
      ]),
      'pilot'
    );

  it('stops on any consent error regardless of results', () => {
    const s = summarise(
      spec,
      [
        ...(pilot(20, 0).variants.length ? helped('ok', 'story') : []),
        ...session('bad', 'story', [{ type: 'consent_error' }]),
      ],
      'pilot'
    );
    const r = recommend(spec, s);
    expect(r.verdict).toBe('stop');
    expect(r.stopConditionsHit.join(' ')).toMatch(/consent error/);
  });

  it('keeps when every variant clears the threshold at the lower bound', () => {
    expect(recommend(spec, pilot(30, 1)).verdict).toBe('keep');
  });

  it('stops when no variant can reach the stop threshold', () => {
    expect(recommend(spec, pilot(1, 30)).verdict).toBe('stop');
  });

  it('never earns keep from preview or synthetic data, however good', () => {
    const s = summarise(
      spec,
      ['story', 'plain'].flatMap(v =>
        Array.from({ length: 30 }, (_, i) =>
          helped(`${v}-${i}`, v, 'preview')
        ).flat()
      ),
      'preview'
    );
    const r = recommend(spec, s);
    expect(r.verdict).toBe('continue_observing');
    expect(r.requiredAuthority).toMatch(/owner/);
  });

  it('keeps observing with too few sessions', () => {
    expect(
      recommend(spec, summarise(spec, helped('one', 'story'), 'pilot')).verdict
    ).toBe('continue_observing');
  });
});
