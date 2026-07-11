/**
 * Studio tool layer — the SINGLE typed contract for everything the studio can
 * do. REST routes, the MCP server, and the in-app copilot are thin wrappers
 * over these. NO publish/schedule tools in phase 1 (spec: agents generate and
 * draft; pushing to the publish queue stays human).
 *
 * SYN-MCP-007 (SYN-1084): the contract gained {scope, riskClass, costClass,
 * outputSchema?} (see ./types.ts). STUDIO_TOOLS remains the creative_* 8
 * (names unchanged — byte-identical for legacy wildcard callers); the new
 * approvals_* + context_* + performance_* namespaces live in sibling modules
 * and are aggregated into ALL_MCP_TOOLS.
 *
 * SYN-MCP-007b: the two deferred namespaces landed — tasks_* (org-pinned
 * BullMQ reads + Linear-gated enqueue; INTERNAL-Unite-Group scope only) and
 * research_* (retriever-registry search/fetch + pure evidence-bundle read).
 */
import { z } from 'zod';
import prisma from '@/lib/prisma';
import type { StudioTool, ToolContext } from './types';
import { APPROVALS_TOOLS } from './approvals-tools';
import { CONTEXT_TOOLS } from './context-tools';
import { PERFORMANCE_TOOLS } from './performance-tools';
import { TASKS_TOOLS } from './tasks-tools';
import { RESEARCH_TOOLS } from './research-tools';
import { MEDIA_TOOLS } from './media-tools';
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
  generateSiteForOrg,
  GbpConnectionMissingError,
} from '@/lib/ai-websites/generate-for-org';
import {
  SUPPORTED_PLATFORMS,
  type AutonomyLevel,
  type GenerationContext,
  type SupportedPlatform,
} from '@/lib/ai/generation-context';

// Contract types moved to ./types.ts (SYN-MCP-007) — re-exported here so
// existing `from '@/lib/services/ai/studio-tools'` imports keep working.
export type {
  StudioTool,
  ToolContext,
  ToolScope,
  RiskClass,
  CostClass,
} from './types';

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
  referenceSet: z.string().min(1).optional(),
  useReferences: z.boolean().optional(),
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
  referenceSet: z.string().min(1).optional(),
  useReferences: z.boolean().optional(),
  model: z.string().min(1).optional(),
  loraId: z.string().min(1).optional(),
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
const GenerateSiteFromGbpArgs = z.object({
  locationId: z.string().min(1),
  serviceSlug: z.string().min(1).optional(),
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
        // Optional grilled YouTube search package. Only honoured for the
        // YouTube cut (deriveSocialCut persists it as metadata.youtube in the
        // dispatch resolver's shape). Callers do not send this yet — the
        // nexus-viral copy stage produces only captions today (SYN-1094
        // follow-up: full title/description/tags from nexus-copywriter).
        youtube: z
          .object({
            title: z.string().min(1).max(100).optional(),
            description: z.string().max(5000).optional(),
            tags: z.array(z.string().min(1).max(100)).max(50).optional(),
          })
          .optional(),
      })
    )
    .min(1)
    .max(8),
});

/**
 * The creative_* namespace — the original phase-1 tool set. Names are
 * byte-identical to phase 1 (legacy wildcard callers see no change).
 * outputSchema is deliberately NOT declared on these yet: their returns
 * embed Date instances and provider/registry passthroughs, and SDK 1.29.0
 * throws at call time on any structuredContent mismatch (spike 2026-07-10).
 * Schemas land per-tool once returns are normalised, each behind a
 * contract test — never blanket-added.
 */
