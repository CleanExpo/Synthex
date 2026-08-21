/**
 * Persist Mission Control missions on Organization.settings.missionControl
 * — avoids a Prisma migration for Scene 1.
 */

import { randomUUID } from 'crypto';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import type { MissionRecord, MissionStage } from './types';

type OrgSettings = Record<string, unknown> & {
  missionControl?: {
    missions?: MissionRecord[];
    lastRepoFullName?: string | null;
  };
};

function asSettings(raw: unknown): OrgSettings {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as OrgSettings;
  }
  return {};
}

export async function listMissions(
  organizationId: string
): Promise<MissionRecord[]> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { settings: true },
  });
  const settings = asSettings(org?.settings);
  return settings.missionControl?.missions ?? [];
}

export async function getMission(
  organizationId: string,
  missionId: string
): Promise<MissionRecord | null> {
  const missions = await listMissions(organizationId);
  return missions.find(m => m.id === missionId) ?? null;
}

export async function getLastRepoFullName(
  organizationId: string
): Promise<string | null> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { settings: true },
  });
  const settings = asSettings(org?.settings);
  return settings.missionControl?.lastRepoFullName ?? null;
}

async function writeMissionControl(
  organizationId: string,
  patch: {
    missions?: MissionRecord[];
    lastRepoFullName?: string | null;
  }
): Promise<void> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { settings: true },
  });
  const settings = asSettings(org?.settings);
  const prev = settings.missionControl ?? {};
  const next = {
    ...settings,
    missionControl: {
      ...prev,
      ...(patch.missions !== undefined ? { missions: patch.missions } : {}),
      ...(patch.lastRepoFullName !== undefined
        ? { lastRepoFullName: patch.lastRepoFullName }
        : {}),
    },
  };
  await prisma.organization.update({
    where: { id: organizationId },
    data: { settings: next as Prisma.InputJsonValue },
  });
}

export async function createMission(input: {
  organizationId: string;
  goal: string;
  acceptanceCriteria: string;
}): Promise<MissionRecord> {
  const now = new Date().toISOString();
  const mission: MissionRecord = {
    id: randomUUID(),
    organizationId: input.organizationId,
    goal: input.goal.trim(),
    acceptanceCriteria: input.acceptanceCriteria.trim(),
    repoFullName: null,
    repoAnalysis: null,
    linearProjectId: null,
    linearProjectName: null,
    draftTickets: [],
    createdTickets: [],
    stage: 'repo',
    approvedAt: null,
    createdAt: now,
    updatedAt: now,
  };
  const missions = await listMissions(input.organizationId);
  await writeMissionControl(input.organizationId, {
    missions: [mission, ...missions].slice(0, 50),
  });
  return mission;
}

export async function updateMission(
  organizationId: string,
  missionId: string,
  patch: Partial<
    Omit<MissionRecord, 'id' | 'organizationId' | 'createdAt'>
  > & { stage?: MissionStage }
): Promise<MissionRecord> {
  const missions = await listMissions(organizationId);
  const idx = missions.findIndex(m => m.id === missionId);
  if (idx < 0) {
    throw new Error('MISSION_NOT_FOUND');
  }
  const updated: MissionRecord = {
    ...missions[idx],
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  missions[idx] = updated;
  const write: {
    missions: MissionRecord[];
    lastRepoFullName?: string | null;
  } = { missions };
  if (patch.repoFullName) {
    write.lastRepoFullName = patch.repoFullName;
  }
  await writeMissionControl(organizationId, write);
  return updated;
}
