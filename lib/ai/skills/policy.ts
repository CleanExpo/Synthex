/**
 * Which skills the product may invoke, and why the list is explicit.
 *
 * The `.claude/skills/` catalogue holds 85 entries, but most are for an agent
 * working in the IDE: they instruct the reader to edit files, drive a browser,
 * run a build, or shell out. Executing those against a live request would ask a
 * model to describe actions the product cannot perform and has no gate for.
 *
 * So invocation is allowlisted rather than deny-listed. A new capability opts
 * in deliberately; nothing becomes reachable from an HTTP request merely by
 * landing a SKILL.md.
 *
 * This is also where the Bedrock spec's "cross-client isolation" requirement
 * actually lands. That document keyed isolation on
 * `operates_in: ["nexus"] | ["external-client"]`, values no skill in this repo
 * has ever carried — every skill uses orchestration layers (`L1`–`L9`) there
 * instead. Isolation therefore cannot come from frontmatter, and the boundary
 * that does hold is this list plus the org-scoping every caller already applies.
 */

/**
 * The senior agency skills, each named by a row of
 * `docs/pm/capability-matrix.csv`. Product-invocable entries are present on
 * disk; rows still recorded as UI_PARTIAL are a wiring gap, not a missing
 * SKILL.md.
 *
 * Deliberately excluded: anything whose instructions assume filesystem writes,
 * browser control, or shell access — `foundation-keeper` edits foundation files,
 * `codex-local` and `cli-anything` shell out, the `browser-*` family drives a
 * browser. Those stay IDE-only until the product can offer the tools they
 * expect.
 */
export const PRODUCT_INVOCABLE_SKILLS = [
  'analytics-lead',
  'brand-voice-enforce',
  'client-retention',
  'creative-director',
  'cro-specialist',
  'customer-insights-lead',
  'email-specialist',
  'local-seo-geo-veteran',
  'marketing-operations-director',
  'paid-performance-marketer',
  'performance-attribution-lead',
  'platform-content-adaptor',
  'platform-content-optimiser',
  'pr-communications-lead',
  'research-lead',
  'senior-cmo',
  'senior-copywriter',
  'senior-strategist',
] as const;

export type InvocableSkill = (typeof PRODUCT_INVOCABLE_SKILLS)[number];

const INVOCABLE = new Set<string>(PRODUCT_INVOCABLE_SKILLS);

export class SkillNotInvocableError extends Error {
  readonly code = 'skill-not-invocable';

  constructor(slug: string) {
    super(
      `Skill "${slug}" is not invocable from the product. ` +
        `Add it to PRODUCT_INVOCABLE_SKILLS only if its instructions need no ` +
        `filesystem, browser or shell access.`
    );
    this.name = 'SkillNotInvocableError';
  }
}

export function isProductInvocable(slug: string): slug is InvocableSkill {
  return INVOCABLE.has(slug);
}

/** Throw unless `slug` is allowlisted. Call before loading, not after. */
export function assertProductInvocable(slug: string): void {
  if (!isProductInvocable(slug)) {
    throw new SkillNotInvocableError(slug);
  }
}
