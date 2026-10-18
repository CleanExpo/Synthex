/**
 * One complete learning loop against the sandbox Postgres (port 5499):
 * card events → observed outcome → recommendation → human decision, with the
 * tenant and authority boundaries proven by attempts that must fail.
 * All data here is SYNTHETIC SEED; nothing is a customer result.
 */
// Test-only signing secret for server-issued card sessions (never a real secret).
process.env.JWT_SECRET ??= 'integration-test-only-card-session-secret';
import { issueSession } from '@/lib/learning-loop/assignment';
import { assignedVariant } from '@/lib/learning-loop/summary';
import { randomUUID } from 'crypto';
import { NextRequest } from 'next/server';

jest.mock('@/lib/auth/rate-limit', () => ({
  checkRateLimit: async () => ({ ok: true }),
  extractClientIp: () => '203.0.113.9',
}));

import prisma from '@/lib/prisma';
import { POST as cardEvents } from '@/app/api/card/[slug]/events/route';
import { WHITE_RABBIT_CARD } from '@/lib/cards/white-rabbit';
import {
  findCardBinding,
  loadLoop,
  observeOutcome,
  recordCardEvent,
  recordDecision,
  LearningLoopError,
} from '@/lib/learning-loop/store';
import { SEED, seedLearningLoop } from '../../../scripts/learning-loop/seed';

const EXP = WHITE_RABBIT_CARD.experiment.id;
const spec = { ...WHITE_RABBIT_CARD.experiment, minSessionsPerVariant: 2 };

function postEvent(body: Record<string, unknown>) {
  const req = new NextRequest('http://localhost:3000/api/card/phill/events', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: 'http://localhost:3000',
    },
    body: JSON.stringify(body),
  });
  return cardEvents(req, { params: Promise.resolve({ slug: 'phill' }) });
}

beforeAll(async () => {
  await prisma.intentScapeEvent.deleteMany({
    where: { organizationId: { in: [SEED.orgA, SEED.orgB] } },
  });
  await seedLearningLoop();
});
afterAll(async () => {
  await prisma.$disconnect();
});

it('binds the card to the authorised experiment in its own organisation, as preview data', async () => {
  const b = await findCardBinding('phill');
  expect(b).toMatchObject({
    organizationId: SEED.orgA,
    workspaceId: SEED.workspace,
    goalContractId: SEED.goalContract,
    experimentId: EXP,
    dataClass: 'preview',
  });
});

it('records public events through the real route and refuses personal data', async () => {
  for (const variant of ['story', 'plain']) {
    for (let i = 0; i < 2; i++) {
      // A server-issued, signed session whose derived assignment is this variant.
      let issued = issueSession();
      while (assignedVariant(issued.id, ['story', 'plain']) !== variant)
        issued = issueSession();
      const sessionId = issued.id;
      for (const e of [
        { type: 'session_started' },
        { type: 'need_selected', needId: 'reviews' },
        { type: 'action_shown', needId: 'reviews' },
        {
          type: 'action_rated',
          needId: 'reviews',
          rating: i === 0 ? 'useful' : 'not_useful',
        },
      ]) {
        const res = await postEvent({
          sessionId,
          sessionSig: issued.sig,
          variant,
          ...e,
        });
        expect(res.status).toBe(201);
      }
    }
  }
  const withEmail = await postEvent({
    sessionId: randomUUID(),
    variant: 'story',
    type: 'session_started',
    email: 'x@example.com',
  });
  expect(withEmail.status).toBe(400);
  const rows = await prisma.intentScapeEvent.findMany({
    where: { organizationId: SEED.orgA, eventType: 'learning.card_event' },
  });
  expect(rows).toHaveLength(16);
  expect(JSON.stringify(rows.map(r => r.payload))).not.toMatch(/@/);
});

it('refuses events (503) when the card has no published page, instead of binding them to the last authorising organisation', async () => {
  const page = await prisma.linkBioPage.findFirst({ where: { slug: 'phill' } });
  expect(page).toBeTruthy();
  await prisma.linkBioPage.update({
    where: { id: page!.id },
    data: { isPublished: false },
  });
  try {
    const res = await postEvent({
      sessionId: randomUUID(),
      variant: 'story',
      type: 'session_started',
    });
    expect(res.status).toBe(503);
  } finally {
    await prisma.linkBioPage.update({
      where: { id: page!.id },
      data: { isPublished: true },
    });
  }
});

