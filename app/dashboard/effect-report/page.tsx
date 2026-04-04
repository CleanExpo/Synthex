'use client';

/**
 * /dashboard/effect-report
 *
 * Index page: redirects to the most recent Effect Report, or shows
 * an empty state with a generation prompt if no report exists yet.
 * SYN-674
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { Button } from '@/components/ui/button';
import { Sparkles, FileText } from '@/components/icons';

interface ReportSummary {
  id: string;
  quarterLabel: string;
  periodEnd: string;
}

const fetchJson = (url: string) =>
  fetch(url, { credentials: 'include' }).then(r => r.json());

export default function EffectReportIndexPage() {
  const router = useRouter();
  const { data, isLoading } = useSWR<{ reports: ReportSummary[] }>(
    '/api/effect-report/list',
    fetchJson
  );

  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  // Auto-redirect if reports exist
  useEffect(() => {
    if (data?.reports && data.reports.length > 0) {
      const latest = data.reports[0];
      router.replace(
        `/dashboard/effect-report/${encodeURIComponent(latest.quarterLabel)}`
      );
    }
  }, [data, router]);

  async function handleGenerate() {
    setGenerating(true);
    setGenError(null);
    try {
      const res = await fetch('/api/effect-report/generate', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        error?: string;
        report_id?: string;
      };
      if (!res.ok || !json.ok) {
        setGenError(json.error ?? 'Generation failed');
      } else {
        router.refresh();
      }
    } catch {
      setGenError('Network error — please try again');
    } finally {
      setGenerating(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="animate-pulse text-gray-400 text-sm">
          Loading your Effect Report…
        </div>
      </div>
    );
  }

  // No reports yet — show empty state
  return (
    <div className="flex flex-col items-center justify-center py-24 px-8 text-center max-w-lg mx-auto">
      <div className="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-6">
        <FileText className="w-8 h-8 text-amber-400" />
      </div>
      <h1 className="text-2xl font-bold text-white mb-3">Your Effect Report</h1>
      <p className="text-gray-300 mb-8 leading-relaxed">
        Your quarterly Synthex Effect Report packages every metric, win, and
        projection into one shareable artefact. Reports are generated
        automatically at the end of each quarter.
      </p>
      <Button
        onClick={handleGenerate}
        disabled={generating}
        className="bg-amber-600 hover:bg-amber-500 text-white border-0"
      >
        <Sparkles className="w-4 h-4 mr-2" />
        {generating ? 'Generating…' : 'Generate Preview Report'}
      </Button>
      {genError && <p className="mt-4 text-sm text-red-400">{genError}</p>}
      <p className="mt-6 text-xs text-gray-500">
        Preview reports require at least 45 days of Synthex data.
      </p>
    </div>
  );
}
