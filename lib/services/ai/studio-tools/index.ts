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
import {
  VIRAL_METHOD_CARDS,
  VIRAL_SAFE_ZONE,
} from '@/lib/services/ai/video/cards/viral-method-cards';
import { MODIFIER_CHIPS } from '@/lib/services/ai/video/cards/modifier-chips';
import { getBrandFragment } from '@/lib/services/ai/video/cards/brand-cards';
import { VIDEO_MODELS } from '@/lib/services/ai/video/registry';
import { quotaSnapshot } from '@/lib/services/ai/video/quota';
import { mediaLibraryService } from '@/lib/services/media-library';
import { deriveSocialCut } from '@/lib/video/social-derivation';
import { getAIProvider } from '@/lib/ai/providers';
import { modelForTask } from '@/lib/services/ai/video/llm-routing';
import type { InitiatedBy } from '@/lib/services/ai/video/types';
// generateImage is the real export from lib/services/ai/image-generation.ts
import { generateImage } from '@/lib/services/ai/image-generation';
import {
  SUPPORTED_PLATFORMS,
  type AutonomyLevel,
  type GenerationContext,
  type SupportedPlatform,
} from '@/lib/ai/generation-context';

export interface ToolContext {
  userId: string;
  organizationId: string;
  initiatedBy: InitiatedBy;
  /**
   * SYN-MCP-004-1: tool scopes of the caller's MCP key ('*' = all tools).
   * Pass-through only for now — consumed by SYN-MCP-007's scope-filtered
   * tool registration. Absent for non-MCP callers (REST routes, copilot).
   */
  scopes?: string[];
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
  // Target SOCIAL platform for visual-style trend enrichment (SYN-MCP-003).
  platform: z
    .enum(SUPPORTED_PLATFORMS as [SupportedPlatform, ...SupportedPlatform[]])
    .optional(),
});

/** Map a studio ToolContext onto a GenerationContext (SYN-MCP-003). */
function toGenerationContext(ctx: ToolContext): GenerationContext {
  const autonomyByInitiator: Record<InitiatedBy, AutonomyLevel> = {
    studio: 'manual',
    copilot: 'assisted',
    mcp: 'autonomous',
  };
  return {
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    traceId: crypto.randomUUID(),
    autonomyLevel: autonomyByInitiator[ctx.initiatedBy] ?? 'manual',
  };
}
const SearchMediaArgs = z.object({
  search: z.string().min(1),
  type: z.enum(['image', 'video', 'audio']).optional(),
});
const DraftCaptionArgs = z.object({
  jobId: z.string().min(1),
  platform: z.enum(['instagram', 'tiktok', 'linkedin', 'facebook', 'youtube']),
});
const DeriveCutsArgs = z.object({
  heroAssetId: z.string().min(1),
  cuts: z
    .array(
      z.object({
        platform: z.string().min(1), // canonical Synthex platform id
        target: z.enum(['9:16', '1:1', '16:9']),
        maxSec: z.number().int().min(3).max(120),
        captionPlacement: z.enum(['upper', 'centre', 'cover']),
        caption: z.string().min(1).max(2200),
      })
    )
    .min(1)
    .max(8),
});

export const STUDIO_TOOLS: StudioTool[] = [
  {
    name: 'derive_cuts',
    description:
      'Derive platform-native cuts from a rendered hero video (nexus-viral 1→8). Each cut is a centred crop + tail trim + caption plan landing in video_assets as a pending render; the social-cut-render cron produces the file. Publish stays human-gated — this never posts.',
    schema: DeriveCutsArgs,
    execute: async (args, ctx) => {
      const a = DeriveCutsArgs.parse(args);
      const cuts = [];
      for (const cut of a.cuts) {
        const derived = await deriveSocialCut({
          orgId: ctx.organizationId,
          heroAssetId: a.heroAssetId,
          target: cut.target,
          maxSec: cut.maxSec,
          captionPlacement: cut.captionPlacement,
          caption: cut.caption,
          trimFrom: 'tail',
          keepSubjectCentre: true,
          platform: cut.platform,
        });
        cuts.push({
          platform: cut.platform,
          assetId: derived.assetId,
          subjectLost: derived.subjectLost,
          publishState: 'queued_human_gated',
        });
      }
      return { heroAssetId: a.heroAssetId, cuts };
    },
  },
  {
    name: 'list_cards',
    description:
      'List method cards, viral method cards (nexus-viral shot grammar + 9:16 safe zone), modifier chips, the org brand card, model tiers with costs and capability profiles, and current quota state.',
    schema: z.object({}),
    execute: async (_args, ctx) => ({
      methodCards: METHOD_CARDS,
      viralCards: VIRAL_METHOD_CARDS,
      viralSafeZone: VIRAL_SAFE_ZONE,
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
    execute: async (args, ctx) => {
      const a = GenerateImageArgs.parse(args);
      // SYN-MCP-003: the tool context (org + user + initiator) becomes the
      // mandatory GenerationContext; platform is threaded for trend lookups.
      const result = await generateImage(
        {
          prompt: a.prompt,
          style: a.style,
          aspectRatio: a.aspectRatio,
          platform: a.platform,
        },
        toGenerationContext(ctx)
      );
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
