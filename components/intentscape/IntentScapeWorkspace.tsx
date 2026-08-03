'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  Brain,
  Check,
  ChevronDown,
  Database,
  FileText,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Shield,
  Sparkles,
  Target,
} from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { DecisionDock } from './DecisionDock';
import { EvidenceBatchPanel, type EvidenceBatch } from './EvidenceBatchPanel';
import { intentScapeApi, IntentScapeApiError } from './api-client';
import {
  suggestExplorationTitle,
  WORKSPACE_STATE_LABELS,
} from './presentation';
import type {
  IntentScapeWorkspaceListItem,
  IntentScapeWorkspaceSnapshot,
  IntentScapeWorkPacket,
} from './types';
import { VisionCanvas } from './VisionCanvas';
import { NextActionGuide } from './NextActionGuide';

type BusyAction =
  | 'loading'
  | 'creating'
  | 'adding-context'
  | 'expanding'
  | 'approving'
  | 'building-packet'
  | null;

const EXPANSION_PHASES = [
  {
    label: 'Observe',
    detail: 'Separating the human signal from the situation around it',
  },
  {
    label: 'Think',
    detail: 'Applying seven fixed lenses and challenging the obvious frame',
  },
  {
    label: 'Research',
    detail: 'Building decision-changing branches and causal alternatives',
  },
  {
    label: 'Audit',
    detail: 'Independent evaluator checking anchoring and distinctness',
  },
] as const;

const JOURNEY = [
  {
    label: 'Context',
    detail: 'Situation captured',
    icon: Database,
  },
  {
    label: 'Vision',
    detail: 'Alternatives explored',
    icon: Brain,
  },
  {
    label: 'Decision',
    detail: 'Human-approved goal',
    icon: Target,
  },
  {
    label: 'Packet',
    detail: 'Governed hand-off',
    icon: FileText,
  },
] as const;

function errorMessage(error: unknown): string {
  if (error instanceof IntentScapeApiError) return error.message;
  if (error instanceof Error) return error.message;
  return 'IntentScape could not complete this step.';
}

