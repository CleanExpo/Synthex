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
  ['Describe', 'Capture the situation, sources and tensions.', Database],
  ['Compare', 'Generate genuinely different explanations.', Brain],
  ['Research', 'Check the questions that could change the decision.', Search],
  ['Choose', 'You select one direction and its limits.', Target],
  ['Prepare', 'Turn the approved direction into a bounded plan.', FileText],
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
              SYNTHEX <span className="text-sx-accent">/ Idea Explorer</span>
            </span>
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-sx-accent/20 bg-sx-accent/[0.06] px-3 py-1.5 font-mono text-xs uppercase tracking-[0.16em] text-sx-accent">
              Free guided workspace · no account needed
            </span>
            <Button asChild variant="premium-primary" size="lg">
              <Link href="#explore-idea">
                Try my idea
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </header>

        <section className="relative grid gap-8 py-10 lg:grid-cols-[minmax(0,1.2fr)_minmax(340px,0.8fr)] lg:items-end lg:py-14">
          <div>
            <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.24em] text-sx-intelligence">
              <Sparkles className="h-4 w-4" />
              Turn one rough idea into three directions
            </div>
            <h1 className="mt-4 max-w-4xl text-balance font-[var(--font-space-grotesk)] text-4xl font-medium tracking-[-0.045em] text-sx-text-primary md:text-6xl md:leading-[1.05]">
              See the options around a rough idea
              <span className="block text-sx-text-muted">
                before you commit to one.
              </span>
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-sx-text-muted md:text-lg md:leading-8">
              Describe what is happening in your own words. Synthex researches
              different explanations, shows three directions and waits for you
              to choose. Nothing is published, purchased or sent without your
              approval.
            </p>
          </div>
          <div className="space-y-3">
            <div className="rounded-card border border-white/[0.1] bg-sx-bg-panel p-5 shadow-[var(--sx-shadow-elevated)]">
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-sx-accent">
                What you get
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
                <div className="rounded-btn border border-white/[0.08] bg-sx-bg-primary/70 p-4">
                  <p className="text-xs text-sx-text-muted">You provide</p>
                  <p className="mt-1 text-sm leading-6 text-sx-text-primary">
                    One rough idea, concern or situation
                  </p>
                </div>
                <ArrowRight className="h-5 w-5 rotate-90 text-sx-intelligence sm:rotate-0" />
                <div className="rounded-btn border border-sx-intelligence/20 bg-sx-intelligence/[0.06] p-4">
                  <p className="text-xs text-sx-intelligence">
                    Synthex returns
                  </p>
                  <p className="mt-1 text-sm leading-6 text-sx-text-primary">
                    Three researched directions and a brief you control
                  </p>
                </div>
              </div>
            </div>
            <div className="rounded-card border border-white/[0.08] bg-sx-bg-elevated p-5 shadow-[var(--sx-shadow-elevated)]">
              <div className="flex items-center gap-2 text-emerald-300">
                <Shield className="h-4 w-4" />
                <p className="font-mono text-xs uppercase tracking-[0.2em]">
                  You stay in control
                </p>
              </div>
              <p className="mt-3 text-sm leading-6 text-sx-text-secondary">
                Your first note is a starting point, not an instruction. Synthex
                will not turn it into a goal or take action without asking you.
              </p>
            </div>
          </div>
        </section>

        <section className="mb-6 grid overflow-hidden rounded-card border border-sx-accent/20 bg-sx-bg-panel shadow-[var(--sx-shadow-elevated)] lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.72fr)]">
          <form
            id="explore-idea"
            onSubmit={expandIdea}
            className="border-b border-white/[0.08] p-5 lg:border-b-0 lg:border-r lg:p-7"
          >
            <div className="flex items-center gap-2 text-sx-accent">
              <Sparkles className="h-4 w-4" />
              <p className="font-mono text-xs uppercase tracking-[0.2em]">
                Describe what is happening
              </p>
            </div>
            <h2 className="mt-2 font-[var(--font-space-grotesk)] text-2xl text-sx-text-primary">
              Write it as you would explain it to a colleague.
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
              {expanding
                ? 'Exploring different directions…'
                : 'Find different directions'}
            </Button>
          </form>
          <div className="p-5 lg:p-7">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-sx-intelligence">
              What happens next
            </p>
            <ol className="mt-4 space-y-4 text-sm text-sx-text-secondary">
              <li>
                <strong className="text-sx-text-primary">1. Compare:</strong>{' '}
                Synthex shows three genuinely different directions.
              </li>
              <li>
                <strong className="text-sx-text-primary">2. Decide:</strong> you
                select the direction and guardrails.
              </li>
              <li>
                <strong className="text-sx-text-primary">
                  3. Take it with you:
                </strong>{' '}
                download the complete brief as a file you can keep.
              </li>
            </ol>
            <p className="mt-5 border-t border-white/[0.08] pt-4 text-xs leading-5 text-sx-text-muted">
              Your note is saved privately while Synthex generates the result.
              It is not shared with the strategy team unless you explicitly
              choose that step later.
            </p>
          </div>
        </section>

        <section aria-labelledby="loop-title" className="mb-6">
          <div className="mb-3 flex items-end justify-between gap-4">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-sx-text-muted">
                How Synthex works
              </p>
              <h2
                id="loop-title"
                className="mt-1 font-[var(--font-space-grotesk)] text-xl text-sx-text-primary"
              >
                Five visible stages, with you making the decision
              </h2>
            </div>
            <p className="hidden text-xs text-sx-text-muted md:block">
              Move the lens cards below, compare three directions and choose
              only what you mean.
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
          move the seven lenses, compare the three directions, then approve one
          below. This sample takes no external action.
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
                Keep working privately
              </p>
            </div>
            <h2 className="mt-2 font-[var(--font-space-grotesk)] text-2xl text-sx-text-primary">
              Save sources, decisions and approved actions in one private
              workspace.
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-sx-text-muted">
              Paste a company URL, social pages, documents, notes and limits in
              one batch. Synthex keeps the sources beside every direction so you
              can see what changed the recommendation.
            </p>
          </div>
          <Button asChild variant="premium-primary" size="xl">
            <Link href="/signup">
              Create my workspace
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </section>
      </div>
    </main>
  );
}
