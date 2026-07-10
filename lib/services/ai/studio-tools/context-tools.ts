/**
 * context_* namespace — READ-ONLY tools over the org's brand/client context:
 * BrandDNA + BrandOperatingSystem, ClientProfile, and the 3-layer prompt
 * builder (lib/ai/prompt-layer-builder.ts). All queries org-scoped via
 * ToolContext.organizationId (all three models are organizationId @unique).
 */
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { buildLayeredPrompt } from '@/lib/ai/prompt-layer-builder';
import type { StudioTool } from './types';

const NoArgs = z.object({});

const PreviewPromptArgs = z.object({
  taskType: z.string().min(1).max(100),
});

const GetBrandOutput = z.object({
  brandDna: z
    .object({
      businessName: z.string(),
      vertical: z.string(),
      industry: z.string(),
      logoUrl: z.string().nullable(),
      primaryColour: z.string().nullable(),
      secondaryColour: z.string().nullable(),
      brandVoice: z.unknown(),
      persona: z.unknown(),
      offerings: z.unknown(),
      seoScore: z.number().nullable(),
      sourceUrl: z.string(),
      lastRefreshedAt: z.string(),
    })
    .nullable(),
  brandOs: z
    .object({
      method: z.string(),
      qualityThreshold: z.number().nullable(),
      version: z.number(),
      systemPromptOverride: z.string().nullable(),
      rules: z.unknown(),
      outputStructure: z.unknown(),
    })
    .nullable(),
});

const GetClientProfileOutput = z.object({
  profile: z
    .object({
      budgetTier: z.string().nullable(),
      intakeStatus: z.string(),
      intakeSource: z.string().nullable(),
      intakeCompletedAt: z.string().nullable(),
      icp: z.unknown(),
      offers: z.unknown(),
      proofPoints: z.unknown(),
      competitors: z.unknown(),
      toneKeywords: z.unknown(),
      antiPatterns: z.unknown(),
      vocabularyBank: z.unknown(),
      goals: z.unknown(),
      channels: z.unknown(),
      constraints: z.unknown(),
      updatedAt: z.string(),
    })
    .nullable(),
});

const PreviewPromptOutput = z.object({
  systemPrompt: z.string().nullable(),
  core: z.string().nullable(),
  client: z.string().nullable(),
  clientSource: z
    .enum(['client-profile', 'brand-dna', 'org-context'])
    .nullable(),
  task: z.string(),
});

export const CONTEXT_TOOLS: StudioTool[] = [
  {
    name: 'context_get_brand',
    description:
      "Fetch the caller org's brand context: BrandDNA (identity, voice, persona, offerings) and BrandOperatingSystem (method, rules, prompt override). Either half is null when the org has not set it up.",
    scope: 'context',
    riskClass: 'read',
    costClass: 'free',
    schema: NoArgs,
    outputSchema: GetBrandOutput,
    execute: async (_args, ctx) => {
      const [dna, bos] = await Promise.all([
        prisma.brandDNA.findUnique({
          where: { organizationId: ctx.organizationId },
          select: {
            businessName: true,
            vertical: true,
            industry: true,
            logoUrl: true,
            primaryColour: true,
            secondaryColour: true,
            brandVoice: true,
            persona: true,
            offerings: true,
            seoScore: true,
            sourceUrl: true,
            lastRefreshedAt: true,
          },
        }),
        prisma.brandOperatingSystem.findUnique({
          where: { organizationId: ctx.organizationId },
          select: {
            method: true,
            qualityThreshold: true,
            version: true,
            systemPromptOverride: true,
            rules: true,
            outputStructure: true,
          },
        }),
      ]);
      return {
        brandDna: dna
          ? { ...dna, lastRefreshedAt: dna.lastRefreshedAt.toISOString() }
          : null,
        brandOs: bos ?? null,
      };
    },
  },
  {
    name: 'context_get_client_profile',
    description:
      "Fetch the caller org's ClientProfile (ICP, offers, proof points, tone keywords, anti-patterns, vocabulary bank, goals, channels, constraints). profile is null when the org has no intake yet.",
    scope: 'context',
    riskClass: 'read',
    costClass: 'free',
    schema: NoArgs,
    outputSchema: GetClientProfileOutput,
    execute: async (_args, ctx) => {
      const p = await prisma.clientProfile.findUnique({
        where: { organizationId: ctx.organizationId },
        select: {
          budgetTier: true,
          intakeStatus: true,
          intakeSource: true,
          intakeCompletedAt: true,
          icp: true,
          offers: true,
          proofPoints: true,
          competitors: true,
          toneKeywords: true,
          antiPatterns: true,
          vocabularyBank: true,
          goals: true,
          channels: true,
          constraints: true,
          updatedAt: true,
        },
      });
      if (!p) return { profile: null };
      return {
        profile: {
          ...p,
          intakeCompletedAt: p.intakeCompletedAt
            ? p.intakeCompletedAt.toISOString()
            : null,
          updatedAt: p.updatedAt.toISOString(),
        },
      };
    },
  },
  {
    name: 'context_preview_layered_prompt',
    description:
      'Preview the 3-layer system prompt (Core = BrandOperatingSystem, Client = ClientProfile → BrandDNA → OrgContext, Task = your taskType passthrough) the org would get for a task type. systemPrompt is null when the org has no Core/ClientProfile artifact — callers then use their own default. Read-only: builds the prompt, runs nothing.',
    scope: 'context',
    riskClass: 'read',
    costClass: 'free',
    schema: PreviewPromptArgs,
    outputSchema: PreviewPromptOutput,
    execute: async (args, ctx) => {
      const a = PreviewPromptArgs.parse(args);
      const prompt = await buildLayeredPrompt(ctx.organizationId, a.taskType);
      return {
        systemPrompt: prompt.systemPrompt,
        core: prompt.core,
        client: prompt.client,
        clientSource: prompt.clientSource,
        task: prompt.task,
      };
    },
  },
];
