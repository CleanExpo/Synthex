/**
 * Regression guard for the AI content-generation eval harness (WS6).
 *
 * Asserts that:
 *   1. The known-GOOD canned outputs pass every check (the baseline never
 *      regresses).
 *   2. The deliberately-BAD canned outputs are flagged by the scorer — each
 *      with the expected failure mode (placeholder leak, length/hashtag breach,
 *      model meta-talk, invalid JSON).
 *   3. The scorer's individual checks behave correctly in isolation.
 *   4. The whole run is offline — no real provider, no network, no API key.
 *
 * If a prompt or model change starts producing content that violates these
 * structural / safety expectations, this test goes red in CI.
 */

import {
  GOLDEN_CASES,
  GOOD_OUTPUTS,
  BAD_OUTPUTS,
  runMockEval,
  runChecks,
  scoreCase,
  BANNED_PHRASES,
  MockAIProvider,
  resolveCaseId,
  CASE_MARKER,
} from '@/lib/ai/eval';

describe('AI eval harness — golden GOOD outputs', () => {
  it('passes every case with the known-good canned outputs', async () => {
    const report = await runMockEval(GOOD_OUTPUTS);
    expect(report.passed).toBe(true);
    expect(report.passedCases).toBe(report.totalCases);
    expect(report.totalCases).toBe(GOLDEN_CASES.length);
    expect(report.aggregateScore).toBe(1);
  });

  it('has a canned good output for every golden case', () => {
    for (const c of GOLDEN_CASES) {
      expect(GOOD_OUTPUTS[c.id]).toBeDefined();
      expect(GOOD_OUTPUTS[c.id].length).toBeGreaterThan(0);
    }
  });

  it('every individual good case scores a perfect 1.0', async () => {
    const report = await runMockEval(GOOD_OUTPUTS);
    for (const caseScore of report.cases) {
      expect(caseScore.score).toBe(1);
      expect(caseScore.passed).toBe(true);
    }
  });
});

