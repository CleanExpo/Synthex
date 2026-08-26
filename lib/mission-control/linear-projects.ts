/**
 * Linear project + issue helpers for Mission Control (GraphQL).
 * Uses LINEAR_API_KEY — same as scripts/create-linear-task.js.
 */

import type { LinearProjectSummary, MissionDraftTicket } from './types';

const LINEAR_URL = 'https://api.linear.app/graphql';

type GqlResult<T> = { data?: T; errors?: Array<{ message: string }> };

async function linearGql<T>(
  query: string,
  variables?: Record<string, unknown>
): Promise<T> {
  const apiKey = process.env.LINEAR_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('LINEAR_API_KEY_REQUIRED');
  }
  const res = await fetch(LINEAR_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: apiKey,
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = (await res.json()) as GqlResult<T>;
  if (!res.ok || json.errors?.length) {
    const msg = json.errors?.[0]?.message ?? `HTTP ${res.status}`;
    throw new Error(`LINEAR_ERROR:${msg}`);
  }
  if (!json.data) {
    throw new Error('LINEAR_ERROR:empty response');
  }
  return json.data;
}

export function isLinearConfigured(): boolean {
  return Boolean(process.env.LINEAR_API_KEY?.trim());
}

export async function listLinearProjects(): Promise<LinearProjectSummary[]> {
  const data = await linearGql<{
    projects: {
      nodes: Array<{
        id: string;
        name: string;
        description?: string | null;
        state: string;
        url?: string | null;
      }>;
    };
  }>(`
    query MissionProjects {
      projects(first: 50, orderBy: updatedAt) {
        nodes { id name description state url }
      }
    }
  `);
  return data.projects.nodes.map(p => ({
    id: p.id,
    name: p.name,
    description: p.description ?? null,
    state: p.state,
    url: p.url ?? null,
  }));
}

export async function resolveDefaultTeamId(): Promise<string> {
  const preferred = process.env.HERMES_LINEAR_TEAM_ID?.trim();
  if (preferred) return preferred;

  const data = await linearGql<{
    teams: { nodes: Array<{ id: string; key: string }> };
  }>(`
    query MissionTeams {
      teams(first: 10) {
        nodes { id key }
      }
    }
  `);
  const team =
    data.teams.nodes.find(t => t.key === 'SYN') ?? data.teams.nodes[0];
  if (!team) {
    throw new Error('LINEAR_NO_TEAM');
  }
  return team.id;
}

export async function createLinearProject(input: {
  name: string;
  description?: string;
}): Promise<LinearProjectSummary> {
  const teamId = await resolveDefaultTeamId();
  const data = await linearGql<{
    projectCreate: {
      success: boolean;
      project: {
        id: string;
        name: string;
        description?: string | null;
        state: string;
        url?: string | null;
      } | null;
    };
  }>(
    `
    mutation CreateMissionProject($input: ProjectCreateInput!) {
      projectCreate(input: $input) {
        success
        project { id name description state url }
      }
    }
  `,
    {
      input: {
        name: input.name.trim(),
        description: input.description?.trim() || undefined,
        teamIds: [teamId],
      },
    }
  );

  if (!data.projectCreate.success || !data.projectCreate.project) {
    throw new Error('LINEAR_PROJECT_CREATE_FAILED');
  }
  const p = data.projectCreate.project;
  return {
    id: p.id,
    name: p.name,
    description: p.description ?? null,
    state: p.state,
    url: p.url ?? null,
  };
}

function formatIssueDescription(
  ticket: MissionDraftTicket,
  goal: string
): string {
  const ac =
    ticket.acceptanceCriteria.length > 0
      ? ticket.acceptanceCriteria.map(c => `- [ ] ${c}`).join('\n')
      : '- [ ] Acceptance criteria TBD';
  const files =
    ticket.suggestedFiles.length > 0
      ? ticket.suggestedFiles.map(f => `- \`${f}\``).join('\n')
      : '- (none suggested)';

  return [
    `## Goal`,
    goal,
    '',
    `## Description`,
    ticket.description,
    '',
    `## Acceptance criteria`,
    ac,
    '',
    `## Technical notes`,
    ticket.technicalNotes || '_None_',
    '',
    `## Suggested files / areas`,
    files,
    '',
    ticket.estimateHours ? `**Estimate:** ~${ticket.estimateHours}h` : '',
    '',
    `_Created via Synthex Mission Control_`,
  ]
    .filter(Boolean)
    .join('\n');
}

export async function createLinearIssuesFromDrafts(input: {
  projectId: string;
  goal: string;
  drafts: MissionDraftTicket[];
}): Promise<
  Array<{
    localId: string;
    linearId: string;
    identifier: string;
    url: string;
    title: string;
  }>
> {
  const teamId = await resolveDefaultTeamId();
  const sorted = [...input.drafts].sort((a, b) => a.order - b.order);
  const created: Array<{
    localId: string;
    linearId: string;
    identifier: string;
    url: string;
    title: string;
  }> = [];

  for (const draft of sorted) {
    const data = await linearGql<{
      issueCreate: {
        success: boolean;
        issue: {
          id: string;
          identifier: string;
          url: string;
          title: string;
        } | null;
      };
    }>(
      `
      mutation CreateMissionIssue($input: IssueCreateInput!) {
        issueCreate(input: $input) {
          success
          issue { id identifier url title }
        }
      }
    `,
      {
        input: {
          teamId,
          projectId: input.projectId,
          title: draft.title.slice(0, 200),
          description: formatIssueDescription(draft, input.goal),
          labelIds: undefined,
        },
      }
    );

    if (!data.issueCreate.success || !data.issueCreate.issue) {
      throw new Error(`LINEAR_ISSUE_CREATE_FAILED:${draft.localId}`);
    }
    const issue = data.issueCreate.issue;
    created.push({
      localId: draft.localId,
      linearId: issue.id,
      identifier: issue.identifier,
      url: issue.url,
      title: issue.title,
    });
  }

  return created;
}
