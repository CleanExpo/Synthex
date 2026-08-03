import type {
  IntentScapeCreatedWorkspace,
  IntentScapeWorkspaceListItem,
  IntentScapeWorkspaceSnapshot,
  IntentScapeWorkPacket,
} from './types';

interface ApiErrorBody {
  error?: string;
  details?: Record<string, string[]>;
}

export class IntentScapeApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly details?: Record<string, string[]>
  ) {
    super(message);
    this.name = 'IntentScapeApiError';
  }
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    credentials: 'include',
    headers: {
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  });

  const body = (await response.json().catch(() => ({}))) as T & ApiErrorBody;
  if (!response.ok) {
    throw new IntentScapeApiError(
      body.error ?? 'IntentScape could not complete this step.',
      response.status,
      body.details
    );
  }
  return body;
}

export const intentScapeApi = {
  async listWorkspaces(): Promise<IntentScapeWorkspaceListItem[]> {
    const body = await requestJson<{
      workspaces: IntentScapeWorkspaceListItem[];
    }>('/api/intentscape/workspaces');
    return body.workspaces;
  },

  async createWorkspace(input: {
    title: string;
    originSignal: string;
    retentionClass?: 'standard' | 'prospect' | 'legal_hold';
  }): Promise<IntentScapeCreatedWorkspace> {
    const body = await requestJson<{
      workspace: IntentScapeCreatedWorkspace;
    }>('/api/intentscape/workspaces', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    return body.workspace;
  },

  async getWorkspace(id: string): Promise<IntentScapeWorkspaceSnapshot> {
    const body = await requestJson<{
      snapshot: IntentScapeWorkspaceSnapshot;
    }>(`/api/intentscape/workspaces/${encodeURIComponent(id)}`);
    return body.snapshot;
  },

  async addSignals(
    id: string,
    input: {
      expectedContextVersion: number;
      signals: Array<{
        kind:
          | 'website'
          | 'social-page'
          | 'product-page'
          | 'competitor-page'
          | 'document'
          | 'note'
          | 'constraint'
          | 'capability'
          | 'prior-attempt';
        label: string;
        content: string;
        sourceUrl?: string;
        evidenceState: 'opinion' | 'assumption';
        provenance?: string;
      }>;
      contradictions: string[];
      unknowns: string[];
    }
  ): Promise<void> {
    await requestJson(
      `/api/intentscape/workspaces/${encodeURIComponent(id)}/signals`,
      {
        method: 'POST',
        body: JSON.stringify(input),
      }
    );
  },

  async expandVision(id: string): Promise<void> {
    await requestJson(
      `/api/intentscape/workspaces/${encodeURIComponent(id)}/expand`,
      {
        method: 'POST',
      }
    );
  },

  async approveGoal(
    id: string,
    input: {
      hypothesisId: string;
      hypothesisVersion: number;
      primaryStakeholder: string;
      acceptanceCriteria: string[];
      exclusions: string[];
      authorityBoundaries: string[];
    }
  ): Promise<void> {
    await requestJson(
      `/api/intentscape/workspaces/${encodeURIComponent(id)}/approve-goal`,
      { method: 'POST', body: JSON.stringify(input) }
    );
  },

  async buildWorkPacket(
    id: string,
    goalContractId: string
  ): Promise<IntentScapeWorkPacket> {
    const body = await requestJson<{ workPacket: IntentScapeWorkPacket }>(
      `/api/intentscape/workspaces/${encodeURIComponent(id)}/work-packet`,
      { method: 'POST', body: JSON.stringify({ goalContractId }) }
    );
    return body.workPacket;
  },
};
