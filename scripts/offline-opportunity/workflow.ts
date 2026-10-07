import { z } from 'zod';
import { convertSignalsToOpportunities } from '../../lib/marketing-agency/intelligence/signal-ledger';
import { createBoardInputDraft } from '../../packages/control-module/src/intake/board-input.service';

const text = z.string().trim().min(1);
const fixtureId = text.regex(/^synthetic-[a-z0-9-]+$/);
const SessionSchema = z
  .object({
    mode: z.literal('synthetic'),
    userId: fixtureId,
    organizationId: fixtureId,
  })
  .strict();
const FixtureSchema = z
  .object({
    mode: z.literal('synthetic'),
    id: fixtureId,
    organizationId: fixtureId,
    source: z
      .object({
        url: z
          .string()
          .url()
          .refine(
            value => new URL(value).hostname.endsWith('.invalid'),
            'Synthetic sources must use .invalid'
          ),
        capturedAt: z.string().datetime(),
        publishedAt: z.string().datetime().optional(),
      })
      .strict(),
    creatorClaims: z.array(text).min(1),
    portfolioEvidence: z.array(
      z
        .object({
          mode: z.literal('synthetic'),
          ref: text.startsWith('synthetic:'),
          observation: text,
        })
        .strict()
    ),
    targetBusiness: text,
    audience: text,
    customerProblemHypothesis: text,
    confidence: z.number().min(0).max(1),
    assumptions: z.array(text).min(1),
    uncertainties: z.array(text).min(1),
    suggestedOwner: text,
    kpi: z
      .object({ name: text, unit: text, baselineRequirement: text })
      .strict(),
    successCriteria: text,
    stopCriteria: text,
    nextValidationStep: text,
  })
  .strict();
const DecisionSchema = z.enum(['accept', 'reject', 'request-evidence']);

