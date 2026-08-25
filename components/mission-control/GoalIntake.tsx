'use client';

import { useState } from 'react';
import { Loader2, Target } from '@/components/icons';

export function GoalIntake({
  onSubmit,
  disabled,
}: {
  onSubmit: (goal: string, acceptanceCriteria: string) => Promise<void>;
  disabled?: boolean;
}) {
  const [goal, setGoal] = useState('');
  const [acceptance, setAcceptance] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (goal.trim().length < 8) {
      setError('Describe the goal in at least a short sentence.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSubmit(goal.trim(), acceptance.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start mission');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="border-[0.5px] border-white/6 bg-white/1 rounded-sm p-5 sm:p-6 space-y-5"
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 h-8 w-8 flex items-center justify-center border-[0.5px] border-candy-orange/25 bg-candy-orange/8 rounded-sm">
          <Target className="h-4 w-4 text-candy-orange" />
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-white/30 mb-1">
            Scene 1 · Goal intake
          </p>
          <h2 className="text-xl font-light text-white tracking-tight">
            What should we ship?
          </h2>
          <p className="text-sm text-white/40 mt-1 leading-relaxed max-w-xl">
            Write the outcome. We analyse the GitHub repo, bind a Linear
            project, draft tickets, and wait for your approval before creating
            anything in Linear.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <label
          htmlFor="mc-goal"
          className="text-xs uppercase tracking-[0.18em] text-white/35"
        >
          Goal
        </label>
        <textarea
          id="mc-goal"
          rows={3}
          value={goal}
          onChange={e => setGoal(e.target.value)}
          disabled={disabled || busy}
          placeholder="e.g. Redesign Mission Control so goals become approved Linear tickets with repo context"
          className="w-full bg-black/30 border-[0.5px] border-white/10 rounded-sm px-3 py-2.5 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-candy-orange/40 resize-y min-h-[88px]"
        />
      </div>

      <div className="space-y-2">
        <label
          htmlFor="mc-ac"
          className="text-xs uppercase tracking-[0.18em] text-white/35"
        >
          Acceptance criteria{' '}
          <span className="text-white/20 normal-case tracking-normal">
            (optional)
          </span>
        </label>
        <textarea
          id="mc-ac"
          rows={3}
          value={acceptance}
          onChange={e => setAcceptance(e.target.value)}
          disabled={disabled || busy}
          placeholder="One criterion per line. What must be true when this is done?"
          className="w-full bg-black/30 border-[0.5px] border-white/10 rounded-sm px-3 py-2.5 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-candy-orange/40 resize-y"
        />
      </div>

      {error && (
        <p className="text-xs text-red-300/90 border-[0.5px] border-red-500/20 bg-red-500/5 px-3 py-2 rounded-sm">
          {error}
        </p>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={disabled || busy}
          className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-medium tracking-wide rounded-sm bg-candy-orange text-charcoal-950 hover:bg-candy-orange-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Start mission
        </button>
      </div>
    </form>
  );
}
