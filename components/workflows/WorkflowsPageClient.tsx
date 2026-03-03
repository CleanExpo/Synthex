'use client';

/**
 * WorkflowsPageClient — Client component for the /dashboard/workflows page.
 * Manages polling, selection, and dialog state.
 * Reads ?action=new and ?filter=waiting_approval query params.
 */

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { PageHeader } from '@/components/dashboard/page-header';
import { DashboardEmptyState } from '@/components/dashboard/empty-state';
import { Button } from '@/components/ui/button';
import { GitBranch, Plus } from '@/components/icons';
import {
  useWorkflowExecutions,
  type WorkflowExecution,
  type WorkflowExecutionWithSteps,
} from '@/lib/workflow/hooks/use-workflow-executions';
import { useUser } from '@/hooks/use-user';
import { ExecutionList } from './ExecutionList';
import { ExecutionDetail } from './ExecutionDetail';
import { NewWorkflowDialog } from './NewWorkflowDialog';
import { ParallelExecutionWidget } from './ParallelExecutionWidget';
import useSWR from 'swr';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Fetcher for single execution detail (with steps)
// ---------------------------------------------------------------------------

async function fetchExecution(url: string): Promise<{ execution: WorkflowExecutionWithSteps }> {
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) throw new Error(`Failed to fetch execution (${res.status})`);
  return res.json();
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function ExecutionSkeleton() {
  return (
    <div className="space-y-2">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="h-24 rounded-xl border border-white/10 bg-white/5 animate-pulse"
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function WorkflowsPageClient() {
  const searchParams = useSearchParams();
  const { user } = useUser();
  const orgId = user?.organizationId ?? user?.activeOrganizationId ?? null;

  // Dialog open state — also triggered by ?action=new from command palette
  const [dialogOpen, setDialogOpen] = useState(false);

  // Pre-open dialog if ?action=new
  useEffect(() => {
    if (searchParams?.get('action') === 'new') {
      setDialogOpen(true);
    }
  }, [searchParams]);

  // Status filter from ?filter=waiting_approval
  const filterStatus = searchParams?.get('filter') ?? undefined;

  const { executions, isLoading, mutate } = useWorkflowExecutions(orgId);

  // Filter by status if query param is present
  const filteredExecutions = filterStatus
    ? executions.filter((e) => e.status === filterStatus)
    : executions;

  // Selected execution id
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Fetch detail for selected execution (with steps)
  const { data: detailData, mutate: mutateDetail } = useSWR<{
    execution: WorkflowExecutionWithSteps;
  }>(
    selectedId ? `/api/workflows/executions/${selectedId}` : null,
    fetchExecution,
    {
      refreshInterval(latest) {
        if (!latest?.execution) return 3000;
        const terminal = ['completed', 'failed', 'cancelled'];
        return terminal.includes(latest.execution.status) ? 0 : 3000;
      },
      revalidateOnFocus: true,
    }
  );

  const selectedExecution = detailData?.execution ?? null;

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------

  function handleSelect(exec: WorkflowExecution) {
    setSelectedId(exec.id === selectedId ? null : exec.id);
  }

  function handleClose() {
    setSelectedId(null);
  }

  function handleRefresh() {
    mutate();
    mutateDetail();
  }

  function handleCreated(exec: WorkflowExecution) {
    setDialogOpen(false);
    mutate();
    setSelectedId(exec.id);
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  const hasExecutions = filteredExecutions.length > 0;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <PageHeader
        title="Workflows"
        description="Monitor and manage AI workflow executions."
        actions={
          <Button
            onClick={() => setDialogOpen(true)}
            className="gradient-primary text-white"
            size="sm"
          >
            <Plus className="h-4 w-4 mr-1.5" />
            New Workflow
          </Button>
        }
      />

      {/* Parallel execution concurrency stats — shown when >1 execution is active */}
      <ParallelExecutionWidget executions={executions} />

      {/* Main content */}
      {isLoading ? (
        <ExecutionSkeleton />
      ) : !hasExecutions ? (
        <DashboardEmptyState
          icon={GitBranch}
          title="No workflows yet"
          description="Start your first AI workflow to automate content creation and publishing."
          action={{
            label: 'Start Workflow',
            onClick: () => setDialogOpen(true),
          }}
        />
      ) : (
        <div
          className={cn(
            'grid gap-4',
            selectedExecution ? 'grid-cols-1 lg:grid-cols-[1fr_2fr]' : 'grid-cols-1'
          )}
        >
          {/* Left: execution list */}
          <div className="space-y-2">
            {filterStatus && (
              <p className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-1.5">
                Showing: <strong>{filterStatus.replace('_', ' ')}</strong> executions
              </p>
            )}
            <ExecutionList
              executions={filteredExecutions}
              onSelect={handleSelect}
              selectedId={selectedId}
            />
          </div>

          {/* Right: detail panel */}
          {selectedExecution && (
            <ExecutionDetail
              execution={selectedExecution}
              onClose={handleClose}
              onRefresh={handleRefresh}
              className="h-[calc(100vh-12rem)] sticky top-4"
            />
          )}
        </div>
      )}

      {/* New Workflow Dialog */}
      <NewWorkflowDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={handleCreated}
      />
    </div>
  );
}