it('keeps a synthetic simulation out of the preview outcome', async () => {
  const b = await findCardBinding('phill');
  await recordCardEvent(b, {
    sessionId: randomUUID(),
    type: 'action_rated',
    variant: 'story',
    needId: 'maps',
    rating: 'useful',
    dataClass: 'synthetic',
  });
  const { summary } = await observeOutcome({
    organizationId: SEED.orgA,
    experimentId: EXP,
    actorId: SEED.collaborator,
    dataClass: 'preview',
    spec,
  });
  expect(summary.sessions).toBe(4);
  expect(summary.excludedByDataClass.synthetic).toBe(1);
});

it('turns the observed outcome into a recommendation that reaches the owner decision', async () => {
  const { summary, recommendation, outcomeEventId, recommendationEventId } =
    await observeOutcome({
      organizationId: SEED.orgA,
      experimentId: EXP,
      actorId: SEED.owner,
      dataClass: 'preview',
      spec,
    });
  expect(summary.claim).toBe('observational');
  expect(summary.variants.map(v => [v.variant, v.useful, v.sessions])).toEqual([
    ['story', 1, 2],
    ['plain', 1, 2],
  ]);
  expect(recommendation.verdict).toBe('continue_observing');
  const stored = await prisma.intentScapeEvent.findUnique({
    where: { id: recommendationEventId },
  });
  expect(stored?.payload).toMatchObject({ dataClass: summary.dataClass });
  expect(outcomeEventId).toBeTruthy();

  await expect(
    recordDecision({
      organizationId: SEED.orgA,
      experimentId: EXP,
      actorId: SEED.collaborator,
      actorRole: 'collaborator',
      recommendationEventId,
      decision: 'keep',
      rationale: 'collaborator tries to decide',
      nextDecision: 'none',
    })
  ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  await expect(
    recordDecision({
      organizationId: SEED.orgB,
      experimentId: EXP,
      actorId: SEED.outsider,
      actorRole: 'owner',
      recommendationEventId,
      decision: 'stop',
      rationale: 'another tenant tries to decide',
      nextDecision: 'none',
    })
  ).rejects.toMatchObject({ code: 'NOT_FOUND' });

  const decision = await recordDecision({
    organizationId: SEED.orgA,
    experimentId: EXP,
    actorId: SEED.owner,
    actorRole: 'owner',
    recommendationEventId,
    decision: 'continue_observing',
    rationale:
      'Preview data only proves the loop works; no customer result yet.',
    nextDecision:
      'Phill to approve or decline the pilot at the next event (founder authority).',
  });
  const loop = await loadLoop(SEED.orgA, EXP);
  expect(loop.goalContract?.id).toBe(SEED.goalContract);
  expect(loop.hypothesis?.invalidatingAssumption).toMatch(
    /lower useful-answer rate/
  );
  expect(loop.decisions.at(-1)).toMatchObject({
    id: decision.id,
    decision: 'continue_observing',
    recommended: 'continue_observing',
    recommendationEventId,
    decidedBy: SEED.owner,
  });
});

it('hides the loop from another organisation', async () => {
  await expect(loadLoop(SEED.orgB, EXP)).rejects.toBeInstanceOf(
    LearningLoopError
  );
  await expect(
    observeOutcome({
      organizationId: SEED.orgB,
      experimentId: EXP,
      actorId: SEED.outsider,
      dataClass: 'preview',
      spec,
    })
  ).rejects.toMatchObject({ code: 'NOT_FOUND' });
});

it('stops recording when the card page moves to another organisation', async () => {
  await prisma.linkBioPage.update({
    where: { slug: 'phill' },
    data: { userId: SEED.outsider },
  });
  try {
    await expect(findCardBinding('phill')).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    const res = await postEvent({
      sessionId: randomUUID(),
      variant: 'story',
      type: 'session_started',
    });
    expect(res.status).toBe(409);
  } finally {
    await prisma.linkBioPage.update({
      where: { slug: 'phill' },
      data: { userId: SEED.owner },
    });
  }
});

it('reports NOT_PROVISIONED for a card with no authorised experiment', async () => {
  await expect(findCardBinding('nobody')).rejects.toMatchObject({
    code: 'NOT_PROVISIONED',
  });
});
