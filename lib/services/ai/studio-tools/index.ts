/**
 * Studio tool layer — the SINGLE typed contract for everything the studio can
 * do. REST routes, the MCP server, and the in-app copilot are thin wrappers
 * over these. NO publish/schedule tools in phase 1 (spec: agents generate and
 * draft; pushing to the publish queue stays human).
 */
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { submitGenerativeVideo } from '@/lib/services/ai/video/generation-service';
import { METHOD_CARDS } from '@/lib/services/ai/video/cards/method-cards';
import { MODIFIER_CHIPS } from '@/lib/services/ai/video/cards/modifier-chips';
import { getBrandFragment } from '@/lib/services/ai/video/cards/brand-cards';
import { VIDEO_MODELS } from '@/lib/services/ai/video/registry';
import { quotaSnapshot } from '@/lib/services/ai/video/quota';
import { mediaLibraryService } from '@/lib/services/media-library';
import { getAIProvider } from '@/lib/ai/providers';
import { modelForTask } from '@/lib/services/ai/video/llm-routing';
import type { InitiatedBy } from '@/lib/services/ai/video/types';
// generateImage is the real export from lib/services/ai/image-generation.ts
import { generateImage } from '@/lib/services/ai/image-generation';

export interface ToolContext {
  userId: string;
  organizationId: string;
  initiatedBy: InitiatedBy;
}

export interface StudioTool {
  name: string;
  description: string;
  schema: z.ZodTypeAny;
  execute: (
    args: unknown,
    ctx: ToolContext
  ) => Promise<Record<string, unknown>>;
}

const GenerateVideoArgs = z.object({
  prompt: z.string().min(3).max(1000),
  imageUrl: z.string().url().optional(),
  methodCardId: z.string().min(1),
  modifierIds: z.array(z.string()).max(12).optional(),
  brandCardId: z.string().optional(),
  audio: z.boolean().optional(),
  variants: z.number().int().min(1).max(8).optional(),
  modelTier: z.enum(['draft', 'standard', 'premium']).optional(),
  aspectRatio: z.enum(['9:16', '1:1', '16:9']).optional(),
  durationSeconds: z.number().int().min(4).max(10).optional(),
});

const GetJobArgs = z.object({ id: z.string().min(1) });
const ListJobsArgs = z.object({
  batchGroupId: z.string().optional(),
  limit: z.number().int().min(1).max(50).optional(),
});
const GenerateImageArgs = z.object({
  prompt: z.string().min(3).max(1000),
  style: z
    .enum([
      'photorealistic',
      'artistic',
      'anime',
      'digital-art',
      'cinematic',
      'minimalist',
    ])
    .optional(),
  aspectRatio: z.enum(['9:16', '1:1', '16:9']).optional(),
});
const SearchMediaArgs = z.object({
  search: z.string().min(1),
  type: z.enum(['image', 'video', 'audio']).optional(),
});
const DraftCaptionArgs = z.object({
  jobId: z.string().min(1),
  platform: z.enum(['instagram', 'tiktok', 'linkedin', 'facebook', 'youtube']),
});

