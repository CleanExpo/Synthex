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
 *   - Every Claim it creates starts unverified: evidenceStatus is DERIVED
 *     via lib/marketing-agency/evidence-policy.ts (SYN-MCP-001) — with no
 *     sourceRef that's 'blocked' for evidence-required claim types, else
 *     'pending_evidence'. Never 'verified'.
 *   - The QaReport it writes starts with status='blocked' until a human
 *     unblocks based on the artifacts.
 *
 * LLM call is wrapped via the `ClaimProposer` interface so unit tests can
 * stub it (see runner.test.ts).
 */
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { deriveEvidenceStatus } from '@/lib/marketing-agency/evidence-policy';
import { listMarketingAgencyOpportunities } from '@/lib/marketing-agency/intelligence/opportunity-reader';
import { openRouterClient } from '@/lib/ai/openrouter-client';
import {
  recordGenerationCost,
  systemGenerationContext,
  type GenerationContext,
} from '@/lib/ai/generation-context';
import { recommendArtlistAudio } from '@/lib/marketing-agency/artlist/recommend';
import { detectAssetNeed } from '@/lib/marketing-agency/artlist/need';
import type { ArtlistAudioRecommendation } from '@/lib/marketing-agency/artlist/types';
import type { ProviderMode } from '@/lib/marketing-agency/types';

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
    /**
     * SYN-MCP-003: actor/tenant context for the LLM call — org-attributed
     * cost-ledger rows. Optional on the interface so existing test stubs
     * stay valid; the default proposer falls back to a system context.
     */
    ctx?: GenerationContext;
  }): Promise<ProposedClaim>;
}

/**
 * Wraps the Artlist recommendation call (SYN-979) so the runner never talks to
 * the Artlist Enterprise API directly. Unit tests stub this; the default
 * implementation delegates to `recommendArtlistAudio`, which stays fully mocked
 * unless the agent is explicitly configured for `providerMode='live'` AND an
 * `ARTLIST_API_KEY` is present in the environment. No secret is ever hardcoded.
 */
export interface AssetLicenser {
  requestAudioLicense(input: {
    mood: string;
    durationSec: number;
    providerMode: ProviderMode;
  }): Promise<ArtlistAudioRecommendation>;
}

export const artlistAssetLicenser: AssetLicenser = {
  async requestAudioLicense({ mood, durationSec, providerMode }) {
    return recommendArtlistAudio({
      providerMode,
      mood,
      durationSec,
      // Live creds are owner-gated; absent in mock mode. Never hardcoded.
      apiKey: process.env.ARTLIST_API_KEY,
    });
  },
};

/** Reads the Artlist provider mode off the agent's JSON config; defaults to mock. */
export function resolveProviderMode(config: unknown): ProviderMode {
  if (config && typeof config === 'object') {
    const raw = (config as Record<string, unknown>).providerMode;
    if (raw === 'live') return 'live';
  }
  return 'mock';
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

    const model = openRouterClient.models.creative;
    const res = await openRouterClient.complete({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 400,
    });

    // SYN-MCP-003: org-attributed cost-ledger row for this LLM call.
    // Provider usage tokens when reported; conservative estimate otherwise.
    // recordGenerationCost never throws — a ledger failure cannot fail a run.
    const ctx = input.ctx ?? systemGenerationContext();
    await recordGenerationCost(ctx, {
      pipelineName: 'marketing-agency-claim',
      model,
      inputTokens: res.usage?.prompt_tokens ?? Math.round(prompt.length / 4),
      outputTokens: res.usage?.completion_tokens ?? 400,
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
        ? obj.warnings.map(w => String(w).slice(0, 200)).slice(0, 10)
        : [],
    };
  },
};

export interface RunAgentInput {
  agentId: string;
  triggeredById: string;
  proposer?: ClaimProposer;
  licenser?: AssetLicenser;
}

export interface RunAgentResult {
  runId: string;
  status: 'completed' | 'failed';
  summary: string;
}

