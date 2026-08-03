'use client';

import Link from 'next/link';
import { useMemo, useState, type FormEvent } from 'react';
import {
  ArrowRight,
  BadgeCheck,
  Brain,
  Database,
  FileText,
  Loader2,
  Search,
  Shield,
  Sparkles,
  Target,
} from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { SynthexLogo } from '@/components/landing/synthex-logo';
import type {
  GoalContract,
  VisionMap,
  WorkPacket,
} from '@/lib/intentscape/contracts';
import { DecisionDock } from './DecisionDock';
import { INTENTSCAPE_DEMO_MAP, INTENTSCAPE_DEMO_ORIGIN } from './demo-data';
import { MarketingExtenderHandoff } from './MarketingExtenderHandoff';
import { VisionCanvas } from './VisionCanvas';

const LOOP = [
  ['Observe', 'Capture the situation, sources and tensions.', Database],
  ['Think', 'Generate competing causal explanations.', Brain],
  ['Research', 'Investigate decision-changing branch questions.', Search],
  ['Decide', 'A human approves one exact goal boundary.', Target],
  ['Act', 'Release a governed packet to downstream agents.', FileText],
] as const;

const GUIDE_VIDEOS = [
  ['Context', '/videos/marketing-extender-context.mp4'],
  ['Expansion', '/videos/marketing-extender-expand.mp4'],
  ['Human decision', '/videos/marketing-extender-decision.mp4'],
  ['Nexus handoff', '/videos/marketing-extender-handoff.mp4'],
] as const;

