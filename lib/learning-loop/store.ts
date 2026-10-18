/**
 * Learning loop — persistence on IntentScape (no new table).
 *
 * customer need → hypothesis (IntentScapeHypothesis) → challenge (its
 * evidenceAgainst + invalidatingAssumption) → authorised experiment (event bound
 * to an approved IntentScapeGoalContract) → observed outcome (event) →
 * recommendation (event) → human decision (event, owner only).
 *
 * Every row is an append-only IntentScapeEvent in ONE organisation and
 * workspace. The organisation always comes from the authorisation row, never
 * from a public request. Nothing here sends, publishes or spends.
 */
import type { PrismaClient } from '@prisma/client';
import prisma from '@/lib/prisma';
import {
  DATA_CLASSES,
  recommend,
  summarise,
  type CardEvent,
  type DataClass,
  type ExperimentSpec,
  type OutcomeSummary,
  type Recommendation,
} from './summary';

export const LOOP_EVENT = {
  authorised: 'learning.experiment_authorised',
  card: 'learning.card_event',
  outcome: 'learning.outcome_observed',
  recommendation: 'learning.recommendation',
  decision: 'learning.decision_recorded',
} as const;

export class LearningLoopError extends Error {
  constructor(
    readonly code: 'NOT_PROVISIONED' | 'NOT_FOUND' | 'FORBIDDEN' | 'INVALID',
    message: string
  ) {
    super(message);
    this.name = 'LearningLoopError';
  }
}

export interface ExperimentRecord {
  experimentId: string;
  cardSlug: string;
  customerBenefit: string;
  hypothesis: string;
  baseline: string;
  comparison: string;
  owner: string;
  scope: string[];
  permissions: string[];
  approvalReference: string;
  successMeasure: string;
  observationPeriod: { start: string; end: string };
  stopConditions: string[];
  deliveryCost: string;
  commercialMeasures: string[];
  pilotStatus: 'not_launched' | 'launched';
}

export interface CardBinding {
  organizationId: string;
  workspaceId: string;
  goalContractId: string;
  experimentId: string;
  dataClass: Extract<DataClass, 'preview' | 'pilot'>;
  bioPageOwnerId: string | null;
}

type Db = Pick<
  PrismaClient,
  | 'intentScapeEvent'
  | 'intentScapeGoalContract'
  | 'intentScapeHypothesis'
  | 'user'
  | 'linkBioPage'
>;

function revision(): string {
  return (
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.GIT_COMMIT_SHA ||
    'local-uncommitted'
  );
}

/** Record an experiment under an approved goal contract. Owner only. */
export async function authoriseExperiment(
  input: {
    organizationId: string;
    workspaceId: string;
    goalContractId: string;
    actorId: string;
    actorRole: 'owner' | 'collaborator';
    record: ExperimentRecord;
  },
  db: Db = prisma
) {
  if (input.actorRole !== 'owner')
    throw new LearningLoopError(
      'FORBIDDEN',
      'Only the organisation owner can authorise an experiment.'
    );
  const contract = await db.intentScapeGoalContract.findFirst({
    where: {
      id: input.goalContractId,
      organizationId: input.organizationId,
      workspaceId: input.workspaceId,
      status: 'approved',
    },
    select: {
      id: true,
      hypothesisId: true,
      hypothesisVersion: true,
      approvedBy: true,
      approvedAt: true,
    },
  });
  if (!contract)
    throw new LearningLoopError(
      'NOT_FOUND',
      'No approved goal contract in this organisation and workspace.'
    );
  return db.intentScapeEvent.create({
    data: {
      organizationId: input.organizationId,
      workspaceId: input.workspaceId,
      eventType: LOOP_EVENT.authorised,
      actorId: input.actorId,
      entityType: 'experiment',
      entityId: input.record.experimentId,
      payload: {
        ...input.record,
        goalContractId: contract.id,
        hypothesisId: contract.hypothesisId,
        hypothesisVersion: contract.hypothesisVersion,
        revision: revision(),
      },
    },
  });
}

/**
 * Resolve the card's binding from its latest authorisation. No authorisation,
 * or a bio page owned outside that organisation, means the card records
 * nothing and says so (NOT_PROVISIONED), never a silent drop.
 */
