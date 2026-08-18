const mockResponsesCreate = jest.fn();
const mockGenerateImage = jest.fn();
const mockSystemGenerationContext = jest
  .fn()
  .mockReturnValue({ context: 'test' });

jest.mock('openai', () => ({
  __esModule: true,
  default: jest.fn(),
}));

jest.mock('@/lib/services/ai/image-generation', () => ({
  generateImage: (...args: unknown[]) => mockGenerateImage(...args),
}));

jest.mock('@/lib/ai/generation-context', () => ({
  systemGenerationContext: (...args: unknown[]) =>
    mockSystemGenerationContext(...args),
}));

jest.mock('@/lib/logger', () => ({
  logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));

import OpenAI from 'openai';
import { generateCampaignConceptStudio } from '@/lib/services/campaign-concept-studio';

const VALID_PAYLOAD = {
  campaignBrief: 'Launch our spring product campaign for professional teams.',
  targetAudience: 'Marketing managers at B2B companies.',
  productDetails:
    'An all-in-one campaign tool that saves hours per week on planning.',
  tone: 'confident' as const,
  channels: ['instagram', 'linkedin'] as const,
};

const AI_JSON = JSON.stringify({
  concept: {
    concept: 'Work smarter, not harder every day',
    positioning: 'The fastest way to launch campaigns at scale',
    valueProposition: 'Cut campaign prep time by 80% per sprint',
  },
  copyVariants: [
    {
      headline: 'Launch faster today',
      body: 'Stop wasting time on manual campaign setup and start generating results that matter.',
    },
    {
      headline: 'Ship more campaigns',
      body: 'Built for teams that need results without the operational overhead every week.',
    },
    {
      headline: 'Grow quicker now',
      body: 'AI-powered campaign tools so your team can focus entirely on strategy.',
    },
  ],
  launchChecklist: [
    'Review copy with legal voice guidelines',
    'Upload brand assets to asset library',
    'Schedule posts at peak engagement times',
    'Set up conversion tracking pixels',
  ],
  imagePrompts: [
    {
      channel: 'instagram',
      prompt: 'Hero shot of modern professional team at work',
    },
    {
      channel: 'linkedin',
      prompt: 'Executive reviewing campaign results on laptop',
    },
  ],
});

const IMAGE_OK = {
  imageUrl: 'https://example.com/image.png',
  imageBase64: undefined,
  error: undefined,
  metadata: { model: 'dall-e-3' },
};

function openaiTextResponse(text: string) {
  return {
    output_text: text,
    usage: { input_tokens: 100, output_tokens: 300, total_tokens: 400 },
  };
}

function openaiOutputArrayResponse(text: string) {
  return {
    output: [{ text }],
    usage: { input_tokens: 80, output_tokens: 250, total_tokens: 330 },
  };
}

function openaiNestedContentResponse(text: string) {
  return {
    output: [{ content: [{ text }] }],
    usage: { input_tokens: 90, output_tokens: 270, total_tokens: 360 },
  };
}

describe('generateCampaignConceptStudio', () => {
  const originalKey = process.env.OPENAI_API_KEY;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.OPENAI_API_KEY = 'test-key';

    // resetMocks:true clears the constructor implementation before each test —
    // re-apply it here so new OpenAI() returns the instance shape we expect.
    (OpenAI as jest.Mock).mockImplementation(() => ({
      responses: {
        create: (...args: unknown[]) => mockResponsesCreate(...args),
      },
    }));

    mockGenerateImage.mockResolvedValue(IMAGE_OK);
  });

  afterEach(() => {
    process.env.OPENAI_API_KEY = originalKey;
  });

  describe('OpenAI response shape handling', () => {
    it('extracts text from output_text field', async () => {
      mockResponsesCreate.mockResolvedValue(openaiTextResponse(AI_JSON));

      const result = await generateCampaignConceptStudio(
        { ...VALID_PAYLOAD, channels: ['instagram', 'linkedin'] },
        { userId: 'u1', organizationId: 'org1' }
      );

      expect(result.concept.concept).toBe('Work smarter, not harder every day');
      expect(result.copyVariants).toHaveLength(3);
    });

    it('extracts text from output[].text array', async () => {
      mockResponsesCreate.mockResolvedValue(openaiOutputArrayResponse(AI_JSON));

      const result = await generateCampaignConceptStudio(
        { ...VALID_PAYLOAD, channels: ['instagram', 'linkedin'] },
        { userId: 'u1', organizationId: 'org1' }
      );

      expect(result.concept.positioning).toBe(
        'The fastest way to launch campaigns at scale'
      );
    });

    it('extracts text from output[].content[].text nested shape', async () => {
      mockResponsesCreate.mockResolvedValue(
        openaiNestedContentResponse(AI_JSON)
      );

      const result = await generateCampaignConceptStudio(
        { ...VALID_PAYLOAD, channels: ['instagram', 'linkedin'] },
        { userId: 'u1', organizationId: 'org1' }
      );

      expect(result.launchChecklist.length).toBeGreaterThanOrEqual(4);
    });

    it('strips markdown code fences from AI JSON output', async () => {
      const fenced = `\`\`\`json\n${AI_JSON}\n\`\`\``;
      mockResponsesCreate.mockResolvedValue(openaiTextResponse(fenced));

      const result = await generateCampaignConceptStudio(
        { ...VALID_PAYLOAD, channels: ['instagram', 'linkedin'] },
        { userId: 'u1', organizationId: 'org1' }
      );

      expect(result.concept.valueProposition).toBe(
        'Cut campaign prep time by 80% per sprint'
      );
    });

    it('throws when OpenAI returns empty output', async () => {
      mockResponsesCreate.mockResolvedValue({ output_text: '', output: [] });

      await expect(
        generateCampaignConceptStudio(
          { ...VALID_PAYLOAD, channels: ['instagram'] },
          { userId: 'u1', organizationId: 'org1' }
        )
      ).rejects.toThrow('OpenAI Responses API returned empty output.');
    });
  });

  describe('AI JSON validation', () => {
    it('throws a readable error when AI returns invalid JSON structure', async () => {
      const badJson = JSON.stringify({
        concept: { concept: 'x', positioning: 'y', valueProposition: 'z' },
        copyVariants: [{ headline: 'only one' }],
        launchChecklist: ['step one'],
        imagePrompts: [{ channel: 'instagram', prompt: 'test' }],
      });
      mockResponsesCreate.mockResolvedValue(openaiTextResponse(badJson));

      await expect(
        generateCampaignConceptStudio(
          { ...VALID_PAYLOAD, channels: ['instagram'] },
          { userId: 'u1', organizationId: 'org1' }
        )
      ).rejects.toThrow('OpenAI response validation failed:');
    });

    it('throws when AI returns unparseable text', async () => {
      mockResponsesCreate.mockResolvedValue(
        openaiTextResponse('This is not JSON at all.')
      );

      await expect(
        generateCampaignConceptStudio(
          { ...VALID_PAYLOAD, channels: ['instagram'] },
          { userId: 'u1', organizationId: 'org1' }
        )
      ).rejects.toThrow();
    });
  });

  describe('image generation', () => {
    it('generates one image per requested channel', async () => {
      mockResponsesCreate.mockResolvedValue(openaiTextResponse(AI_JSON));

      const result = await generateCampaignConceptStudio(
        { ...VALID_PAYLOAD, channels: ['instagram', 'linkedin'] },
        { userId: 'u1', organizationId: 'org1' }
      );

      expect(mockGenerateImage).toHaveBeenCalledTimes(2);
      expect(result.imagePrompts).toHaveLength(2);
      expect(result.imagePrompts[0].status).toBe('ready');
    });

    it('captures image failure per channel without throwing', async () => {
      mockResponsesCreate.mockResolvedValue(openaiTextResponse(AI_JSON));
      mockGenerateImage.mockRejectedValue(
        new Error('Image service unavailable')
      );

      const result = await generateCampaignConceptStudio(
        { ...VALID_PAYLOAD, channels: ['instagram', 'linkedin'] },
        { userId: 'u1', organizationId: 'org1' }
      );

      expect(result.imagePrompts.every(item => item.status === 'failed')).toBe(
        true
      );
      expect(result.imagePrompts[0].error).toBe('Image service unavailable');
    });

    it('marks channel failed when image service returns no URL', async () => {
      mockResponsesCreate.mockResolvedValue(openaiTextResponse(AI_JSON));
      mockGenerateImage.mockResolvedValue({
        imageUrl: undefined,
        imageBase64: undefined,
        error: 'Blocked by content policy',
        metadata: { model: 'dall-e-3' },
      });

      const result = await generateCampaignConceptStudio(
        { ...VALID_PAYLOAD, channels: ['instagram'] },
        { userId: 'u1', organizationId: 'org1' }
      );

      expect(result.imagePrompts[0].status).toBe('failed');
      expect(result.imagePrompts[0].error).toBe('Blocked by content policy');
    });

    it('generates a fallback prompt when AI omits a requested channel', async () => {
      const jsonMissingLinkedin = JSON.stringify({
        concept: {
          concept: 'Work smarter and move faster every sprint',
          positioning: 'The fastest campaign launch tool on the market',
          valueProposition: 'Save 80% of prep time on every campaign sprint',
        },
        copyVariants: [
          {
            headline: 'Headline variant A',
            body: 'Body variant A is long enough to satisfy the minimum length validation requirement.',
          },
          {
            headline: 'Headline variant B',
            body: 'Body variant B is long enough to satisfy the minimum length validation requirement.',
          },
          {
            headline: 'Headline variant C',
            body: 'Body variant C is long enough to satisfy the minimum length validation requirement.',
          },
        ],
        launchChecklist: [
          'Review step detail one',
          'Review step detail two',
          'Review step detail three',
          'Review step detail four',
        ],
        imagePrompts: [
          { channel: 'instagram', prompt: 'Hero shot for instagram campaign' },
        ],
      });
      mockResponsesCreate.mockResolvedValue(
        openaiTextResponse(jsonMissingLinkedin)
      );

      const result = await generateCampaignConceptStudio(
        { ...VALID_PAYLOAD, channels: ['instagram', 'linkedin'] },
        { userId: 'u1', organizationId: 'org1' }
      );

      const linkedinEntry = result.imagePrompts.find(
        item => item.channel === 'linkedin'
      );
      expect(linkedinEntry).toBeDefined();
      expect(linkedinEntry?.prompt.length).toBeGreaterThan(0);
    });
  });

  describe('response shape', () => {
    it('returns usage tokens from the OpenAI response', async () => {
      mockResponsesCreate.mockResolvedValue(openaiTextResponse(AI_JSON));

      const result = await generateCampaignConceptStudio(
        { ...VALID_PAYLOAD, channels: ['instagram'] },
        { userId: 'u1', organizationId: 'org1' }
      );

      expect(result.usage?.inputTokens).toBe(100);
      expect(result.usage?.outputTokens).toBe(300);
      expect(result.usage?.totalTokens).toBe(400);
    });

    it('includes model names in the response', async () => {
      mockResponsesCreate.mockResolvedValue(openaiTextResponse(AI_JSON));

      const result = await generateCampaignConceptStudio(
        { ...VALID_PAYLOAD, channels: ['instagram'] },
        { userId: 'u1', organizationId: 'org1' }
      );

      expect(typeof result.model.textModel).toBe('string');
      expect(typeof result.model.imageModel).toBe('string');
    });
  });

  describe('error paths', () => {
    it('throws when OPENAI_API_KEY is not set', async () => {
      delete process.env.OPENAI_API_KEY;

      await expect(
        generateCampaignConceptStudio(
          { ...VALID_PAYLOAD, channels: ['instagram'] },
          { userId: 'u1', organizationId: 'org1' }
        )
      ).rejects.toThrow('OPENAI_API_KEY is not configured.');
    });

    it('passes request schema validation before calling OpenAI', async () => {
      await expect(
        generateCampaignConceptStudio(
          {
            campaignBrief: 'too short',
            targetAudience: 'x',
            productDetails: 'y',
            tone: 'confident',
            channels: [],
          } as never,
          { userId: 'u1', organizationId: 'org1' }
        )
      ).rejects.toThrow();

      expect(mockResponsesCreate).not.toHaveBeenCalled();
    });
  });
});
