/**
 * Unit tests — RA-3028 story-generator provider-layer edges
 *
 * generateMonthlyNarrative now calls Claude via AnthropicProvider. These tests
 * pin the two behaviour deltas of that migration:
 *  - multi-text-block responses are concatenated ('' separator) instead of the
 *    old content[0]-only read
 *  - a missing API key rejects before any SDK call
 */

const mockAnthropicCreate = jest.fn();
let mockApiKey = 'test-key';

jest.mock('@anthropic-ai/sdk', () => {
  class MockAnthropic {
    apiKey = mockApiKey;
    messages = { create: mockAnthropicCreate };
    static APIError = class MockAPIError extends Error {};
  }
  return { __esModule: true, default: MockAnthropic };
});

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

const METRICS = {
  orgName: 'Capital Plumbing',
  monthLabel: 'June 2026',
  postsPublished: 12,
  autonomousPosts: 8,
  totalReach: 4200,
  minutesSaved: 300,
};

beforeEach(() => {
  // resetModules clears the module-level AnthropicProvider singleton so each
  // test constructs a fresh provider against the current mockApiKey.
  jest.resetModules();
  jest.clearAllMocks();
  mockApiKey = 'test-key';
});

describe('generateMonthlyNarrative — provider-layer edges (RA-3028)', () => {
  it('concatenates multiple text blocks (provider delta vs old content[0])', async () => {
    mockAnthropicCreate.mockResolvedValue({
      id: 'msg_test',
      model: 'claude-sonnet-4-6',
      stop_reason: 'end_turn',
      content: [
        { type: 'text', text: 'June was a strong month.' },
        { type: 'text', text: ' Reach grew across platforms.' },
      ],
      usage: { input_tokens: 200, output_tokens: 80 },
    });

    const { generateMonthlyNarrative } =
      await import('@/lib/ai/story-generator');
    const narrative = await generateMonthlyNarrative(METRICS);

    expect(narrative).toBe(
      'June was a strong month. Reach grew across platforms.'
    );
    expect(mockAnthropicCreate).toHaveBeenCalledTimes(1);
  });

  it('rejects before any SDK call when the API key is missing', async () => {
    mockApiKey = '';

    const { generateMonthlyNarrative } =
      await import('@/lib/ai/story-generator');

    await expect(generateMonthlyNarrative(METRICS)).rejects.toThrow(
      'Anthropic API key not configured'
    );
    expect(mockAnthropicCreate).not.toHaveBeenCalled();
  });
});
