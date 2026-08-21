/**
 * Draft Linear tickets from goal + acceptance + repo analysis.
 * Uses AI when available; falls back to structured heuristic tickets.
 */

import { randomUUID } from 'crypto';
import { z } from 'zod';
import { getAIProvider } from '@/lib/ai/providers';
import type { MissionDraftTicket, RepoAnalysisSummary } from './types';

const DraftSchema = z.object({
  tickets: z
    .array(
      z.object({
        title: z.string().min(4).max(200),
        description: z.string().min(8).max(4000),
        acceptanceCriteria: z.array(z.string().min(3).max(400)).max(12),
        technicalNotes: z.string().max(2000).default(''),
        suggestedFiles: z.array(z.string().max(200)).max(12).default([]),
        estimateHours: z.number().min(0.5).max(40).optional(),
        labels: z.array(z.string().max(40)).max(8).default([]),
        dependsOnIndexes: z.array(z.number().int().min(0)).max(8).default([]),
      })
    )
    .min(1)
    .max(12),
});

function heuristicDrafts(input: {
  goal: string;
  acceptanceCriteria: string;
  repo: RepoAnalysisSummary | null;
}): MissionDraftTicket[] {
  const paths = input.repo?.topPaths.slice(0, 6) ?? [
    'app/dashboard',
    'components',
    'lib',
  ];
  const acLines = input.acceptanceCriteria
    .split(/\n|;/)
    .map(s => s.replace(/^[-*]\s*/, '').trim())
    .filter(Boolean)
    .slice(0, 6);

  const baseAc =
    acLines.length > 0
      ? acLines
      : [
          'Behaviour matches the stated goal',
          'Covered by unit or integration tests',
          'No regressions on auth / org scope',
        ];

  const specs: Array<Omit<MissionDraftTicket, 'localId' | 'order'>> = [
    {
      title: `Spec & IA: ${input.goal.slice(0, 80)}`,
      description: `Capture product intent and information architecture for: ${input.goal}`,
      acceptanceCriteria: [
        'Written acceptance criteria are testable',
        'Out-of-scope items listed as Coming soon where needed',
        ...baseAc.slice(0, 2),
      ],
      technicalNotes: 'Keep docs short; prefer checklist over essay.',
      suggestedFiles: ['docs/', ...paths.slice(0, 2)],
      estimateHours: 2,
      labels: ['spec', 'mission-control'],
      dependsOnLocalIds: [],
    },
    {
      title: `Implement core path for: ${input.goal.slice(0, 70)}`,
      description: `Ship the minimum vertical slice that satisfies the goal against ${input.repo?.fullName ?? 'the selected repo'}.`,
      acceptanceCriteria: baseAc,
      technicalNotes: `Repo language: ${input.repo?.language ?? 'unknown'}. Prefer surgical diffs in ${paths.slice(0, 3).join(', ')}.`,
      suggestedFiles: paths,
      estimateHours: 8,
      labels: ['implementation'],
      dependsOnLocalIds: [],
    },
    {
      title: `Tests & verification for: ${input.goal.slice(0, 70)}`,
      description:
        'Add gate tests for happy path, empty states, and approval/project gates where applicable.',
      acceptanceCriteria: [
        'Unit tests cover critical gates',
        'Manual QA checklist attached in ticket',
        'Type-check / lint clean for touched files',
      ],
      technicalNotes: 'Prefer tests/unit over brittle E2E for gates.',
      suggestedFiles: ['tests/unit/', ...paths.slice(0, 2)],
      estimateHours: 4,
      labels: ['tests'],
      dependsOnLocalIds: [],
    },
  ];

  const withIds = specs.map((s, i) => ({
    ...s,
    localId: randomUUID(),
    order: i,
  }));

  return withIds.map((t, i) => ({
    ...t,
    dependsOnLocalIds: i === 0 ? [] : [withIds[i - 1].localId],
  }));
}

function toDraftTickets(
  parsed: z.infer<typeof DraftSchema>
): MissionDraftTicket[] {
  const withIds = parsed.tickets.map((t, order) => ({
    localId: randomUUID(),
    title: t.title.trim(),
    description: t.description.trim(),
    acceptanceCriteria: t.acceptanceCriteria.map(s => s.trim()).filter(Boolean),
    technicalNotes: t.technicalNotes?.trim() ?? '',
    suggestedFiles: t.suggestedFiles ?? [],
    estimateHours: t.estimateHours,
    labels: t.labels ?? [],
    dependsOnLocalIds: [] as string[],
    order,
  }));

  parsed.tickets.forEach((t, i) => {
    withIds[i].dependsOnLocalIds = (t.dependsOnIndexes ?? [])
      .filter(idx => idx >= 0 && idx < withIds.length && idx !== i)
      .map(idx => withIds[idx].localId);
  });

  return withIds;
}

export async function draftTicketsFromGoal(input: {
  goal: string;
  acceptanceCriteria: string;
  projectName: string;
  repo: RepoAnalysisSummary | null;
}): Promise<{ tickets: MissionDraftTicket[]; source: 'ai' | 'heuristic' }> {
  const repoBlock = input.repo
    ? JSON.stringify(
        {
          fullName: input.repo.fullName,
          language: input.repo.language,
          topPaths: input.repo.topPaths.slice(0, 20),
          recentPRs: input.repo.recentPullRequests.slice(0, 5),
          openIssueCount: input.repo.openIssueCount,
        },
        null,
        2
      )
    : 'No repo analysis available.';

  const prompt = `You are a senior engineering PM for Synthex (Next.js marketing platform).
Break this goal into 3–8 small, shippable Linear tickets for project "${input.projectName}".

GOAL:
${input.goal}

ACCEPTANCE CRITERIA:
${input.acceptanceCriteria || '(none provided)'}

REPO ANALYSIS:
${repoBlock}

Return ONLY valid JSON matching:
{"tickets":[{"title":"...","description":"...","acceptanceCriteria":["..."],"technicalNotes":"...","suggestedFiles":["path"],"estimateHours":2,"labels":["..."],"dependsOnIndexes":[0]}]}

Rules:
- Prefer small tickets over mega-tickets
- dependsOnIndexes references earlier ticket indexes (0-based)
- Titles actionable and specific
- No markdown fences`;

  try {
    const ai = getAIProvider();
    const raw = await ai.complete({
      model: ai.models.balanced,
      messages: [
        {
          role: 'system',
          content:
            'You draft precise Linear engineering tickets. Output JSON only.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.2,
      max_tokens: 3500,
    });

    const text = raw.content?.trim() || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('NO_JSON');
    const parsed = DraftSchema.parse(JSON.parse(jsonMatch[0]));
    return { tickets: toDraftTickets(parsed), source: 'ai' };
  } catch {
    return {
      tickets: heuristicDrafts(input),
      source: 'heuristic',
    };
  }
}
