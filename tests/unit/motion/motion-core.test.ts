/**
 * @jest-environment node
 */
import {
  MotionBriefSchema,
  buildClaudeMotionBrief,
  checkFigures,
  computeDerived,
  extractFigures,
  planMotion,
  resolveHouseStyle,
  styleParagraph,
  MAX_WORDS_MUTED,
  type MotionBrief,
} from '@/lib/motion';
import { brands } from '@unite-group/brand-config';

const SOURCE =
  'Last month our crews dried 42 flooded homes in Brisbane. Average arrival time fell from 90 minutes to 38 minutes. 1,800 visitors, 210 bookings. We answer 24/7.';

const brief = (over: Partial<MotionBrief> = {}): MotionBrief =>
  MotionBriefSchema.parse({
    brand: 'dr',
    placement: 'youtube',
    durationSeconds: 20,
    audience: 'Brisbane homeowners',
    cta: 'Call 24/7',
    source: SOURCE,
    content: {
      kind: 'stat',
      stat: '38 minutes',
      label: 'Average arrival time',
      context: 'Down from 90 minutes',
    },
    ...over,
  });

describe('house style', () => {
  it('comes from the brand config, not from memory', () => {
    const style = resolveHouseStyle('dr');
    expect(style.colours.primary).toBe(brands.dr.colour.primary);
    expect(style.motion.signature).toBe(brands.dr.motion.signature);
    expect(style.motion.easingIn).toBe(brands.dr.motion.easing.in);
    const p = styleParagraph(style);
    expect(p).toContain(brands.dr.colour.primary);
    expect(p).toContain('Nothing moves linearly');
    expect(p).toContain('No stock, no invented people or footage');
  });
});

describe('fact guard', () => {
  it('reads currency, commas and percentages', () => {
    expect(extractFigures('$1,300 and 22.5% of 4')).toEqual([
      { raw: '$1,300', value: 1300, percent: false },
      { raw: '22.5%', value: 22.5, percent: true },
      { raw: '4', value: 4, percent: false },
    ]);
  });

  it('allows figures from the source and blocks invented ones', () => {
    expect(checkFigures(['42 homes dried', '38 minutes'], SOURCE).ok).toBe(
      true
    );
    const bad = checkFigures(['43 homes dried', '50% faster'], SOURCE);
    expect(bad.ok).toBe(false);
    expect(bad.unsupported).toEqual(['43', '50%']);
  });

  it('a percent is not the same figure as a plain number', () => {
    expect(checkFigures(['42%'], SOURCE).ok).toBe(false);
  });

  it('allows a declared derived figure only when recomputed from source inputs', () => {
    const conv = {
      label: 'conversion',
      operation: 'percent' as const,
      inputs: [210, 1800],
      decimals: 1,
    };
    expect(computeDerived(conv).value).toBe(11.7);
    expect(checkFigures(['11.7% booked'], SOURCE, [conv]).ok).toBe(true);
    expect(checkFigures(['12% booked'], SOURCE, [conv]).ok).toBe(false);
    const invented = { ...conv, inputs: [250, 1800] };
    const r = checkFigures(['13.9% booked'], SOURCE, [invented]);
    expect(r.ok).toBe(false);
    expect(r.unsupported).toContain('conversion: inputs not found in source');
    // The figure itself must be blocked too, not only the declaration.
    expect(r.unsupported).toContain('13.9%');
  });
});

