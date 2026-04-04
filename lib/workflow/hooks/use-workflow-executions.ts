'use client';

/**
 * Workflow Execution Hooks — Phase 62-03
 * SWR-based polling hooks with dynamic refresh intervals.
 * Polls actively when executions are running; pauses when all terminal.
 */

import useSWR from 'swr';

// ---------------------------------------------------------------------------
// Types matching API response shape (mirrors Prisma models)
// ---------------------------------------------------------------------------

export interface WorkflowExecution {
  id: string;
  organizationId: string;
  workflowId: string | null;
  status: string; // WorkflowExecutionStatus
  title: string;
  triggerType: string;
  triggeredBy: string;
  currentStepIndex: number;
  totalSteps: number;
  inputData: unknown | null;
  outputData: unknown | null;
  errorMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StepExecution {
  id: string;
  workflowExecutionId: string;
  stepIndex: number;
  stepName: string;
  stepType: string; // 'ai' | 'approval' | 'action' | 'validation'
  status: string; // StepExecutionStatus
  inputData: unknown | null;
  outputData: unknown | null;
  confidenceScore: number | null;
  autoApproved: boolean;
  approvedBy: string | null;
  approvedAt: string | null;
  errorMessage: string | null;
  retryCount: number;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

export interface WorkflowExecutionWithSteps extends WorkflowExecution {
  stepExecutions: StepExecution[];
}

export interface WorkflowTemplate {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  steps: unknown;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Terminal status set — polling pauses when all executions are terminal
// ---------------------------------------------------------------------------

const TERMINAL_STATUSES = new Set(['completed', 'failed', 'cancelled']);

function isTerminal(status: string): boolean {
  return TERMINAL_STATUSES.has(status);
}

// ---------------------------------------------------------------------------
// Generic fetcher
// ---------------------------------------------------------------------------

async function fetcher<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) {
    const err = new Error(`API error ${res.status}`);
    throw err;
  }
  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// useWorkflowExecutions — polls list, pauses when all terminal
// ---------------------------------------------------------------------------

interface ExecutionsResponse {
  executions: WorkflowExecution[];
}

/**
 * Polls /api/workflows/executions every 5s when any execution is running.
 * Pauses polling when all executions are in a terminal state.
 */
export function useWorkflowExecutions(orgId: string | null | undefined) {
  const { data, error, isLoading, mutate } = useSWR<ExecutionsResponse>(
    orgId ? '/api/workflows/executions' : null,
    fetcher,
    {
      refreshInterval(latestData) {
        if (!latestData?.executions?.length) return 5000;
        const hasActive = latestData.executions.some(
          (e) => !isTerminal(e.status)
        );
        return hasActive ? 5000 : 0; // pause when all terminal
      },
      revalidateOnFocus: true,
      dedupingInterval: 2000,
    }
  );

  return {
    executions: data?.executions ?? [],
    isLoading,
    error,
    mutate,
  };
}

// ---------------------------------------------------------------------------
// useWorkflowExecution — polls single execution, pauses when terminal
// ---------------------------------------------------------------------------

interface SingleExecutionResponse {
  execution: WorkflowExecutionWithSteps;
}

/**
 * Polls /api/workflows/executions/[id] every 3s when running.
 * Pauses polling when the execution reaches a terminal state.
 */
export function useWorkflowExecution(id: string | null | undefined) {
  const { data, error, isLoading, mutate } = useSWR<SingleExecutionResponse>(
    id ? `/api/workflows/executions/${id}` : null,
    fetcher,
    {
      refreshInterval(latestData) {
        if (!latestData?.execution) return 3000;
        return isTerminal(latestData.execution.status) ? 0 : 3000;
      },
      revalidateOnFocus: true,
      dedupingInterval: 1000,
    }
  );

  return {
    execution: data?.execution ?? null,
    isLoading,
    error,
    mutate,
  };
}

// ---------------------------------------------------------------------------
// useWorkflowTemplates — one-shot fetch (templates rarely change)
// ---------------------------------------------------------------------------

interface TemplatesResponse {
  templates: WorkflowTemplate[];
}

export function useWorkflowTemplates() {
  const { data, error, isLoading } = useSWR<TemplatesResponse>(
    '/api/workflows/templates',
    fetcher,
    { revalidateOnFocus: false }
  );

  return {
    templates: data?.templates ?? [],
    isLoading,
    error,
  };
}
