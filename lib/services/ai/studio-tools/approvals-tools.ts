/**
 * approvals_* namespace — READ-ONLY tools over MarketingAgencyClaim,
 * including the SYN-MCP-001 approvalStatus/evidenceStatus split.
 * approvals_list_pending also surfaces the other human gates: Studio drafts
 * awaiting approval and publish-queue rows parked as queued_human_gated
 * (seam audit 06 §B8). Listing them is read-only; approving or releasing stays
 * a human-UI act.
 *
 * approvals_decide is DELIBERATELY ABSENT: approving/rejecting a claim stays
 * a human-UI act (SYN-1084). Do not add a decide/approve/reject tool here —
 * its absence is machine-enforced by tests/unit/mcp/namespace-tools.test.ts.
 */
import { z } from 'zod';
import prisma from '@/lib/prisma';
import type { StudioTool } from './types';

const ListPendingArgs = z.object({
  campaignId: z.string().optional(),
  limit: z.number().int().min(1).max(100).optional(),
});

const GetClaimArgs = z.object({ id: z.string().min(1) });

const ClaimSummary = z.object({
  id: z.string(),
  campaignId: z.string(),
  statement: z.string(),
  claimType: z.string(),
  approvalStatus: z.string(),
  evidenceStatus: z.string(),
  createdAt: z.string(),
});

const DraftSummary = z.object({
  id: z.string(),
  clientSlug: z.string(),
  topic: z.string(),
  status: z.string(),
  videoUrl: z.string().nullable(),
  createdAt: z.string(),
});

const QueueItemSummary = z.object({
  id: z.string(),
  slotId: z.string(),
  platform: z.string(),
  status: z.string(),
  scheduledAt: z.string(),
  createdAt: z.string(),
});

const ListPendingOutput = z.object({
  claims: z.array(ClaimSummary),
  /** Number of claims (unchanged meaning; drafts/queueItems carry their own length). */
  total: z.number(),
  drafts: z.array(DraftSummary),
  queueItems: z.array(QueueItemSummary),
});

const GetClaimOutput = z.object({
  claim: ClaimSummary.extend({
    sourceRefId: z.string().nullable(),
    evidenceNotes: z.string().nullable(),
    approvedById: z.string().nullable(),
    approvedAt: z.string().nullable(),
    updatedAt: z.string(),
  }).nullable(),
});

export const APPROVALS_TOOLS: StudioTool[] = [
  {
    name: 'approvals_list_pending',
    description:
      'List everything awaiting a human decision for the caller org, newest first: marketing-agency claims (approvalStatus=pending; total = claim count), Studio content drafts (status=awaiting_approval) and publish-queue rows held for release (status=queued_human_gated, e.g. derived social cuts). Read-only: deciding approvals is a human-UI act — there is deliberately NO approvals_decide tool.',
    scope: 'approvals',
    riskClass: 'read',
    costClass: 'free',
    schema: ListPendingArgs,
    outputSchema: ListPendingOutput,
    execute: async (args, ctx) => {
      const a = ListPendingArgs.parse(args);
      const take = a.limit ?? 20;
      const [rows, drafts, queueItems] = await Promise.all([
        prisma.marketingAgencyClaim.findMany({
          where: {
            organizationId: ctx.organizationId,
            approvalStatus: 'pending',
            ...(a.campaignId ? { campaignId: a.campaignId } : {}),
          },
          orderBy: { createdAt: 'desc' },
          take,
          select: {
            id: true,
            campaignId: true,
            statement: true,
            claimType: true,
            approvalStatus: true,
            evidenceStatus: true,
            createdAt: true,
          },
        }),
        prisma.studioContentDraft.findMany({
          where: {
            organizationId: ctx.organizationId,
            status: 'awaiting_approval',
          },
          orderBy: { createdAt: 'desc' },
          take,
          select: {
            id: true,
            clientSlug: true,
            topic: true,
            status: true,
            videoUrl: true,
            createdAt: true,
          },
        }),
        prisma.publishQueueItem.findMany({
          where: {
            organizationId: ctx.organizationId,
            status: 'queued_human_gated',
          },
          orderBy: { createdAt: 'desc' },
          take,
          select: {
            id: true,
            slotId: true,
            platform: true,
            status: true,
            scheduledAt: true,
            createdAt: true,
          },
        }),
      ]);
      return {
        claims: rows.map(r => ({
          ...r,
          createdAt: r.createdAt.toISOString(),
        })),
        total: rows.length,
        drafts: drafts.map(d => ({
          ...d,
          createdAt: d.createdAt.toISOString(),
        })),
        queueItems: queueItems.map(q => ({
          ...q,
          scheduledAt: q.scheduledAt.toISOString(),
          createdAt: q.createdAt.toISOString(),
        })),
      };
    },
  },
  {
    name: 'approvals_get',
    description:
      'Fetch one marketing-agency claim by id — both axes surfaced: approvalStatus (human approval) and evidenceStatus (derived evidence verification). Org-scoped; a wrong-org id returns claim: null.',
    scope: 'approvals',
    riskClass: 'read',
    costClass: 'free',
    schema: GetClaimArgs,
    outputSchema: GetClaimOutput,
    execute: async (args, ctx) => {
      const a = GetClaimArgs.parse(args);
      const r = await prisma.marketingAgencyClaim.findFirst({
        where: { id: a.id, organizationId: ctx.organizationId },
        select: {
          id: true,
          campaignId: true,
          sourceRefId: true,
          statement: true,
          claimType: true,
          approvalStatus: true,
          evidenceStatus: true,
          evidenceNotes: true,
          approvedById: true,
          approvedAt: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      if (!r) return { claim: null };
      return {
        claim: {
          ...r,
          approvedAt: r.approvedAt ? r.approvedAt.toISOString() : null,
          createdAt: r.createdAt.toISOString(),
          updatedAt: r.updatedAt.toISOString(),
        },
      };
    },
  },
];