describe('planner', () => {
  const style = resolveHouseStyle('dr');

  it.each([
    [
      'stat',
      {
        kind: 'stat',
        stat: '38 minutes',
        label: 'Average arrival time',
        context: 'Down from 90 minutes',
      },
      'StatReveal',
    ],
    [
      'comparison',
      {
        kind: 'comparison',
        oldWay: 'Arrive in 90 minutes',
        newWay: 'Arrive in 38 minutes',
      },
      'ComparisonSlide',
    ],
    [
      'case-study',
      {
        kind: 'case-study',
        challenge: 'Flooded homes',
        solution: 'Crews on call',
        result: '42 homes dried',
        metric: '42',
      },
      'CaseStudyVideo',
    ],
    [
      'how-to',
      { kind: 'how-to', steps: [{ step: 'Call us' }, { step: 'We arrive' }] },
      'HowToVideo',
    ],
    [
      'list',
      { kind: 'list', items: ['Fast arrival', 'Drying crews'] },
      'ListicleVideo',
    ],
    [
      'explainer',
      { kind: 'explainer', scenes: [{ text: 'Water damage spreads fast' }] },
      'ExplainerVideo',
    ],
  ])(
    '%s maps to %s with brand colour and only source figures',
    (_k, content, id) => {
      const plan = planMotion(brief({ content: content as never }), style);
      expect(plan.compositionId).toBe(id);
      expect(plan.issues).toEqual([]);
      expect(plan.props?.brandColour).toBe(style.colours.primary);
      expect(plan.factCheck.ok).toBe(true);
    }
  );

  it('blocks a plan with an invented number', () => {
    const plan = planMotion(
      brief({
        content: {
          kind: 'stat',
          stat: '20 minutes',
          label: 'Arrival',
          context: 'Fast',
        },
      }),
      style
    );
    expect(plan.factCheck.unsupported).toEqual(['20']);
    expect(plan.issues.join(' ')).toMatch(
      /Figures not found in the source: 20/
    );
  });

  it('enforces the muted-feed word limit but not with sound', () => {
    const long = 'Our certified crews arrive with drying equipment really fast';
    expect(long.split(' ').length).toBeGreaterThan(MAX_WORDS_MUTED);
    const content = { kind: 'list' as const, items: [long] };
    expect(
      planMotion(
        brief({ placement: 'feed-portrait', content }),
        style
      ).issues.join(' ')
    ).toMatch(/Too long to read/);
    expect(
      planMotion(brief({ placement: 'youtube', content }), style).issues
    ).toEqual([]);
  });

  it('refuses a placement with no matching composition instead of guessing', () => {
    const plan = planMotion(brief({ placement: 'feed-portrait' }), style);
    expect(plan.compositionId).toBeNull();
    expect(plan.props).toBeNull();
    expect(plan.issues[0]).toMatch(/No 9:16 composition exists for "stat"/);
  });

  it('uses the portrait reel for list content and splits scenes across the runtime', () => {
    const plan = planMotion(
      brief({
        placement: 'feed-portrait',
        content: { kind: 'list', items: ['Fast arrival', 'Drying crews'] },
      }),
      style
    );
    expect(plan.compositionId).toBe('SocialReel');
    const scenes = plan.props?.scenes as { text: string; duration: number }[];
    expect(scenes.map(s => s.text)).toEqual([
      'Fast arrival',
      'Drying crews',
      'Call 24/7',
    ]);
    expect(scenes.reduce((n, s) => n + s.duration, 0)).toBeLessThanOrEqual(
      plan.durationInFrames
    );
  });

  it('plans one critique still per second', () => {
    const plan = planMotion(brief(), style);
    expect(plan.critiqueFrames.length).toBe(plan.durationInFrames / plan.fps);
    expect(plan.critiqueFrames[0]).toBe(plan.fps - 1);
  });
});

describe('Claude Motion hand-off brief', () => {
  it('carries the brief, source, house style and self-critique', () => {
    const b = brief({
      placement: 'feed-portrait',
      content: { kind: 'list', items: ['Fast arrival'] },
    });
    const style = resolveHouseStyle('dr');
    const text = buildClaudeMotionBrief(b, style, planMotion(b, style));
    expect(text).toMatch(
      /^Make a 20-second 9:16 animation for Brisbane homeowners/
    );
    expect(text).toContain(
      'It plays muted, so every point must read as words on screen.'
    );
    expect(text).toContain(
      'Do not add, round or calculate any number that is not listed.'
    );
    expect(text).toContain(SOURCE);
    expect(text).toContain(style.colours.primary);
    expect(text).toContain('render a still every 1 second');
  });
});
