import {
  VIRAL_METHOD_CARDS,
  VIRAL_METHOD_CARDS_AS_METHOD,
  VIRAL_SAFE_ZONE,
  VIRAL_CARDS_VERSION,
  getViralCard,
  viralToMethodCard,
} from '@/lib/services/ai/video/cards/viral-method-cards';
import {
  METHOD_CARDS,
  getMethodCard,
} from '@/lib/services/ai/video/cards/method-cards';
import { getChips } from '@/lib/services/ai/video/cards/modifier-chips';
import { composePrompt } from '@/lib/services/ai/video/cards/compose';
import viralDoc from '@/lib/services/ai/video/cards/viral-method-cards.json';
import viralSchema from '@/lib/services/ai/video/cards/viral-method-cards.schema.json';

describe('viral method cards document', () => {
  it('carries a semver version and the four viral grammar cards', () => {
    expect(VIRAL_CARDS_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
    expect(VIRAL_METHOD_CARDS.map(c => c.id)).toEqual([
      'viral-hero-short',
      'pattern-interrupt-open',
      'retention-3beat',
      'loop-back-close',
    ]);
  });

  it('uses unique kebab-case ids that do not collide with the base deck', () => {
    const ids = VIRAL_METHOD_CARDS.map(c => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    const baseIds = new Set(METHOD_CARDS.map(c => c.id));
    for (const id of ids) expect(baseIds.has(id)).toBe(false);
  });

  it('hero short is 9:16, <=15s, with contiguous beats covering 0-7s', () => {
    const hero = getViralCard('viral-hero-short');
    expect(hero).toBeDefined();
    expect(hero!.aspect).toBe('9:16');
    expect(hero!.maxDurationSec).toBeLessThanOrEqual(15);

    const beats = hero!.beats ?? [];
    expect(beats.length).toBe(6);
    let cursor = 0;
    for (const beat of beats) {
      const match = beat.window.match(/^(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)s$/);
      expect(match).not.toBeNull();
      const start = Number(match![1]);
      const end = Number(match![2]);
      expect(start).toBeCloseTo(cursor); // no gap, no overlap
      expect(end).toBeGreaterThan(start);
      cursor = end;
    }
    expect(cursor).toBe(7); // the 7-second spine
  });

  it('hero delegates hook and caption copy to nexus-copywriter', () => {
    const hero = getViralCard('viral-hero-short')!;
    expect(hero.requires).toEqual(['hook_copy', 'caption_track']);
    for (const requirement of hero.requires!) {
      expect(hero.delegates?.[requirement]).toBe('nexus-copywriter');
    }
  });

  it('safe zone reserves platform chrome and demands muted-legible captions', () => {
    expect(VIRAL_SAFE_ZONE.bottomReservedPct).toBeGreaterThan(0);
    expect(VIRAL_SAFE_ZONE.bottomReservedPct).toBeLessThan(100);
    expect(VIRAL_SAFE_ZONE.rightReservedPct).toBeGreaterThan(0);
    expect(VIRAL_SAFE_ZONE.rightReservedPct).toBeLessThan(100);
    expect(VIRAL_SAFE_ZONE.captionMaxLines).toBe(2);
    expect(VIRAL_SAFE_ZONE.captionLeadMs).toBeGreaterThan(0);
    expect(VIRAL_SAFE_ZONE.mutedLegible).toBe(true);
  });

  it('points at the schema shipped alongside it, and the schema guards the shape', () => {
    expect((viralDoc as { $schema: string }).$schema).toBe(
      './viral-method-cards.schema.json'
    );
    expect(viralSchema.required).toEqual(
      expect.arrayContaining(['version', 'cards', 'safeZone'])
    );
    expect(viralSchema.definitions.card.required).toEqual(
      expect.arrayContaining(['id', 'label', 'intent'])
    );
  });

  // No JSON Schema validator ships in the repo, so the schema's contract is
  // executed here directly: patterns, required fields, and the
  // additionalProperties:false property lists must all hold for the document.
  it('schema patterns and required fields accept the shipped document', () => {
    const versionPattern = new RegExp(viralSchema.properties.version.pattern);
    const idPattern = new RegExp(
      viralSchema.definitions.card.properties.id.pattern
    );
    const windowPattern = new RegExp(
      viralSchema.definitions.beat.properties.window.pattern
    );
    // The patterns must keep their teeth — loosening them fails here.
    expect('2-3').not.toMatch(windowPattern); // missing trailing 's'
    expect('Not-Kebab').not.toMatch(idPattern);
    expect('1.0').not.toMatch(versionPattern);

    expect(viralDoc.version).toMatch(versionPattern);
    for (const card of VIRAL_METHOD_CARDS) {
      expect(card.id).toMatch(idPattern);
      for (const required of viralSchema.definitions.card.required) {
        expect(card).toHaveProperty(required);
      }
      for (const beat of card.beats ?? []) {
        expect(beat.window).toMatch(windowPattern);
        for (const required of viralSchema.definitions.beat.required) {
          expect(beat).toHaveProperty(required);
        }
      }
    }
  });

  it('document uses only properties the schema declares (additionalProperties: false)', () => {
    const rootProps = Object.keys(viralSchema.properties);
    for (const key of Object.keys(viralDoc)) expect(rootProps).toContain(key);

    const cardProps = Object.keys(viralSchema.definitions.card.properties);
    const beatProps = Object.keys(viralSchema.definitions.beat.properties);
    for (const card of VIRAL_METHOD_CARDS) {
      for (const key of Object.keys(card)) expect(cardProps).toContain(key);
      for (const beat of card.beats ?? []) {
        for (const key of Object.keys(beat)) expect(beatProps).toContain(key);
      }
    }

    const safeZoneProps = Object.keys(
      viralSchema.definitions.safeZone.properties
    );
    for (const key of Object.keys(VIRAL_SAFE_ZONE)) {
      expect(safeZoneProps).toContain(key);
    }
  });
});

describe('viral -> MethodCard bridge (composer consumption)', () => {
  it('bridges every viral card with a {{subject}} scaffold in the viral category', () => {
    expect(VIRAL_METHOD_CARDS_AS_METHOD.length).toBe(VIRAL_METHOD_CARDS.length);
    for (const card of VIRAL_METHOD_CARDS_AS_METHOD) {
      expect(card.promptScaffold).toContain('{{subject}}');
      expect(card.category).toBe('viral');
      expect(card.requiresImage).toBe(false);
      expect(card.exampleSubjects).toHaveLength(3);
    }
  });

  it('keeps hero beat windows in the scaffold but strips delegation notes', () => {
    const hero = viralToMethodCard(getViralCard('viral-hero-short')!);
    expect(hero.promptScaffold).toContain('0.0-0.5s');
    expect(hero.promptScaffold).toContain('pattern interrupt');
    for (const card of VIRAL_METHOD_CARDS_AS_METHOD) {
      expect(card.promptScaffold).not.toContain('nexus-copywriter');
      expect(card.promptScaffold).not.toMatch(/\(from /);
    }
  });

  it('strips delegation notes from every scaffold field, not just beat rules', () => {
    const bridged = viralToMethodCard({
      id: 'note-card',
      label: 'Note',
      intent: 'an intent (from nexus-copywriter)',
      modifiers: ['a modifier (from nexus-anything)'],
      rule: 'a rule (from nexus-copywriter)',
    });
    expect(bridged.promptScaffold).not.toContain('nexus-');
    expect(bridged.promptScaffold).toContain(
      'an intent, featuring {{subject}}'
    );
    expect(bridged.promptScaffold).toContain('a modifier');
    expect(bridged.promptScaffold).toContain('a rule');
  });

  it('carries the negative list as the negative prompt', () => {
    const hero = viralToMethodCard(getViralCard('viral-hero-short')!);
    expect(hero.negativePrompt).toContain('logo sting');
    expect(hero.negativePrompt).toContain('dead middle');
    const retention = viralToMethodCard(getViralCard('retention-3beat')!);
    expect(retention.negativePrompt).toBeUndefined();
  });

  it('bridges future cards without a curated example set via the fallback trio', () => {
    const bridged = viralToMethodCard({
      id: 'new-card',
      label: 'New',
      intent: 'test intent',
    });
    expect(bridged.exampleSubjects).toHaveLength(3);
    expect(bridged.promptScaffold).toBe('test intent, featuring {{subject}}');
  });

  it('getMethodCard resolves viral ids without disturbing the base deck', () => {
    expect(getMethodCard('viral-hero-short')?.category).toBe('viral');
    expect(getMethodCard('pattern-interrupt-open')?.category).toBe('viral');
    expect(getMethodCard('product-reveal')?.category).toBe('product');
    expect(getMethodCard('does-not-exist')).toBeUndefined();
    // Viral cards resolve for generation but never join the base deck.
    expect(METHOD_CARDS.length).toBe(9);
    expect(METHOD_CARDS.some(c => c.category === 'viral')).toBe(false);
  });

  it('composes through the existing card composer: subject, then chips, brand last', () => {
    const out = composePrompt({
      methodCard: getMethodCard('viral-hero-short')!,
      subject: 'a 3-second water-damage myth',
      chips: getChips(['style-documentary']),
      brandFragment: 'in the AquaDry brand style',
    });
    expect(out.prompt).toContain('a 3-second water-damage myth');
    expect(out.prompt.indexOf('a 3-second water-damage myth')).toBeLessThan(
      out.prompt.indexOf('gritty documentary')
    );
    expect(out.prompt.endsWith('in the AquaDry brand style')).toBe(true);
    expect(out.negativePrompt).toContain('slow intro');
  });
});