export function IntentScapeProductTour() {
  const [originSignalInput, setOriginSignalInput] = useState('');
  const [activeOriginSignal, setActiveOriginSignal] = useState(
    INTENTSCAPE_DEMO_ORIGIN
  );
  const [visionMap, setVisionMap] = useState<VisionMap>(INTENTSCAPE_DEMO_MAP);
  const [workspaceId, setWorkspaceId] = useState('public-product-tour');
  const [expanding, setExpanding] = useState(false);
  const [expansionError, setExpansionError] = useState<string | null>(null);
  const [selectedHypothesisId, setSelectedHypothesisId] = useState<
    string | null
  >('demo-trust');
  const [goalContract, setGoalContract] = useState<GoalContract | null>(null);
  const [workPacket, setWorkPacket] = useState<WorkPacket | null>(null);
  const selected = useMemo(
    () =>
      visionMap.hypotheses.find(
        hypothesis => hypothesis.id === selectedHypothesisId
      ) ?? null,
    [selectedHypothesisId, visionMap]
  );

  async function expandIdea(event: FormEvent) {
    event.preventDefault();
    setExpansionError(null);
    setExpanding(true);
    try {
      const response = await fetch('/api/intentscape/public/expand', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ originSignal: originSignalInput }),
      });
      const payload = (await response.json()) as {
        error?: string;
        workspaceId?: string;
        acceptedVision?: { visionMap?: VisionMap };
      };
      if (
        !response.ok ||
        !payload.workspaceId ||
        !payload.acceptedVision?.visionMap
      ) {
        throw new Error(payload.error ?? 'The vision could not be expanded.');
      }
      const nextMap = payload.acceptedVision.visionMap;
      setActiveOriginSignal(originSignalInput.trim());
      setVisionMap(nextMap);
      setWorkspaceId(payload.workspaceId);
      setSelectedHypothesisId(nextMap.hypotheses[0]?.id ?? null);
      setGoalContract(null);
      setWorkPacket(null);
    } catch (caught) {
      setExpansionError(
        caught instanceof Error
          ? caught.message
          : 'The vision could not be expanded.'
      );
    } finally {
      setExpanding(false);
    }
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-sx-bg-primary text-sx-text-primary">
      <div className="relative mx-auto max-w-[1600px] px-4 py-5 md:px-7 md:py-7">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/4 top-0 h-80 w-80 rounded-full bg-sky-400/[0.07] blur-3xl"
        />
        <header className="relative flex flex-wrap items-center justify-between gap-4 border-b border-white/[0.09] pb-5">
          <Link
            href="/"
            className="flex items-center gap-2 font-[var(--font-space-grotesk)] text-lg font-medium tracking-[-0.02em] text-sx-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sx-accent"
          >
            <SynthexLogo className="h-8 w-8" />
            <span>
              SYNTHEX{' '}
              <span className="text-sx-accent">/ Marketing Extender</span>
            </span>
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-sx-accent/20 bg-sx-accent/[0.06] px-3 py-1.5 font-mono text-xs uppercase tracking-[0.16em] text-sx-accent">
              Guided sample · no account needed
            </span>
            <Button asChild variant="premium-primary" size="lg">
              <Link href="/signup">
                Start with your signal
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </header>

        <section className="relative grid gap-8 py-10 lg:grid-cols-[minmax(0,1.2fr)_minmax(340px,0.8fr)] lg:items-end lg:py-14">
          <div>
            <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.24em] text-sx-intelligence">
              <Sparkles className="h-4 w-4" />
              Product tour / interactive
            </div>
            <h1 className="mt-4 max-w-4xl text-balance font-[var(--font-space-grotesk)] text-4xl font-medium tracking-[-0.045em] text-sx-text-primary md:text-6xl md:leading-[1.05]">
              It does not answer your prompt.
              <span className="block text-sx-text-muted">
                It expands the situation around it.
              </span>
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-sx-text-muted md:text-lg md:leading-8">
              The Marketing Extender is the front door to an orchestrated agent
              loop. It turns a rough human signal into a researched visual
              field, then pauses at the only point that matters: your decision.
            </p>
          </div>
          <div className="space-y-3">
            <div className="overflow-hidden rounded-card border border-white/[0.1] bg-black shadow-[var(--sx-shadow-elevated)]">
              <video
                controls
                preload="metadata"
                playsInline
                poster="/videos/marketing-extender-intro-poster.jpg"
                className="aspect-video w-full object-cover"
                aria-label="Marketing Extender introduction video"
              >
                <source
                  src="/videos/marketing-extender-intro.mp4"
                  type="video/mp4"
                />
                Marketing Extender introduction video.
              </video>
            </div>
            <div className="rounded-card border border-white/[0.08] bg-sx-bg-elevated p-5 shadow-[var(--sx-shadow-elevated)]">
              <div className="flex items-center gap-2 text-emerald-300">
                <Shield className="h-4 w-4" />
                <p className="font-mono text-xs uppercase tracking-[0.2em]">
                  The governing rule
                </p>
              </div>
              <p className="mt-3 text-sm leading-6 text-sx-text-secondary">
                The first human sentence is provenance only. It cannot silently
                become the goal, research query, tool choice or permission to
                act.
              </p>
            </div>
          </div>
        </section>

        <section className="mb-6 grid overflow-hidden rounded-card border border-sx-accent/20 bg-sx-bg-panel shadow-[var(--sx-shadow-elevated)] lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.72fr)]">
          <form
            onSubmit={expandIdea}
            className="border-b border-white/[0.08] p-5 lg:border-b-0 lg:border-r lg:p-7"
          >
            <div className="flex items-center gap-2 text-sx-accent">
              <Sparkles className="h-4 w-4" />
              <p className="font-mono text-xs uppercase tracking-[0.2em]">
                Start with one rough idea
              </p>
            </div>
            <h2 className="mt-2 font-[var(--font-space-grotesk)] text-2xl text-sx-text-primary">
              Give us the situation—not a perfect prompt.
            </h2>
            <Textarea
              required
              minLength={12}
              maxLength={5000}
              value={originSignalInput}
              onChange={event => setOriginSignalInput(event.target.value)}
              placeholder="Example: We need better product images, but I am not sure whether the real problem is the creative, the offer or buyer trust."
              className="mt-4 min-h-32 resize-y border-white/[0.1] bg-sx-bg-primary/70 text-base leading-7"
            />
            {expansionError && (
              <p role="alert" className="mt-3 text-sm text-rose-300">
                {expansionError}
              </p>
            )}
            <Button
              type="submit"
              variant="premium-primary"
              size="xl"
              disabled={expanding}
              className="mt-4 min-h-11 w-full sm:w-auto"
            >
              {expanding ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {expanding ? 'Expanding the situation…' : 'Expand my idea'}
            </Button>
          </form>
          <div className="p-5 lg:p-7">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-sx-intelligence">
              What happens next
            </p>
            <ol className="mt-4 space-y-4 text-sm text-sx-text-secondary">
              <li>
                <strong className="text-sx-text-primary">1. Explore:</strong>{' '}
                Synthex generates competing causal directions.
              </li>
              <li>
                <strong className="text-sx-text-primary">2. Decide:</strong> you
                select the direction and guardrails.
              </li>
              <li>
                <strong className="text-sx-text-primary">
                  3. Leave with value:
                </strong>{' '}
                download the complete Markdown vision brief.
              </li>
            </ol>
            <p className="mt-5 border-t border-white/[0.08] pt-4 text-xs leading-5 text-sx-text-muted">
              Your submission is saved as a private prospect workspace to
              generate the result. It is not sent to a strategist unless you
              explicitly choose the Nexus handoff later.
            </p>
          </div>
        </section>

        <details className="mb-6 rounded-card border border-white/[0.08] bg-sx-bg-panel">
          <summary className="cursor-pointer list-none px-5 py-4 font-[var(--font-space-grotesk)] text-sm text-sx-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sx-accent">
            Watch the four stage guides
            <span className="ml-2 font-mono text-xs text-sx-text-muted">
              12 seconds each
            </span>
          </summary>
          <div className="grid gap-3 border-t border-white/[0.08] p-4 sm:grid-cols-2">
            {GUIDE_VIDEOS.map(([label, src]) => (
              <figure
                key={label}
                className="overflow-hidden rounded-btn border border-white/[0.08] bg-black"
              >
                <video
                  controls
                  preload="none"
                  playsInline
                  poster={src.replace('.mp4', '-poster.jpg')}
                  className="aspect-video w-full object-cover"
                  aria-label={`${label} guide video`}
                >
                  <source src={src} type="video/mp4" />
                  {label} guide video.
                </video>
                <figcaption className="bg-sx-bg-elevated px-3 py-2 text-xs text-sx-text-muted">
                  {label}
                </figcaption>
              </figure>
            ))}
          </div>
        </details>

        <section aria-labelledby="loop-title" className="mb-6">
          <div className="mb-3 flex items-end justify-between gap-4">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-sx-text-muted">
                How to read the system
              </p>
              <h2
                id="loop-title"
                className="mt-1 font-[var(--font-space-grotesk)] text-xl text-sx-text-primary"
              >
                One continuous loop, five visible stages
              </h2>
            </div>
            <p className="hidden text-xs text-sx-text-muted md:block">
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
                  <Icon className="h-4 w-4 text-sx-intelligence" />
                  <span className="font-mono text-xs text-sx-text-muted/70">
                    0{index + 1}
                  </span>
                </div>
                <p className="mt-3 text-sm text-sx-text-primary">{label}</p>
                <p className="mt-1 text-xs leading-5 text-sx-text-muted">
                  {detail}
                </p>
              </li>
            ))}
          </ol>
        </section>

        <div className="rounded-btn border border-sx-accent/15 bg-sx-accent/[0.04] px-4 py-3 text-sm text-sx-text-secondary">
          <strong className="font-medium text-sx-accent">Try it here:</strong>{' '}
          move the seven lenses, inspect the three competing directions, then
          approve one below. This sample runs locally and takes no external
          action.
        </div>

        <div className="mt-5">
          <VisionCanvas
            workspaceId={workspaceId}
            originSignal={activeOriginSignal}
            visionMap={visionMap}
            selectedHypothesisId={selectedHypothesisId}
            onSelectHypothesis={setSelectedHypothesisId}
          />
        </div>

        <div className="mt-5">
          <DecisionDock
            visionMap={visionMap}
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
              const hypothesis = visionMap.hypotheses.find(
                item => item.id === approval.hypothesisId
              );
              if (!hypothesis) return;
              setGoalContract({
                id: 'tour-goal-contract',
                workspaceId,
                organizationId: 'marketing-extender',
                contextVersion: visionMap.contextVersion,
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

        {goalContract && workPacket && (
          <MarketingExtenderHandoff
            originSignal={activeOriginSignal}
            visionMap={visionMap}
            goalContract={goalContract}
            workPacket={workPacket}
          />
        )}

        <section className="mt-5 grid gap-4 rounded-card border border-white/[0.08] bg-sx-bg-elevated p-5 md:grid-cols-[1fr_auto] md:items-center md:p-7">
          <div>
            <div className="flex items-center gap-2 text-emerald-300">
              <BadgeCheck className="h-4 w-4" />
              <p className="font-mono text-xs uppercase tracking-[0.2em]">
                From tour to real workspace
              </p>
            </div>
            <h2 className="mt-2 font-[var(--font-space-grotesk)] text-2xl text-sx-text-primary">
              Your workspace adds live sources, private Markdown history and
              accountable agent runs.
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-sx-text-muted">
              Paste a company URL, social pages, developer documents, notes and
              constraints in one batch. The Marketing Extender builds the
              Context Field before any model is allowed to expand the vision.
            </p>
          </div>
          <Button asChild variant="premium-primary" size="xl">
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
