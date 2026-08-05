/**
 * Skill loader — reads a `SKILL.md` off disk and parses it into a typed
 * definition the product can execute.
 *
 * Why this exists: all 85 skills under `.claude/skills/` were only ever
 * reachable by an agent reading the filesystem in the IDE, which is why the
 * capability matrix records C2 (IDE) as complete and C3 (product) as 0% —
 * nothing in `lib/` or `app/` read `.claude/` at runtime at all. This is the
 * missing half.
 *
 * It deliberately does NOT go via AWS Bedrock. The original
 * `lib/ai/skills-bedrock-adapter/README.md` spec gated the build on two
 * unverified gates (VG-159, VG-160), two new AWS accounts, and a dependency
 * install. None of that is needed to invoke a skill: the existing provider
 * factory already talks to Anthropic, OpenAI, Google, OpenRouter and Ollama,
 * and `gray-matter` is already a dependency. Bedrock remains the right answer
 * for AU data residency specifically, and can be added later as one more
 * provider behind the same factory without touching this file.
 *
 * Runtime note: the skills live outside the Next.js import graph, so they are
 * only present in a Vercel function if `outputFileTracingIncludes` names them
 * (see `next.config.mjs`). Without that entry every read ENOENTs in
 * production while working perfectly in dev — the same failure mode as the
 * SYN-835 postcode CSV and the reference-library manifest.
 */

import { readFile } from 'fs/promises';
import { join, resolve, sep } from 'path';

import matter from 'gray-matter';
import { z } from 'zod';

/** Skill directories, relative to the repo root at runtime. */
const SKILLS_ROOT = join(process.cwd(), '.claude', 'skills');

/**
 * Foundation documents a skill's `foundation_authority` may cite. Separate
 * from the skills root so a skill name can never be used to read one.
 */
const FOUNDATION_ROOT = join(process.cwd(), '.claude', 'memory');

/**
 * A skill name is a single directory segment. The pattern is the primary
 * defence against traversal because a name can reach here from a request body;
 * the containment check in `skillPath` is the backstop.
 */
const SKILL_NAME_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;

/** `foundation_authority: itself` — foundation-keeper governs itself. */
const SELF_AUTHORITY = 'itself';

export type SkillLoadErrorCode =
  | 'invalid-skill-name'
  | 'skill-not-found'
  | 'malformed-skill';

export class SkillLoadError extends Error {
  constructor(
    readonly code: SkillLoadErrorCode,
    message: string
  ) {
    super(message);
    this.name = 'SkillLoadError';
  }
}

/**
 * Frontmatter contract. Only `name` and `description` are required — the rest
 * are declared by the senior skills but absent from the utility ones, so
 * requiring them would refuse to load most of the catalogue.
 */
const FrontmatterSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  operates_in: z.union([z.array(z.string()), z.string()]).optional(),
  consumes_from: z.union([z.array(z.string()), z.string()]).optional(),
  foundation_authority: z.string().optional(),
  linear: z.string().optional(),
});

export interface SkillDefinition {
  /** Directory name, which is also the invocation key. */
  slug: string;
  /** `name` from frontmatter. Usually equal to `slug`, but not guaranteed. */
  name: string;
  description: string;
  /**
   * Orchestration layers the skill operates in (`L1`–`L9`, `L4-gate`,
   * `foundation-canonical-layer`).
   *
   * Note for anyone reading the Bedrock spec: that document assumed
   * `operates_in` held `"nexus"` / `"external-client"` and built its
   * cross-client isolation on it. No skill in this repo has ever used those
   * values, so isolation cannot be keyed on this field. `lib/ai/skills/policy`
   * carries the real product-invocation boundary instead.
   */
  operatesIn: string[];
  /** Upstream skills or layers whose structured output this consumes. */
  consumesFrom: string[];
  /** Foundation documents that govern the skill, as bare filenames. */
  foundationAuthority: string[];
  /** True when `foundation_authority` is the literal `itself`. */
  governsItself: boolean;
  linear?: string;
  /** The markdown body below the frontmatter — the skill's actual prompt. */
  instructions: string;
}

