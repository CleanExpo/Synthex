/**
 * Skill loader — parsing, traversal refusal, and foundation resolution.
 *
 * These read the real catalogue rather than fixtures. That is the point: the
 * loader's job is to parse 17 SKILL.md files written by hand over months, so a
 * fixture proving it can parse a fixture would prove nothing about whether the
 * product can actually invoke `senior-strategist` today.
 */

import {
  loadFoundation,
  loadSkill,
  SkillLoadError,
} from '@/lib/ai/skills/skill-loader';
import { PRODUCT_INVOCABLE_SKILLS } from '@/lib/ai/skills/policy';

describe('loadSkill — the real catalogue', () => {
  it('parses senior-strategist into its declared shape', async () => {
    const skill = await loadSkill('senior-strategist');

    expect(skill.slug).toBe('senior-strategist');
    expect(skill.name).toBe('senior-strategist');
    expect(skill.description).toContain('Senior Strategist');
    // Layer codes, NOT the nexus/external-client values the Bedrock spec
    // assumed — the reason isolation cannot be keyed on this field.
    expect(skill.operatesIn).toEqual(['L4', 'L6', 'L8']);
    expect(skill.consumesFrom).toContain('analytics-lead');
    expect(skill.foundationAuthority).toEqual([
      'ceo-foundation.md',
      'verification-gates.md',
      'skill-orchestration-spec.md',
    ]);
    expect(skill.linear).toBe('SYN-806');
  });

  it('returns the markdown body as the instructions, without frontmatter', async () => {
    const skill = await loadSkill('senior-strategist');

    expect(skill.instructions.length).toBeGreaterThan(500);
    expect(skill.instructions).not.toContain('foundation_authority:');
    expect(skill.instructions.startsWith('---')).toBe(false);
  });

  it.each(PRODUCT_INVOCABLE_SKILLS)(
    '%s loads with instructions and a description',
    async slug => {
      const skill = await loadSkill(slug);

      expect(skill.description.trim()).not.toBe('');
      expect(skill.instructions.trim()).not.toBe('');
    }
  );
});

describe('loadSkill — name validation', () => {
  // A skill name can arrive from a request body, so traversal is the first
  // thing to refuse, before any filesystem access happens.
  const rejected = [
    '../../../etc/passwd',
    '..',
    'senior-strategist/../../secrets',
    'nested/path',
    'Senior-Strategist',
    'skill_with_underscores',
    '-leading-hyphen',
    '',
    '.',
  ];

  it.each(rejected)('refuses %p', async name => {
    await expect(loadSkill(name)).rejects.toThrow(SkillLoadError);
  });

  it('reports invalid-skill-name rather than skill-not-found for traversal', async () => {
    // The distinction matters: a "not found" would imply the path was looked up.
    await expect(loadSkill('../../etc/passwd')).rejects.toMatchObject({
      code: 'invalid-skill-name',
    });
  });

  it('reports skill-not-found for a well-formed name that does not exist', async () => {
    await expect(loadSkill('no-such-skill-exists')).rejects.toMatchObject({
      code: 'skill-not-found',
    });
  });
});

describe('loadFoundation', () => {
  it('reads the documents a skill cites', async () => {
    const { documents, missing } = await loadFoundation([
      'verification-gates.md',
      'skill-orchestration-spec.md',
    ]);

    expect([...documents.keys()].sort()).toEqual([
      'skill-orchestration-spec.md',
      'verification-gates.md',
    ]);
    expect(documents.get('verification-gates.md')).toContain('VG-');
    expect(missing).toEqual([]);
  });

  it('reports an absent document as missing instead of throwing', async () => {
    // tier-b-engineering-specs.md is cited by a skill but has never existed.
    // Refusing to invoke would take that skill down over a documentation gap.
    const { documents, missing } = await loadFoundation([
      'verification-gates.md',
      'tier-b-engineering-specs.md',
    ]);

    expect(missing).toEqual(['tier-b-engineering-specs.md']);
    expect(documents.has('verification-gates.md')).toBe(true);
  });

  it('refuses a citation that escapes the foundation directory', async () => {
    const { documents, missing } = await loadFoundation([
      '../../../etc/passwd',
    ]);

    expect(documents.size).toBe(0);
    expect(missing).toEqual(['../../../etc/passwd']);
  });

  it('returns nothing for a skill that governs itself', async () => {
    const { documents, missing } = await loadFoundation([]);

    expect(documents.size).toBe(0);
    expect(missing).toEqual([]);
  });
});
