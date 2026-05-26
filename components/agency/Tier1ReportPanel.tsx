'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, BarChart2 } from '@/components/icons';
import { toast } from 'sonner';

interface Tier1Data {
  id: string;
  name: string;
  generatedAt: string | null;
  snapshot: {
    weekEnding: string;
    headline: { narrative: string; status: string };
  };
}

export function Tier1ReportPanel() {
  const [data, setData] = useState<Tier1Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/agency/tier1-report', {
        credentials: 'include',
      });
      if (res.ok) {
        const json = await res.json();
        setData(json.data);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleGenerate() {
    setGenerating(true);
    try {
      const res = await fetch('/api/agency/tier1-report', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        toast.error('Failed to generate Tier-1 report');
        return;
      }
      toast.success('Tier-1 snapshot generated');
      await load();
    } finally {
      setGenerating(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/5 p-6 flex items-center gap-2 text-slate-300">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading Tier-1 report…
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-orange-500/20 bg-orange-500/5 p-5 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <BarChart2 className="h-5 w-5 text-orange-300" />
          <h3 className="text-sm font-semibold text-white">
            Portfolio Tier-1 (weekly)
          </h3>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="border-white/10"
          onClick={handleGenerate}
          disabled={generating}
        >
          {generating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            'Generate snapshot'
          )}
        </Button>
      </div>
      {data ? (
        <p className="text-sm text-slate-300">
          Week ending {data.snapshot?.weekEnding ?? '—'} —{' '}
          {data.snapshot?.headline?.narrative}
        </p>
      ) : (
        <p className="text-sm text-slate-400">
          No Tier-1 report yet. Generate a snapshot or wait for Monday 07:00
          AEST cron.
        </p>
      )}
    </div>
  );
}