export const STUDIO_TOOLS: StudioTool[] = [
  {
    name: 'derive_cuts',
    scope: 'creative',
    riskClass: 'draft',
    costClass: 'metered',
    description:
      'Derive platform-native cuts from a rendered hero video (nexus-viral 1→8). Each cut is a centred crop + tail trim + caption plan landing in video_assets as a pending render; the social-cut-render cron produces the file. Publish stays human-gated — this never posts.',
    schema: DeriveCutsArgs,
    // Gate B enforcement is inherited for free: deriveSocialCut() now calls
    // assertGatePassed(heroAssetId, 'broadcast') fail-closed before it writes
    // any row (SYN-1094, lib/video/social-derivation.ts), so this tool blocks
    // unless a passing broadcast verdict exists for the hero. No separate call
    // needed here.
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
          youtube: cut.youtube,
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
    scope: 'creative',
    riskClass: 'read',
    costClass: 'free',
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
    scope: 'creative',
    riskClass: 'draft',
    costClass: 'expensive',
    description:
      'Submit a generative video job (async — returns job ids immediately; poll get_job). Defaults: draft tier, 9:16, 6s, 1 variant. Premium tier must be explicit. Response includes budgetWarning when the org is at 80%+ of a cap — self-throttle when true. Pass referenceSet (or useReferences:true) to seed the clip from an owned reference photo (real equipment) instead of a synthetic first frame.',
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
    scope: 'creative',
    riskClass: 'draft',
    costClass: 'metered',
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
          referenceSet: a.referenceSet,
          useReferences: a.useReferences,
          model: a.model,
          loraId: a.loraId,
        },
        toGenerationContext(ctx)
      );
      return { result };
    },
  },
  {
    name: 'get_job',
    scope: 'creative',
    riskClass: 'read',
    costClass: 'free',
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
    scope: 'creative',
    riskClass: 'read',
    costClass: 'free',
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
    scope: 'creative',
    riskClass: 'read',
    costClass: 'free',
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
    name: 'list_reference_sets',
    scope: 'creative',
    riskClass: 'read',
    costClass: 'free',
    description:
      'List the owned reference-image sets (industry, subjects, counts) available to ground image generation. Use to discover a referenceSet id for generate_image.',
    schema: z.object({}),
    execute: async () => {
      const { listReferenceSets } =
        await import('@/lib/services/ai/reference-library');
      return { sets: listReferenceSets() };
    },
  },
  {
    name: 'draft_caption',
    scope: 'creative',
    riskClass: 'draft',
    costClass: 'metered',
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
  {
    name: 'generate_site_from_gbp',
    description:
      'Generate an on-brand, schema-marked website section from a connected Google Business Profile location. Fetches the listing, fills FAQ/service gaps from an industry starter, and writes validator-gated copy (Aid Rule, ACL §18, brand voice). Returns html + JSON-LD + validations. Does NOT deploy.',
    scope: 'creative',
    riskClass: 'draft',
    costClass: 'metered',
    schema: GenerateSiteFromGbpArgs,
    execute: async (args, ctx) => {
      const a = GenerateSiteFromGbpArgs.parse(args);
      try {
        const { profile, result } = await generateSiteForOrg(
          ctx.organizationId,
          a
        );
        return {
          ok: result.ok,
          slug: result.slug,
          canonicalUrl: result.canonicalUrl,
          html: result.html,
          jsonLd: result.jsonLd,
          copy: result.copy,
          validations: result.validations,
          profile: {
            name: profile.name,
            servicesCount: profile.services.length,
            hasReviews: Boolean(profile.reviews?.length),
          },
        };
      } catch (err) {
        if (err instanceof GbpConnectionMissingError) {
          return { ok: false, error: err.message };
        }
        throw err;
      }
    },
  },
];

/**
 * Registry-level invariant (SYN-1084): v1 registers ZERO publish/spend
 * riskClass tools, no approvals_decide, and no *_publish/*_spend names —
 * machine-enforced here at module load AND by
 * tests/unit/mcp/namespace-tools.test.ts. Capability tokens (post-004-2)
 * are the earliest anything above draft may appear.
 */
function assertV1RiskInvariant(tools: StudioTool[]): StudioTool[] {
  for (const t of tools) {
    if (t.riskClass === 'publish' || t.riskClass === 'spend') {
      throw new Error(
        `MCP v1 invariant violated: tool "${t.name}" carries riskClass "${t.riskClass}" (only read/draft may register)`
      );
    }
    if (/^approvals_decide$|_publish$|_spend$/.test(t.name)) {
      throw new Error(
        `MCP v1 invariant violated: tool name "${t.name}" is reserved-absent in v1`
      );
    }
  }
  return tools;
}

/**
 * Every tool the MCP server can expose — creative_* (the original 8, names
 * unchanged) + the SYN-MCP-007 read/draft namespaces + the SYN-MCP-007b
 * tasks_* and research_* namespaces + the media_* tools (creative-scope thin
 * clients over the Railway media-worker). The load-time risk guard covers all.
 */
export const ALL_MCP_TOOLS: StudioTool[] = assertV1RiskInvariant([
  ...STUDIO_TOOLS,
  ...APPROVALS_TOOLS,
  ...CONTEXT_TOOLS,
  ...PERFORMANCE_TOOLS,
  ...TASKS_TOOLS,
  ...RESEARCH_TOOLS,
  ...MEDIA_TOOLS,
]);

/**
 * Covered-by semantics (SYN-1084, exact):
 *   - '*' ∈ scopes            → every tool is covered (legacy/wildcard keys).
 *   - otherwise               → covered iff tool.scope ∈ scopes.
 *   - scopes empty or absent  → NOTHING is covered. DB keys default to
 *     scopes [] (McpApiKey), so an unscoped key sees an EMPTY tools/list —
 *     deny-by-default, never all-tools.
 */
export function isScopeCovered(
  scope: string,
  scopes: string[] | undefined
): boolean {
  if (!scopes || scopes.length === 0) return false;
  if (scopes.includes('*')) return true;
  return scopes.includes(scope);
}

/** The subset of ALL_MCP_TOOLS a caller with these scopes may see/call. */
export function toolsForScopes(scopes: string[] | undefined): StudioTool[] {
  return ALL_MCP_TOOLS.filter(t => isScopeCovered(t.scope, scopes));
}

export async function executeStudioTool(
  name: string,
  args: unknown,
  ctx: ToolContext
): Promise<Record<string, unknown>> {
  const tool = ALL_MCP_TOOLS.find(t => t.name === name);
  if (!tool) throw new Error(`Unknown tool: ${name}`);
  // Defence in depth: an MCP caller (ctx.scopes present) can never execute a
  // tool outside its scopes, even if registration filtering is bypassed.
  // Non-MCP callers (REST routes, copilot) carry no scopes field and are
  // unaffected.
  if (ctx.scopes !== undefined && !isScopeCovered(tool.scope, ctx.scopes)) {
    throw new Error(`Tool not permitted for caller scopes: ${name}`);
  }
  tool.schema.parse(args); // throw zod error before any side effect
  return tool.execute(args, ctx);
}