export const STUDIO_TOOLS: StudioTool[] = [
  {
    name: 'list_cards',
    description:
      'List method cards, modifier chips, the org brand card, model tiers with costs and capability profiles, and current quota state.',
    schema: z.object({}),
    execute: async (_args, ctx) => ({
      methodCards: METHOD_CARDS,
      modifierChips: MODIFIER_CHIPS,
      brandCard: (await getBrandFragment(ctx.organizationId))
        ? { organizationId: ctx.organizationId }
        : null,
      models: VIDEO_MODELS,
      quota: await quotaSnapshot(ctx.organizationId),
    }),
  },
  {
    name: 'generate_video',
    description:
      'Submit a generative video job (async — returns job ids immediately; poll get_job). Defaults: draft tier, 9:16, 6s, 1 variant. Premium tier must be explicit. Response includes budgetWarning when the org is at 80%+ of a cap — self-throttle when true.',
    schema: GenerateVideoArgs,
    execute: async (args, ctx) => {
      const a = GenerateVideoArgs.parse(args);
      const jobs = await submitGenerativeVideo({ ...a, ...ctx });
      const quota = await quotaSnapshot(ctx.organizationId);
      return { jobs, budgetWarning: quota.warning };
    },
  },
  {
    name: 'generate_image',
    description:
      'Generate an image via the existing image service (Stability/DALL-E/Gemini).',
    schema: GenerateImageArgs,
    execute: async (args, _ctx) => {
      const a = GenerateImageArgs.parse(args);
      // generateImage takes ImageGenerationOptions — no userId field on the real signature
      const result = await generateImage({
        prompt: a.prompt,
        style: a.style,
        aspectRatio: a.aspectRatio,
      });
      return { result };
    },
  },
  {
    name: 'get_job',
    description:
      'Fetch one video job by id (status, videoUrl when rendered, error when failed). Org-scoped.',
    schema: GetJobArgs,
    execute: async (args, ctx) => {
      const { id } = GetJobArgs.parse(args);
      const job = await prisma.videoGeneration.findFirst({
        where: { id, organizationId: ctx.organizationId },
        select: {
          id: true,
          status: true,
          videoUrl: true,
          errorMessage: true,
          model: true,
          batchGroupId: true,
          estimatedCostUsd: true,
          actualCostUsd: true,
          createdAt: true,
        },
      });
      return { job };
    },
  },
  {
    name: 'list_jobs',
    description:
      'List recent generative video jobs for the org, optionally by batchGroupId.',
    schema: ListJobsArgs,
    execute: async (args, ctx) => {
      const a = ListJobsArgs.parse(args);
      const jobs = await prisma.videoGeneration.findMany({
        where: {
          organizationId: ctx.organizationId,
          mode: 'generative',
          ...(a.batchGroupId ? { batchGroupId: a.batchGroupId } : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: a.limit ?? 20,
        select: {
          id: true,
          status: true,
          videoUrl: true,
          methodCardId: true,
          batchGroupId: true,
          createdAt: true,
        },
      });
      return { jobs };
    },
  },
  {
    name: 'search_media_library',
    description:
      'Search the media library (e.g. find an image asset to use as I2V input).',
    schema: SearchMediaArgs,
    execute: async (args, ctx) => {
      const a = SearchMediaArgs.parse(args);
      // getAssets(userId, options) returns { assets, total } — extract both
      const { assets, total } = await mediaLibraryService.getAssets(
        ctx.userId,
        {
          search: a.search,
          type: a.type,
          limit: 20,
        }
      );
      return { assets, total };
    },
  },
  {
    name: 'draft_caption',
    description:
      'Draft a platform caption for a rendered video using cheap-LLM routing. Does NOT publish.',
    schema: DraftCaptionArgs,
    execute: async (args, ctx) => {
      const a = DraftCaptionArgs.parse(args);
      const job = await prisma.videoGeneration.findFirst({
        where: { id: a.jobId, organizationId: ctx.organizationId },
        select: { inputPrompt: true, enhancedPrompt: true, methodCardId: true },
      });
      if (!job) return { caption: null, error: 'job not found' };
      const ai = getAIProvider();
      const res = await ai.complete({
        model: modelForTask('caption-draft'),
        messages: [
          {
            role: 'system',
            content: `Write one ${a.platform} caption for a short video. Match platform norms (hashtags for instagram/tiktok, professional for linkedin). Max 80 words. Australian English. No preamble.`,
          },
          {
            role: 'user',
            content: `Video: ${job.enhancedPrompt ?? job.inputPrompt}`,
          },
        ],
        temperature: 0.7,
        max_tokens: 200,
      });
      return { caption: res.choices[0]?.message?.content?.trim() ?? null };
    },
  },
];

export async function executeStudioTool(
  name: string,
  args: unknown,
  ctx: ToolContext
): Promise<Record<string, unknown>> {
  const tool = STUDIO_TOOLS.find(t => t.name === name);
  if (!tool) throw new Error(`Unknown tool: ${name}`);
  tool.schema.parse(args); // throw zod error before any side effect
  return tool.execute(args, ctx);
}
