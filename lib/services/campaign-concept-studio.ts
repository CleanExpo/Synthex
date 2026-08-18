import OpenAI from 'openai';
import { z } from 'zod';

import {
  generateImage,
  type ImageGenerationOptions,
} from '@/lib/services/ai/image-generation';
import { systemGenerationContext } from '@/lib/ai/generation-context';

import {
  CAMPAIGN_STUDIO_CHANNELS,
  CAMPAIGN_STUDIO_TONES,
  type CampaignStudioChannel,
  type CampaignStudioImagePrompt,
  type CampaignStudioRequest,
  type CampaignStudioResponse,
} from '@/lib/types/campaign-concept-studio';

const textModel =
  process.env.CAMPAIGN_CONCEPT_TEXT_MODEL ||
  process.env.OPENAI_TEXT_MODEL ||
  'gpt-4o-mini';
const imageModel = process.env.CAMPAIGN_CONCEPT_IMAGE_MODEL || 'dall-e-3';
const maxOutputTokens = Number(
  process.env.CAMPAIGN_CONCEPT_MAX_TOKENS || '1400'
);
const imageQualityDefault =
  process.env.CAMPAIGN_CONCEPT_IMAGE_QUALITY || 'standard';

const allowedImageSizes = ['1024x1024', '1024x1792', '1792x1024'] as const;
const outputValidation = z.object({
  concept: z.object({
    concept: z.string().trim().min(24),
    positioning: z.string().trim().min(24),
    valueProposition: z.string().trim().min(24),
  }),
  copyVariants: z
    .array(
      z.object({
        headline: z.string().trim().min(8),
        body: z.string().trim().min(40),
      })
    )
    .length(3),
  launchChecklist: z.array(z.string().trim().min(6)).min(4),
  imagePrompts: z
    .array(
      z.object({
        channel: z.enum(CAMPAIGN_STUDIO_CHANNELS),
        prompt: z.string().trim().min(10),
      })
    )
    .min(1),
});

export const campaignConceptStudioRequestSchema = z
  .object({
    campaignBrief: z
      .string()
      .trim()
      .min(12, 'Campaign brief must be at least 12 characters')
      .max(1600, 'Campaign brief must be at most 1600 characters'),
    targetAudience: z
      .string()
      .trim()
      .min(6, 'Target audience must be at least 6 characters')
      .max(500, 'Target audience must be at most 500 characters'),
    productDetails: z
      .string()
      .trim()
      .min(12, 'Product details must be at least 12 characters')
      .max(2200, 'Product details must be at most 2200 characters'),
    tone: z.enum(CAMPAIGN_STUDIO_TONES),
    channels: z
      .array(z.enum(CAMPAIGN_STUDIO_CHANNELS))
      .min(1, 'Select at least one channel')
      .max(8, 'Select up to eight channels'),
  })
  .strict();

type ImageSize = (typeof allowedImageSizes)[number];

function parseImageSize(): ImageSize {
  const requested = process.env.CAMPAIGN_CONCEPT_IMAGE_SIZE?.trim();
  if (
    requested &&
    (allowedImageSizes as readonly string[]).includes(requested)
  ) {
    return requested as ImageSize;
  }
  return '1024x1024';
}

function parseImageDimensions(): { width: number; height: number } {
  const [widthText, heightText] = parseImageSize().split('x');
  return {
    width: Number(widthText) || 1024,
    height: Number(heightText) || 1024,
  };
}

function extractResponsesText(response: unknown): string {
  const data = response as {
    output_text?: unknown;
    output?: Array<{ content?: unknown; text?: string }>;
  };

  if (typeof data.output_text === 'string' && data.output_text.trim()) {
    return data.output_text;
  }

  if (!Array.isArray(data.output)) {
    return '';
  }

  const collected = data.output
    .map(item => {
      if (!item) return '';
      if (typeof item.text === 'string') return item.text;
      if (typeof (item.content as unknown) === 'string')
        return item.content as string;

      if (Array.isArray(item.content)) {
        return item.content
          .map((part: { text?: unknown }) => {
            if (typeof part?.text === 'string') return part.text;
            return '';
          })
          .join('');
      }

      return '';
    })
    .filter(Boolean)
    .join('\n');

  return collected;
}

function coerceImageJson(rawText: string): string {
  const fenced = rawText.match(/```json\s*([\s\S]*?)\s*```/i);
  if (fenced?.[1]) {
    return fenced[1].trim();
  }
  return rawText.trim();
}

function buildPrompt(input: CampaignStudioRequest) {
  const channels = input.channels.join(', ');

  return [
    'You are a senior marketing strategist.',
    'Return ONLY minified JSON with exactly these fields and no additional prose.',
    'Top-level keys: concept, copyVariants, launchChecklist, imagePrompts.',
    'Use plain JSON-safe text values only.',
    `Campaign brief: ${input.campaignBrief}`,
    `Target audience: ${input.targetAudience}`,
    `Product details: ${input.productDetails}`,
    `Tone: ${input.tone}`,
    `Channels: ${channels}`,
    '',
    'Rules:',
    '1) concept: short reusable positioning idea.',
    '2) copyVariants: exactly 3 objects with headline and body.',
    '3) launchChecklist: at least 4 executable steps.',
    '4) imagePrompts: one entry per requested channel with channel + detailed prompt.',
    'Do not include Markdown or explanation.',
  ].join('\n');
}

