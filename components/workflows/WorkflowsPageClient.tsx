'use client';

/**
 * WorkflowsPageClient — Client component for the /dashboard/workflows page.
 * Manages polling, selection, and dialog state.
 * Reads ?action=new and ?filter=waiting_approval query params.
 * Phase 65: Added Performance tab with IntelligencePanel.
 */

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { PageHeader } from '@/components/dashboard/page-header';
import { DashboardEmptyState } from '@/components/dashboard/empty-state';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { GitBranch, Plus, Brain } from '@/components/icons';
import {
  useWorkflowExecutions,
  type WorkflowExecution,
  type WorkflowExecutionWithSteps,
} from '@/lib/workflow/hooks/use-workflow-executions';
import { useUser } from '@/hooks/use-user';
import { useSubscription } from '@/hooks/useSubscription';
import { UpgradePrompt } from '@/components/billing/UpgradePrompt';
import { ExecutionList } from './ExecutionList';
import { ExecutionDetail } from './ExecutionDetail';
import { NewWorkflowDialog } from './NewWorkflowDialog';
import { ParallelExecutionWidget } from './ParallelExecutionWidget';
import { IntelligencePanel } from './IntelligencePanel';
import useSWR from 'swr';
import { cn } from '@/lib/utils';

const ALLOWED_PLANS = ['pro', 'growth', 'scale', 'professional', 'business', 'custom'];

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
// Template selector for Intelligence tab
// ---------------------------------------------------------------------------

interface Template {
  id: string;
  name: string;
}

async function fetchTemplates(url: string): Promise<{ templates: Template[] }> {
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) throw new Error('Failed to fetch templates');
  return res.json();
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function WorkflowsPageClient() {
  const searchParams = useSearchParams();
  const { user } = useUser();
  const orgId = user?.organizationId ?? user?.activeOrganizationId ?? null;
  const { subscription, isLoading: subscriptionLoading } = useSubscription();
  const hasAccess = subscription && ALLOWED_PLANS.includes(subscription.plan);

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

  // Performance tab: selected template id
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);

  // Load templates for intelligence panel
  const { data: templatesData } = useSWR<{ templates: Template[] }>(
    '/api/workflows/templates',
    fetchTemplates
  );
  const templates = templatesData?.templates ?? [];

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

  // Gate: show upgrade prompt for free-plan users
  if (!subscriptionLoading && !hasAccess) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Workflows"
          description="Monitor and manage AI workflow executions."
        />
        <div className="container py-8">
          <UpgradePrompt feature="Multi-step Workflows" />
        </div>
      </div>
    );
  }

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

      {/* Tabs: Executions | Performance */}
      <Tabs defaultValue="executions">
        <TabsList className="bg-white/5 border border-white/10">
          <TabsTrigger value="executions" className="text-xs data-[state=active]:bg-white/10">
            Executions
          </TabsTrigger>
          <TabsTrigger value="performance" className="text-xs data-[state=active]:bg-white/10 flex items-center gap-1">
            <Brain className="h-3 w-3" />
            Performance
          </TabsTrigger>
        </TabsList>

        {/* Executions tab */}
        <TabsContent value="executions" className="mt-4">
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
        </TabsContent>

        {/* Performance tab */}
        <TabsContent value="performance" className="mt-4">
          <div className="space-y-4">
            {templates.length === 0 ? (
              <div className="flex flex-col items-center py-12 space-y-3">
                <Brain className="h-8 w-8 text-white/20" />
                <p className="text-sm text-white/50">No templates available</p>
                <p className="text-xs text-white/30">Create workflow templates to track performance.</p>
              </div>
            ) : (
              <>
                {/* Template selector */}
                <div className="flex flex-wrap gap-2">
                  {templates.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setSelectedTemplateId(t.id === selectedTemplateId ? null : t.id)}
                      className={cn(
                        'text-xs px-3 py-1.5 rounded-full border transition-colours',
                        t.id === selectedTemplateId
                          ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30'
                          : 'bg-white/5 text-white/50 border-white/10 hover:border-white/20'
                      )}
                    >
                      {t.name}
                    </button>
                  ))}
                </div>

                {selectedTemplateId ? (
                  <IntelligencePanel templateId={selectedTemplateId} />
                ) : (
                  <p className="text-xs text-white/30 py-4">Select a template to view performance analysis.</p>
                )}
              </>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* New Workflow Dialog */}
      <NewWorkflowDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={handleCreated}
      />
    </div>
  );
}