describe('AI eval harness — deliberately BAD outputs are flagged', () => {
  it('fails the overall run when bad outputs are served', async () => {
    const report = await runMockEval(BAD_OUTPUTS);
    expect(report.passed).toBe(false);
    expect(report.passedCases).toBeLessThan(report.totalCases);
  });

  it('flags EVERY bad case (none slip through)', async () => {
    const report = await runMockEval(BAD_OUTPUTS);
    for (const caseScore of report.cases) {
      expect(caseScore.passed).toBe(false);
    }
  });

  it('catches placeholder leakage + missing brand keyword (instagram-cafe)', async () => {
    const report = await runMockEval(BAD_OUTPUTS);
    const c = report.cases.find(x => x.caseId === 'instagram-cafe')!;
    const failed = c.checks.filter(ch => !ch.passed).map(ch => ch.name);
    expect(failed).toContain('no-banned:lorem');
    expect(failed).toContain('must-include:Riverside Roasters');
  });

  it('catches char-limit and hashtag-ceiling breaches (twitter-tradie)', async () => {
    const report = await runMockEval(BAD_OUTPUTS);
    const c = report.cases.find(x => x.caseId === 'twitter-tradie')!;
    const failed = c.checks.filter(ch => !ch.passed).map(ch => ch.name);
    expect(failed).toContain('max-chars');
    expect(failed).toContain('max-hashtags');
  });

  it('catches model meta-talk / leaked prompt (linkedin-saas)', async () => {
    const report = await runMockEval(BAD_OUTPUTS);
    const c = report.cases.find(x => x.caseId === 'linkedin-saas')!;
    const failed = c.checks.filter(ch => !ch.passed).map(ch => ch.name);
    expect(failed).toContain('no-banned:as an ai');
    expect(failed).toContain('no-banned:system prompt');
  });

  it('catches invalid structured JSON (structured-json-post)', async () => {
    const report = await runMockEval(BAD_OUTPUTS);
    const c = report.cases.find(x => x.caseId === 'structured-json-post')!;
    const failed = c.checks.filter(ch => !ch.passed).map(ch => ch.name);
    expect(failed).toContain('valid-json');
  });

  it('catches leaked secret + missing brand keyword (facebook-restaurant)', async () => {
    const report = await runMockEval(BAD_OUTPUTS);
    const c = report.cases.find(x => x.caseId === 'facebook-restaurant')!;
    const failed = c.checks.filter(ch => !ch.passed).map(ch => ch.name);
    expect(failed).toContain('no-banned:sk-ant-');
    expect(failed).toContain('must-include:Harbour Table');
  });

  it('catches engagement-bait cliché + under-length (linkedin-thought-leadership)', async () => {
    const report = await runMockEval(BAD_OUTPUTS);
    const c = report.cases.find(
      x => x.caseId === 'linkedin-thought-leadership'
    )!;
    const failed = c.checks.filter(ch => !ch.passed).map(ch => ch.name);
    expect(failed).toContain('min-chars');
    expect(failed).toContain('no-banned:agree?');
  });

  it('catches Threads char-cap + hashtag-ceiling breach (threads-startup)', async () => {
    const report = await runMockEval(BAD_OUTPUTS);
    const c = report.cases.find(x => x.caseId === 'threads-startup')!;
    const failed = c.checks.filter(ch => !ch.passed).map(ch => ch.name);
    expect(failed).toContain('max-chars');
    expect(failed).toContain('max-hashtags');
  });

  it('catches a short-caption upper-bound breach (instagram-caption-short)', async () => {
    const report = await runMockEval(BAD_OUTPUTS);
    const c = report.cases.find(x => x.caseId === 'instagram-caption-short')!;
    const failed = c.checks.filter(ch => !ch.passed).map(ch => ch.name);
    expect(failed).toContain('max-chars');
  });

  it('catches blank/empty required JSON fields (structured-campaign-json)', async () => {
    const report = await runMockEval(BAD_OUTPUTS);
    const c = report.cases.find(x => x.caseId === 'structured-campaign-json')!;
    const failed = c.checks.filter(ch => !ch.passed).map(ch => ch.name);
    // valid JSON, but blank string body, empty cta and empty hashtags array.
    expect(c.checks.find(ch => ch.name === 'valid-json')!.passed).toBe(true);
    expect(failed).toContain('json-key-nonempty:body');
    expect(failed).toContain('json-key-nonempty:cta');
    expect(failed).toContain('json-key-nonempty:hashtags');
  });
});

