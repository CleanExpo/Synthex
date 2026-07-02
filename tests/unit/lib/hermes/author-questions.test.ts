/**
 * HERMES author-questions generator unit tests (HER-7 / B-5)
 *
 * Pure helpers (prompt builders + parser) are tested directly. The two async
 * functions are tested with routedCall + loadSystemPrompt mocked, so no live
 * model call or filesystem read is needed.
 */

import {
  buildQuestionsPrompt,
  buildFinalisePrompt,
  parseDraftAndQuestions,
  generateDraftWithQuestions,
  finaliseDraftWithAnswers,
  MAX_AUTHOR_QUESTIONS,
  type AuthorQa,
} from '@/lib/hermes/generator/author-questions';
import { routedCall } from '@/lib/ai/model-router';
import { loadSystemPrompt } from '@/lib/hermes/generator/draft';

jest.mock('@/lib/ai/model-router', () => ({ routedCall: jest.fn() }));
jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));
jest.mock('@/lib/hermes/generator/draft', () => ({
  loadSystemPrompt: jest.fn(),
}));

const mockedRoutedCall = routedCall as jest.MockedFunction<typeof routedCall>;
const mockedLoadSystemPrompt = loadSystemPrompt as jest.MockedFunction<
  typeof loadSystemPrompt
>;

// jest config sets resetMocks:true, so (re)apply implementations before each test.
beforeEach(() => {
  mockedLoadSystemPrompt.mockResolvedValue('SYSTEM PROMPT');
});

const req = {
  organizationId: 'org-1',
  topic: 'Drying a flooded subfloor',
  rationale: 'Ranking gap vs competitor for "subfloor water damage"',
};

// ---------------------------------------------------------------------------
// buildQuestionsPrompt
// ---------------------------------------------------------------------------
describe('buildQuestionsPrompt', () => {
  it('includes the topic, rationale, and a strict-JSON instruction', () => {
    const p = buildQuestionsPrompt(req);
    expect(p).toContain('Drying a flooded subfloor');
    expect(p).toContain('Ranking gap vs competitor');
    expect(p).toContain('STRICT JSON');
    expect(p).toContain(String(MAX_AUTHOR_QUESTIONS));
  });

  it('includes the signal summary only when provided', () => {
    expect(buildQuestionsPrompt(req)).not.toContain('Underlying signals');
    expect(
      buildQuestionsPrompt({ ...req, signalSummary: 'clicks -40%' })
    ).toContain('Underlying signals');
  });
});

// ---------------------------------------------------------------------------
// buildFinalisePrompt
// ---------------------------------------------------------------------------
describe('buildFinalisePrompt', () => {
  const qa: AuthorQa[] = [
    {
      question: 'A real situation?',
      answer: 'We saved a 1920s Queenslander after 48h flooding.',
    },
    {
      question: 'A number?',
      answer: 'Dropped moisture from 28% to 12% in three days.',
    },
  ];

  it('embeds the draft and every non-empty answer', () => {
    const p = buildFinalisePrompt(req, 'INITIAL DRAFT TEXT', qa);
    expect(p).toContain('INITIAL DRAFT TEXT');
    expect(p).toContain('1920s Queenslander');
    expect(p).toContain('28% to 12%');
  });

  it('omits questions the author left unanswered', () => {
    const p = buildFinalisePrompt(req, 'D', [
      ...qa,
      { question: 'Skipped?', answer: '   ' },
    ]);
    expect(p).not.toContain('Skipped?');
  });
});

// ---------------------------------------------------------------------------
// parseDraftAndQuestions
// ---------------------------------------------------------------------------
describe('parseDraftAndQuestions', () => {
  it('parses a clean JSON object', () => {
    const r = parseDraftAndQuestions(
      JSON.stringify({ draft: 'd', questions: ['q1', 'q2'] })
    );
    expect(r.draft).toBe('d');
    expect(r.questions).toEqual(['q1', 'q2']);
  });

  it('tolerates a ```json fenced response', () => {
    const r = parseDraftAndQuestions(
      '```json\n{"draft":"d","questions":["q1"]}\n```'
    );
    expect(r.draft).toBe('d');
    expect(r.questions).toEqual(['q1']);
  });

  it(`clamps to at most ${MAX_AUTHOR_QUESTIONS} questions`, () => {
    const r = parseDraftAndQuestions(
      JSON.stringify({ draft: 'd', questions: ['q1', 'q2', 'q3', 'q4', 'q5'] })
    );
    expect(r.questions).toHaveLength(MAX_AUTHOR_QUESTIONS);
  });

  it('drops empty/non-string questions', () => {
    const r = parseDraftAndQuestions(
      JSON.stringify({ draft: 'd', questions: ['q1', '', '  ', 7, 'q2'] })
    );
    expect(r.questions).toEqual(['q1', 'q2']);
  });

  it('throws on invalid JSON', () => {
    expect(() => parseDraftAndQuestions('not json at all')).toThrow(
      'valid JSON'
    );
  });

  it('throws when the draft is missing', () => {
    expect(() =>
      parseDraftAndQuestions(JSON.stringify({ questions: ['q1'] }))
    ).toThrow('missing draft');
  });

  it('throws when no questions are returned', () => {
    expect(() =>
      parseDraftAndQuestions(JSON.stringify({ draft: 'd', questions: [] }))
    ).toThrow('no questions');
  });
});

// ---------------------------------------------------------------------------
// generateDraftWithQuestions (routedCall mocked)
// ---------------------------------------------------------------------------
describe('generateDraftWithQuestions', () => {
  it('returns the parsed draft + questions and routes as caption_generation for the org', async () => {
    mockedRoutedCall.mockResolvedValueOnce(
      JSON.stringify({ draft: 'partial draft', questions: ['q1', 'q2', 'q3'] })
    );
    const res = await generateDraftWithQuestions(req);

    expect(res.draft).toBe('partial draft');
    expect(res.questions).toEqual(['q1', 'q2', 'q3']);
    expect(res.promptTokensEstimate).toBeGreaterThan(0);
    expect(mockedRoutedCall).toHaveBeenCalledWith(
      expect.objectContaining({
        task: expect.objectContaining({
          taskType: 'caption_generation',
          clientId: 'org-1',
        }),
      })
    );
  });

  it('rejects when the model response is not valid JSON', async () => {
    mockedRoutedCall.mockResolvedValueOnce('I cannot do that');
    await expect(generateDraftWithQuestions(req)).rejects.toThrow('valid JSON');
  });
});

// ---------------------------------------------------------------------------
// finaliseDraftWithAnswers (routedCall mocked)
// ---------------------------------------------------------------------------
describe('finaliseDraftWithAnswers', () => {
  const qa: AuthorQa[] = [
    { question: 'A number?', answer: '28% to 12% in three days' },
  ];

  it('returns the finalised content', async () => {
    mockedRoutedCall.mockResolvedValueOnce('Final post weaving in 28% to 12%.');
    const res = await finaliseDraftWithAnswers(req, 'initial draft', qa);
    expect(res.content).toBe('Final post weaving in 28% to 12%.');
    expect(mockedRoutedCall).toHaveBeenCalledTimes(1);
  });

  it('throws before any model call when there are no answered questions', async () => {
    await expect(
      finaliseDraftWithAnswers(req, 'initial draft', [
        { question: 'q', answer: '  ' },
      ])
    ).rejects.toThrow('no answered questions');
    expect(mockedRoutedCall).not.toHaveBeenCalled();
  });
});
