/**
 * Marketing Agency — Agent Runner.
 *
 * Drives the existing Marketing Agency governance substrate between gates.
 * Reads top-N unblocked opportunities for an Organization, LLM-proposes
 * a single Claim per opportunity, persists each claim (blocked-by-default,
 * pending source linkage by a human), then writes a MarketingAgencyQaReport
 * summarising what's ready vs. what's blocked.
 *
 * Hard rules (mirrored in AGENT_SPEC.md §4):
 *   - Never publishes anything.
 *   - Never approves any gate.
 *   - Every Claim it creates starts with evidenceStatus='blocked'.
 *   - The QaReport it writes starts with status='blocked' until a human
 *     unblocks based on the artifacts.
 *
 * LLM call is wrapped via the `ClaimProposer` interface so unit tests can
 * stub it (see runner.test.ts).
 */
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { listMarketingAgencyOpportunities } from '@/lib/marketing-agency/intelligence/opportunity-reader';
import { openRouterClient } from '@/lib/ai/openrouter-client';

export type ProposedClaim = {
  statement: string;
  claimType: string;
  evidenceNotes: string;
  warnings: string[];
};

export interface ClaimProposer {
  propose(input: {
    opportunityTitle: string;
    opportunityRecommendation: string;
    signalLabel: string;
    agentGoal: string;
  }): Promise<ProposedClaim>;
}

export const llmClaimProposer: ClaimProposer = {
  async propose(input) {
    const prompt = `You are a marketing-agency analyst proposing a single, source-checkable claim derived from an opportunity signal.

Agent goal: ${input.agentGoal}
Opportunity title: ${input.opportunityTitle}
Opportunity recommendation: ${input.opportunityRecommendation}
Signal source: ${input.signalLabel}

Return strict JSON with these keys ONLY:
- "statement": a single sentence stating the claim
- "claimType": one of "statistic" | "quote" | "case-study" | "observation" | "comparison"
- "evidenceNotes": one sentence describing what document/source would prove or disprove it
- "warnings": array of strings (empty if none) flagging risks (over-claim, missing baseline, etc.)

Do not include markdown. Do not include any text outside the JSON object.`;

    const res = await openRouterClient.complete({
      model: openRouterClient.models.creative,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 400,
    });

    const text = res.choices?.[0]?.message?.content ?? '';
    const trimmed = text.trim();
    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      const match = trimmed.match(/\{[\s\S]*\}/);
      if (!match) throw new Error('LLM did not return JSON');
      parsed = JSON.parse(match[0]);
    }
    const obj = parsed as Partial<ProposedClaim>;
    return {
      statement: String(obj.statement ?? '').slice(0, 1000),
      claimType: (obj.claimType ?? 'observation').toString(),
      evidenceNotes: String(obj.evidenceNotes ?? '').slice(0, 500),
      warnings: Array.isArray(obj.warnings)
        ? obj.warnings.map((w) => String(w).slice(0, 200)).slice(0, 10)
        : [],
    };
  },
};

export interface RunAgentInput {
  agentId: string;
  triggeredById: string;
  proposer?: ClaimProposer;
}

export interface RunAgentResult {
  runId: string;
  status: 'completed' | 'failed';
  summary: string;
}

