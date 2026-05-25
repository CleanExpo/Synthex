'use client';

/**
 * RunAgentButton — synchronous trigger for a single agent run.
 *
 * Posts to /api/marketing-agency/agents/[id]/run and waits for completion
 * (server route is maxDuration=60). On success, calls onComplete so the
 * parent panel can refetch the agent list (lastRunAt updates).
 */
import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface RunAgentButtonProps {
  agentId: string;
  disabled?: boolean;
  onComplete?: () => void;
}

export function RunAgentButton({
  agentId,
  disabled,
  onComplete,
}: RunAgentButtonProps) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRun() {
    setRunning(true);
    setError(null);
    try {
      const res = await fetch(`/api/marketing-agency/agents/${agentId}/run`, {
        method: 'POST',
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Run failed (${res.status})`);
      }
      const data = (await res.json()) as { run?: { id: string } };
      onComplete?.();
      if (data.run?.id) {
        router.push(`/dashboard/marketing-agency/runs/${data.run.id}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Run failed');
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={handleRun}
        disabled={disabled || running}
        className="rounded-sm bg-emerald-500/20 px-3 py-1.5 text-xs font-medium text-emerald-200 hover:bg-emerald-500/30 disabled:opacity-50"
      >
        {running ? 'Running…' : 'Run Now'}
      </button>
      {error && (
        <span className="text-xs text-red-300">{error}</span>
      )}
    </div>
  );
}
