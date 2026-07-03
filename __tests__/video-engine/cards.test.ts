import {
  METHOD_CARDS,
  getMethodCard,
} from '@/lib/services/ai/video/cards/method-cards';
import {
  MODIFIER_CHIPS,
  getChips,
} from '@/lib/services/ai/video/cards/modifier-chips';
import { brandFragmentFromDna } from '@/lib/services/ai/video/cards/brand-cards';
import { composePrompt } from '@/lib/services/ai/video/cards/compose';

describe('card registry', () => {
  it('ships 9 method cards including freeform, each with a {{subject}} scaffold', () => {
    expect(METHOD_CARDS.length).toBe(9);
    expect(METHOD_CARDS.map(c => c.id)).toContain('freeform');
    for (const c of METHOD_CARDS.filter(c => c.id !== 'freeform')) {
      expect(c.promptScaffold).toContain('{{subject}}');
    }
  });

  it('ships chips across style, camera, lighting with camera the deepest', () => {
    const byCat = (cat: string) =>
      MODIFIER_CHIPS.filter(m => m.category === cat);
    expect(byCat('style').length).toBeGreaterThanOrEqual(4);
    expect(byCat('camera').length).toBeGreaterThanOrEqual(12);
    expect(byCat('lighting').length).toBeGreaterThanOrEqual(4);
  });

  it('composes scaffold + subject, then chips grouped by category order', () => {
    const out = composePrompt({
      methodCard: getMethodCard('product-reveal')!,
      subject: 'a cordless moisture meter',
      chips: getChips(['style-cinematic', 'camera-orbit']),
    });
    expect(out.prompt).toContain('a cordless moisture meter');
    expect(out.prompt.indexOf('a cordless moisture meter')).toBeLessThan(
      out.prompt.indexOf('cinematic')
    );
    expect(out.prompt).toMatch(/orbit/i);
  });

  it('appends the brand fragment last when provided', () => {
    const frag = brandFragmentFromDna({
      businessName: 'AquaDry',
      vertical: 'tradie',
      primaryColour: '#0044CC',
      secondaryColour: '#FFFFFF',
      tone: 'friendly and direct',
    });
    const out = composePrompt({
      methodCard: getMethodCard('product-reveal')!,
      subject: 'a cordless moisture meter',
      chips: [],
      brandFragment: frag,
    });
    expect(out.prompt.endsWith(frag)).toBe(true);
    expect(frag).toContain('AquaDry');
    expect(frag).toContain('#0044CC');
  });

  it('merges chip params under card params (card wins conflicts)', () => {
    const out = composePrompt({
      methodCard: {
        ...getMethodCard('product-reveal')!,
        params: { motion: 'slow' },
      },
      subject: 'x',
      chips: [
        {
          id: 'test-chip',
          category: 'style',
          name: 'Test',
          promptFragment: 'test look',
          params: { motion: 'fast', grain: 'fine' },
        },
      ],
    });
    expect(out.params.motion).toBe('slow'); // card-last wins
    expect(out.params.grain).toBe('fine');
  });
});
