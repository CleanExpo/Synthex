/**
 * Compiles a loaded skill plus its foundation documents into one system prompt.
 *
 * The foundation context is budgeted, which the original Bedrock pseudo-code
 * did not account for: it read the whole foundation and concatenated it. That
 * is not viable here — `ceo-foundation.md` alone is 279 KB (~70k tokens, 2,490
 * lines), so injecting it verbatim on every invocation would dominate the
 * context window and the bill. Each document is therefore capped and the model
 * is told plainly when it received an excerpt, so it can ask for a specific
 * section instead of silently reasoning from a truncated document.
 */

import type { SkillDefinition } from './skill-loader';

/**
 * Per-document character budget. ~8k characters is roughly 2k tokens, so a
 * skill citing three foundation documents spends about 6k tokens on context
 * before its own instructions.
 */
export const DEFAULT_FOUNDATION_CHAR_BUDGET = 8_000;

export interface CompileOptions {
  /** Per-document character cap. */
  foundationCharBudget?: number;
}

export interface CompiledSkill {
  systemPrompt: string;
  /** Documents included, and whether each had to be trimmed. */
  foundationIncluded: Array<{ filename: string; truncated: boolean }>;
  /** Cited documents that could not be read. */
  foundationMissing: string[];
}

function truncate(
  body: string,
  budget: number
): { text: string; truncated: boolean } {
  if (body.length <= budget) return { text: body, truncated: false };

  // Cut at a line boundary so the excerpt does not end mid-sentence.
  const clipped = body.slice(0, budget);
  const lastBreak = clipped.lastIndexOf('\n');

  return {
    text: lastBreak > budget * 0.5 ? clipped.slice(0, lastBreak) : clipped,
    truncated: true,
  };
}

/**
 * Build the system prompt. Order matters: the skill's own instructions come
 * first so its calibration markers frame everything after, then the foundation
 * it is bound to, then the standing evidence rule.
 */
export function compileSkill(
  skill: SkillDefinition,
  foundation: { documents: Map<string, string>; missing: string[] },
  options: CompileOptions = {}
): CompiledSkill {
  const budget = options.foundationCharBudget ?? DEFAULT_FOUNDATION_CHAR_BUDGET;
  const sections: string[] = [skill.instructions];
  const foundationIncluded: CompiledSkill['foundationIncluded'] = [];

  if (foundation.documents.size > 0) {
    const parts: string[] = [
      '# Canonical foundation context',
      '',
      'These documents govern this skill. Where they conflict with anything above, they win.',
    ];

    for (const [filename, body] of foundation.documents) {
      const { text, truncated } = truncate(body.trim(), budget);
      foundationIncluded.push({ filename, truncated });

      parts.push(
        '',
        `## ${filename}${truncated ? ' (excerpt)' : ''}`,
        '',
        text
      );

      if (truncated) {
        parts.push(
          '',
          `_This is the first ${budget} characters of ${filename}, not the whole document. ` +
            `If a decision depends on a section you cannot see, say so and name the section ` +
            `rather than assuming its contents._`
        );
      }
    }

    sections.push(parts.join('\n'));
  }

  if (foundation.missing.length > 0) {
    sections.push(
      [
        '# Unavailable foundation documents',
        '',
        `This skill cites ${foundation.missing.join(', ')}, which could not be read.`,
        'Treat anything that would depend on them as unverified, and say which document you needed.',
      ].join('\n')
    );
  }

  // Repo-wide standard (.claude/rules/fabel-evidence-standard.md): an untagged
  // claim is a defect, so the prompt states it rather than hoping for it.
  sections.push(
    [
      '# Evidence discipline',
      '',
      'Tag every claim exactly one of [VERIFIED] (grounded in something you were given),',
      '[INFERENCE] (reasoned, not confirmed) or [UNCONFIRMED] (assumed). An untagged claim',
      'is treated as a defect. Never present an inference as a verified fact.',
    ].join('\n')
  );

  return {
    systemPrompt: sections.join('\n\n---\n\n'),
    foundationIncluded,
    foundationMissing: foundation.missing,
  };
}