/**
 * Resolve `<name>/SKILL.md` under the skills root, refusing anything that
 * escapes it. Pattern-checked names cannot contain `/` or `.` so this should be
 * unreachable, which is exactly why it is cheap to keep.
 */
function skillPath(slug: string): string {
  if (!SKILL_NAME_PATTERN.test(slug)) {
    throw new SkillLoadError(
      'invalid-skill-name',
      `"${slug}" is not a valid skill name (lowercase letters, digits and hyphens only).`
    );
  }

  const candidate = resolve(join(SKILLS_ROOT, slug, 'SKILL.md'));

  if (!candidate.startsWith(SKILLS_ROOT + sep)) {
    throw new SkillLoadError(
      'invalid-skill-name',
      `"${slug}" resolves outside the skills directory.`
    );
  }

  return candidate;
}

/** Accept both a YAML list and a single bare scalar for list-ish fields. */
function toList(value: string[] | string | undefined): string[] {
  if (value === undefined) return [];
  return (Array.isArray(value) ? value : [value])
    .map(entry => String(entry).trim())
    .filter(Boolean);
}

/**
 * `foundation_authority` is a ` + `-joined list of filenames, e.g.
 * "ceo-foundation.md + verification-gates.md + reporting-templates.md".
 */
function toAuthorityList(value: string | undefined): string[] {
  if (!value || value.trim() === SELF_AUTHORITY) return [];
  return value
    .split('+')
    .map(entry => entry.trim())
    .filter(Boolean);
}

/** Load and parse one skill by directory name. */
export async function loadSkill(slug: string): Promise<SkillDefinition> {
  const path = skillPath(slug);

  let raw: string;
  try {
    raw = await readFile(path, 'utf8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new SkillLoadError(
        'skill-not-found',
        `No skill named "${slug}" (expected ${path}).`
      );
    }
    throw err;
  }

  const parsed = matter(raw);
  const frontmatter = FrontmatterSchema.safeParse(parsed.data);

  if (!frontmatter.success) {
    throw new SkillLoadError(
      'malformed-skill',
      `"${slug}" has invalid frontmatter: ${frontmatter.error.issues
        .map(i => `${i.path.join('.') || '(root)'} ${i.message}`)
        .join('; ')}`
    );
  }

  const body = parsed.content.trim();
  if (!body) {
    throw new SkillLoadError(
      'malformed-skill',
      `"${slug}" has frontmatter but no instructions below it, so there is nothing to invoke.`
    );
  }

  const data = frontmatter.data;

  return {
    slug,
    name: data.name,
    description: data.description,
    operatesIn: toList(data.operates_in),
    consumesFrom: toList(data.consumes_from),
    foundationAuthority: toAuthorityList(data.foundation_authority),
    governsItself: data.foundation_authority?.trim() === SELF_AUTHORITY,
    linear: data.linear,
    instructions: body,
  };
}

/**
 * Read the foundation documents a skill cites. A missing document is returned
 * as an absence rather than an error: the catalogue cites five foundation files
 * and refusing to invoke when one is absent would take the whole agency down
 * for a documentation gap. The compiler records which were unavailable so the
 * model is told rather than left to infer.
 */
export async function loadFoundation(
  filenames: string[]
): Promise<{ documents: Map<string, string>; missing: string[] }> {
  const documents = new Map<string, string>();
  const missing: string[] = [];

  await Promise.all(
    filenames.map(async filename => {
      // Filenames come from skill frontmatter, not user input, but the same
      // containment rule applies — a stray `../` in a SKILL.md must not read
      // outside the foundation directory.
      const candidate = resolve(join(FOUNDATION_ROOT, filename));
      if (!candidate.startsWith(FOUNDATION_ROOT + sep)) {
        missing.push(filename);
        return;
      }

      try {
        documents.set(filename, await readFile(candidate, 'utf8'));
      } catch {
        missing.push(filename);
      }
    })
  );

  return { documents, missing };
}
