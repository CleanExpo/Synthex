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
    headline: 'Faster help after a flood',
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
      ['headline', 'stat', 'cta'],
    ],
    [
      'comparison',
      {
        kind: 'comparison',
        oldWay: 'Arrive in 90 minutes',
        newWay: 'Arrive in 38 minutes',
      },
      ['headline', 'compare', 'cta'],
    ],
    [
      'case-study',
      {
        kind: 'case-study',
        challenge: 'Flooded homes',
        solution: 'Crews on call',
        result: 'Homes dried',
        metric: '42',
      },
      ['headline', 'headline', 'headline', 'stat', 'cta'],
    ],
    [
      'how-to',
      { kind: 'how-to', steps: [{ step: 'Call us' }, { step: 'We arrive' }] },
      ['headline', 'item', 'item', 'cta'],
    ],
    [
      'list',
      { kind: 'list', items: ['Fast arrival', 'Drying crews'] },
      ['headline', 'item', 'item', 'cta'],
    ],
    [
      'explainer',
      { kind: 'explainer', scenes: [{ text: 'Water damage spreads fast' }] },
      ['headline', 'headline', 'cta'],
    ],
  ])(
    '%s becomes headline → content beats → CTA in the house style',
    (_k, content, kinds) => {
      const plan = planMotion(brief({ content: content as never }), style);
      expect(plan.compositionId).toBe('MotionStudio');
      expect(plan.issues).toEqual([]);
      expect(plan.props.beats.map(b => b.kind)).toEqual(kinds);
      expect(plan.props.beats[0]).toMatchObject({
        kind: 'headline',
        text: 'Faster help after a flood',
      });
      expect(plan.props.beats.at(-1)).toMatchObject({
        kind: 'cta',
        text: 'Call 24/7',
      });
      expect(plan.props.style.primary).toBe(style.colours.primary);
      expect(plan.props.style.signature).toBe(style.motion.signature);
      expect(plan.props.beats.reduce((n, b) => n + b.durationInFrames, 0)).toBe(
        plan.durationInFrames
      );
      expect(plan.factCheck.ok).toBe(true);
    }
  );

  it('uses no placeholder copy: every on-screen line comes from the brief', () => {
    const plan = planMotion(
      brief({ content: { kind: 'list', items: ['Fast arrival'] } }),
      style
    );
    expect(plan.onScreen).toEqual([
      'Faster help after a flood',
      'Fast arrival',
      'Call 24/7',
    ]);
    expect(JSON.stringify(plan.props)).not.toMatch(/What matters|How it works/);
  });

  it.each([
    ['feed-portrait', 'MotionStudioPortrait', 1080, 1920],
    ['feed-square', 'MotionStudioSquare', 1080, 1080],
    ['youtube', 'MotionStudio', 1920, 1080],
  ])('%s renders on %s', (placement, id, w, h) => {
    const plan = planMotion(brief({ placement: placement as never }), style);
    expect([plan.compositionId, plan.width, plan.height]).toEqual([id, w, h]);
  });

  it('runs exactly the length the brief asks for', () => {
    const plan = planMotion(brief({ durationSeconds: 15 }), style);
    expect(plan.durationInFrames).toBe(450);
    expect(plan.props.durationInFrames).toBe(450);
  });

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

  it('list ordinals are not treated as claims', () => {
    const plan = planMotion(
      brief({
        content: {
          kind: 'list',
          items: ['Fast arrival', 'Drying crews', 'Clear reports'],
        },
      }),
      style
    );
    expect(plan.factCheck.ok).toBe(true);
    expect(
      plan.props.beats
        .filter(b => b.kind === 'item')
        .map(b => (b as { index: string }).index)
    ).toEqual(['1', '2', '3']);
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

  it('muted feeds allow 6 words per line, not 7', () => {
    const six = { kind: 'list' as const, items: ['Crews on site in under an'] };
    const seven = {
      kind: 'list' as const,
      items: ['Crews on site in under an hour'],
    };
    expect(MAX_WORDS_MUTED).toBe(6);
    expect(
      planMotion(brief({ placement: 'feed-square', content: six }), style)
        .issues
    ).toEqual([]);
    expect(
      planMotion(
        brief({ placement: 'feed-square', content: seven }),
        style
      ).issues.join(' ')
    ).toMatch(/7 words, max 6/);
  });

  it('refuses to cram too many beats into a short video', () => {
    const content = {
      kind: 'explainer' as const,
      scenes: Array.from({ length: 8 }, (_, i) => ({
        text: `Point ${'abcdefgh'[i]}`,
      })),
    };
    const plan = planMotion(brief({ durationSeconds: 6, content }), style);
    expect(plan.issues.join(' ')).toMatch(/Too much for 6s/);
  });

  it('plans one critique still per second', () => {
    const plan = planMotion(brief(), style);
    expect(plan.critiqueFrames.length).toBe(20);
    expect(plan.critiqueFrames[0]).toBe(29);
  });
});

describe('Claude Motion hand-off brief', () => {
  it('follows the guide shape: canvas, look, audience, timed scenes, avoid, done means', () => {
    const b = brief({
      placement: 'feed-portrait',
      content: { kind: 'list', items: ['Fast arrival'] },
    });
    const style = resolveHouseStyle('dr');
    const plan = planMotion(b, style);
    const text = buildClaudeMotionBrief(b, style, plan);
    expect(text).toMatch(
      /^Make a 20-second animation for Disaster Recovery\. 1080 x 1920, 30 frames a second\./
    );
    expect(text).toContain(`The look: ${style.colours.background} background`);
    expect(text).toContain('Who watches and where: Brisbane homeowners.');
    expect(text).toContain(
      'It plays muted, so every point must read as words on screen.'
    );
    const scenes = text.split('\n').filter(l => /^Scene \d+ \(/.test(l));
    expect(scenes).toHaveLength(plan.props.beats.length);
    expect(scenes[0]).toContain('"Faster help after a flood"');
    const secs = scenes.map(l => Number(l.match(/\((\d+\.\d) s\)/)![1]));
    expect(secs.reduce((a, n) => a + n, 0)).toBeCloseTo(20, 0);
    expect(text).toContain('Avoid: more than 6 words on screen at once');
    expect(text).toContain('Done means:');
    expect(text).toContain(SOURCE);
    expect(text).not.toContain('#00B140');
  });

  it('asks for a green background only for the overlay placement', () => {
    const b = brief({ placement: 'overlay-green' });
    const style = resolveHouseStyle('dr');
    const text = buildClaudeMotionBrief(b, style, planMotion(b, style));
    expect(text).toContain('Background: solid green #00B140');
  });
});