export function IntentScapeWorkspace() {
  const [workspaces, setWorkspaces] = useState<IntentScapeWorkspaceListItem[]>(
    []
  );
  const [snapshot, setSnapshot] = useState<IntentScapeWorkspaceSnapshot | null>(
    null
  );
  const [workPacket, setWorkPacket] = useState<IntentScapeWorkPacket | null>(
    null
  );
  const [selectedHypothesisId, setSelectedHypothesisId] = useState<
    string | null
  >(null);
  const [busyAction, setBusyAction] = useState<BusyAction>('loading');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [expansionPhase, setExpansionPhase] = useState(0);

  const refreshList = useCallback(async () => {
    const next = await intentScapeApi.listWorkspaces();
    setWorkspaces(next);
    return next;
  }, []);

  const loadWorkspace = useCallback(async (id: string) => {
    setBusyAction('loading');
    setError(null);
    setNotice(null);
    setWorkPacket(null);
    try {
      const next = await intentScapeApi.getWorkspace(id);
      setSnapshot(next);
      setSelectedHypothesisId(
        next.goalContract?.hypothesisId ??
          next.acceptedVision?.visionMap.hypotheses[0]?.id ??
          null
      );
    } catch (loadError) {
      setError(errorMessage(loadError));
    } finally {
      setBusyAction(null);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const next = await intentScapeApi.listWorkspaces();
        if (cancelled) return;
        setWorkspaces(next);
        if (next[0]) {
          const firstSnapshot = await intentScapeApi.getWorkspace(next[0].id);
          if (cancelled) return;
          setSnapshot(firstSnapshot);
          setSelectedHypothesisId(
            firstSnapshot.goalContract?.hypothesisId ??
              firstSnapshot.acceptedVision?.visionMap.hypotheses[0]?.id ??
              null
          );
        } else {
          setShowCreate(true);
        }
      } catch (loadError) {
        if (!cancelled) setError(errorMessage(loadError));
      } finally {
        if (!cancelled) setBusyAction(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (busyAction !== 'expanding') {
      setExpansionPhase(0);
      return;
    }
    const timer = window.setInterval(() => {
      setExpansionPhase(current =>
        Math.min(current + 1, EXPANSION_PHASES.length - 1)
      );
    }, 2400);
    return () => window.clearInterval(timer);
  }, [busyAction]);

  const completedJourneySteps = useMemo(() => {
    if (!snapshot) return 0;
    if (workPacket) return 4;
    if (snapshot.goalContract) return 3;
    if (snapshot.acceptedVision) return 2;
    if (snapshot.contextField) return 1;
    return 0;
  }, [snapshot, workPacket]);

  async function refreshCurrent() {
    if (!snapshot) return;
    const next = await intentScapeApi.getWorkspace(snapshot.workspace.id);
    setSnapshot(next);
    await refreshList();
  }

  async function addEvidenceBatch(batch: EvidenceBatch) {
    if (!snapshot?.contextField) return;
    setBusyAction('adding-context');
    setError(null);
    setNotice(null);
    try {
      await intentScapeApi.addSignals(snapshot.workspace.id, {
        expectedContextVersion: snapshot.contextField.version,
        ...batch,
      });
      await refreshCurrent();
      setNotice(
        'Context Field updated. The next vision run will use this version.'
      );
    } catch (actionError) {
      setError(errorMessage(actionError));
      throw actionError;
    } finally {
      setBusyAction(null);
    }
  }

  async function expandVision() {
    if (!snapshot) return;
    setBusyAction('expanding');
    setError(null);
    setNotice(null);
    try {
      await intentScapeApi.expandVision(snapshot.workspace.id);
      const next = await intentScapeApi.getWorkspace(snapshot.workspace.id);
      setSnapshot(next);
      setSelectedHypothesisId(
        next.acceptedVision?.visionMap.hypotheses[0]?.id ?? null
      );
      await refreshList();
      setNotice(
        'Vision accepted by both gates. Your decision dock is ready for human review.'
      );
    } catch (actionError) {
      setError(errorMessage(actionError));
      try {
        await refreshCurrent();
      } catch {
        // Preserve the expansion error; a refresh failure is secondary.
      }
    } finally {
      setBusyAction(null);
    }
  }

  async function approveGoal(
    input: Parameters<typeof intentScapeApi.approveGoal>[1]
  ) {
    if (!snapshot) return;
    setBusyAction('approving');
    setError(null);
    setNotice(null);
    try {
      await intentScapeApi.approveGoal(snapshot.workspace.id, input);
      await refreshCurrent();
      setNotice(
        'Goal Contract approved and written to the private Markdown wiki.'
      );
    } catch (actionError) {
      setError(errorMessage(actionError));
      throw actionError;
    } finally {
      setBusyAction(null);
    }
  }

  async function buildWorkPacket() {
    if (!snapshot?.goalContract) return;
    setBusyAction('building-packet');
    setError(null);
    setNotice(null);
    try {
      const packet = await intentScapeApi.buildWorkPacket(
        snapshot.workspace.id,
        snapshot.goalContract.id
      );
      setWorkPacket(packet);
      await refreshCurrent();
      setNotice(
        'Governed Work Packet created. No external action has been taken.'
      );
    } catch (actionError) {
      setError(errorMessage(actionError));
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <div className="relative min-h-[calc(100vh-7rem)] pb-12 text-sx-text-primary">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-24 top-24 h-72 w-72 rounded-full bg-sx-intelligence/[0.07] blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute right-0 top-[34rem] h-80 w-80 rounded-full bg-sx-accent/[0.05] blur-3xl"
      />

      <header className="relative mb-5 overflow-hidden rounded-card border border-white/[0.08] bg-sx-bg-panel/95 px-5 py-6 shadow-[var(--sx-shadow-elevated)] backdrop-blur-xl md:px-7 md:py-7">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-sx-accent/70 to-transparent" />
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.25em] text-sx-intelligence">
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              Synthex / Vision expansion system
            </div>
            <h1 className="mt-3 text-balance font-[var(--font-space-grotesk)] text-3xl font-medium tracking-[-0.03em] text-sx-text-primary md:text-4xl">
              IntentScape
              <span className="ml-3 text-sx-text-muted">
                turn signals into vision
              </span>
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-sx-text-muted md:text-base md:leading-7">
              Capture the whole situation, let separate agents explore beyond
              the obvious request, then approve one evidence-backed direction
              before any work is allowed to begin.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {workspaces.length > 0 && (
              <label className="relative">
                <span className="sr-only">Select IntentScape workspace</span>
                <select
                  value={snapshot?.workspace.id ?? ''}
                  onChange={event => loadWorkspace(event.target.value)}
                  disabled={busyAction !== null}
                  className="min-h-11 appearance-none rounded-[10px] border border-white/[0.1] bg-sx-bg-primary/80 py-2 pl-3 pr-10 text-sm text-sx-text-secondary outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  {workspaces.map(workspace => (
                    <option key={workspace.id} value={workspace.id}>
                      {workspace.title}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-sx-text-muted" />
              </label>
            )}
            <Button
              type="button"
              variant="glass-secondary"
              size="lg"
              onClick={() => setShowCreate(true)}
              className="min-h-11 focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <Plus className="h-4 w-4" />
              New signal
            </Button>
          </div>
        </div>
      </header>

      <JourneyRail completed={completedJourneySteps} />

      <div aria-live="polite" className="relative mt-4 space-y-3">
        {error && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-btn border border-rose-400/25 bg-rose-400/[0.07] p-4 text-sm text-rose-100"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-300" />
            <div className="min-w-0 flex-1">
              <p>{error}</p>
              <button
                type="button"
                onClick={() => setError(null)}
                className="mt-2 min-h-11 text-xs text-rose-200/70 underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}
        {notice && (
          <div className="flex items-center gap-3 rounded-btn border border-emerald-400/20 bg-emerald-400/[0.06] p-4 text-sm text-emerald-100">
            <Check className="h-4 w-4 shrink-0 text-emerald-300" />
            {notice}
          </div>
        )}
      </div>

      {busyAction === 'loading' && !snapshot ? (
        <LoadingWorkspace />
      ) : showCreate || !snapshot ? (
        <CreateWorkspacePanel
          busy={busyAction === 'creating'}
          hasExistingWorkspace={Boolean(snapshot)}
          onCancel={() => setShowCreate(false)}
          onCreate={async input => {
            setBusyAction('creating');
            setError(null);
            try {
              const created = await intentScapeApi.createWorkspace(input);
              await refreshList();
              const next = await intentScapeApi.getWorkspace(created.id);
              setSnapshot(next);
              setWorkPacket(null);
              setSelectedHypothesisId(null);
              setShowCreate(false);
              setNotice(
                'Signal captured as provenance. Add context before expanding the vision.'
              );
            } catch (actionError) {
              setError(errorMessage(actionError));
            } finally {
              setBusyAction(null);
            }
          }}
        />
      ) : (
        <main className="relative mt-5 space-y-5">
          <WorkspaceControlStrip
            snapshot={snapshot}
            busyAction={busyAction}
            expansionPhase={expansionPhase}
            onExpand={expandVision}
            onRefresh={refreshCurrent}
          />

          <NextActionGuide
            snapshot={snapshot}
            workPacket={workPacket}
            busy={busyAction !== null}
            onExpand={expandVision}
            onBuildWorkPacket={buildWorkPacket}
          />

          {snapshot.contextField && (
            <EvidenceBatchPanel
              contextField={snapshot.contextField}
              busy={busyAction === 'adding-context'}
              onAddBatch={addEvidenceBatch}
            />
          )}

          {snapshot.contextField && (
            <VisionCanvas
              workspaceId={snapshot.workspace.id}
              originSignal={snapshot.contextField.originSignal}
              visionMap={snapshot.acceptedVision?.visionMap ?? null}
              selectedHypothesisId={selectedHypothesisId}
              onSelectHypothesis={setSelectedHypothesisId}
            />
          )}

          <DecisionDock
            visionMap={snapshot.acceptedVision?.visionMap ?? null}
            goalContract={snapshot.goalContract}
            workPacket={workPacket}
            selectedHypothesisId={selectedHypothesisId}
            busy={busyAction !== null}
            onSelectHypothesis={setSelectedHypothesisId}
            onApprove={approveGoal}
            onBuildWorkPacket={buildWorkPacket}
          />

          <EvidenceLedger snapshot={snapshot} />
        </main>
      )}
    </div>
  );
}

function JourneyRail({ completed }: { completed: number }) {
  return (
    <nav aria-label="IntentScape lifecycle" className="relative">
      <ol className="grid overflow-hidden rounded-btn border border-white/[0.1] bg-white/[0.025] sm:grid-cols-2 xl:grid-cols-4">
        {JOURNEY.map((step, index) => {
          const isComplete = index < completed;
          const isCurrent = index === completed;
          return (
            <li
              key={step.label}
              className={cn(
                'relative flex min-h-[74px] items-center gap-3 border-b border-r border-white/[0.07] px-4 py-3 last:border-r-0 sm:[&:nth-child(2)]:border-r-0 xl:border-b-0 xl:[&:nth-child(2)]:border-r',
                isCurrent && 'bg-sx-accent/[0.05]'
              )}
            >
              <div
                className={cn(
                  'flex h-9 w-9 shrink-0 items-center justify-center rounded-full border',
                  isComplete
                    ? 'border-emerald-400/30 bg-emerald-400/[0.1] text-emerald-300'
                    : isCurrent
                      ? 'border-sx-accent/35 bg-sx-accent/[0.1] text-sx-accent'
                      : 'border-white/[0.1] text-sx-text-muted/70'
                )}
              >
                {isComplete ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <step.icon className="h-4 w-4" />
                )}
              </div>
              <div>
                <p
                  className={cn(
                    'text-sm',
                    isCurrent
                      ? 'text-sx-text-primary'
                      : 'text-sx-text-secondary'
                  )}
                >
                  {step.label}
                </p>
                <p className="text-[11px] text-sx-text-muted">{step.detail}</p>
              </div>
              {index < JOURNEY.length - 1 && (
                <ArrowRight className="absolute right-2 top-1/2 hidden h-3.5 w-3.5 -translate-y-1/2 text-sx-text-muted/40 xl:block" />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function CreateWorkspacePanel({
  busy,
  hasExistingWorkspace,
  onCancel,
  onCreate,
}: {
  busy: boolean;
  hasExistingWorkspace: boolean;
  onCancel: () => void;
  onCreate: (input: { title: string; originSignal: string }) => Promise<void>;
}) {
  const [title, setTitle] = useState('');
  const [originSignal, setOriginSignal] = useState('');
  const [validation, setValidation] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (originSignal.trim().length < 3) {
      setValidation(
        'Add the rough human input you want the system to look beyond.'
      );
      return;
    }
    setValidation(null);
    const signal = originSignal.trim();
    await onCreate({
      title: title.trim() || suggestExplorationTitle(signal),
      originSignal: signal,
    });
  }

  return (
    <main className="relative mt-5 grid overflow-hidden rounded-card border border-white/[0.08] bg-sx-bg-panel/95 shadow-[var(--sx-shadow-elevated)] backdrop-blur-xl lg:grid-cols-[minmax(0,0.9fr)_minmax(420px,1.1fr)]">
      <div className="border-b border-white/[0.08] p-6 md:p-8 lg:border-b-0 lg:border-r">
        <p className="font-mono text-xs uppercase tracking-[0.24em] text-sx-accent">
          Start with less certainty
        </p>
        <h2 className="mt-3 max-w-lg font-[var(--font-space-grotesk)] text-2xl font-medium tracking-[-0.02em] text-sx-text-primary md:text-3xl">
          Give IntentScape the spark, not a perfectly written prompt.
        </h2>
        <p className="mt-4 max-w-xl text-sm leading-6 text-sx-text-muted">
          Your words are preserved as the origin signal. They are not treated as
          the end goal, search query, tool instruction or implied solution.
        </p>
        <div className="mt-7 space-y-4">
          {[
            [
              '01',
              'Capture in one pass',
              'Bring URLs, social pages, docs, constraints and unknowns together.',
            ],
            [
              '02',
              'Explore causally different paths',
              'Seven fixed lenses prevent a single clever paraphrase from winning.',
            ],
            [
              '03',
              'Approve before action',
              'No agent receives a work packet until a human locks the goal boundary.',
            ],
          ].map(([number, heading, detail]) => (
            <div key={number} className="flex gap-3">
              <span className="font-mono text-xs text-sx-intelligence">
                {number}
              </span>
              <div>
                <p className="text-sm text-sx-text-secondary">{heading}</p>
                <p className="mt-1 text-xs leading-5 text-sx-text-muted">
                  {detail}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <form onSubmit={submit} className="space-y-5 p-6 md:p-8">
        <label className="block text-sm text-sx-text-secondary">
          What is on your mind?
          <span className="ml-2 text-[11px] text-sx-text-muted">
            It can be incomplete
          </span>
          <Textarea
            variant="glass-solid"
            resize="vertical"
            value={originSignal}
            onChange={event => setOriginSignal(event.target.value)}
            placeholder="Describe the problem, request, concern or opportunity in your own words…"
            className="mt-2 min-h-[190px] text-base leading-7 focus-visible:ring-orange-500 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          />
        </label>
        <details className="group rounded-[12px] border border-white/[0.08] bg-white/[0.025] p-3">
          <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between text-xs text-sx-text-muted marker:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sx-accent">
            Name this exploration
            <span className="text-sx-text-muted/60 group-open:hidden">
              Optional · Synthex can name it
            </span>
          </summary>
          <label className="mt-2 block text-sm text-sx-text-secondary">
            Exploration title
            <input
              value={title}
              onChange={event => setTitle(event.target.value)}
              placeholder={
                originSignal.trim()
                  ? suggestExplorationTitle(originSignal)
                  : 'Generated from your signal'
              }
              className="mt-2 min-h-11 w-full rounded-[10px] border border-white/[0.1] bg-sx-bg-primary/70 px-3 text-sm text-sx-text-primary outline-none placeholder:text-sx-text-muted focus-visible:ring-2 focus-visible:ring-sx-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            />
          </label>
        </details>
        {validation && (
          <p role="alert" className="text-sm text-rose-300">
            {validation}
          </p>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.08] pt-5">
          {hasExistingWorkspace ? (
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={onCancel}
              className="min-h-11"
            >
              Cancel
            </Button>
          ) : (
            <p className="text-xs text-sx-text-muted">
              Private to your active organisation
            </p>
          )}
          <Button
            type="submit"
            variant="glass-primary"
            size="xl"
            disabled={busy}
            className="min-h-11 focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ArrowRight className="h-4 w-4" />
            )}
            Create the Context Field
          </Button>
        </div>
      </form>
    </main>
  );
}

function WorkspaceControlStrip({
  snapshot,
  busyAction,
  expansionPhase,
  onExpand,
  onRefresh,
}: {
  snapshot: IntentScapeWorkspaceSnapshot;
  busyAction: BusyAction;
  expansionPhase: number;
  onExpand: () => Promise<void>;
  onRefresh: () => Promise<void>;
}) {
  const acceptedForCurrentContext =
    snapshot.acceptedVision?.visionMap.contextVersion ===
    snapshot.contextField?.version;
  const mayExpand =
    Boolean(snapshot.contextField) &&
    !acceptedForCurrentContext &&
    !['expanding', 'awaiting_approval'].includes(snapshot.workspace.state);

  return (
    <section className="rounded-btn border border-white/[0.1] bg-white/[0.025] p-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-3">
          <span
            className={cn(
              'mt-1 h-2.5 w-2.5 shrink-0 rounded-full',
              snapshot.workspace.state === 'blocked' ||
                snapshot.workspace.state === 'failed'
                ? 'bg-rose-400'
                : snapshot.goalContract
                  ? 'bg-emerald-400'
                  : 'bg-sky-400'
            )}
          />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-[var(--font-space-grotesk)] text-base font-medium text-sx-text-primary">
                {snapshot.workspace.title}
              </h2>
              <span className="rounded-full border border-white/[0.09] bg-white/[0.035] px-2 py-1 font-mono text-xs uppercase tracking-wider text-sx-text-muted">
                {WORKSPACE_STATE_LABELS[snapshot.workspace.state] ??
                  snapshot.workspace.state.replaceAll('_', ' ')}
              </span>
            </div>
            <p className="mt-1 text-xs text-sx-text-muted">
              Context v{snapshot.workspace.activeContextVersion} ·{' '}
              {snapshot.runs.length} agent run
              {snapshot.runs.length === 1 ? '' : 's'} ·{' '}
              {snapshot.artifacts.length} immutable wiki artefacts
            </p>
          </div>
        </div>

        {busyAction === 'expanding' ? (
          <div className="min-w-0 rounded-[10px] border border-sx-intelligence/20 bg-sx-intelligence/[0.05] px-4 py-3 lg:min-w-[410px]">
            <div className="flex items-center gap-3">
              <Loader2 className="h-4 w-4 animate-spin text-sx-intelligence" />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-sx-text-secondary">
                  {EXPANSION_PHASES[expansionPhase].label}
                </p>
                <p className="truncate text-[11px] text-sx-text-muted">
                  {EXPANSION_PHASES[expansionPhase].detail}
                </p>
              </div>
              <span className="font-mono text-xs tabular-nums text-sx-intelligence">
                {expansionPhase + 1}/4
              </span>
            </div>
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/[0.06]">
              <div
                className="h-full rounded-full bg-sx-intelligence transition-[width] duration-500 motion-reduce:transition-none"
                style={{ width: `${((expansionPhase + 1) / 4) * 100}%` }}
              />
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon-lg"
              onClick={onRefresh}
              disabled={busyAction !== null}
              aria-label="Refresh workspace"
              className="min-h-11 min-w-11 focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
            {mayExpand && (
              <Button
                type="button"
                variant="glass-primary"
                size="xl"
                onClick={onExpand}
                disabled={busyAction !== null}
                className="min-h-11 focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                <Search className="h-4 w-4" />
                Expand beyond the brief
              </Button>
            )}
            {acceptedForCurrentContext && !snapshot.goalContract && (
              <span className="flex min-h-11 items-center gap-2 rounded-[10px] border border-emerald-400/20 bg-emerald-400/[0.06] px-4 text-xs text-emerald-200">
                <BadgeCheck className="h-4 w-4" />
                Vision passed both gates
              </span>
            )}
            {snapshot.goalContract && (
              <span className="flex min-h-11 items-center gap-2 rounded-[10px] border border-emerald-400/20 bg-emerald-400/[0.06] px-4 text-xs text-emerald-200">
                <Shield className="h-4 w-4" />
                Human authority recorded
              </span>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function EvidenceLedger({
  snapshot,
}: {
  snapshot: IntentScapeWorkspaceSnapshot;
}) {
  const latestRun = snapshot.runs[0];
  return (
    <section
      aria-labelledby="evidence-ledger-title"
      className="rounded-card border border-white/[0.1] bg-white/[0.025] p-4 md:p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-sx-text-muted">
            Immutable run ledger
          </p>
          <h2
            id="evidence-ledger-title"
            className="mt-1 font-[var(--font-space-grotesk)] text-base font-medium text-sx-text-secondary"
          >
            What the system used, produced and approved
          </h2>
        </div>
        <span className="font-mono text-xs text-sx-text-muted/70">
          private markdown / sha-256 integrity
        </span>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <LedgerCard
          label="Knowledge"
          value={`${snapshot.artifacts.length} artefacts`}
          detail={`Latest: ${snapshot.artifacts.at(-1)?.logicalPath ?? 'Context Field'}`}
        />
        <LedgerCard
          label="Model separation"
          value={latestRun ? 'Generator + evaluator' : 'Awaiting first run'}
          detail={
            latestRun
              ? `${latestRun.generatorModel ?? 'generator'} / ${latestRun.evaluatorModel ?? 'evaluator'}`
              : 'Separate calls are required before acceptance'
          }
        />
        <LedgerCard
          label="Authority"
          value={
            snapshot.goalContract ? 'Human-approved' : 'No action authority'
          }
          detail={
            snapshot.goalContract
              ? `Hypothesis v${snapshot.goalContract.hypothesisVersion}`
              : 'Work Packet remains locked'
          }
        />
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.08] pt-4">
        <p className="text-xs leading-5 text-sx-text-muted">
          Export contains every immutable version, its logical wiki path and its
          verified content hash.
        </p>
        <Button variant="glass-secondary" size="lg" asChild>
          <a
            href={`/api/intentscape/workspaces/${encodeURIComponent(snapshot.workspace.id)}/export`}
            download
            className="min-h-11 focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <FileText className="h-4 w-4" />
            Export Markdown wiki
          </a>
        </Button>
      </div>
    </section>
  );
}

function LedgerCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-[10px] border border-white/[0.08] bg-sx-bg-primary/40 p-3">
      <p className="font-mono text-xs uppercase tracking-wider text-sx-text-muted/70">
        {label}
      </p>
      <p className="mt-2 text-sm text-sx-text-secondary">{value}</p>
      <p
        className="mt-1 truncate text-[11px] text-sx-text-muted"
        title={detail}
      >
        {detail}
      </p>
    </div>
  );
}

function LoadingWorkspace() {
  return (
    <div className="mt-5 flex min-h-[420px] items-center justify-center rounded-card border border-white/[0.1] bg-white/[0.025]">
      <div className="text-center">
        <Loader2 className="mx-auto h-6 w-6 animate-spin text-sx-intelligence" />
        <p className="mt-3 text-sm text-sx-text-muted">
          Loading the Context Field…
        </p>
      </div>
    </div>
  );
}
