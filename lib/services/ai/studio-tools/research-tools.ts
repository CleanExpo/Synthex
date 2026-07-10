/**
 * research_* namespace — SYN-MCP-007b (SYN-1084 tail).
 *
 * READ-ONLY tools over the SYN-MCP-006 evidence pipeline:
 *   - research_search / research_fetch go through the EvidenceRetriever
 *     registry (lib/evidence/retriever.ts), respecting available() — a
 *     provider without its env key never runs. They PERSIST NOTHING (bench
 *     must_fix `no-retrieval-persistence`): SourceRef/ClaimEvidenceScore
 *     writes belong exclusively to the verify-claim job
 *     (lib/evidence/verify-claim-job.ts). Zero providers configured → an
 *     honest empty result { sources: [], retrieversAvailable: [] }.
 *   - research_get_evidence_bundle materializes the EvidenceBundle for one
 *     claim from persisted ClaimEvidenceScore rows via rehydrateScoredSources
 *     + the PURE evaluateEvidencePolicy (bench must_fix
 *     `bundle-read-no-write`): it NEVER calls evaluateAndApplyEvidencePolicy
 *     or applyEvidenceVerdict (those write evidenceStatus) and appends no
 *     reviewLog entry. Both the fresh verdict and the persisted
 *     claim.evidenceStatus are returned so drift is visible.
 *
 * SSRF: enforced ADAPTER-SIDE — every registry adapter calls
 * validateExternalUrl() at the top of fetch() (verified, not rebuilt here);
 * a rejected URL surfaces as this tool's explicit error field.
 *
 * verify-claim ENQUEUE is deliberately NOT exposed here — claims verification
 * stays on its dedicated authed route.
 */
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { getAvailableRetrievers } from '@/lib/evidence/retriever';
import {
  DEFAULT_EVIDENCE_POLICY,
  evaluateEvidencePolicy,
} from '@/lib/evidence/policy';
import {
  rehydrateScoredSources,
  type ScoreRowWithSourceRef,
} from '@/lib/marketing-agency/evidence-policy';
import type { SourceEvidence } from '@/lib/evidence/types';
import type { StudioTool } from './types';

// ─── Args + output schemas (structuredContent contract — ISO strings only) ───

const SearchArgs = z.object({
  query: z.string().min(2).max(500),
  /** Per-retriever result cap (adapters clamp to their own provider limits). */
  limit: z.number().int().min(1).max(10).optional(),
});

const FetchArgs = z.object({ url: z.string().url() });

const BundleArgs = z.object({ claimId: z.string().min(1) });

/** Normalized SourceEvidence summary (lib/evidence/types.ts). provider stays
 * a plain string: persisted provider columns are free-form. */
const SourceEvidenceOut = z.object({
  url: z.string(),
  title: z.string(),
  publishedAt: z.string().nullable(),
  retrievedAt: z.string(),
  provider: z.string(),
  contentHash: z.string(),
  excerpt: z.string(),
  fullTextRef: z.string().optional(),
  domain: z.string(),
});

const SearchOutput = z.object({
  query: z.string(),
  sources: z.array(SourceEvidenceOut),
  retrieversAvailable: z.array(z.string()),
  retrieversUsed: z.array(z.string()),
  /** Per-retriever failures, honestly surfaced (a partial result is a result). */
  errors: z.array(z.string()),
});

const FetchOutput = z.object({
  url: z.string(),
  source: SourceEvidenceOut.nullable(),
  provider: z.string().nullable(),
  retrieversAvailable: z.array(z.string()),
  error: z.string().nullable(),
});

const ScoredSourceOut = SourceEvidenceOut.extend({
  stance: z.string(),
  confidence: z.number(),
  scorer: z.string(),
  rationale: z.string().optional(),
});

const BundleOutput = z.object({
  claimId: z.string(),
  /** Fresh (recomputed, NOT persisted) bundle — null when the claim is not
   * found in the caller org. */
  bundle: z
    .object({
      claimId: z.string(),
      sources: z.array(ScoredSourceOut),
      aggregate: z.object({
        verdict: z.enum([
          'verified',
          'refuted',
          'insufficient',
          'not_required',
        ]),
        policyId: z.string(),
        scoredAt: z.string(),
        sourceAgeBasis: z.array(
          z.object({
            url: z.string(),
            basis: z.enum(['published', 'retrieved']),
          })
        ),
        retrieversAvailable: z.array(z.string()),
        retrieversUsed: z.array(z.string()),
        reasons: z.array(z.string()),
      }),
    })
    .nullable(),
  /** The claim's PERSISTED evidenceStatus — compare with freshEvidenceStatus
   * to see drift between the stored verdict and a fresh policy run. */
  persistedEvidenceStatus: z.string().nullable(),
  /** What the fresh verdict WOULD map to (null = policy requires no change).
   * Informational only — this tool never writes it. */
  freshEvidenceStatus: z.string().nullable(),
  scoreRowCount: z.number(),
});

function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

// ─── Tools ───────────────────────────────────────────────────────────────────

