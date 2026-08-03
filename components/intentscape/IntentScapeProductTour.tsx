'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import {
  ArrowRight,
  BadgeCheck,
  Brain,
  Database,
  FileText,
  Search,
  Shield,
  Sparkles,
  Target,
} from '@/components/icons';
import { Button } from '@/components/ui/button';
import type { GoalContract, WorkPacket } from '@/lib/intentscape/contracts';
import { DecisionDock } from './DecisionDock';
import { INTENTSCAPE_DEMO_MAP, INTENTSCAPE_DEMO_ORIGIN } from './demo-data';
import { VisionCanvas } from './VisionCanvas';

const LOOP = [
  ['Observe', 'Capture the situation, sources and tensions.', Database],
  ['Think', 'Generate competing causal explanations.', Brain],
  ['Research', 'Investigate decision-changing branch questions.', Search],
  ['Decide', 'A human approves one exact goal boundary.', Target],
  ['Act', 'Release a governed packet to downstream agents.', FileText],
] as const;

export function IntentScapeProductTour() {
  const [selectedHypothesisId, setSelectedHypothesisId] =
    useState('demo-trust');
  const [goalContract, setGoalContract] = useState<GoalContract | null>(null);
  const [workPacket, setWorkPacket] = useState<WorkPacket | null>(null);
  const selected = useMemo(
    () =>
      INTENTSCAPE_DEMO_MAP.hypotheses.find(
        hypothesis => hypothesis.id === selectedHypothesisId
      ) ?? null,
    [selectedHypothesisId]
  );

  return (
    <main className="min-h-screen overflow-x-hidden bg-slate-950 text-slate-100">
      <div className="relative mx-auto max-w-[1600px] px-4 py-5 md:px-7 md:py-7">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/4 top-0 h-80 w-80 rounded-full bg-sky-400/[0.07] blur-3xl"
        />
        <header className="relative flex flex-wrap items-center justify-between gap-4 border-b border-white/[0.09] pb-5">
          <Link
            href="/"
            className="font-[var(--font-space-grotesk)] text-lg font-medium tracking-[-0.02em] text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
          >
            SYNTHEX <span className="text-sky-300">/ IntentScape</span>
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-amber-300/20 bg-amber-300/[0.06] px-3 py-1.5 font-mono text-xs uppercase tracking-[0.16em] text-amber-200">
              Guided sample · no account needed
            </span>
            <Button asChild variant="glass-primary" size="lg">
              <Link href="/signup">
                Start with your signal
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </header>

        <section className="relative grid gap-8 py-10 lg:grid-cols-[minmax(0,1.2fr)_minmax(340px,0.8fr)] lg:items-end lg:py-14">
          <div>
            <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.24em] text-sky-300/70">
              <Sparkles className="h-4 w-4" />
              Product tour / interactive
            </div>
            <h1 className="mt-4 max-w-4xl font-[var(--font-space-grotesk)] text-4xl font-medium tracking-[-0.045em] text-white md:text-6xl md:leading-[1.05]">
              It does not answer your prompt.
              <span className="block text-slate-500">
                It expands the situation around it.
              </span>
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-slate-400 md:text-lg md:leading-8">
              IntentScape is the front door to an orchestrated agent loop. It
              turns a rough human signal into a researched visual field, then
              pauses at the only point that matters: your decision.
            </p>
          </div>
          <div className="rounded-[20px] border border-white/[0.12] bg-white/[0.035] p-5 shadow-[0_8px_32px_rgba(0,0,0,0.32)]">
            <div className="flex items-center gap-2 text-emerald-300">
              <Shield className="h-4 w-4" />
              <p className="font-mono text-xs uppercase tracking-[0.2em]">
                The governing rule
              </p>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-200">
              The first human sentence is provenance only. It cannot silently
              become the goal, research query, tool choice or permission to act.
            </p>
          </div>
        </section>

        <section aria-labelledby="loop-title" className="mb-6">
          <div className="mb-3 flex items-end justify-between gap-4">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-slate-500">
                How to read the system
              </p>
              <h2
                id="loop-title"
                className="mt-1 font-[var(--font-space-grotesk)] text-xl text-white"
              >
                One continuous loop, five visible stages
              </h2>
            </div>
            <p className="hidden text-xs text-slate-500 md:block">
              Drag the lens cards below. Select a hypothesis. Approve only what
              you mean.
            </p>
          </div>
          <ol className="grid overflow-hidden rounded-[16px] border border-white/[0.1] bg-white/[0.025] sm:grid-cols-2 lg:grid-cols-5">
            {LOOP.map(([label, detail, Icon], index) => (
              <li
                key={label}
                className="relative min-h-[116px] border-b border-r border-white/[0.08] p-4 last:border-r-0 sm:[&:nth-child(2)]:border-r-0 lg:border-b-0 lg:[&:nth-child(2)]:border-r"
              >
                <div className="flex items-center justify-between">
                  <Icon className="h-4 w-4 text-sky-300" />
                  <span className="font-mono text-xs text-slate-600">
                    0{index + 1}
                  </span>
                </div>
                <p className="mt-3 text-sm text-slate-100">{label}</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  {detail}
                </p>
              </li>
            ))}
          </ol>
        </section>

        <div className="rounded-[14px] border border-sky-300/15 bg-sky-300/[0.04] px-4 py-3 text-sm text-sky-100/80">
          <strong className="font-medium text-sky-200">Try it here:</strong>{' '}
          move the seven lenses, inspect the three competing directions, then
          approve one below. This sample runs locally and takes no external
          action.
        </div>

        <div className="mt-5">
          <VisionCanvas
            workspaceId="public-product-tour"
            originSignal={INTENTSCAPE_DEMO_ORIGIN}
            visionMap={INTENTSCAPE_DEMO_MAP}
            selectedHypothesisId={selectedHypothesisId}
            onSelectHypothesis={setSelectedHypothesisId}
          />
        </div>

        <div className="mt-5">
          <DecisionDock
            visionMap={INTENTSCAPE_DEMO_MAP}
            goalContract={goalContract}
            workPacket={workPacket}
            selectedHypothesisId={selectedHypothesisId}
            busy={false}
            onSelectHypothesis={id => {
              setSelectedHypothesisId(id);
              setGoalContract(null);
              setWorkPacket(null);
            }}
            onApprove={async approval => {
              const hypothesis = INTENTSCAPE_DEMO_MAP.hypotheses.find(
                item => item.id === approval.hypothesisId
              );
              if (!hypothesis) return;
              setGoalContract({
                id: 'tour-goal-contract',
                workspaceId: 'public-product-tour',
                organizationId: 'sample-organisation',
                contextVersion: INTENTSCAPE_DEMO_MAP.contextVersion,
                desiredChange: hypothesis.desiredChange,
                evidenceRefs: hypothesis.researchBranchIds,
                status: 'approved',
                approvedBy: 'you-in-this-tour',
                approvedAt: new Date().toISOString(),
                ...approval,
              });
            }}
            onBuildWorkPacket={async () => {
              if (!goalContract || !selected) return;
              setWorkPacket({
                goalContractId: goalContract.id,
                organizationId: goalContract.organizationId,
                workspaceId: goalContract.workspaceId,
                goal: selected.desiredChange,
                acceptanceCriteria: goalContract.acceptanceCriteria,
                exclusions: goalContract.exclusions,
                authorityBoundaries: goalContract.authorityBoundaries,
                evidenceRefs: goalContract.evidenceRefs,
              });
            }}
          />
        </div>

        <section className="mt-5 grid gap-4 rounded-[20px] border border-white/[0.12] bg-white/[0.03] p-5 md:grid-cols-[1fr_auto] md:items-center md:p-7">
          <div>
            <div className="flex items-center gap-2 text-emerald-300">
              <BadgeCheck className="h-4 w-4" />
              <p className="font-mono text-xs uppercase tracking-[0.2em]">
                From tour to real workspace
              </p>
            </div>
            <h2 className="mt-2 font-[var(--font-space-grotesk)] text-2xl text-white">
              Your workspace adds live sources, private Markdown history and
              accountable agent runs.
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
              Paste a company URL, social pages, developer documents, notes and
              constraints in one batch. IntentScape builds the Context Field
              before any model is allowed to expand the vision.
            </p>
          </div>
          <Button asChild variant="glass-primary" size="xl">
            <Link href="/signup">
              Create a private workspace
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </section>
      </div>
    </main>
  );
}
