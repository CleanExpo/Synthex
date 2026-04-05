/**
 * Unit tests — Ask Synthex ModelRouter routing logic — SYN-681
 *
 * Validates question complexity classification and task type mapping.
 */

// ── Inline the classification logic (decoupled from route handler) ────────────
// These functions mirror the logic in app/api/ask-synthex/route.ts exactly.
// If routing logic changes there, update these tests too.

const STRATEGY_SIGNALS = [
  'opportunity',
  'quarter',
  'strategy',
  'grow',
  'improve',
  'plan',
  'should i',
  'recommend',
  'advice',
  'roadmap',
  'long-term',
];
const SYNTHESIS_SIGNALS = [
  'why',
  'compare',
  'analyse',
  'analyze',
  'trend',
  'drop',
  'fell',
  'increase',
  'pattern',
  'versus',
  'vs',
  'best',
  'worst',
  'across',
];

type ConversationTier = 'simple' | 'synthesis' | 'strategy';

function classifyQuestion(question: string): ConversationTier {
  const lower = question.toLowerCase();
  if (STRATEGY_SIGNALS.some(s => lower.includes(s))) return 'strategy';
  if (SYNTHESIS_SIGNALS.some(s => lower.includes(s))) return 'synthesis';
  if (question.split(' ').length > 15) return 'synthesis';
  return 'simple';
}

function tierToModelTier(tier: ConversationTier): 'haiku' | 'sonnet' | 'opus' {
  if (tier === 'strategy') return 'opus';
  if (tier === 'synthesis') return 'sonnet';
  return 'haiku';
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Ask Synthex — question complexity classifier', () => {
  describe('simple tier (Haiku)', () => {
    it('routes single-signal lookup to simple', () => {
      expect(classifyQuestion("What's my Health Score?")).toBe('simple');
    });

    it('routes posting frequency question to simple', () => {
      expect(classifyQuestion('How often am I posting?')).toBe('simple');
    });

    it('routes platform count question to simple', () => {
      expect(classifyQuestion('Which platforms am I active on?')).toBe(
        'simple'
      );
    });
  });

  describe('synthesis tier (Sonnet)', () => {
    it('routes why-question to synthesis', () => {
      expect(classifyQuestion('Why did my reach drop last week?')).toBe(
        'synthesis'
      );
    });

    it('routes compare question to synthesis', () => {
      expect(
        classifyQuestion('Compare my Instagram vs Facebook performance')
      ).toBe('synthesis');
    });

    it('routes trend question to synthesis', () => {
      expect(
        classifyQuestion('What trend do you see in my engagement rate?')
      ).toBe('synthesis');
    });

    it('routes long question (>15 words) to synthesis', () => {
      const longQ =
        'Can you tell me what the data says about my engagement rate on each platform over the past three months please?';
      expect(classifyQuestion(longQ)).toBe('synthesis');
    });

    it('routes analyse question to synthesis', () => {
      expect(classifyQuestion('Analyse my best performing content types')).toBe(
        'synthesis'
      );
    });
  });

  describe('strategy tier (Opus)', () => {
    it('routes opportunity question to strategy', () => {
      expect(
        classifyQuestion("What's my biggest content opportunity this quarter?")
      ).toBe('strategy');
    });

    it('routes grow question to strategy', () => {
      expect(classifyQuestion('How do I grow my local reach?')).toBe(
        'strategy'
      );
    });

    it('routes "should I" question to strategy', () => {
      expect(classifyQuestion('Should I post more on TikTok?')).toBe(
        'strategy'
      );
    });

    it('routes recommendation question to strategy', () => {
      expect(
        classifyQuestion('What do you recommend for my content strategy?')
      ).toBe('strategy');
    });
  });

  describe('strategy signals take priority over synthesis signals', () => {
    it('routes question with both signals to strategy', () => {
      // Contains both "why" (synthesis) and "strategy" (strategy)
      expect(classifyQuestion('Why should I change my strategy?')).toBe(
        'strategy'
      );
    });
  });
});

describe('Ask Synthex — model tier mapping', () => {
  it('maps simple → haiku', () => {
    expect(tierToModelTier('simple')).toBe('haiku');
  });

  it('maps synthesis → sonnet', () => {
    expect(tierToModelTier('synthesis')).toBe('sonnet');
  });

  it('maps strategy → opus', () => {
    expect(tierToModelTier('strategy')).toBe('opus');
  });
});