export const RESEARCH_TOOLS: StudioTool[] = [
  {
    name: 'research_search',
    description:
      'Search the web via the evidence retriever registry (Firecrawl/Apify/Exa — only providers whose API key is configured run) and return normalized SourceEvidence summaries, deduped by URL. Persists NOTHING — evidence persistence belongs to the verify-claim pipeline. Zero providers configured → an honest empty result. Metered: each call spends provider quota.',
    scope: 'research',
    riskClass: 'read',
    costClass: 'metered',
    schema: SearchArgs,
    outputSchema: SearchOutput,
    execute: async (args, _ctx) => {
      const a = SearchArgs.parse(args);
      const available = getAvailableRetrievers();
      const retrieversAvailable = available.map(r => r.id as string);
      const collected: SourceEvidence[] = [];
      const retrieversUsed: string[] = [];
      const errors: string[] = [];
      for (const retriever of available) {
        if (!retriever.capabilities.canSearch) continue;
        try {
          const results = await retriever.search(a.query, {
            limit: a.limit,
          });
          if (results.length > 0 && !retrieversUsed.includes(retriever.id)) {
            retrieversUsed.push(retriever.id);
          }
          collected.push(...results);
        } catch (err) {
          errors.push(`${retriever.id}: ${errMessage(err)}`);
        }
      }
      // Dedupe by URL across providers.
      const seen = new Set<string>();
      const sources = collected.filter(s =>
        seen.has(s.url) ? false : (seen.add(s.url), true)
      );
      return {
        query: a.query,
        sources,
        retrieversAvailable,
        retrieversUsed,
        errors,
      };
    },
  },
  {
    name: 'research_fetch',
    description:
      'Fetch one URL via the evidence retriever registry and normalize it to a SourceEvidence summary. SSRF-guarded adapter-side (http/https only; localhost/private/metadata addresses rejected — surfaced in the error field). Persists NOTHING. source is null when the provider yields no content or no fetch-capable provider is configured. Metered: each call spends provider quota.',
    scope: 'research',
    riskClass: 'read',
    costClass: 'metered',
    schema: FetchArgs,
    outputSchema: FetchOutput,
    execute: async (args, _ctx) => {
      const a = FetchArgs.parse(args);
      const available = getAvailableRetrievers();
      const retrieversAvailable = available.map(r => r.id as string);
      const fetcher = available.find(r => r.capabilities.canFetch);
      if (!fetcher) {
        return {
          url: a.url,
          source: null,
          provider: null,
          retrieversAvailable,
          error:
            retrieversAvailable.length === 0
              ? 'no retrieval providers configured'
              : 'no fetch-capable retrieval provider available',
        };
      }
      try {
        // SSRF boundary enforced inside the adapter's fetch() —
        // lib/evidence/retriever.ts `assertFetchUrlAllowed` contract.
        const source = await fetcher.fetch(a.url);
        return {
          url: a.url,
          source,
          provider: fetcher.id,
          retrieversAvailable,
          error: null,
        };
      } catch (err) {
        return {
          url: a.url,
          source: null,
          provider: fetcher.id,
          retrieversAvailable,
          error: errMessage(err),
        };
      }
    },
  },
  {
    name: 'research_get_evidence_bundle',
    description:
      "Materialize the EvidenceBundle for one claim: rehydrate its persisted ClaimEvidenceScore rows and run the PURE evidence policy over them. Returns the fresh bundle (verdict, per-source stances, age basis, reasons) PLUS the claim's persisted evidenceStatus so drift is visible. Strictly read-only: never writes evidenceStatus, never appends to the reviewLog — claims verification stays on its dedicated authed route. Org-scoped: a wrong-org claimId returns bundle: null.",
    scope: 'research',
    riskClass: 'read',
    costClass: 'free',
    schema: BundleArgs,
    outputSchema: BundleOutput,
    execute: async (args, ctx) => {
      const a = BundleArgs.parse(args);
      // Org-scoped claim lookup — a cross-tenant claimId is never evaluated.
      const claim = await prisma.marketingAgencyClaim.findFirst({
        where: { id: a.claimId, organizationId: ctx.organizationId },
        select: { id: true, claimType: true, evidenceStatus: true },
      });
      if (!claim) {
        return {
          claimId: a.claimId,
          bundle: null,
          persistedEvidenceStatus: null,
          freshEvidenceStatus: null,
          scoreRowCount: 0,
        };
      }
      // Org-scoped score-row read (pattern: evaluateAndApplyEvidencePolicy in
      // lib/marketing-agency/evidence-policy.ts — read side only).
      const scoreRows = (await prisma.claimEvidenceScore.findMany({
        where: { claimId: a.claimId, organizationId: ctx.organizationId },
        include: { sourceRef: true },
      })) as unknown as ScoreRowWithSourceRef[];

      const { sources, skipped } = rehydrateScoredSources(scoreRows);
      // PURE evaluation — no persistence, no clock side effects beyond `now`.
      const decision = evaluateEvidencePolicy(
        { id: claim.id, claimType: claim.claimType },
        sources,
        DEFAULT_EVIDENCE_POLICY
      );
      // Record un-rehydratable rows honestly on the returned aggregate (same
      // convention as the persisting evaluator).
      decision.bundle.aggregate.reasons.push(...skipped);

      return {
        claimId: claim.id,
        bundle: decision.bundle,
        persistedEvidenceStatus: claim.evidenceStatus ?? null,
        freshEvidenceStatus: decision.evidenceStatus,
        scoreRowCount: scoreRows.length,
      };
    },
  },
];
