/**
 * Unit tests for slop-scanner v2 patterns (SYN-567)
 *
 * Tests the new video-sourced patterns and 4 structural scanners:
 *  1. New overused words from Leila Hormozi video
 *  2. Corporate therapist voice patterns
 *  3. Transition opener detection (paragraph-level)
 *  4. Bold-colon bullet pattern detection
 *  5. Em-dash overuse detection
 *  6. Neat-bow conclusion detection
 *  7. Forced negation pattern
 */

import { scanForSlop, SLOP_PATTERNS_V1 } from '@/lib/voice/slop-scanner';

// ── Helper ─────────────────────────────────────────────────────────────────────

function matchPhrase(text: string, expectedPhrase: string) {
  const result = scanForSlop(text);
  return result.matches.some(m => m.phrase === expectedPhrase);
}

// ── Test 1: New overused words ─────────────────────────────────────────────────

describe('slop-scanner v2 — video-sourced overused words', () => {
  const newWords = [
    ['embarked', 'embarked'],
    ['This is invaluable to us', 'invaluable'],
    ['A groundbreaking discovery', 'groundbreaking'],
    ['She was enlightened by the talk', 'enlighten'],
    ['Our esteemed partners', 'esteemed'],
    ['This will shed light on the issue', 'shed light'],
    ['A treasure trove of data', 'treasure trove'],
    ['It is a testament to our work', 'testament'],
    ['synergies across teams', 'synergy'],
    ['This underscores the need', 'underscores'],
    ['navigate the complexities of scaling', 'navigate the complexities'],
    ['in an ever-changing landscape', 'ever-changing landscape'],
    ['deep understanding of the market', 'deep understanding'],
    ['our offerings include', 'offerings'],
    ['a streamlined process', 'streamlined'],
  ] as const;

  it.each(newWords)('detects "%s"', (text, phrase) => {
    expect(matchPhrase(text, phrase)).toBe(true);
  });

  it('does not flag clean text', () => {
    const result = scanForSlop(
      'We started the project last week and found three bugs.'
    );
    const newCategories = result.matches.filter(
      m => m.category === 'voice-pattern' || m.category === 'formatting-pattern'
    );
    expect(newCategories).toHaveLength(0);
  });
});

// ── Test 2: Corporate therapist voice ──────────────────────────────────────────

describe('slop-scanner v2 — corporate therapist voice', () => {
  it('detects "lean into"', () => {
    expect(matchPhrase('We need to lean into our strengths', 'lean into')).toBe(
      true
    );
  });

  it('detects "foster a culture of"', () => {
    expect(
      matchPhrase('foster a culture of accountability', 'foster a culture of')
    ).toBe(true);
  });

  it('detects "powerful opportunity"', () => {
    expect(
      matchPhrase('This is a powerful opportunity', 'powerful opportunity')
    ).toBe(true);
  });

  it('detects "holistic approach"', () => {
    expect(
      matchPhrase('Take a holistic approach to marketing', 'holistic approach')
    ).toBe(true);
  });

  it('detects "unleash"', () => {
    expect(matchPhrase('unleash the potential of your team', 'unleash')).toBe(
      true
    );
  });
});

// ── Test 3: Transition opener detection ────────────────────────────────────────

describe('slop-scanner v2 — transition openers (paragraph-level)', () => {
  it('flags when >=40% of paragraphs open with transition words', () => {
    const text = [
      'First paragraph about something specific.',
      '',
      'Moreover, this is the second point we want to make.',
      '',
      'Furthermore, the third point builds on this.',
      '',
      'Additionally, we have more evidence.',
      '',
      'The fifth paragraph is clean.',
    ].join('\n');

    const result = scanForSlop(text);
    const openerMatches = result.matches.filter(m =>
      m.phrase.startsWith('paragraph opens with')
    );
    // 3 out of 5 paragraphs (60%) → should flag
    expect(openerMatches.length).toBeGreaterThanOrEqual(3);
  });

  it('does not flag when only 1 out of 5 paragraphs opens with a transition', () => {
    const text = [
      'First paragraph about something specific.',
      '',
      'Second paragraph continues the thought.',
      '',
      'Moreover, this one uses a transition.',
      '',
      'Fourth paragraph wraps up cleanly.',
      '',
      'Fifth paragraph ends the piece.',
    ].join('\n');

    const result = scanForSlop(text);
    const openerMatches = result.matches.filter(m =>
      m.phrase.startsWith('paragraph opens with')
    );
    // 1 out of 5 = 20% → below 40% threshold
    expect(openerMatches).toHaveLength(0);
  });

  it('does not flag text with fewer than 3 paragraphs', () => {
    const text = 'Moreover, first paragraph.\n\nFurthermore, second paragraph.';
    const result = scanForSlop(text);
    const openerMatches = result.matches.filter(m =>
      m.phrase.startsWith('paragraph opens with')
    );
    expect(openerMatches).toHaveLength(0);
  });
});

