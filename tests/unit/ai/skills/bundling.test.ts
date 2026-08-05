/**
 * Guards the runtime-file contract for skill invocation.
 *
 * `lib/ai/skills` reads SKILL.md and foundation documents from disk at runtime.
 * Those files sit outside the Next.js import graph, so NFT cannot discover them
 * and they only reach a Vercel function if `outputFileTracingIncludes` names
 * them explicitly. Get that wrong and the failure is invisible locally: dev
 * reads straight off the working tree and passes, production ENOENTs.
 *
 * Three mechanical rules, each of which has to hold for invocation to work in
 * production at all:
 *   1. Every allowlisted skill is bundled.
 *   2. Every allowlisted skill exists on disk (so the allowlist cannot name a
 *      skill nobody wrote).
 *   3. Every foundation document that an allowlisted skill cites is bundled, or
 *      the prompt silently degrades to "unavailable" in production only.
 */

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

import { PRODUCT_INVOCABLE_SKILLS } from '@/lib/ai/skills/policy';
import { loadSkill } from '@/lib/ai/skills/skill-loader';

const REPO_ROOT = join(__dirname, '..', '..', '..', '..');
const nextConfig = readFileSync(join(REPO_ROOT, 'next.config.mjs'), 'utf8');

describe('skill bundling ↔ invocation allowlist', () => {
  it.each(PRODUCT_INVOCABLE_SKILLS)(
    '%s is named in outputFileTracingIncludes',
    slug => {
      expect(nextConfig).toContain(`./.claude/skills/${slug}/SKILL.md`);
    }
  );

  it.each(PRODUCT_INVOCABLE_SKILLS)('%s exists on disk', slug => {
    expect(
      existsSync(join(REPO_ROOT, '.claude', 'skills', slug, 'SKILL.md'))
    ).toBe(true);
  });

  it('bundles no skill it cannot invoke', () => {
    // A bundled-but-not-allowlisted skill is dead weight in every Lambda.
    const bundled = [
      ...nextConfig.matchAll(/\.\/\.claude\/skills\/([a-z0-9-]+)\/SKILL\.md/g),
    ].map(m => m[1]);

    const orphaned = bundled.filter(
      slug => !(PRODUCT_INVOCABLE_SKILLS as readonly string[]).includes(slug)
    );

    expect(orphaned).toEqual([]);
  });
});

/**
 * Foundation documents cited by a skill that have never been written.
 *
 * `marketing-operations-director` declares
 * `foundation_authority: ceo-foundation.md + verification-gates.md + tier-b-engineering-specs.md`,
 * but the third file does not exist anywhere in `.claude/memory/`. The loader
 * degrades to telling the model the document was unavailable rather than
 * refusing to invoke, so this is a documentation gap, not a runtime break.
 *
 * This baseline should shrink, never grow. The stale check below fails the
 * moment a listed document is actually written, so the entry cannot be
 * forgotten once the gap is closed.
 */
const KNOWN_ABSENT_FOUNDATION = ['tier-b-engineering-specs.md'];

describe('foundation documents reach production', () => {
  it('bundles every foundation document the allowlisted skills cite', async () => {
    const cited = new Set<string>();

    for (const slug of PRODUCT_INVOCABLE_SKILLS) {
      const skill = await loadSkill(slug);
      skill.foundationAuthority.forEach(f => cited.add(f));
    }

    // Proves the loop actually found citations rather than passing vacuously.
    expect(cited.size).toBeGreaterThan(0);

    const unbundled = [...cited].filter(
      filename =>
        !nextConfig.includes(`./.claude/memory/${filename}`) &&
        !KNOWN_ABSENT_FOUNDATION.includes(filename)
    );

    expect(unbundled).toEqual([]);
  });

  it.each(KNOWN_ABSENT_FOUNDATION)(
    '%s is still genuinely absent, so the baseline is not hiding a bundling miss',
    filename => {
      expect(existsSync(join(REPO_ROOT, '.claude', 'memory', filename))).toBe(
        false
      );
    }
  );
});
