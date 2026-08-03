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

  return (
    <section
      aria-labelledby="decision-dock-title"
      className="rounded-[20px] border border-white/[0.12] bg-[rgba(15,23,42,0.90)] shadow-[0_8px_32px_rgba(0,0,0,0.37)] backdrop-blur-xl"
    >
      <div className="border-b border-white/[0.08] p-4 md:p-5">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-amber-300" aria-hidden="true" />
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-amber-300/70">
            Human decision dock
          </p>
        </div>
        <h2
          id="decision-dock-title"
          className="mt-1 font-[var(--font-space-grotesk)] text-lg font-medium text-slate-50"
        >
          Promote one direction into an accountable goal
        </h2>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-400">
          The agents can explore and challenge. Only you can select the exact
          hypothesis version and authorise the boundary for downstream work.
        </p>
      </div>

      {!visionMap && (
        <div className="p-5">
          <div className="rounded-[14px] border border-dashed border-white/[0.14] bg-white/[0.025] p-6 text-center">
            <Lock
              className="mx-auto h-5 w-5 text-slate-500"
              aria-hidden="true"
            />
            <p className="mt-3 text-sm text-slate-300">Decision dock locked</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              A vision must pass the deterministic anchoring gate and
              independent evaluator before anything can be approved.
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
                  'w-full rounded-[14px] border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                  selectedHypothesisId === hypothesis.id
                    ? 'border-amber-300/35 bg-amber-300/[0.07]'
                    : 'border-white/[0.09] bg-white/[0.025] hover:border-white/[0.18] hover:bg-white/[0.05]'
                )}
              >
                <div className="flex items-start gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/[0.1] font-mono text-xs text-slate-400">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-[var(--font-space-grotesk)] text-sm font-medium text-slate-100">
                        {hypothesis.title}
                      </span>
                      <span className="font-mono text-xs text-emerald-300/70">
                        {Math.round(hypothesis.confidence * 100)}%
                      </span>
                    </span>
                    <span className="mt-2 line-clamp-2 block text-xs leading-5 text-slate-400">
                      {hypothesis.causalMechanism}
                    </span>
                    <span className="mt-3 flex items-center gap-1 text-[11px] text-slate-500">
                      {selectedHypothesisId === hypothesis.id && (
                        <Check className="h-3.5 w-3.5 text-amber-300" />
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
                <div className="rounded-[14px] border border-emerald-400/20 bg-emerald-400/[0.05] p-4">
                  <p className="font-mono text-xs uppercase tracking-[0.18em] text-emerald-300/70">
                    Proposed desired change
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-200">
                    {selected.desiredChange}
                  </p>
                  <p className="mt-3 text-xs leading-5 text-rose-200/70">
                    Main risk: {selected.mainRisk}
                  </p>
                </div>
                <label className="block text-sm text-slate-200">
                  Primary stakeholder
                  <select
                    value={stakeholder}
                    onChange={event => setStakeholder(event.target.value)}
                    className="mt-2 min-h-11 w-full rounded-[10px] border border-white/[0.1] bg-slate-950/70 px-3 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  >
                    {selected.affectedStakeholders.map(candidate => (
                      <option key={candidate} value={candidate}>
                        {candidate}
                      </option>
                    ))}
                  </select>
                </label>
                <DecisionField
                  label="Acceptance criteria"
                  hint="One observable outcome per line"
                  value={criteria}
                  onChange={setCriteria}
                  placeholder={
                    'A first-time user can complete the flow without assistance.\nThe approved output preserves all authority boundaries.'
                  }
                />
                <DecisionField
                  label="Explicit exclusions"
                  hint="What this goal must not become"
                  value={exclusions}
                  onChange={setExclusions}
                  placeholder={
                    'No autonomous publishing.\nNo rewrite of unrelated product areas.'
                  }
                />
                <DecisionField
                  label="Authority boundaries"
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
              <div className="flex min-h-[320px] flex-col items-center justify-center rounded-[14px] border border-dashed border-white/[0.14] p-6 text-center">
                <ArrowRight className="h-5 w-5 text-amber-300" />
                <p className="mt-3 text-sm text-slate-300">
                  Select a candidate direction
                </p>
                <p className="mt-1 max-w-xs text-xs leading-5 text-slate-500">
                  You will then define success, exclusions and authority before
                  approval.
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
                Goal contract approved
              </p>
            </div>
            <h3 className="mt-3 font-[var(--font-space-grotesk)] text-xl text-slate-50">
              {goalContract.desiredChange}
            </h3>
            <div className="mt-5 space-y-4 text-sm">
              <ContractList
                label="Acceptance criteria"
                values={goalContract.acceptanceCriteria}
              />
              <ContractList
                label="Authority boundaries"
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
              <div className="h-full rounded-[14px] border border-sky-300/20 bg-sky-300/[0.04] p-4">
                <div className="flex items-center gap-2 text-sky-300">
                  <FileText className="h-4 w-4" />
                  <p className="font-mono text-xs uppercase tracking-[0.2em]">
                    Governed work packet
                  </p>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-200">
                  {workPacket.goal}
                </p>
                <p className="mt-4 text-xs leading-5 text-slate-500">
                  This packet carries the approved goal, evidence references,
                  acceptance criteria, exclusions and authority boundaries into
                  downstream agents. It contains no new authority.
                </p>
              </div>
            ) : (
              <div className="flex h-full min-h-[260px] flex-col items-center justify-center rounded-[14px] border border-dashed border-white/[0.14] p-6 text-center">
                <Shield className="h-6 w-6 text-sky-300" aria-hidden="true" />
                <p className="mt-3 text-sm text-slate-200">
                  The action boundary is now unlocked
                </p>
                <p className="mt-2 max-w-sm text-xs leading-5 text-slate-500">
                  Build a governed packet that downstream agents can consume.
                  Creating the packet does not execute, publish or purchase
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
                  Build governed work packet
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
    <label htmlFor={id} className="block text-sm text-slate-200">
      {label}
      <span className="ml-2 text-[11px] text-slate-500">{hint}</span>
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
      <p className="font-mono text-xs uppercase tracking-[0.18em] text-slate-500">
        {label}
      </p>
      <ul className="mt-2 space-y-2">
        {values.map(value => (
          <li
            key={value}
            className="flex gap-2 text-xs leading-5 text-slate-300"
          >
            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-300" />
            {value}
          </li>
        ))}
      </ul>
    </div>
  );
}
