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
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { GitBranch, Plus, Brain, Play, Layers } from '@/components/icons';
import {
  useWorkflowExecutions,
  type WorkflowExecution,
  type WorkflowExecutionWithSteps,
  type WorkflowTemplate,
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

const ALLOWED_PLANS = [
  'pro',
  'growth',
  'scale',
  'professional',
  'business',
  'custom',
];

// ---------------------------------------------------------------------------
// WorkflowTemplatesGrid — template selection section above executions
// ---------------------------------------------------------------------------

interface WorkflowTemplatesGridProps {
  templates: WorkflowTemplate[];
  isLoading: boolean;
  error: Error | undefined;
  onUseTemplate: (template: WorkflowTemplate) => void;
}

function TemplateSkeleton() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {[1, 2, 3].map(i => (
        <div
          key={i}
          className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-2 animate-pulse"
        >
          <div className="h-4 w-2/3 rounded bg-white/10" />
          <div className="h-3 w-full rounded bg-white/5" />
          <div className="h-3 w-4/5 rounded bg-white/5" />
          <div className="h-7 w-28 rounded-lg bg-white/10 mt-3" />
        </div>
      ))}
    </div>
  );
}

function WorkflowTemplatesGrid({
  templates,
  isLoading,
  error,
  onUseTemplate,
}: WorkflowTemplatesGridProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Layers className="h-4 w-4 text-[#FF6B35]" />
        <h2 className="text-sm font-semibold text-white">Templates</h2>
        <span className="text-xs text-white/40">
          — select one to start a workflow
        </span>
      </div>

      {isLoading && <TemplateSkeleton />}

      {error && !isLoading && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3">
          <p className="text-xs text-red-400">
            Could not load templates. Please refresh and try again.
          </p>
        </div>
      )}

      {!isLoading && !error && templates.length === 0 && (
        <Card className="bg-white/[0.02] border-white/10">
          <CardContent className="flex flex-col items-center py-8 gap-2">
            <Layers className="h-7 w-7 text-white/60" />
            <p className="text-sm text-white/50">No templates available yet</p>
            <p className="text-xs text-white/60 text-center max-w-xs">
              Create a template to streamline your workflow automation.
            </p>
          </CardContent>
        </Card>
      )}

      {!isLoading && !error && templates.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map(tpl => {
            const stepCount = Array.isArray(tpl.steps)
              ? (tpl.steps as unknown[]).length
              : typeof tpl.steps === 'object' && tpl.steps !== null
                ? Object.keys(tpl.steps as object).length
                : 0;

            return (
              <div
                key={tpl.id}
                className="group rounded-xl border border-white/10 bg-white/[0.02] p-4 flex flex-col gap-2 hover:border-[#FF6B35]/30 hover:bg-white/[0.04] transition-all"
              >
                <h3 className="text-sm font-semibold text-white truncate">
                  {tpl.name}
                </h3>
                {tpl.description && (
                  <p className="text-xs text-white/50 line-clamp-2 leading-relaxed">
                    {tpl.description}
                  </p>
                )}
                <div className="flex items-center justify-between mt-auto pt-2">
                  {stepCount > 0 && (
                    <span className="text-[10px] text-white/60">
                      {stepCount} {stepCount === 1 ? 'step' : 'steps'}
                    </span>
                  )}
                  <Button
                    size="sm"
                    onClick={() => onUseTemplate(tpl)}
                    className="gradient-primary text-white h-7 px-3 text-xs ml-auto gap-1"
                  >
                    <Play className="h-3 w-3" />
                    Use Template
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Fetcher for single execution detail (with steps)
// ---------------------------------------------------------------------------

async function fetchExecution(
  url: string
): Promise<{ execution: WorkflowExecutionWithSteps }> {
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
      {[1, 2, 3].map(i => (
        <div
          key={i}
          className="h-24 rounded-xl border border-white/10 bg-white/5 animate-pulse"
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Template fetcher (used for both the templates grid and the Intelligence tab)
// ---------------------------------------------------------------------------

async function fetchTemplates(
  url: string
): Promise<{ templates: WorkflowTemplate[] }> {
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

  // Pre-selected template (set when user clicks "Use Template" in the grid)
  const [dialogTemplate, setDialogTemplate] = useState<WorkflowTemplate | null>(
    null
  );

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
    ? executions.filter(e => e.status === filterStatus)
    : executions;

  // Selected execution id
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Performance tab: selected template id
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(
    null
  );

  // Load templates — used both for the template grid and the intelligence panel
  const {
    data: templatesData,
    isLoading: templatesLoading,
    error: templatesError,
  } = useSWR<{ templates: WorkflowTemplate[] }>(
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
    setDialogTemplate(null);
    mutate();
    setSelectedId(exec.id);
  }

  function handleUseTemplate(template: WorkflowTemplate) {
    setDialogTemplate(template);
    setDialogOpen(true);
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
          <TabsTrigger
            value="executions"
            className="text-xs data-[state=active]:bg-white/10"
          >
            Executions
          </TabsTrigger>
          <TabsTrigger
            value="performance"
            className="text-xs data-[state=active]:bg-white/10 flex items-center gap-1"
          >
            <Brain className="h-3 w-3" />
            Performance
          </TabsTrigger>
        </TabsList>

        {/* Executions tab */}
        <TabsContent value="executions" className="mt-4 space-y-6">
          {/* Template selection grid — always shown above executions */}
          <WorkflowTemplatesGrid
            templates={templates}
            isLoading={templatesLoading}
            error={templatesError}
            onUseTemplate={handleUseTemplate}
          />

          {/* Execution list / empty state */}
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
                selectedExecution
                  ? 'grid-cols-1 lg:grid-cols-[1fr_2fr]'
                  : 'grid-cols-1'
              )}
            >
              {/* Left: execution list */}
              <div className="space-y-2">
                {filterStatus && (
                  <p className="text-xs text-[#FF9A6C] bg-[#FF6B35]/10 border border-[#FF6B35]/20 rounded-lg px-3 py-1.5">
                    Showing: <strong>{filterStatus.replace('_', ' ')}</strong>{' '}
                    executions
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
                <Brain className="h-8 w-8 text-white/50" />
                <p className="text-sm text-white/50">No templates available</p>
                <p className="text-xs text-white/50">
                  Create workflow templates to track performance.
                </p>
              </div>
            ) : (
              <>
                {/* Template selector */}
                <div className="flex flex-wrap gap-2">
                  {templates.map(t => (
                    <button
                      key={t.id}
                      onClick={() =>
                        setSelectedTemplateId(
                          t.id === selectedTemplateId ? null : t.id
                        )
                      }
                      className={cn(
                        'text-xs px-3 py-1.5 rounded-full border transition-colours',
                        t.id === selectedTemplateId
                          ? 'bg-[#FF6B35]/20 text-[#FFD60A] border-[#FF6B35]/30'
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
                  <p className="text-xs text-white/50 py-4">
                    Select a template to view performance analysis.
                  </p>
                )}
              </>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* New Workflow Dialog */}
      <NewWorkflowDialog
        open={dialogOpen}
        onOpenChange={open => {
          setDialogOpen(open);
          if (!open) setDialogTemplate(null);
        }}
        onCreated={handleCreated}
        preSelectedTemplate={dialogTemplate}
      />
    </div>
  );
}
