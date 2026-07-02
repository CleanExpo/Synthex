/**
 * Deterministic-template banned-phrase tests.
 *
 * Proves the NO-AI-KEY template fallback in ContentGeneratorService never emits
 * the banned/cliché phrases enforced by the brand skill
 * (`.claude/skills/brand-campaign-generator/SKILL.md` +
 * `.claude/skills/synthex-standards/references/content-standards.md`).
 *
 * The deterministic structure is produced by the private
 * `generateContentStructure(hookType, topic)`. We exercise it directly (cast to
 * access the private method) across every hook type and a spread of
 * representative topics — including topics deliberately crafted to contain
 * banned phrases — and assert NONE survive in the output. This is the path that
 * runs without an API key, so it must be clean on its own.
 */

import { ContentGeneratorService } from '@/lib/services/content-generator';
import {
  BANNED_PHRASES,
  containsBannedPhrase,
  stripBannedPhrases,
} from '@/lib/content/banned-phrases';

// supabase-client is imported by the module under test but unused on these paths.
jest.mock('@/lib/supabase-client', () => ({
  db: { content: { create: jest.fn() } },
  supabase: {},
}));

/** Reaches the private deterministic structure builder for direct testing. */
function buildStructure(
  svc: ContentGeneratorService,
  hookType: string,
  topic: string
): string {
  return (
    svc as unknown as {
      generateContentStructure(hookType: string, topic: string): string;
    }
  ).generateContentStructure(hookType, topic);
}

const HOOK_TYPES = [
  'question',
  'story',
  'educational',
  'achievement',
  'general', // falls back to the question template
];

const REPRESENTATIVE_TOPICS = [
  'our new coffee blend',
  'remote work productivity',
  'local SEO for plumbers',
  'AI in healthcare',
  'sustainable packaging',
  'a 30-day fitness challenge',
];

describe('ContentGeneratorService — deterministic template fallback (no AI)', () => {
  const svc = new ContentGeneratorService();

  it('emits NONE of the banned phrases across every hook type and topic', () => {
    for (const hookType of HOOK_TYPES) {
      for (const topic of REPRESENTATIVE_TOPICS) {
        const output = buildStructure(svc, hookType, topic);
        const lower = output.toLowerCase();
        for (const banned of BANNED_PHRASES) {
          expect(lower).not.toContain(banned.toLowerCase());
        }
        expect(containsBannedPhrase(output)).toBe(false);
      }
    }
  });

  it('strips a banned phrase even when the TOPIC itself carries one', () => {
    // A user-supplied topic could embed a banned phrase; the offline filter on
    // the template path must still neutralise it.
    const output = buildStructure(
      svc,
      'achievement',
      'our revolutionary game-changing leverage tool'
    );
    expect(containsBannedPhrase(output)).toBe(false);
    expect(output.toLowerCase()).not.toContain('revolutionary');
    expect(output.toLowerCase()).not.toContain('game-changing');
    expect(output.toLowerCase()).not.toContain('leverage');
  });

  it('is deterministic — same input yields identical output', () => {
    const a = buildStructure(svc, 'achievement', 'our new coffee blend');
    const b = buildStructure(svc, 'achievement', 'our new coffee blend');
    expect(a).toBe(b);
  });

  it('still produces non-empty content', () => {
    // Not every selected template embeds the {topic} token (some use {goal} etc.),
    // so we assert structure is produced rather than that the topic always appears.
    const output = buildStructure(svc, 'educational', 'local SEO for plumbers');
    expect(output.trim().length).toBeGreaterThan(0);
  });
});

describe('stripBannedPhrases — offline helper', () => {
  it('rewrites the headline cliché and preserves intent', () => {
    expect(stripBannedPhrases('Excited to announce our launch!')).toBe(
      'Announcing our launch!'
    );
  });

  it('preserves leading capitalisation context-appropriately', () => {
    expect(stripBannedPhrases('we leverage data')).toBe('we use data');
    expect(stripBannedPhrases('Leverage data')).toBe('Use data');
  });

  it('rewrites every banned phrase it knows about', () => {
    const kitchenSink =
      "Excited to announce our revolutionary, game-changing, seamless, " +
      "robust, world-class platform — we're thrilled to share it.";
    const cleaned = stripBannedPhrases(kitchenSink);
    expect(containsBannedPhrase(cleaned)).toBe(false);
  });

  it('leaves clean copy untouched', () => {
    const clean = 'We added 3 posts per week across 5 platforms.';
    expect(stripBannedPhrases(clean)).toBe(clean);
    expect(containsBannedPhrase(clean)).toBe(false);
  });
});
