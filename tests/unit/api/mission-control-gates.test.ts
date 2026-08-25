/**
 * Unit tests for Mission Control API gate behaviour (mocked deps).
 */

import { NextRequest } from 'next/server';

jest.mock('@/lib/mission-control/api-auth', () => ({
  requireMissionOrg: jest.fn(),
}));

jest.mock('@/lib/mission-control/mission-store', () => ({
  getMission: jest.fn(),
  updateMission: jest.fn(),
}));

jest.mock('@/lib/mission-control/draft-tickets', () => ({
  draftTicketsFromGoal: jest.fn(),
}));

jest.mock('@/lib/mission-control/linear-projects', () => ({
  createLinearIssuesFromDrafts: jest.fn(),
  listLinearProjects: jest.fn(),
}));

import { requireMissionOrg } from '@/lib/mission-control/api-auth';
import { getMission, updateMission } from '@/lib/mission-control/mission-store';
import { draftTicketsFromGoal } from '@/lib/mission-control/draft-tickets';
import { createLinearIssuesFromDrafts } from '@/lib/mission-control/linear-projects';
import { POST as draftPost } from '@/app/api/mission-control/draft-tickets/route';
import { POST as approvePost } from '@/app/api/mission-control/approve-tickets/route';

const orgAuth = {
  ok: true as const,
  userId: 'user-1',
  organizationId: 'org-1',
};

function jsonReq(url: string, body: unknown) {
  return new NextRequest(url, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('POST /api/mission-control/draft-tickets', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (requireMissionOrg as jest.Mock).mockResolvedValue(orgAuth);
  });

  it('blocks drafting when no Linear project is selected', async () => {
    (getMission as jest.Mock).mockResolvedValue({
      id: '11111111-1111-4111-8111-111111111111',
      linearProjectId: null,
      linearProjectName: null,
      goal: 'Ship Mission Control',
      acceptanceCriteria: '',
      repoAnalysis: null,
    });

    const res = await draftPost(
      jsonReq('http://localhost/api/mission-control/draft-tickets', {
        missionId: '11111111-1111-4111-8111-111111111111',
      })
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('PROJECT_REQUIRED');
    expect(draftTicketsFromGoal).not.toHaveBeenCalled();
  });

  it('drafts when project is selected', async () => {
    (getMission as jest.Mock).mockResolvedValue({
      id: '11111111-1111-4111-8111-111111111111',
      linearProjectId: 'proj-1',
      linearProjectName: 'Mission Control',
      goal: 'Ship Mission Control',
      acceptanceCriteria: 'Gates work',
      repoAnalysis: null,
    });
    (draftTicketsFromGoal as jest.Mock).mockResolvedValue({
      tickets: [
        {
          localId: 'a',
          title: 'Ticket A',
          description: 'Do the thing properly',
          acceptanceCriteria: ['done'],
          technicalNotes: '',
          suggestedFiles: [],
          labels: [],
          dependsOnLocalIds: [],
          order: 0,
        },
      ],
      source: 'heuristic',
    });
    (updateMission as jest.Mock).mockImplementation(
      async (_o: string, _id: string, patch: Record<string, unknown>) => ({
        id: '11111111-1111-4111-8111-111111111111',
        ...patch,
      })
    );

    const res = await draftPost(
      jsonReq('http://localhost/api/mission-control/draft-tickets', {
        missionId: '11111111-1111-4111-8111-111111111111',
      })
    );
    expect(res.status).toBe(200);
    expect(draftTicketsFromGoal).toHaveBeenCalled();
  });
});

describe('POST /api/mission-control/approve-tickets', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (requireMissionOrg as jest.Mock).mockResolvedValue(orgAuth);
  });

  it('requires explicit approve: true before creating Linear issues', async () => {
    const res = await approvePost(
      jsonReq('http://localhost/api/mission-control/approve-tickets', {
        missionId: '11111111-1111-4111-8111-111111111111',
        approve: false,
      })
    );
    // zod literal(true) → 400 validation
    expect(res.status).toBe(400);
    expect(createLinearIssuesFromDrafts).not.toHaveBeenCalled();
  });

  it('creates Linear issues only after approval with project + drafts', async () => {
    (getMission as jest.Mock).mockResolvedValue({
      id: '11111111-1111-4111-8111-111111111111',
      linearProjectId: 'proj-1',
      goal: 'Ship it',
      draftTickets: [
        {
          localId: 'a',
          title: 'Ticket A',
          description: 'Do the thing properly',
          acceptanceCriteria: ['done'],
          technicalNotes: '',
          suggestedFiles: [],
          labels: [],
          dependsOnLocalIds: [],
          order: 0,
        },
      ],
    });
    (createLinearIssuesFromDrafts as jest.Mock).mockResolvedValue([
      {
        localId: 'a',
        linearId: 'lin-1',
        identifier: 'SYN-2000',
        url: 'https://linear.app/x/issue/SYN-2000',
        title: 'Ticket A',
      },
    ]);
    (updateMission as jest.Mock).mockImplementation(
      async (_o: string, _id: string, patch: Record<string, unknown>) => ({
        id: '11111111-1111-4111-8111-111111111111',
        stage: 'coming_soon',
        ...patch,
      })
    );

    const res = await approvePost(
      jsonReq('http://localhost/api/mission-control/approve-tickets', {
        missionId: '11111111-1111-4111-8111-111111111111',
        approve: true,
      })
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(createLinearIssuesFromDrafts).toHaveBeenCalled();
    expect(data.mission.stage).toBe('coming_soon');
  });
});
