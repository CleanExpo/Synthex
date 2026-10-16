/**
 * @jest-environment node
 *
 * REE Phase 2 — Synthex skills and advisor context carry only verified
 * 2025–26 platform facts (docs/ree/sources/platform-changes-2025-2026.md).
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { getAlgorithmContextBlock } from '@/lib/algorithm/algorithm-context';
import { KNOWN_ALGORITHM_UPDATES } from '@/lib/sentinel/algorithm-feed';
import { PRODUCT_INVOCABLE_SKILLS } from '@/lib/ai/skills/policy';
import { loadSkill } from '@/lib/ai/skills/skill-loader';

const ROOT = process.cwd();
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8');
const skill = (slug: string) => read(`.claude/skills/${slug}/SKILL.md`);

describe('advisor algorithm context', () => {
  const block = getAlgorithmContextBlock();

  it('never presents leaked or inferred signals as verified', () => {
    expect(block).not.toMatch(/verified platform documents/);
    expect(block).not.toMatch(/verified platform algorithm signals/);
    const leaked = block.split('\n').filter(l => l.includes('2024 leak'));
    expect(leaked.length).toBeGreaterThanOrEqual(2);
    leaked.forEach(line => expect(line).toMatch(/unconfirmed/));
  });

  it('drops unsupported penalty and video-length claims', () => {
    expect(block).not.toMatch(/ranking penalty/);
    expect(block).not.toMatch(/under 30s/);
  });
});

describe('skills knowledge', () => {
  it('GBP skill uses Google-documented post, photo and ranking facts', () => {
    const gbp = skill('google-business-profile');
    expect(gbp).toContain('Archived after 6 months unless a date range is set');
    expect(gbp).toContain('recommended 720 × 720 px, minimum 250 × 250 px');
    expect(gbp).toContain('Q&A API was discontinued on 03/11/2025');
    expect(gbp).not.toMatch(/\| 7 days/);
    expect(gbp).not.toMatch(/Geotag photos with business coordinates/);
    expect(gbp).not.toMatch(/Geo-tagged photos strengthen/);
    expect(gbp).not.toMatch(/minimum to stay active in local pack/);
  });

  it('sentinel skill lists exactly the fallback updates in the code', () => {
    const sentinel = skill('google-updates-sentinel');
    const months = (type: string) =>
      [...KNOWN_ALGORITHM_UPDATES]
        .filter(u => u.updateType === type)
        .map(u => u.name.replace(/ (core|spam) update$/, ''))
        .reverse()
        .join(', ');
    expect(sentinel).toContain(
      `- **Known updates in fallback**: ${months('core')}\n`
    );
    expect(sentinel).toContain(
      `- **Known updates in fallback**: ${months('spam')}\n`
    );
    expect(sentinel).toContain(
      "There's no longer one signal or system used to do this"
    );
    expect(sentinel).not.toMatch(/Known updates in feed/);
  });

  it('algorithm reference follows Google on AI features and labels leaks', () => {
    const ref = read(
      '.claude/skills/algorithm-knowledge-base/references/google-search.md'
    );
    expect(ref).toContain('use the normal Search index');
    expect(ref).toContain('**`[LEAKED]` means unconfirmed.**');
    expect(ref).not.toMatch(/separate system from web rankings/);
    expect(ref).not.toMatch(/Use `FAQPage` and `HowTo` schema/);
    expect(ref).not.toMatch(
      /is a meaningful ranking penalty|\| Page Experience penalty \|/
    );
  });

  it('Search Console skill documents the 2026 AI and multimodal reports', () => {
    const gsc = skill('google-search-console');
    expect(gsc).toContain('generative-AI performance');
    expect(gsc).toContain('multimodal search type');
    expect(gsc).toContain('platform properties');
  });

  it.each([
    [
      'local-seo-geo-veteran',
      '## Verified platform facts (re-checked 16/10/2026)',
    ],
    ['platform-content-optimiser', '## Provenance in production (2026-10-16)'],
  ])(
    'product skill %s ships its verified section to the runtime prompt',
    async (slug, heading) => {
      const loaded = await loadSkill(
        slug as (typeof PRODUCT_INVOCABLE_SKILLS)[number]
      );
      expect(JSON.stringify(loaded)).toContain(
        heading.replace(/[()]/g, c => c)
      );
    }
  );

  it.each(['ree-diagnostic', 'ree-content-teardown'])(
    '%s exists as an IDE-only operator skill',
    slug => {
      expect(skill(slug)).toMatch(new RegExp(`^---\\nname: ${slug}\\n`));
      expect(PRODUCT_INVOCABLE_SKILLS as readonly string[]).not.toContain(slug);
      expect(read('next.config.mjs')).not.toContain(`.claude/skills/${slug}/`);
    }
  );
});