export type FixtureSession = z.infer<typeof SessionSchema>;
export type SyntheticFixture = z.infer<typeof FixtureSchema>;
type Decision = z.infer<typeof DecisionSchema>;
type State = 'unreviewed' | 'accepted' | 'rejected' | 'awaiting-evidence';
interface ReviewItem {
  fixture: SyntheticFixture;
  state: State;
  review?: { decision: Decision; reason: string; operatorId: string };
}
type PacketDraft = ReturnType<typeof createBoardInputDraft>;
interface Preview extends PacketDraft {
  status: 'pending';
  executionBlocked: true;
  submitted: false;
  proposal: ReturnType<typeof buildProposal>;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function buildProposal(fixture: SyntheticFixture) {
  return {
    mode: 'synthetic-draft' as const,
    targetBusiness: fixture.targetBusiness,
    audience: fixture.audience,
    customerProblemHypothesis: fixture.customerProblemHypothesis,
    creatorInspiration: {
      claims: fixture.creatorClaims,
      attribution: fixture.source,
      demandEvidence: false,
    },
    supportingPortfolioEvidence: fixture.portfolioEvidence,
    confidence: fixture.confidence,
    confidenceMeaning:
      'Synthetic hypothesis support only; real customer demand remains unvalidated.',
    assumptions: fixture.assumptions,
    uncertainties: fixture.uncertainties,
    suggestedOwner: fixture.suggestedOwner,
    kpi: fixture.kpi,
    successCriteria: fixture.successCriteria,
    stopCriteria: fixture.stopCriteria,
    nextValidationStep: fixture.nextValidationStep,
    spendLimitAUD: 0,
    demandValidated: false,
    revenueValidated: false,
  };
}

/** Local fixture exercise only. FixtureSession is not production authentication.
 * No storage adapter, providers, route, queue or execution capability exists.
 * All state dies at process exit. Rejected/request-evidence records require a
 * new fixture revision for another review; they cannot be reset or promoted.
 */
export function createSyntheticOpportunityWorkflow() {
  const items = new Map<string, ReviewItem>();
  const previews = new Map<string, Preview>();

  function key(session: FixtureSession, id: string) {
    const context = SessionSchema.parse(session);
    return `${context.organizationId}:${fixtureId.parse(id)}`;
  }
  function find(session: FixtureSession, id: string) {
    const item = items.get(key(session, id));
    if (!item) throw new Error('Fixture not found');
    return item;
  }

  return {
    capture(session: FixtureSession, input: SyntheticFixture): ReviewItem {
      const context = SessionSchema.parse(session);
      const fixture = FixtureSchema.parse(input);
      if (fixture.organizationId !== context.organizationId)
        throw new Error('Fixture organisation mismatch');
      const id = key(context, fixture.id);
      const existing = items.get(id);
      if (existing) {
        if (JSON.stringify(existing.fixture) !== JSON.stringify(fixture))
          throw new Error('Duplicate ID has conflicting fixture content');
        return clone(existing);
      }
      const item: ReviewItem = { fixture, state: 'unreviewed' };
      items.set(id, item);
      return clone(item);
    },
    inspect(session: FixtureSession, id: string): ReviewItem {
      return clone(find(session, id));
    },
    decide(
      session: FixtureSession,
      id: string,
      input: Decision,
      reason: string
    ): ReviewItem {
      const decision = DecisionSchema.parse(input);
      const reviewReason = text.parse(reason);
      const item = find(session, id);
      if (item.state === 'rejected' || item.state === 'awaiting-evidence')
        throw new Error('Review closed; use a new fixture revision');
      if (previews.has(key(session, id)))
        throw new Error('Draft already emitted; use a new fixture revision');
      item.state =
        decision === 'accept'
          ? 'accepted'
          : decision === 'reject'
            ? 'rejected'
            : 'awaiting-evidence';
      item.review = {
        decision,
        reason: reviewReason,
        operatorId: session.userId,
      };
      return clone(item);
    },
    promote(session: FixtureSession, id: string): Preview {
      const item = find(session, id);
      if (item.state !== 'accepted')
        throw new Error('Only accepted fixtures can become drafts');
      const cached = previews.get(key(session, id));
      if (cached) return clone(cached);
      const f = item.fixture;
      if (f.portfolioEvidence.length === 0)
        throw new Error('Separate synthetic portfolio evidence is required');
      const opportunities = convertSignalsToOpportunities([
        {
          id: f.id,
          source: {
            id: f.id,
            kind: 'manual',
            label: 'Synthetic creator inspiration — not customer demand',
            sourceUrl: f.source.url,
            capturedAt: f.source.capturedAt,
            permissionContext: 'internal',
          },
          capturedAt: f.source.capturedAt,
          business: f.targetBusiness,
          client: 'synthetic-portfolio',
          product: 'Internal handover hypothesis',
          audienceSegment: f.audience,
          narrative: f.customerProblemHypothesis,
          content: f.creatorClaims.join('\n'),
          freshness: 0,
          confidence: f.confidence,
          commercialImpact: 0,
          creativePotential: 0,
          risk: 0.5,
          status: 'scored',
          evidenceRefs: f.portfolioEvidence.map(e => e.ref),
        },
      ]);
      if (opportunities.length === 0)
        throw new Error('Existing confidence/risk gate blocks this draft');
      const proposal = buildProposal(f);
      let sequence = 0;
      const packet = createBoardInputDraft({
        organizationId: f.organizationId,
        source: 'manual',
        speaker: session.userId,
        rawText: JSON.stringify(proposal),
        evidenceRefs: opportunities[0].evidenceRefs,
        now: new Date(f.source.capturedAt),
        idFactory: () => `${f.organizationId}:${f.id}:${++sequence}`,
      });
      const preview: Preview = {
        ...packet,
        commandPacket: {
          ...packet.commandPacket,
          approvalGate: 'production_blocked',
          scenarioState: 'blocked',
          outcomeMetric: 'synthetic_draft_review_only',
          nextAction: 'Review synthetic proposal; no execution authorised.',
          risks: [
            ...new Set([
              ...packet.commandPacket.risks,
              'synthetic_only',
              'real_demand_unvalidated',
              'zero_spend',
            ]),
          ],
        },
        status: 'pending',
        executionBlocked: true,
        submitted: false,
        proposal,
      };
      previews.set(key(session, id), preview);
      return clone(preview);
    },
  };
}