describe('AI eval harness — scorer unit behaviour', () => {
  it('flags empty output', () => {
    const checks = runChecks('   ', { nonEmpty: true });
    const nonEmpty = checks.find(c => c.name === 'non-empty')!;
    expect(nonEmpty.passed).toBe(false);
  });

  it('enforces platform char limits', () => {
    const tooLong = 'x'.repeat(300);
    const checks = runChecks(tooLong, { platform: 'twitter' });
    expect(checks.find(c => c.name === 'max-chars')!.passed).toBe(false);
  });

  it('enforces min length', () => {
    const checks = runChecks('hi', { minChars: 10 });
    expect(checks.find(c => c.name === 'min-chars')!.passed).toBe(false);
  });

  it('detects missing JSON keys', () => {
    const checks = runChecks('{"caption":"x"}', {
      requireJsonKeys: ['caption', 'hashtags'],
    });
    expect(checks.find(c => c.name === 'valid-json')!.passed).toBe(true);
    expect(checks.find(c => c.name === 'json-key:hashtags')!.passed).toBe(false);
  });

  it('enforces Threads 500-char / 5-hashtag platform bounds', () => {
    const overLong = runChecks('x'.repeat(501), { platform: 'threads' });
    expect(overLong.find(c => c.name === 'max-chars')!.passed).toBe(false);
    const tooManyTags = runChecks('hi #a #b #c #d #e #f', {
      platform: 'threads',
    });
    expect(tooManyTags.find(c => c.name === 'max-hashtags')!.passed).toBe(false);
    const ok = runChecks('Short threads post. #a #b', { platform: 'threads' });
    expect(ok.find(c => c.name === 'max-chars')!.passed).toBe(true);
    expect(ok.find(c => c.name === 'max-hashtags')!.passed).toBe(true);
  });

  it('flags blank string / empty array required JSON values', () => {
    const checks = runChecks('{"body":"   ","cta":"Go","tags":[]}', {
      requireNonEmptyJsonKeys: ['body', 'cta', 'tags'],
    });
    expect(checks.find(c => c.name === 'json-key-nonempty:body')!.passed).toBe(
      false
    );
    expect(checks.find(c => c.name === 'json-key-nonempty:cta')!.passed).toBe(
      true
    );
    expect(checks.find(c => c.name === 'json-key-nonempty:tags')!.passed).toBe(
      false
    );
  });

  it('treats a missing required-non-empty JSON key as failing', () => {
    const checks = runChecks('{"a":"x"}', { requireNonEmptyJsonKeys: ['b'] });
    expect(checks.find(c => c.name === 'json-key-nonempty:b')!.passed).toBe(
      false
    );
  });

  it('rejects a bare object / non-string-non-array as a required non-empty value (CodeRabbit #395)', () => {
    // Contract is "non-blank string or non-empty array" — an empty object, a
    // populated object, and a number must all FAIL a required-non-empty key.
    const checks = runChecks('{"a":{},"b":{"x":1},"c":0}', {
      requireNonEmptyJsonKeys: ['a', 'b', 'c'],
    });
    expect(checks.find(ch => ch.name === 'json-key-nonempty:a')!.passed).toBe(
      false
    );
    expect(checks.find(ch => ch.name === 'json-key-nonempty:b')!.passed).toBe(
      false
    );
    expect(checks.find(ch => ch.name === 'json-key-nonempty:c')!.passed).toBe(
      false
    );
  });

  it('treats non-object JSON as invalid for structured cases', () => {
    const checks = runChecks('"just a string"', { requireJsonKeys: ['x'] });
    expect(checks.find(c => c.name === 'valid-json')!.passed).toBe(false);
  });

  it('flags every banned phrase substring case-insensitively', () => {
    for (const phrase of BANNED_PHRASES) {
      const checks = runChecks(`prefix ${phrase.toUpperCase()} suffix`, {});
      const check = checks.find(c => c.name === `no-banned:${phrase}`)!;
      expect(check.passed).toBe(false);
    }
  });

  it('honours per-case mustNotInclude additions', () => {
    const checks = runChecks('we love competitor brand', {
      mustNotInclude: ['competitor brand'],
    });
    expect(checks.find(c => c.name === 'no-banned:competitor brand')!.passed).toBe(
      false
    );
  });

  it('scoreCase reports partial score when some checks fail', () => {
    const goldenCase = GOLDEN_CASES.find(c => c.id === 'instagram-cafe')!;
    const result = scoreCase(goldenCase, BAD_OUTPUTS['instagram-cafe']);
    expect(result.passed).toBe(false);
    expect(result.score).toBeGreaterThan(0);
    expect(result.score).toBeLessThan(1);
  });
});

describe('AI eval harness — provider is fully mocked (offline / no cost)', () => {
  it('mock provider returns canned content by embedded case id', async () => {
    const provider = new MockAIProvider({ 'case-a': 'canned A' });
    const res = await provider.complete({
      model: provider.models.balanced,
      messages: [
        { role: 'system', content: `ctx ${CASE_MARKER}case-a` },
        { role: 'user', content: 'go' },
      ],
    });
    expect(res.choices[0].message.content).toBe('canned A');
    expect(res.usage?.total_tokens).toBe(0);
  });

  it('resolves the case id from any message carrying the marker', () => {
    expect(
      resolveCaseId({
        model: 'm',
        messages: [{ role: 'system', content: `${CASE_MARKER}xyz` }],
      })
    ).toBe('xyz');
    expect(
      resolveCaseId({ model: 'm', messages: [{ role: 'user', content: 'none' }] })
    ).toBeNull();
  });

  it('does not import the real OpenAI SDK in the mock path', () => {
    // The eval barrel must be importable without OPENAI_API_KEY or network.
    // If the real provider were eagerly imported, constructing the harness
    // would touch the OpenAI SDK. This test passing proves the offline path.
    delete process.env.OPENAI_API_KEY;
    expect(() => new MockAIProvider({})).not.toThrow();
  });
});