export async function findCardBinding(
  slug: string,
  db: Db = prisma
): Promise<CardBinding> {
  const auth = await db.intentScapeEvent.findFirst({
    where: {
      eventType: LOOP_EVENT.authorised,
      payload: { path: ['cardSlug'], equals: slug },
    },
    orderBy: { createdAt: 'desc' },
  });
  if (!auth)
    throw new LearningLoopError(
      'NOT_PROVISIONED',
      'This card has no authorised learning experiment.'
    );
  const p = auth.payload as unknown as ExperimentRecord & {
    goalContractId: string;
  };
  const page = await db.linkBioPage.findFirst({
    where: { slug, isPublished: true },
    select: { userId: true },
  });
  if (page) {
    const owner = await db.user.findFirst({
      where: { id: page.userId, organizationId: auth.organizationId },
      select: { id: true },
    });
    if (!owner)
      throw new LearningLoopError(
        'FORBIDDEN',
        'The card page belongs to a different organisation from its experiment.'
      );
  }
  return {
    organizationId: auth.organizationId,
    workspaceId: auth.workspaceId,
    goalContractId: p.goalContractId,
    experimentId: auth.entityId,
    dataClass: p.pilotStatus === 'launched' ? 'pilot' : 'preview',
    bioPageOwnerId: page?.userId ?? null,
  };
}

export async function recordCardEvent(
  binding: CardBinding,
  event: Omit<CardEvent, 'dataClass' | 'createdAt'> & { dataClass?: DataClass },
  db: Db = prisma
) {
  return db.intentScapeEvent.create({
    data: {
      organizationId: binding.organizationId,
      workspaceId: binding.workspaceId,
      eventType: LOOP_EVENT.card,
      actorId: null,
      entityType: 'card_session',
      entityId: event.sessionId,
      payload: {
        experimentId: binding.experimentId,
        type: event.type,
        variant: event.variant,
        needId: event.needId ?? null,
        rating: event.rating ?? null,
        dataClass: event.dataClass ?? binding.dataClass,
      },
    },
  });
}

async function experimentEvents(
  organizationId: string,
  experimentId: string,
  db: Db
) {
  const [auth, card, outcomes, recs, decisions] = await Promise.all([
    db.intentScapeEvent.findFirst({
      where: {
        organizationId,
        eventType: LOOP_EVENT.authorised,
        entityId: experimentId,
      },
      orderBy: { createdAt: 'desc' },
    }),
    db.intentScapeEvent.findMany({
      where: {
        organizationId,
        eventType: LOOP_EVENT.card,
        payload: { path: ['experimentId'], equals: experimentId },
      },
      orderBy: { createdAt: 'asc' },
    }),
    db.intentScapeEvent.findMany({
      where: {
        organizationId,
        eventType: LOOP_EVENT.outcome,
        entityId: experimentId,
      },
      orderBy: { createdAt: 'asc' },
    }),
    db.intentScapeEvent.findMany({
      where: {
        organizationId,
        eventType: LOOP_EVENT.recommendation,
        entityId: experimentId,
      },
      orderBy: { createdAt: 'asc' },
    }),
    db.intentScapeEvent.findMany({
      where: {
        organizationId,
        eventType: LOOP_EVENT.decision,
        entityId: experimentId,
      },
      orderBy: { createdAt: 'asc' },
    }),
  ]);
  if (!auth)
    throw new LearningLoopError(
      'NOT_FOUND',
      'No authorised experiment with that id in your organisation.'
    );
  return { auth, card, outcomes, recs, decisions };
}

function toCardEvents(
  rows: { entityId: string; payload: unknown; createdAt: Date }[]
): CardEvent[] {
  return rows.map(r => {
    const p = r.payload as Record<string, unknown>;
    return {
      sessionId: r.entityId,
      type: p.type as CardEvent['type'],
      variant: String(p.variant),
      dataClass: (DATA_CLASSES as readonly string[]).includes(
        String(p.dataClass)
      )
        ? (p.dataClass as DataClass)
        : 'synthetic',
      needId: (p.needId as string) ?? undefined,
      rating: (p.rating as CardEvent['rating']) ?? undefined,
      createdAt: r.createdAt.toISOString(),
    };
  });
}

/** Snapshot the observed outcome and the rule-based recommendation. Members may run it; it decides nothing. */
export async function observeOutcome(
  input: {
    organizationId: string;
    experimentId: string;
    actorId: string;
    dataClass: DataClass;
    spec: ExperimentSpec;
  },
  db: Db = prisma
): Promise<{
  summary: OutcomeSummary;
  recommendation: Recommendation;
  outcomeEventId: string;
  recommendationEventId: string;
}> {
  const { auth, card } = await experimentEvents(
    input.organizationId,
    input.experimentId,
    db
  );
  const summary = summarise(input.spec, toCardEvents(card), input.dataClass);
  const recommendation = recommend(input.spec, summary);
  const provenance = {
    source: 'intentscape_events',
    eventType: LOOP_EVENT.card,
    rowsRead: card.length,
    firstEventAt: card[0]?.createdAt.toISOString() ?? null,
    lastEventAt: card.at(-1)?.createdAt.toISOString() ?? null,
    revision: revision(),
    generatedAt: new Date().toISOString(),
  };
  const outcome = await db.intentScapeEvent.create({
    data: {
      organizationId: input.organizationId,
      workspaceId: auth.workspaceId,
      eventType: LOOP_EVENT.outcome,
      actorId: input.actorId,
      entityType: 'experiment',
      entityId: input.experimentId,
      payload: JSON.parse(JSON.stringify({ summary, provenance })),
    },
  });
  const rec = await db.intentScapeEvent.create({
    data: {
      organizationId: input.organizationId,
      workspaceId: auth.workspaceId,
      eventType: LOOP_EVENT.recommendation,
      actorId: input.actorId,
      entityType: 'experiment',
      entityId: input.experimentId,
      payload: JSON.parse(
        JSON.stringify({
          ...recommendation,
          outcomeEventId: outcome.id,
          generatedBy: 'rules:lib/learning-loop/summary.ts#recommend',
        })
      ),
    },
  });
  return {
    summary,
    recommendation,
    outcomeEventId: outcome.id,
    recommendationEventId: rec.id,
  };
}

