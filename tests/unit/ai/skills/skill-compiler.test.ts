/**
 * Compiler — foundation budgeting and prompt structure.
 *
 * The budget is the part that matters most. `ceo-foundation.md` is 279 KB
 * (~70k tokens), and the Bedrock spec's pseudo-code concatenated the whole
 * foundation into every system prompt. Doing that here would dominate the
 * context window on every single invocation, so the cap and the honesty about
 * truncation are load-bearing rather than cosmetic.
 */

import {
  compileSkill,
  DEFAULT_FOUNDATION_CHAR_BUDGET,
} from '@/lib/ai/skills/skill-compiler';
import { loadFoundation, loadSkill } from '@/lib/ai/skills/skill-loader';
import type { SkillDefinition } from '@/lib/ai/skills/skill-loader';

const skill: SkillDefinition = {
  slug: 'test-skill',
  name: 'test-skill',
  description: 'A fixture.',
  operatesIn: ['L4'],
  consumesFrom: [],
  foundationAuthority: ['big.md'],
  governsItself: false,
  instructions: 'INSTRUCTION BODY',
};

const empty = { documents: new Map<string, string>(), missing: [] };

describe('compileSkill — structure', () => {
  it("puts the skill's own instructions first", () => {
    const { systemPrompt } = compileSkill(skill, empty);

    expect(systemPrompt.startsWith('INSTRUCTION BODY')).toBe(true);
  });

  it('always states the evidence discipline', () => {
    const { systemPrompt } = compileSkill(skill, empty);

    expect(systemPrompt).toContain('[VERIFIED]');
    expect(systemPrompt).toContain('[INFERENCE]');
    expect(systemPrompt).toContain('[UNCONFIRMED]');
  });

  it('includes a foundation document verbatim when it fits', () => {
    const { systemPrompt, foundationIncluded } = compileSkill(skill, {
      documents: new Map([['small.md', 'SHORT FOUNDATION']]),
      missing: [],
    });

    expect(systemPrompt).toContain('SHORT FOUNDATION');
    expect(foundationIncluded).toEqual([
      { filename: 'small.md', truncated: false },
    ]);
    expect(systemPrompt).not.toContain('(excerpt)');
  });

  it('tells the model which cited documents it did not receive', () => {
    const { systemPrompt, foundationMissing } = compileSkill(skill, {
      documents: new Map(),
      missing: ['tier-b-engineering-specs.md'],
    });

    expect(systemPrompt).toContain('tier-b-engineering-specs.md');
    expect(systemPrompt).toContain('unverified');
    expect(foundationMissing).toEqual(['tier-b-engineering-specs.md']);
  });
});

describe('compileSkill — foundation budget', () => {
  const oversized = 'x'.repeat(DEFAULT_FOUNDATION_CHAR_BUDGET * 3);

  it('caps an oversized document at the budget', () => {
    const { systemPrompt } = compileSkill(skill, {
      documents: new Map([['big.md', oversized]]),
      missing: [],
    });

    // Prompt carries the skill body and scaffolding too, so compare against the
    // budget plus a generous allowance rather than the raw document length.
    expect(systemPrompt.length).toBeLessThan(
      DEFAULT_FOUNDATION_CHAR_BUDGET + 2_000
    );
    expect(systemPrompt.length).toBeLessThan(oversized.length);
  });

  it('marks a truncated document as an excerpt rather than passing it off whole', () => {
    const { systemPrompt, foundationIncluded } = compileSkill(skill, {
      documents: new Map([['big.md', oversized]]),
      missing: [],
    });

    expect(foundationIncluded).toEqual([
      { filename: 'big.md', truncated: true },
    ]);
    expect(systemPrompt).toContain('(excerpt)');
    expect(systemPrompt).toContain('not the whole document');
  });

  it('honours a caller-supplied budget', () => {
    const { systemPrompt } = compileSkill(
      skill,
      { documents: new Map([['big.md', oversized]]), missing: [] },
      { foundationCharBudget: 100 }
    );

    expect(systemPrompt.length).toBeLessThan(2_000);
  });
});

describe('compileSkill — against the real senior-strategist', () => {
  it('keeps the 279 KB ceo-foundation.md from dominating the prompt', async () => {
    const strategist = await loadSkill('senior-strategist');
    const foundation = await loadFoundation(strategist.foundationAuthority);

    const { systemPrompt, foundationIncluded } = compileSkill(
      strategist,
      foundation
    );

    const ceo = foundationIncluded.find(
      f => f.filename === 'ceo-foundation.md'
    );
    expect(ceo?.truncated).toBe(true);

    // Unbudgeted this prompt would be ~320 KB. Three capped documents plus the
    // skill body must stay far below that.
    expect(systemPrompt.length).toBeLessThan(60_000);
    expect(
      foundation.documents.get('ceo-foundation.md')!.length
    ).toBeGreaterThan(200_000);
  });
});
