/**
 * Unit coverage for generateCaseStudyScript (SYN-508).
 * Anthropic fetch + trackPipelineCost are mocked; no real network / DB.
 */

const mockTrackPipelineCost = jest.fn().mockResolvedValue(undefined);
jest.mock('@/lib/pipelines/track-cost', () => ({
  __esModule: true,
  trackPipelineCost: (...args: unknown[]) => mockTrackPipelineCost(...args),
  // Keep the real cost maths so the ledger figure is meaningful.
  calculatePipelineCost: jest.requireActual('@/lib/pipelines/track-cost')
    .calculatePipelineCost,
}));

import {
  buildScriptUserMessage,
  parseCaseStudyScript,
  generateCaseStudyScript,
} from '@/lib/videos/generateCaseStudyScript';

const VALID_SCRIPT = {
  intro: 'Meet Acme Roofing.',
  resultsHighlight: 'Engagement climbed to 6.4% on Instagram.',
  quote: '"Synthex changed how we show up online."',
  cta: 'Start your story with Synthex.',
};

beforeEach(() => {
  jest.clearAllMocks();
  process.env.ANTHROPIC_API_KEY = 'test-key';
});

describe('buildScriptUserMessage', () => {
  it('includes supplied metrics and omits missing ones', () => {
    const msg = buildScriptUserMessage({
      businessName: 'Acme Roofing',
      avgEngagementRate: '6.4%',
      bestPlatform: 'Instagram',
      topContentTypes: ['Reels', 'Carousels'],
    });
    expect(msg).toContain('Acme Roofing');
    expect(msg).toContain('6.4%');
    expect(msg).toContain('Instagram');
    expect(msg).toContain('Reels, Carousels');
  });

  it('never fabricates a metric that was not supplied', () => {
    const msg = buildScriptUserMessage({ businessName: 'Acme Roofing' });
    expect(msg).toContain('Acme Roofing');
    expect(msg).not.toMatch(/engagement rate/i);
  });
});

describe('parseCaseStudyScript', () => {
  it('parses clean JSON into the four sections', () => {
    expect(parseCaseStudyScript(JSON.stringify(VALID_SCRIPT))).toEqual(
      VALID_SCRIPT
    );
  });

  it('strips a ```json code fence', () => {
    const fenced = '```json\n' + JSON.stringify(VALID_SCRIPT) + '\n```';
    expect(parseCaseStudyScript(fenced)).toEqual(VALID_SCRIPT);
  });

  it('throws when a required section is missing', () => {
    const bad = JSON.stringify({
      intro: 'x',
      resultsHighlight: 'y',
      quote: 'z',
    });
    expect(() => parseCaseStudyScript(bad)).toThrow(/cta/);
  });
});

describe('generateCaseStudyScript', () => {
  function mockAnthropicOk() {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ type: 'text', text: JSON.stringify(VALID_SCRIPT) }],
        usage: { input_tokens: 120, output_tokens: 300 },
      }),
    }) as unknown as typeof fetch;
  }

  it('returns the structured script and tracks cost after generation', async () => {
    mockAnthropicOk();
    const script = await generateCaseStudyScript(
      { businessName: 'Acme Roofing', avgEngagementRate: '6.4%' },
      { clientId: 'client-123', runId: 'run-1' }
    );

    expect(script).toEqual(VALID_SCRIPT);

    // Hit the direct Anthropic Messages endpoint with the haiku model.
    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    const sent = JSON.parse((init as RequestInit).body as string);
    expect(sent.model).toBe('claude-haiku-4-5-20251001');
    expect(sent.max_tokens).toBe(800);

    // Cost tracked with the real token counts.
    expect(mockTrackPipelineCost).toHaveBeenCalledTimes(1);
    const costArg = mockTrackPipelineCost.mock.calls[0][0];
    expect(costArg).toMatchObject({
      pipeline_name: 'featured_case_study_script',
      client_id: 'client-123',
      run_id: 'run-1',
      model: 'claude-haiku-4-5-20251001',
      input_tokens: 120,
      output_tokens: 300,
    });
    // 120/1e6*1 + 300/1e6*5 = 0.00162
    expect(costArg.cost_usd).toBeCloseTo(0.00162, 6);
  });

  it('throws (and never tracks cost) when the API key is missing', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    await expect(
      generateCaseStudyScript({ businessName: 'Acme' })
    ).rejects.toThrow(/ANTHROPIC_API_KEY/);
    expect(mockTrackPipelineCost).not.toHaveBeenCalled();
  });

  it('throws on a non-OK Anthropic response', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 429,
      text: async () => 'rate limited',
    }) as unknown as typeof fetch;
    await expect(
      generateCaseStudyScript({ businessName: 'Acme' })
    ).rejects.toThrow(/429/);
    expect(mockTrackPipelineCost).not.toHaveBeenCalled();
  });
});