export const DECISIONS = [
  'keep',
  'revise',
  'stop',
  'continue_observing',
] as const;

/** A human decision on one recommendation. Owner only; rationale required. */
export async function recordDecision(
  input: {
    organizationId: string;
    experimentId: string;
    actorId: string;
    actorRole: 'owner' | 'collaborator';
    recommendationEventId: string;
    decision: (typeof DECISIONS)[number];
    rationale: string;
    nextDecision: string;
  },
  db: Db = prisma
) {
  if (input.actorRole !== 'owner')
    throw new LearningLoopError(
      'FORBIDDEN',
      'Only the organisation owner can record this decision.'
    );
  if (!DECISIONS.includes(input.decision))
    throw new LearningLoopError('INVALID', 'Unknown decision.');
  if (input.rationale.trim().length < 10)
    throw new LearningLoopError(
      'INVALID',
      'Give a rationale of at least 10 characters.'
    );
  const rec = await db.intentScapeEvent.findFirst({
    where: {
      id: input.recommendationEventId,
      organizationId: input.organizationId,
      eventType: LOOP_EVENT.recommendation,
      entityId: input.experimentId,
    },
  });
  if (!rec)
    throw new LearningLoopError(
      'NOT_FOUND',
      'That recommendation is not in your organisation.'
    );
  return db.intentScapeEvent.create({
    data: {
      organizationId: input.organizationId,
      workspaceId: rec.workspaceId,
      eventType: LOOP_EVENT.decision,
      actorId: input.actorId,
      entityType: 'experiment',
      entityId: input.experimentId,
      payload: {
        recommendationEventId: rec.id,
        recommended: (rec.payload as { verdict?: string }).verdict ?? null,
        decision: input.decision,
        rationale: input.rationale.trim(),
        nextDecision: input.nextDecision.trim(),
        decidedBy: input.actorId,
      },
    },
  });
}

/** The whole loop for one experiment, for the owner's page. */
export async function loadLoop(
  organizationId: string,
  experimentId: string,
  db: Db = prisma
) {
  const { auth, card, outcomes, recs, decisions } = await experimentEvents(
    organizationId,
    experimentId,
    db
  );
  const p = auth.payload as Record<string, unknown>;
  const [contract, hypothesis] = await Promise.all([
    db.intentScapeGoalContract.findFirst({
      where: { id: String(p.goalContractId), organizationId },
      select: {
        id: true,
        desiredChange: true,
        primaryStakeholder: true,
        acceptanceCriteria: true,
        authorityBoundaries: true,
        approvedBy: true,
        approvedAt: true,
      },
    }),
    db.intentScapeHypothesis.findFirst({
      where: {
        organizationId,
        workspaceId: auth.workspaceId,
        hypothesisId: String(p.hypothesisId),
        version: Number(p.hypothesisVersion),
      },
      select: {
        title: true,
        causalMechanism: true,
        desiredChange: true,
        evidenceFor: true,
        evidenceAgainst: true,
        invalidatingAssumption: true,
        mainRisk: true,
      },
    }),
  ]);
  const byClass: Record<DataClass, number> = {
    synthetic: 0,
    preview: 0,
    pilot: 0,
  };
  for (const e of toCardEvents(card)) byClass[e.dataClass] += 1;
  return {
    experiment: {
      id: experimentId,
      authorisedAt: auth.createdAt,
      authorisedBy: auth.actorId,
      record: p,
    },
    goalContract: contract,
    hypothesis,
    cardEvents: { total: card.length, byDataClass: byClass },
    outcomes: outcomes.map(o => ({
      id: o.id,
      at: o.createdAt,
      ...(o.payload as object),
    })),
    recommendations: recs.map(r => ({
      id: r.id,
      at: r.createdAt,
      ...(r.payload as object),
    })),
    decisions: decisions.map(d => ({
      id: d.id,
      at: d.createdAt,
      ...(d.payload as object),
    })),
  };
}
