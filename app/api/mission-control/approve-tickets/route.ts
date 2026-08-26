/**
 * POST /api/mission-control/approve-tickets
 * Human approval gate — only then create Linear issues.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { DEFAULT_POLICIES } from '@/lib/security/api-security-checker';
import { requireMissionOrg } from '@/lib/mission-control/api-auth';
import { createLinearIssuesFromDrafts } from '@/lib/mission-control/linear-projects';
import { getMission, updateMission } from '@/lib/mission-control/mission-store';
import type { MissionDraftTicket } from '@/lib/mission-control/types';

const DraftPatchSchema = z.object({
  localId: z.string().min(1),
  title: z.string().min(4).max(200).optional(),
  description: z.string().min(8).max(4000).optional(),
  acceptanceCriteria: z.array(z.string()).max(12).optional(),
  technicalNotes: z.string().max(2000).optional(),
  suggestedFiles: z.array(z.string()).max(12).optional(),
  estimateHours: z.number().min(0.5).max(40).optional(),
  labels: z.array(z.string()).max(8).optional(),
  remove: z.boolean().optional(),
});

const Schema = z.object({
  missionId: z.string().uuid(),
  approve: z.literal(true),
  drafts: z.array(DraftPatchSchema).max(12).optional(),
});

export async function POST(request: NextRequest) {
  const auth = await requireMissionOrg(
    request,
    DEFAULT_POLICIES.AUTHENTICATED_WRITE
  );
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Malformed JSON' }, { status: 400 });
  }

  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  if (parsed.data.approve !== true) {
    return NextResponse.json(
      {
        error: 'APPROVAL_REQUIRED',
        message: 'Tickets are not created until you explicitly approve.',
      },
      { status: 400 }
    );
  }

  const existing = await getMission(auth.organizationId, parsed.data.missionId);
  if (!existing) {
    return NextResponse.json({ error: 'Mission not found' }, { status: 404 });
  }

  if (!existing.linearProjectId) {
    return NextResponse.json(
      {
        error: 'PROJECT_REQUIRED',
        message: 'Select a Linear project before approving tickets.',
      },
      { status: 400 }
    );
  }

  let drafts: MissionDraftTicket[] = existing.draftTickets;
  if (parsed.data.drafts?.length) {
    const byId = new Map(drafts.map(d => [d.localId, d]));
    for (const patch of parsed.data.drafts) {
      const cur = byId.get(patch.localId);
      if (!cur) continue;
      if (patch.remove) {
        byId.delete(patch.localId);
        continue;
      }
      byId.set(patch.localId, {
        ...cur,
        title: patch.title ?? cur.title,
        description: patch.description ?? cur.description,
        acceptanceCriteria: patch.acceptanceCriteria ?? cur.acceptanceCriteria,
        technicalNotes: patch.technicalNotes ?? cur.technicalNotes,
        suggestedFiles: patch.suggestedFiles ?? cur.suggestedFiles,
        estimateHours: patch.estimateHours ?? cur.estimateHours,
        labels: patch.labels ?? cur.labels,
      });
    }
    drafts = Array.from(byId.values())
      .sort((a, b) => a.order - b.order)
      .map((d, i) => ({ ...d, order: i }));
  }

  if (drafts.length === 0) {
    return NextResponse.json(
      { error: 'NO_DRAFTS', message: 'Approve at least one draft ticket.' },
      { status: 400 }
    );
  }

  try {
    const created = await createLinearIssuesFromDrafts({
      projectId: existing.linearProjectId,
      goal: existing.goal,
      drafts,
    });

    const mission = await updateMission(
      auth.organizationId,
      parsed.data.missionId,
      {
        draftTickets: drafts,
        createdTickets: created.map(c => ({
          ...c,
          status: 'approved' as const,
        })),
        approvedAt: new Date().toISOString(),
        stage: 'coming_soon',
      }
    );

    return NextResponse.json({ mission, tickets: created });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'LINEAR_ERROR';
    return NextResponse.json(
      {
        error: msg,
        message: 'Failed to create Linear tickets after approval.',
      },
      { status: 502 }
    );
  }
}
