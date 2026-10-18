/**
 * Learning-loop seed shared by scripts/learning-loop/seed-dev.ts and the
 * integration test. Writes SYNTHETIC SEED rows only; callers guard the target.
 */
import {
  authoriseExperiment,
  type ExperimentRecord,
} from '@/lib/learning-loop/store';
import { WHITE_RABBIT_CARD } from '@/lib/cards/white-rabbit';
import prisma from '@/lib/prisma';

export const SEED = {
  orgA: 'seed-org-unite',
  orgB: 'seed-org-other',
  owner: 'seed-user-phill',
  collaborator: 'seed-user-collab',
  outsider: 'seed-user-other-owner',
  workspace: 'seed-ws-white-rabbit',
  visionRun: 'seed-run-white-rabbit',
  goalContract: 'seed-gc-white-rabbit',
} as const;

export async function seedLearningLoop(): Promise<void> {
  const label = 'SYNTHETIC SEED (local only)';
  await prisma.organization.upsert({
    where: { id: SEED.orgA },
    update: {},
    create: {
      id: SEED.orgA,
      name: `Unite-Group — ${label}`,
      slug: 'seed-unite',
    },
  });
  await prisma.organization.upsert({
    where: { id: SEED.orgB },
    update: {},
    create: {
      id: SEED.orgB,
      name: `Other client — ${label}`,
      slug: 'seed-other',
    },
  });
  for (const [id, email, org] of [
    [SEED.owner, 'phill.seed@example.invalid', SEED.orgA],
    [SEED.collaborator, 'collab.seed@example.invalid', SEED.orgA],
    [SEED.outsider, 'other.seed@example.invalid', SEED.orgB],
  ] as const) {
    await prisma.user.upsert({
      where: { id },
      update: { organizationId: org, onboardingComplete: true },
      create: {
        id,
        email,
        name: id,
        organizationId: org,
        onboardingComplete: true,
      },
    });
  }
  const collab = await prisma.teamMember.findFirst({
    where: { userId: SEED.collaborator, organizationId: SEED.orgA },
  });
  if (!collab)
    await prisma.teamMember.create({
      data: {
        userId: SEED.collaborator,
        organizationId: SEED.orgA,
        role: 'collaborator',
        acceptedAt: new Date(),
      },
    });

  const page = await prisma.linkBioPage.upsert({
    where: { slug: WHITE_RABBIT_CARD.slug },
    update: { isPublished: true, userId: SEED.owner },
    create: {
      slug: WHITE_RABBIT_CARD.slug,
      userId: SEED.owner,
      title: 'Phill McGurk',
      bio: `Founder, Unite-Group. ${label}`,
      isPublished: true,
    },
  });
  if ((await prisma.linkBioLink.count({ where: { pageId: page.id } })) === 0) {
    await prisma.linkBioLink.createMany({
      data: [
        {
          pageId: page.id,
          title: 'Synthex',
          url: 'https://synthex.social',
          order: 0,
        },
        {
          pageId: page.id,
          title: 'Unpublished brand (hidden)',
          url: 'https://example.invalid/hidden',
          order: 1,
          isVisible: false,
        },
      ],
    });
  }

  await prisma.intentScapeWorkspace.upsert({
    where: { id: SEED.workspace },
    update: {},
    create: {
      id: SEED.workspace,
      organizationId: SEED.orgA,
      createdById: SEED.owner,
      title: 'White Rabbit card — front door',
      state: 'approved',
      originSignalHash: 'seed',
      activeContextVersion: 1,
    },
  });
  await prisma.intentScapeVisionRun.upsert({
    where: { id: SEED.visionRun },
    update: {},
    create: {
      id: SEED.visionRun,
      organizationId: SEED.orgA,
      workspaceId: SEED.workspace,
      contextVersion: 1,
      attempt: 1,
      status: 'approved',
      generatorProvider: 'human-seed',
    },
  });
  const hyp = { hypothesisId: 'h-front-door', version: 1 };
  const existingHyp = await prisma.intentScapeHypothesis.findFirst({
    where: { organizationId: SEED.orgA, workspaceId: SEED.workspace, ...hyp },
  });
  if (!existingHyp) {
    await prisma.intentScapeHypothesis.create({
      data: {
        organizationId: SEED.orgA,
        workspaceId: SEED.workspace,
        visionRunId: SEED.visionRun,
        ...hyp,
        title:
          'A story-led card helps at least as many attendees find a useful next step as a plain card',
        causalMechanism:
          'A clear, low-effort first step before any ask lowers the cost of engaging; the story may add curiosity or may add friction.',
        desiredChange:
          'More attendees leave with one actionable answer to a real need.',
        affectedStakeholders: ['event attendees', 'Phill'],
        evidenceFor: [
          '[INFERENCE from the Opportunity Map, which records a usefulness verdict per public scan]',
        ],
        evidenceAgainst: [
          '[UNCONFIRMED] story framing can slow people who just want the contact',
        ],
        invalidatingAssumption:
          'If the story card shows a lower useful-answer rate, or more confusion, than the plain card on equivalent offers.',
        mainRisk: 'Optimising for taps or emails instead of usefulness.',
        adjacentValue:
          'The same loop works for every Unite-Group brand front door.',
        researchBranchIds: [],
        rank: 1,
        confidence: 0.4,
      },
    });
  }
  await prisma.intentScapeGoalContract.upsert({
    where: { id: SEED.goalContract },
    update: {},
    create: {
      id: SEED.goalContract,
      organizationId: SEED.orgA,
      workspaceId: SEED.workspace,
      visionRunId: SEED.visionRun,
      hypothesisId: hyp.hypothesisId,
      hypothesisVersion: 1,
      version: 1,
      contextVersion: 1,
      desiredChange:
        'Attendees identify a need and receive a relevant, actionable answer.',
      primaryStakeholder: 'event attendees',
      acceptanceCriteria: [
        'useful-answer rate per variant reported with a 95% interval',
        'diagnostics kept separate from benefit',
      ],
      exclusions: ['email capture', 'prize', 'auto-posting'],
      authorityBoundaries: [
        'no sends or publication',
        'pilot launch needs founder approval',
        'no cross-brand data use',
      ],
      evidenceRefs: [],
      status: 'approved',
      approvedBy: SEED.owner,
      approvedAt: new Date(),
      artifactId: 'seed-artifact-none',
    },
  });

  const exists = await prisma.intentScapeEvent.findFirst({
    where: {
      organizationId: SEED.orgA,
      eventType: 'learning.experiment_authorised',
      entityId: WHITE_RABBIT_CARD.experiment.id,
    },
  });
  if (!exists) {
    const record: ExperimentRecord = {
      experimentId: WHITE_RABBIT_CARD.experiment.id,
      cardSlug: WHITE_RABBIT_CARD.slug,
      customerBenefit:
        'An attendee identifies a need and receives a relevant, actionable answer, without giving an email.',
      hypothesis:
        'Story card ≥ plain card on the useful-answer rate, with equivalent offers.',
      baseline: 'plain card',
      comparison: 'story card, randomised per session',
      owner: 'Phill McGurk (organisation owner)',
      scope: [
        '/card/phill DISCOVER and CONNECT doors',
        'no SOLVE until deck, prize and music are confirmed',
      ],
      permissions: [
        'record anonymous card events',
        'no personal data',
        'no sends',
      ],
      approvalReference: `goal contract ${SEED.goalContract} (${label})`,
      successMeasure:
        'useful-answer rate per variant, lower 95% bound at or above 50%',
      observationPeriod: {
        start: 'pilot event day (not scheduled)',
        end: 'end of pilot event day',
      },
      stopConditions: [
        'any consent error',
        'accessibility issue rate above 5%',
        'confusion rate above 10%',
      ],
      deliveryCost: 'AUD 0 per session (static content, no model calls)',
      commercialMeasures: [
        'qualified next steps after a useful answer',
        'cost per useful answer',
      ],
      pilotStatus: 'not_launched',
    };
    await authoriseExperiment({
      organizationId: SEED.orgA,
      workspaceId: SEED.workspace,
      goalContractId: SEED.goalContract,
      actorId: SEED.owner,
      actorRole: 'owner',
      record,
    });
  }
  console.log(
    `seed-dev: ready (${label}). Card: /card/${WHITE_RABBIT_CARD.slug}  Loop: /dashboard/learning-loop?experimentId=${WHITE_RABBIT_CARD.experiment.id}`
  );
}