export async function runAgent(input: RunAgentInput): Promise<RunAgentResult> {
  const proposer = input.proposer ?? llmClaimProposer;
  const licenser = input.licenser ?? artlistAssetLicenser;

  const agent = await prisma.marketingAgent.findUnique({
    where: { id: input.agentId },
  });
  if (!agent) throw new Error(`Agent ${input.agentId} not found`);
  if (agent.status !== 'active') {
    throw new Error(
      `Agent ${input.agentId} is not active (status=${agent.status})`
    );
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
      .filter(o => o.approvalStatus !== 'rejected')
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
    const licensedAssets: Array<{
      opportunityId: string;
      assetId: string;
      provider: string;
      assetType: string;
      title: string;
      licenceStatus: string;
    }> = [];

    const providerMode = resolveProviderMode(agent.config);

    // SYN-MCP-003: server-built GenerationContext for every LLM call this
    // run makes — org attribution in the cost ledger, traceId = run id.
    const generationContext: GenerationContext = {
      organizationId: agent.organizationId,
      userId: input.triggeredById,
      taskId: run.id,
      traceId: run.id,
      autonomyLevel: 'autonomous',
    };

    for (const op of eligible) {
      try {
        const proposal = await proposer.propose({
          opportunityTitle: op.title,
          opportunityRecommendation: op.recommendation,
          signalLabel: op.signal.sourceLabel,
          agentGoal: agent.goal,
          ctx: generationContext,
        });

        const claim = await prisma.marketingAgencyClaim.create({
          data: {
            organizationId: agent.organizationId,
            createdById: input.triggeredById,
            campaignId,
            statement: proposal.statement,
            claimType: proposal.claimType,
            // SYN-MCP-001: evidenceStatus is derived-only — no literals.
            // Agent proposals never carry a sourceRef, so this derives
            // 'blocked' (evidence-required types) or 'pending_evidence'.
            evidenceStatus: deriveEvidenceStatus({
              sourceRefId: null,
              claimType: proposal.claimType,
            }),
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

    // Asset auto-licensing (SYN-979): for any opportunity whose creative needs
    // audio/video, request an Artlist licence and persist a pending asset row.
    // Runs in its own per-opportunity try/catch so a licensing failure never
    // blocks claim proposal (and vice-versa).
    for (const op of eligible) {
      const need = detectAssetNeed({
        title: op.title,
        recommendation: op.recommendation,
        nextAction: op.nextAction,
      });
      if (!need.needsAsset) continue;

      try {
        const rec = await licenser.requestAudioLicense({
          mood: need.mood,
          durationSec: need.durationSec,
          providerMode,
        });

        const asset = await prisma.marketingAgencyAsset.create({
          data: {
            organizationId: agent.organizationId,
            createdById: input.triggeredById,
            campaignId,
            provider: rec.provider,
            providerAssetId: rec.id,
            assetType: need.assetType,
            title: rec.title,
            // Ticket contract: assets always land pending human licence confirmation.
            licenceStatus: 'pending',
            licenceUrl: rec.sourceUrl,
            metadata: {
              proposedByAgent: agent.id,
              proposedInRun: run.id,
              opportunityId: op.id,
              detectedNeed: need.assetType,
              matchedKeyword: need.matchedKeyword,
              mood: need.mood,
              durationSec: need.durationSec,
              providerMode,
              artistCredit: rec.artist,
            },
          },
        });

        licensedAssets.push({
          opportunityId: op.id,
          assetId: asset.id,
          provider: rec.provider,
          assetType: need.assetType,
          title: rec.title,
          licenceStatus: 'pending',
        });

        checks.push({
          check: `Asset licence requested for "${op.title.slice(0, 60)}"`,
          status: 'review',
          detail: `Artlist ${need.assetType} asset ${asset.id} created at licenceStatus=pending. Needs human licence confirmation to unblock.`,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.warn('marketing-agent: asset licensing failed', {
          agentId: agent.id,
          opportunityId: op.id,
          providerMode,
          error: message,
        });
        checks.push({
          check: `Asset licence request for "${op.title.slice(0, 60)}"`,
          status: 'blocked',
          detail: `Artlist licence request failed: ${message.slice(0, 200)}`,
        });
      }
    }

    const blockedReasons: string[] = [];
    if (evidenceGaps.length) {
      blockedReasons.push('Awaiting source linkage for proposed claims');
    }
    if (licensedAssets.length) {
      blockedReasons.push(
        'Awaiting Artlist licence confirmation for requested assets'
      );
    }
    if (blockedReasons.length === 0) {
      blockedReasons.push('No new claims proposed this run');
    }

    const qaReport = await prisma.marketingAgencyQaReport.create({
      data: {
        organizationId: agent.organizationId,
        createdById: input.triggeredById,
        campaignId,
        status: 'blocked',
        blockedReasons,
        warnings: proposedClaims.flatMap(c => c.warnings),
        checks,
        metadata: {
          producedByAgent: agent.id,
          producedInRun: run.id,
          assetsRequested: licensedAssets.length,
          assets: licensedAssets,
        },
      },
    });

    const summary = buildSummary({
      considered: opportunities.length,
      proposed: proposedClaims.length,
      gaps: evidenceGaps.length,
      licensed: licensedAssets.length,
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
          assets: licensedAssets,
          opportunityIds: eligible.map(o => o.id),
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
    // The original failure is often DB-related; the status update below may
    // therefore fail too. Wrap separately so we never leave a run row stuck
    // at status='running' and never lose visibility on either failure.
    try {
      await prisma.marketingAgentRun.update({
        where: { id: run.id },
        data: {
          status: 'failed',
          completedAt: new Date(),
          errorMessage: message.slice(0, 500),
        },
      });
    } catch (updateErr) {
      const updateMessage =
        updateErr instanceof Error ? updateErr.message : String(updateErr);
      logger.error(
        'marketing-agent: failed-status update ALSO failed; run row may be stuck at running',
        {
          runId: run.id,
          agentId: agent.id,
          originalError: message,
          updateError: updateMessage,
        }
      );
    }
    return {
      runId: run.id,
      status: 'failed',
      summary: `Run failed: ${message.slice(0, 200)}`,
    };
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
  licensed: number;
}): string {
  if (input.considered === 0) {
    return 'No unblocked opportunities available. Run the Apify intelligence command to populate the ledger.';
  }
  const assetClause =
    input.licensed > 0
      ? ` Requested ${input.licensed} Artlist asset licence${input.licensed === 1 ? '' : 's'} (pending confirmation).`
      : '';
  if (input.proposed === 0) {
    return `Reviewed ${input.considered} opportunities. No claims proposed (all failed or filtered).${assetClause}`;
  }
  return `Reviewed ${input.considered} opportunities, proposed ${input.proposed} claims with ${input.gaps} evidence gaps awaiting source linkage.${assetClause}`;
}