export async function runAgent(input: RunAgentInput): Promise<RunAgentResult> {
  const proposer = input.proposer ?? llmClaimProposer;

  const agent = await prisma.marketingAgent.findUnique({
    where: { id: input.agentId },
  });
  if (!agent) throw new Error(`Agent ${input.agentId} not found`);
  if (agent.status !== 'active') {
    throw new Error(`Agent ${input.agentId} is not active (status=${agent.status})`);
  }

  const run = await prisma.marketingAgentRun.create({
    data: {
      agentId: agent.id,
      organizationId: agent.organizationId,
      triggeredById: input.triggeredById,
      status: 'running',
    },
  });

  try {
    const opportunities = await listMarketingAgencyOpportunities({
      organizationId: agent.organizationId,
      limit: Math.min(agent.maxClaimsPerRun * 2, 25),
    });

    // Only act on opportunities that aren't outright rejected.
    const eligible = opportunities
      .filter((o) => o.approvalStatus !== 'rejected')
      .slice(0, agent.maxClaimsPerRun);

    const campaignId = await ensureCampaignForAgent({
      organizationId: agent.organizationId,
      createdById: input.triggeredById,
      agentName: agent.name,
    });

    const checks: Array<{
      check: string;
      status: 'pass' | 'review' | 'blocked';
      detail: string;
    }> = [];
    const proposedClaims: Array<{
      opportunityId: string;
      claimId: string;
      statement: string;
      warnings: string[];
    }> = [];
    const evidenceGaps: string[] = [];

    for (const op of eligible) {
      try {
        const proposal = await proposer.propose({
          opportunityTitle: op.title,
          opportunityRecommendation: op.recommendation,
          signalLabel: op.signal.sourceLabel,
          agentGoal: agent.goal,
        });

        const claim = await prisma.marketingAgencyClaim.create({
          data: {
            organizationId: agent.organizationId,
            createdById: input.triggeredById,
            campaignId,
            statement: proposal.statement,
            claimType: proposal.claimType,
            evidenceStatus: 'blocked',
            evidenceNotes: proposal.evidenceNotes,
            metadata: {
              proposedByAgent: agent.id,
              proposedInRun: run.id,
              opportunityId: op.id,
              warnings: proposal.warnings,
            },
          },
        });

        proposedClaims.push({
          opportunityId: op.id,
          claimId: claim.id,
          statement: proposal.statement,
          warnings: proposal.warnings,
        });

        const evidenceGap = `${op.title}: ${proposal.evidenceNotes}`;
        evidenceGaps.push(evidenceGap);

        checks.push({
          check: `Claim proposed for "${op.title.slice(0, 60)}"`,
          status: 'review',
          detail: `Claim ${claim.id} created. Needs source linkage to unblock.`,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.warn('marketing-agent: claim proposal failed', {
          agentId: agent.id,
          opportunityId: op.id,
          error: message,
        });
        checks.push({
          check: `Claim proposal for "${op.title.slice(0, 60)}"`,
          status: 'blocked',
          detail: `LLM proposal failed: ${message.slice(0, 200)}`,
        });
      }
    }

    const qaReport = await prisma.marketingAgencyQaReport.create({
      data: {
        organizationId: agent.organizationId,
        createdById: input.triggeredById,
        campaignId,
        status: 'blocked',
        blockedReasons: evidenceGaps.length
          ? ['Awaiting source linkage for proposed claims']
          : ['No new claims proposed this run'],
        warnings: proposedClaims.flatMap((c) => c.warnings),
        checks,
        metadata: {
          producedByAgent: agent.id,
          producedInRun: run.id,
        },
      },
    });

    const summary = buildSummary({
      considered: opportunities.length,
      proposed: proposedClaims.length,
      gaps: evidenceGaps.length,
    });

    const completed = await prisma.marketingAgentRun.update({
      where: { id: run.id },
      data: {
        status: 'completed',
        completedAt: new Date(),
        opportunitiesConsidered: opportunities.length,
        claimsProposed: proposedClaims.length,
        evidenceGapsFlagged: evidenceGaps.length,
        qaReportId: qaReport.id,
        summary,
        artifacts: {
          claims: proposedClaims,
          gaps: evidenceGaps,
          opportunityIds: eligible.map((o) => o.id),
          campaignId,
        },
      },
    });

    await prisma.marketingAgent.update({
      where: { id: agent.id },
      data: { lastRunAt: new Date() },
    });

    return { runId: completed.id, status: 'completed', summary };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('marketing-agent: run failed', {
      runId: run.id,
      agentId: agent.id,
      error: message,
    });
    await prisma.marketingAgentRun.update({
      where: { id: run.id },
      data: {
        status: 'failed',
        completedAt: new Date(),
        errorMessage: message.slice(0, 500),
      },
    });
    return { runId: run.id, status: 'failed', summary: `Run failed: ${message.slice(0, 200)}` };
  }
}

async function ensureCampaignForAgent(input: {
  organizationId: string;
  createdById: string;
  agentName: string;
}): Promise<string> {
  const today = new Date().toISOString().slice(0, 10);
  const slug = `agent-${input.agentName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)}-${today}`;

  const existing = await prisma.marketingAgencyCampaign.findFirst({
    where: { organizationId: input.organizationId, slug },
  });
  if (existing) return existing.id;

  const created = await prisma.marketingAgencyCampaign.create({
    data: {
      organizationId: input.organizationId,
      createdById: input.createdById,
      name: `Agent: ${input.agentName} ${today}`,
      slug,
      status: 'draft',
      providerMode: 'mock',
      productName: input.agentName,
      primaryOffer: 'Agent-proposed claims for review',
      metadata: { generatedByAgent: true },
    },
  });
  return created.id;
}

function buildSummary(input: {
  considered: number;
  proposed: number;
  gaps: number;
}): string {
  if (input.considered === 0) {
    return 'No unblocked opportunities available. Run the Apify intelligence command to populate the ledger.';
  }
  if (input.proposed === 0) {
    return `Reviewed ${input.considered} opportunities. No claims proposed (all failed or filtered).`;
  }
  return `Reviewed ${input.considered} opportunities, proposed ${input.proposed} claims with ${input.gaps} evidence gaps awaiting source linkage.`;
}