function normaliseTextOutput(
  rawText: string,
  requestedChannels: CampaignStudioChannel[]
) {
  const parsed = outputValidation.parse(JSON.parse(rawText));

  const requested = new Set(requestedChannels);
  const promptMap = new Map(
    parsed.imagePrompts.map(entry => [entry.channel, entry.prompt])
  );

  return {
    concept: parsed.concept,
    copyVariants: parsed.copyVariants,
    launchChecklist: parsed.launchChecklist,
    imagePrompts: requestedChannels.map(channel => ({
      channel,
      prompt:
        promptMap.get(channel) ||
        `${parsed.concept.concept} visual direction for ${channel}: ${parsed.concept.positioning}. ${parsed.concept.valueProposition}.`,
    })),
  };
}

function getImagePromptForChannel(
  parsedPayload: {
    concept: { concept: string; positioning: string; valueProposition: string };
    imagePrompts: Array<{ channel: CampaignStudioChannel; prompt: string }>;
  },
  channel: CampaignStudioChannel
) {
  const found = parsedPayload.imagePrompts.find(
    item => item.channel === channel
  );
  if (found) return found.prompt;

  return `${parsedPayload.concept.concept} for ${channel}: ${parsedPayload.concept.positioning}. ${parsedPayload.concept.valueProposition}.`;
}

export async function generateCampaignConceptStudio(
  payload: CampaignStudioRequest,
  options?: {
    userId?: string;
    organizationId?: string;
    traceId?: string;
  }
): Promise<CampaignStudioResponse> {
  const validated = campaignConceptStudioRequestSchema.parse(payload);

  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    throw new Error('OPENAI_API_KEY is not configured.');
  }

  const openai = new OpenAI({ apiKey: key });
  const { width, height } = parseImageDimensions();
  const generationContext = systemGenerationContext(options?.organizationId, {
    userId: options?.userId || 'system',
    traceId: options?.traceId,
    autonomyLevel: 'manual',
  });

  const textResponse = await openai.responses.create({
    model: textModel,
    input: buildPrompt(validated),
    instructions:
      'You are writing for a professional marketing workflow. Be concise, practical and production-ready.',
    max_output_tokens:
      Number.isFinite(maxOutputTokens) && maxOutputTokens > 0
        ? maxOutputTokens
        : 1400,
  });

  const rawText = extractResponsesText(textResponse);
  if (!rawText) {
    throw new Error('OpenAI Responses API returned empty output.');
  }

  let parsedPayload;
  try {
    parsedPayload = normaliseTextOutput(
      coerceImageJson(rawText),
      validated.channels
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(
        `OpenAI response validation failed: ${error.issues.map(item => item.message).join('; ')}`
      );
    }

    throw error as Error;
  }

  const withImages = await Promise.all(
    validated.channels.map(async channel => {
      const promptText = getImagePromptForChannel(parsedPayload, channel);
      const fullPrompt = `${promptText} ${validated.tone} marketing campaign visual style.`;

      const imageOptions: ImageGenerationOptions = {
        prompt: fullPrompt,
        width,
        height,
        quality: imageQualityDefault as 'standard' | 'hd',
        provider: 'dalle',
        // Keep this workflow functional even when no reference subject is
        // resolvable yet; it is still grounded via explicit settings in the
        // UI workflow (user can toggle grounding later if/when they wire a
        // campaign reference set).
        useReferences: false,
      };

      try {
        const imageResult = await generateImage(
          imageOptions,
          generationContext
        );
        const imageUrl = imageResult.imageUrl || imageResult.imageBase64;

        const prepared: CampaignStudioImagePrompt = {
          channel,
          prompt: promptText,
          status: imageUrl ? 'ready' : 'failed',
          imageUrl: imageUrl || undefined,
          providerImageModel: imageResult.metadata?.model || imageModel,
          error: imageUrl
            ? undefined
            : imageResult.error || 'No image returned by image service',
        };

        return prepared;
      } catch (error) {
        return {
          channel,
          prompt: promptText,
          status: 'failed' as const,
          providerImageModel: imageModel,
          error:
            error instanceof Error ? error.message : 'Image generation failed',
        };
      }
    })
  );

  return {
    concept: parsedPayload.concept,
    copyVariants: parsedPayload.copyVariants,
    launchChecklist: parsedPayload.launchChecklist,
    imagePrompts: withImages,
    model: {
      textModel,
      imageModel,
    },
    usage: {
      inputTokens: (
        textResponse as {
          usage?: {
            input_tokens?: number;
            output_tokens?: number;
            total_tokens?: number;
          };
        }
      ).usage?.input_tokens,
      outputTokens: (
        textResponse as {
          usage?: {
            input_tokens?: number;
            output_tokens?: number;
            total_tokens?: number;
          };
        }
      ).usage?.output_tokens,
      totalTokens: (
        textResponse as {
          usage?: {
            input_tokens?: number;
            output_tokens?: number;
            total_tokens?: number;
          };
        }
      ).usage?.total_tokens,
    },
  };
}
