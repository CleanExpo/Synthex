/**
 * HERMES author-input helper unit tests (HER-7 / B-5 wiring)
 */

import {
  isAuthorQuestionsEnabled,
  formatAuthorQuestionsMessage,
  matchAnswersToQuestions,
  readAwaitingAuthorInputMetadata,
} from '@/lib/hermes/author-input';

describe('isAuthorQuestionsEnabled', () => {
  it('is true only for the boolean true flag', () => {
    expect(isAuthorQuestionsEnabled({ authorQuestions: true })).toBe(true);
  });

  it('is false for truthy-but-not-true, missing, or non-object metadata', () => {
    expect(isAuthorQuestionsEnabled({ authorQuestions: 'yes' })).toBe(false);
    expect(isAuthorQuestionsEnabled({ authorQuestions: 1 })).toBe(false);
    expect(isAuthorQuestionsEnabled({})).toBe(false);
    expect(isAuthorQuestionsEnabled(null)).toBe(false);
    expect(isAuthorQuestionsEnabled('authorQuestions')).toBe(false);
  });
});

describe('formatAuthorQuestionsMessage', () => {
  it('includes the topic, every numbered question, and the proposal id', () => {
    const msg = formatAuthorQuestionsMessage(
      'Drying a subfloor',
      ['A real situation?', 'A number?'],
      'prop-123'
    );
    expect(msg).toContain('Drying a subfloor');
    expect(msg).toContain('1. A real situation?');
    expect(msg).toContain('2. A number?');
    expect(msg).toContain('prop-123');
  });
});

describe('matchAnswersToQuestions', () => {
  const questions = ['Q1', 'Q2', 'Q3'];

  it('zips index-aligned answers and trims them', () => {
    expect(matchAnswersToQuestions(questions, ['  a1 ', 'a2', 'a3'])).toEqual([
      { question: 'Q1', answer: 'a1' },
      { question: 'Q2', answer: 'a2' },
      { question: 'Q3', answer: 'a3' },
    ]);
  });

  it('drops blank / whitespace-only / missing answers', () => {
    expect(matchAnswersToQuestions(questions, ['a1', '   ', ''])).toEqual([
      { question: 'Q1', answer: 'a1' },
    ]);
  });
});

describe('readAwaitingAuthorInputMetadata', () => {
  it('reads a well-formed metadata block', () => {
    const m = readAwaitingAuthorInputMetadata({
      stage: 'awaiting_author_input',
      authorQuestions: ['q1', 'q2'],
      topic: 't',
      rationale: 'r',
      modelUsed: 'haiku',
    });
    expect(m).not.toBeNull();
    expect(m?.authorQuestions).toEqual(['q1', 'q2']);
    expect(m?.topic).toBe('t');
  });

  it('returns null when questions, topic, or rationale are missing', () => {
    expect(
      readAwaitingAuthorInputMetadata({
        authorQuestions: [],
        topic: 't',
        rationale: 'r',
      })
    ).toBeNull();
    expect(
      readAwaitingAuthorInputMetadata({ authorQuestions: ['q'], topic: 't' })
    ).toBeNull();
    expect(readAwaitingAuthorInputMetadata(null)).toBeNull();
  });
});
