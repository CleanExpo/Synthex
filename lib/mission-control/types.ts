/**
 * Mission Control domain types — Goal → Linear tickets pipeline (Scene 1).
 * Scene 2 (code / tests / PR) is scaffold-only Coming soon.
 */

export type MissionStage =
  | 'goal'
  | 'repo'
  | 'project'
  | 'draft'
  | 'approval'
  | 'tickets'
  | 'coming_soon';

export type MissionTicketStatus =
  | 'draft'
  | 'approved'
  | 'in_progress'
  | 'in_review'
  | 'done';

export interface MissionDraftTicket {
  localId: string;
  title: string;
  description: string;
  acceptanceCriteria: string[];
  technicalNotes: string;
  suggestedFiles: string[];
  estimateHours?: number;
  labels: string[];
  dependsOnLocalIds: string[];
  order: number;
}

export interface MissionCreatedTicket {
  localId: string;
  linearId: string;
  identifier: string;
  url: string;
  title: string;
  status: MissionTicketStatus;
}

export interface RepoAnalysisSummary {
  owner: string;
  repo: string;
  fullName: string;
  description: string | null;
  defaultBranch: string;
  language: string | null;
  topics: string[];
  topPaths: string[];
  recentPullRequests: Array<{
    number: number;
    title: string;
    mergedAt: string | null;
    state: string;
  }>;
  openIssueCount: number;
  analyzedAt: string;
}

export interface LinearProjectSummary {
  id: string;
  name: string;
  description: string | null;
  state: string;
  url: string | null;
}

export interface MissionRecord {
  id: string;
  organizationId: string;
  goal: string;
  acceptanceCriteria: string;
  repoFullName: string | null;
  repoAnalysis: RepoAnalysisSummary | null;
  linearProjectId: string | null;
  linearProjectName: string | null;
  draftTickets: MissionDraftTicket[];
  createdTickets: MissionCreatedTicket[];
  stage: MissionStage;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export const COMING_SOON_STAGES = [
  {
    key: 'code',
    label: 'Code',
    blurb: 'Agent build from approved tickets',
  },
  {
    key: 'tests',
    label: 'Tests',
    blurb: 'Verification gates before PR',
  },
  {
    key: 'pr',
    label: 'PR + CI',
    blurb: 'Open pull request and watch checks',
  },
  {
    key: 'deploy',
    label: 'Merge + deploy',
    blurb: 'Ship and reflect status here',
  },
  {
    key: 'roles',
    label: 'Role views',
    blurb: 'Owner / PM / Engineer mission lenses',
  },
] as const;
