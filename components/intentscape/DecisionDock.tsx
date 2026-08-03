'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  ArrowRight,
  BadgeCheck,
  Check,
  FileText,
  Loader2,
  Lock,
  Shield,
  Sparkles,
  Target,
} from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import type { GoalContract, VisionMap } from '@/lib/intentscape/contracts';
import { cn } from '@/lib/utils';
import { splitLines } from './presentation';
import type { IntentScapeWorkPacket } from './types';

interface DecisionDockProps {
  visionMap: VisionMap | null;
  goalContract: GoalContract | null;
  workPacket: IntentScapeWorkPacket | null;
  selectedHypothesisId: string | null;
  busy: boolean;
  onSelectHypothesis: (id: string) => void;
  onApprove: (input: {
    hypothesisId: string;
    hypothesisVersion: number;
    primaryStakeholder: string;
    acceptanceCriteria: string[];
    exclusions: string[];
    authorityBoundaries: string[];
  }) => Promise<void>;
  onBuildWorkPacket: () => Promise<void>;
}

export function DecisionDock({
  visionMap,
  goalContract,
  workPacket,
  selectedHypothesisId,
  busy,
  onSelectHypothesis,
  onApprove,
  onBuildWorkPacket,
}: DecisionDockProps) {
  const selected = useMemo(
    () =>
      visionMap?.hypotheses.find(
        hypothesis => hypothesis.id === selectedHypothesisId
      ) ?? null,
    [selectedHypothesisId, visionMap]
  );
  const [stakeholder, setStakeholder] = useState('');
  const [criteria, setCriteria] = useState('');
  const [exclusions, setExclusions] = useState('');
  const [boundaries, setBoundaries] = useState(
    'Human approval is required before any downstream action.'
  );
  const [validation, setValidation] = useState<string | null>(null);

  useEffect(() => {
    setValidation(null);
    setStakeholder(selected?.affectedStakeholders[0] ?? '');
  }, [selected, selectedHypothesisId]);

  async function approve(event: FormEvent) {
    event.preventDefault();
    if (!selected) return;
    const acceptanceCriteria = splitLines(criteria);
    const authorityBoundaries = splitLines(boundaries);
    if (!stakeholder.trim()) {
      setValidation(
        'Name the primary stakeholder whose situation must change.'
      );
      return;
    }
    if (!acceptanceCriteria.length) {
      setValidation('Add at least one observable acceptance criterion.');
      return;
    }
    if (!authorityBoundaries.length) {
      setValidation('Keep at least one explicit authority boundary.');
      return;
    }
    setValidation(null);
    await onApprove({
      hypothesisId: selected.id,
      hypothesisVersion: selected.version,
      primaryStakeholder: stakeholder.trim(),
      acceptanceCriteria,
      exclusions: splitLines(exclusions),
      authorityBoundaries,
    });
  }

  function useSuggestedGuardrails() {
    if (!selected) return;
    if (!criteria.trim()) {
      setCriteria(
        `The team records an observable baseline and target for: ${selected.desiredChange.slice(0, 900)}`
      );
    }
    if (!exclusions.trim()) {
      setExclusions(
        'No external publishing, purchasing or irreversible action without separate approval.'
      );
    }
    setBoundaries(current =>
      current.includes('Evidence must remain traceable')
        ? current
        : `${current.trim()}\nEvidence must remain traceable to this Context Field version.`
    );
  }

  return (
    <section
      aria-labelledby="decision-dock-title"
      className="rounded-card border border-white/[0.08] bg-sx-bg-panel/95 shadow-[var(--sx-shadow-elevated)] backdrop-blur-xl"
    >
      <div className="border-b border-white/[0.08] p-4 md:p-5">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-sx-accent" aria-hidden="true" />
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-sx-accent">
            Your decision
          </p>
        </div>
        <h2
          id="decision-dock-title"
          className="mt-1 font-[var(--font-space-grotesk)] text-lg font-medium text-sx-text-primary"
        >
          Choose one direction and set its limits
        </h2>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-sx-text-muted">
          Synthex can compare and challenge the options. Only you can choose the
          outcome, define success and decide which actions still need approval.
        </p>
      </div>

      {!visionMap && (
        <div className="p-5">
          <div className="rounded-btn border border-dashed border-white/[0.14] bg-white/[0.025] p-6 text-center">
            <Lock
              className="mx-auto h-5 w-5 text-sx-text-muted"
              aria-hidden="true"
            />
            <p className="mt-3 text-sm text-sx-text-secondary">
              Your decision comes after the research
            </p>
            <p className="mt-1 text-xs leading-5 text-sx-text-muted">
              Synthex will show the evidence and three different directions
              before asking you to choose.
            </p>
          </div>
        </div>
      )}

      {visionMap && !goalContract && (
        <div className="grid gap-0 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
          <div className="space-y-3 border-b border-white/[0.08] p-4 md:p-5 xl:border-b-0 xl:border-r">
            {visionMap.hypotheses.map((hypothesis, index) => (
              <button
                key={hypothesis.id}
                type="button"
                onClick={() => onSelectHypothesis(hypothesis.id)}
                aria-pressed={selectedHypothesisId === hypothesis.id}
                className={cn(
                  'w-full rounded-btn border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                  selectedHypothesisId === hypothesis.id
                    ? 'border-sx-accent/35 bg-sx-accent/[0.07]'
                    : 'border-white/[0.09] bg-white/[0.025] hover:border-white/[0.18] hover:bg-white/[0.05]'
                )}
              >
                <div className="flex items-start gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/[0.1] font-mono text-xs text-sx-text-muted">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-[var(--font-space-grotesk)] text-sm font-medium text-sx-text-primary">
                        {hypothesis.title}
                      </span>
                      <span className="font-mono text-xs tabular-nums text-sx-success">
                        {Math.round(hypothesis.confidence * 100)}%
                      </span>
                    </span>
                    <span className="mt-2 line-clamp-2 block text-xs leading-5 text-sx-text-muted">
                      {hypothesis.causalMechanism}
                    </span>
                    <span className="mt-3 flex items-center gap-1 text-[11px] text-sx-text-muted">
                      {selectedHypothesisId === hypothesis.id && (
                        <Check className="h-3.5 w-3.5 text-sx-accent" />
                      )}
                      {hypothesis.affectedStakeholders.slice(0, 3).join(' · ')}
                    </span>
                  </span>
                </div>
              </button>
            ))}
          </div>

          <form onSubmit={approve} className="space-y-4 p-4 md:p-5">
            {selected ? (
              <>
                <div className="rounded-btn border border-emerald-400/20 bg-emerald-400/[0.05] p-4">
                  <p className="font-mono text-xs uppercase tracking-[0.18em] text-emerald-300/70">
                    Suggested outcome
                  </p>
                  <p className="mt-2 text-sm leading-6 text-sx-text-secondary">
                    {selected.desiredChange}
                  </p>
                  <p className="mt-3 text-xs leading-5 text-rose-200/70">
                    Main risk: {selected.mainRisk}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={useSuggestedGuardrails}
                  className="flex min-h-11 w-full items-center justify-between gap-3 rounded-[10px] border border-sx-intelligence/20 bg-sx-intelligence/[0.06] px-3 text-left text-xs text-sx-text-secondary transition-colors hover:border-sx-intelligence/35 hover:bg-sx-intelligence/[0.1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sx-accent active:scale-[0.96] motion-reduce:transform-none"
                >
                  <span className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-sx-intelligence" />
                    Use safe starting guardrails
                  </span>
                  <span className="text-sx-text-muted">Editable</span>
                </button>
                <label className="block text-sm text-sx-text-secondary">
                  Who this is for
                  <select
                    value={stakeholder}
                    onChange={event => setStakeholder(event.target.value)}
                    className="mt-2 min-h-11 w-full rounded-[10px] border border-white/[0.1] bg-sx-bg-primary/70 px-3 text-sm text-sx-text-primary outline-none placeholder:text-sx-text-muted/70 focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  >
                    {selected.affectedStakeholders.map(candidate => (
                      <option key={candidate} value={candidate}>
                        {candidate}
                      </option>
                    ))}
                  </select>
                </label>
                <DecisionField
                  label="What success looks like"
                  hint="One observable outcome per line"
                  value={criteria}
                  onChange={setCriteria}
                  placeholder={
                    'A first-time user can complete the flow without assistance.\nThe approved output preserves all authority boundaries.'
                  }
                />
                <DecisionField
                  label="What this must not become"
                  hint="What this goal must not become"
                  value={exclusions}
                  onChange={setExclusions}
                  placeholder={
                    'No autonomous publishing.\nNo rewrite of unrelated product areas.'
                  }
                />
                <DecisionField
                  label="Actions that still need approval"
                  hint="One non-negotiable boundary per line"
                  value={boundaries}
                  onChange={setBoundaries}
                  placeholder="Human approval is required before any downstream action."
                />
                {validation && (
                  <p role="alert" className="text-sm text-rose-300">
                    {validation}
                  </p>
                )}
                <Button
                  type="submit"
                  variant="glass-success"
                  size="xl"
                  disabled={busy}
                  className="min-h-11 w-full focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  {busy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <BadgeCheck className="h-4 w-4" />
                  )}
                  Approve this exact direction
                </Button>
              </>
            ) : (
              <div className="flex min-h-[320px] flex-col items-center justify-center rounded-btn border border-dashed border-white/[0.14] p-6 text-center">
                <ArrowRight className="h-5 w-5 text-sx-accent" />
                <p className="mt-3 text-sm text-sx-text-secondary">
                  Select a candidate direction
                </p>
                <p className="mt-1 max-w-xs text-xs leading-5 text-sx-text-muted">
                  You will then define success, exclusions and approval limits.
                </p>
              </div>
            )}
          </form>
        </div>
      )}

      {goalContract && (
        <div className="grid gap-0 lg:grid-cols-2">
          <div className="border-b border-white/[0.08] p-4 md:p-5 lg:border-b-0 lg:border-r">
            <div className="flex items-center gap-2 text-emerald-300">
              <BadgeCheck className="h-5 w-5" aria-hidden="true" />
              <p className="font-mono text-xs uppercase tracking-[0.2em]">
                Direction approved
              </p>
            </div>
            <h3 className="mt-3 font-[var(--font-space-grotesk)] text-xl text-sx-text-primary">
              {goalContract.desiredChange}
            </h3>
            <div className="mt-5 space-y-4 text-sm">
              <ContractList
                label="What success looks like"
                values={goalContract.acceptanceCriteria}
              />
              <ContractList
                label="Actions that still need approval"
                values={goalContract.authorityBoundaries}
              />
              {goalContract.exclusions.length > 0 && (
                <ContractList
                  label="Exclusions"
                  values={goalContract.exclusions}
                />
              )}
            </div>
          </div>

          <div className="p-4 md:p-5">
            {workPacket ? (
              <div className="h-full rounded-btn border border-sx-intelligence/20 bg-sx-intelligence/[0.04] p-4">
                <div className="flex items-center gap-2 text-sx-intelligence">
                  <FileText className="h-4 w-4" />
                  <p className="font-mono text-xs uppercase tracking-[0.2em]">
                    Action-ready plan
                  </p>
                </div>
                <p className="mt-3 text-sm leading-6 text-sx-text-secondary">
                  {workPacket.goal}
                </p>
                <p className="mt-4 text-xs leading-5 text-sx-text-muted">
                  This plan carries only the outcome, evidence and limits you
                  approved. It does not publish, purchase or contact anyone.
                </p>
              </div>
            ) : (
              <div className="flex h-full min-h-[260px] flex-col items-center justify-center rounded-btn border border-dashed border-white/[0.14] p-6 text-center">
                <Shield
                  className="h-6 w-6 text-sx-intelligence"
                  aria-hidden="true"
                />
                <p className="mt-3 text-sm text-sx-text-secondary">
                  Your approved direction is ready to prepare
                </p>
                <p className="mt-2 max-w-sm text-xs leading-5 text-sx-text-muted">
                  Prepare a bounded plan that another person or tool can follow.
                  This step still does not execute, publish or purchase
                  anything.
                </p>
                <Button
                  type="button"
                  variant="glass-primary"
                  size="xl"
                  disabled={busy}
                  onClick={onBuildWorkPacket}
                  className="mt-5 min-h-11 focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  {busy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <FileText className="h-4 w-4" />
                  )}
                  Prepare this plan
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function DecisionField({
  label,
  hint,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  hint: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  const id = `decision-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  return (
    <label htmlFor={id} className="block text-sm text-sx-text-secondary">
      {label}
      <span className="ml-2 text-[11px] text-sx-text-muted">{hint}</span>
      <Textarea
        id={id}
        variant="glass-solid"
        resize="vertical"
        value={value}
        onChange={event => onChange(event.target.value)}
        placeholder={placeholder}
        className="mt-2 min-h-[94px] focus-visible:ring-orange-500 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      />
    </label>
  );
}

function ContractList({ label, values }: { label: string; values: string[] }) {
  return (
    <div>
      <p className="font-mono text-xs uppercase tracking-[0.18em] text-sx-text-muted">
        {label}
      </p>
      <ul className="mt-2 space-y-2">
        {values.map(value => (
          <li
            key={value}
            className="flex gap-2 text-xs leading-5 text-sx-text-secondary"
          >
            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-300" />
            {value}
          </li>
        ))}
      </ul>
    </div>
  );
}
