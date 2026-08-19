/**
 * Skill invocation — the product-side entry point for the `.claude/skills/`
 * catalogue.
 *
 * This closes the C3 column of `docs/pm/capability-matrix.csv`. Every senior
 * agency capability was already written as a SKILL.md and already had a policy
 * document, but nothing outside the IDE could run one: no file under `lib/` or
 * `app/` read `.claude/` at runtime. That, not missing documentation, is what
 * held C3 at 0%.
 *
 * It rides the existing provider factory, so it works with whichever provider
 * `AI_PROVIDER` selects and needs no AWS account, no new verification gate and
 * no new dependency.
 */

import { logger } from '@/lib/logger';

import { getAIProvider } from '../providers';
import { compileSkill, type CompileOptions } from './skill-compiler';
import {
  loadFoundation,
  loadSkill,
  type SkillDefinition,
} from './skill-loader';
import { assertProductInvocable, PRODUCT_INVOCABLE_SKILLS } from './policy';

export { SkillLoadError, type SkillDefinition } from './skill-loader';
export {
  SkillNotInvocableError,
  isProductInvocable,
  PRODUCT_INVOCABLE_SKILLS,
  type InvocableSkill,
} from './policy';
export { DEFAULT_FOUNDATION_CHAR_BUDGET } from './skill-compiler';

export interface InvokeSkillRequest {
  /** Directory name under `.claude/skills/`. Must be allowlisted. */
  skill: string;
  /** The task for the skill, in the caller's own words. */
  prompt: string;
  /** Defaults to the provider's `balanced` preset. */
  model?: string;
  maxTokens?: number;
  temperature?: number;
  foundationCharBudget?: CompileOptions['foundationCharBudget'];
}

export interface InvokeSkillResult {
  skill: { slug: string; name: string };
  content: string;
  model: string;
  /** Which foundation documents reached the model, and which were trimmed. */
  foundationIncluded: Array<{ filename: string; truncated: boolean }>;
  /** Cited-but-unreadable foundation documents. The caller should surface these. */
  foundationMissing: string[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * Run one skill against a prompt.
 *
 * Order is deliberate: the allowlist is checked before the filesystem is
 * touched, so a name that is not invocable never becomes a read.
 */
export async function invokeSkill(
  request: InvokeSkillRequest
): Promise<InvokeSkillResult> {
  assertProductInvocable(request.skill);

  const skill = await loadSkill(request.skill);
  const foundation = await loadFoundation(skill.foundationAuthority);
  const compiled = compileSkill(skill, foundation, {
    foundationCharBudget: request.foundationCharBudget,
  });

  const provider = getAIProvider();
  const model = request.model ?? provider.models.balanced;

  if (compiled.foundationMissing.length > 0) {
    logger.warn('invokeSkill: foundation documents unavailable', {
      skill: skill.slug,
      missing: compiled.foundationMissing,
    });
  }

  const response = await provider.complete({
    model,
    messages: [
      { role: 'system', content: compiled.systemPrompt },
      { role: 'user', content: request.prompt },
    ],
    max_tokens: request.maxTokens,
    temperature: request.temperature,
    // The system prompt is large and identical across calls for a given skill,
    // which is exactly what prompt caching is for (Anthropic only; ignored
    // elsewhere).
    cache: true,
  });

  const content = response.choices[0]?.message?.content ?? '';

  logger.info('invokeSkill: completed', {
    skill: skill.slug,
    model,
    totalTokens: response.usage?.total_tokens ?? null,
  });

  return {
    skill: { slug: skill.slug, name: skill.name },
    content,
    model,
    foundationIncluded: compiled.foundationIncluded,
    foundationMissing: compiled.foundationMissing,
    usage: response.usage,
  };
}

/**
 * Descriptions of every invocable skill, for a product surface that needs to
 * offer a choice. Loaded from disk rather than duplicated, so a description can
 * never drift from the SKILL.md that governs it.
 */
export async function listInvocableSkills(): Promise<
  Array<Pick<SkillDefinition, 'slug' | 'name' | 'description' | 'operatesIn'>>
> {
  const loaded = await Promise.all(
    PRODUCT_INVOCABLE_SKILLS.map(async slug => {
      try {
        const skill = await loadSkill(slug);
        return {
          slug: skill.slug,
          name: skill.name,
          description: skill.description,
          operatesIn: skill.operatesIn,
        };
      } catch (err) {
        // An allowlisted skill that will not load is a real defect, but it must
        // not take the whole catalogue down.
        logger.error('listInvocableSkills: skill failed to load', {
          slug,
          error: err instanceof Error ? err.message : String(err),
        });
        return null;
      }
    })
  );

  return loaded.filter((entry): entry is NonNullable<typeof entry> => !!entry);
}