// ── Test 4: Bold-colon bullet detection ────────────────────────────────────────

describe('slop-scanner v2 — bold-colon bullet pattern', () => {
  it('flags 3+ consecutive bold-colon bullets', () => {
    const text = [
      'Some intro text here.',
      '**Clarity:** Ensure your memo is clear and concise.',
      '**Alignment:** Make sure all stakeholders agree.',
      '**Execution:** Focus on actionable next steps.',
    ].join('\n');

    const result = scanForSlop(text);
    const bulletMatches = result.matches.filter(m =>
      m.phrase.includes('bold-colon bullets')
    );
    expect(bulletMatches).toHaveLength(1);
    expect(bulletMatches[0].phrase).toContain('3 consecutive');
  });

  it('does not flag 2 consecutive bold-colon bullets', () => {
    const text = [
      '**Clarity:** Ensure your memo is clear.',
      '**Alignment:** Make sure stakeholders agree.',
      'Normal text here.',
    ].join('\n');

    const result = scanForSlop(text);
    const bulletMatches = result.matches.filter(m =>
      m.phrase.includes('bold-colon bullets')
    );
    expect(bulletMatches).toHaveLength(0);
  });

  it('does not flag normal bullets without bold-colon pattern', () => {
    const text = [
      '- Check the budget',
      '- Review the timeline',
      '- Assign team members',
    ].join('\n');

    const result = scanForSlop(text);
    const bulletMatches = result.matches.filter(m =>
      m.phrase.includes('bold-colon bullets')
    );
    expect(bulletMatches).toHaveLength(0);
  });
});

// ── Test 5: Em-dash overuse ────────────────────────────────────────────────────

describe('slop-scanner v2 — em-dash overuse', () => {
  it('flags >3 em-dashes in short text (<500 words)', () => {
    // Short text with 4 em-dashes
    const text =
      'The team \u2014 all five of them \u2014 worked late. They finished \u2014 barely \u2014 on time.';
    const result = scanForSlop(text);
    const emDashMatches = result.matches.filter(
      m => m.phrase === 'em-dash (\u2014)'
    );
    expect(emDashMatches.length).toBe(4);
  });

  it('does not flag 1-2 em-dashes in short text', () => {
    const text =
      'The project \u2014 our biggest yet \u2014 launched successfully.';
    const result = scanForSlop(text);
    const emDashMatches = result.matches.filter(
      m => m.phrase === 'em-dash (\u2014)'
    );
    expect(emDashMatches).toHaveLength(0);
  });

  it('does not flag regular hyphens or en-dashes', () => {
    const text =
      'Well-known brands use data-driven methods. The years 2020-2025 were pivotal.';
    const result = scanForSlop(text);
    const emDashMatches = result.matches.filter(
      m => m.phrase === 'em-dash (\u2014)'
    );
    expect(emDashMatches).toHaveLength(0);
  });
});

// ── Test 6: Neat-bow conclusion ────────────────────────────────────────────────

describe('slop-scanner v2 — neat-bow conclusion detection', () => {
  it('flags "at the end of the day" in the last paragraph', () => {
    const text = [
      'First paragraph with real content about our marketing results.',
      '',
      'At the end of the day, it comes down to execution and teamwork.',
    ].join('\n');

    const result = scanForSlop(text);
    const bowMatches = result.matches.filter(m =>
      m.phrase.startsWith('neat-bow conclusion')
    );
    expect(bowMatches.length).toBeGreaterThanOrEqual(1);
  });

  it('does not flag single-paragraph text', () => {
    const text = 'At the end of the day it comes down to execution.';
    const result = scanForSlop(text);
    const bowMatches = result.matches.filter(m =>
      m.phrase.startsWith('neat-bow conclusion')
    );
    expect(bowMatches).toHaveLength(0);
  });
});

// ── Test 7: Forced negation pattern ────────────────────────────────────────────

describe('slop-scanner v2 — forced negation pattern', () => {
  it('detects "not X, but rather Y" pattern', () => {
    expect(
      matchPhrase('not speed, but rather quality', 'not X, but rather Y')
    ).toBe(true);
  });

  it('detects "not about X, but Y" pattern', () => {
    expect(
      matchPhrase('not about growth, but sustainability', 'not X, but rather Y')
    ).toBe(true);
  });
});

// ── Test 8: Pattern count sanity check ─────────────────────────────────────────

describe('slop-scanner v2 — pattern inventory', () => {
  it('has at least 75 total patterns (was 45, added ~33)', () => {
    expect(SLOP_PATTERNS_V1.length).toBeGreaterThanOrEqual(75);
  });

  it('includes voice-pattern category', () => {
    const voicePatterns = SLOP_PATTERNS_V1.filter(
      p => p.category === 'voice-pattern'
    );
    expect(voicePatterns.length).toBeGreaterThanOrEqual(8);
  });
});
