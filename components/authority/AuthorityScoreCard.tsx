'use client';

/**
 * AuthorityScoreCard
 *
 * Dashboard widget for the Synthex Authority Score (SYN-513).
 * Displays a 0–100 E.E.A.T. composite score with a per-pillar breakdown
 * and an actionable improvement hint.
 *
 * Data: GET /api/dashboard/authority-score
 * Refresh: every 5 minutes (score is cached 24h server-side, so this is
 * just to pick up manual ?force=true refreshes or new cache writes).
 *
 * @task SYN-513
 */

import useSWR from 'swr';

// ── Types ─────────────────────────────────────────────────────────────────────

interface EEATBreakdown {
  gbpCompleteness: number; // 0–25
  reviewVelocity: number; // 0–20
  contentFreshness: number; // 0–20
  backlinkSignals: number; // 0–15
  schemaCoverage: number; // 0–10
  socialProof: number; // 0–10
}

interface AuthorityScoreData {
  score: number;
  breakdown: EEATBreakdown;
  signalsVersion: string;
  computedAt: string;
  fromCache: boolean;
}

interface AuthorityScoreResponse {
  success: boolean;
  data: AuthorityScoreData;
}

// ── Fetcher ───────────────────────────────────────────────────────────────────

const fetchJson = (url: string) =>
  fetch(url, { credentials: 'include' }).then(r => r.json());

// ── Helpers ───────────────────────────────────────────────────────────────────

function getScoreColour(score: number): string {
  if (score >= 75) return '#22c55e'; // green-500
  if (score >= 50) return '#f59e0b'; // amber-500
  if (score >= 25) return '#f97316'; // orange-500
  return '#ef4444'; // red-500
}

function getScoreLabel(score: number): string {
  if (score >= 75) return 'Strong';
  if (score >= 50) return 'Developing';
  if (score >= 25) return 'Building';
  return 'Getting started';
}

function getTopImprovementHint(breakdown: EEATBreakdown): string {
  const pillars: { key: keyof EEATBreakdown; max: number; hint: string }[] = [
    {
      key: 'gbpCompleteness',
      max: 25,
      hint: 'Complete your Google Business Profile — add address, phone, hours, and categories.',
    },
    {
      key: 'reviewVelocity',
      max: 20,
      hint: 'Ask recent customers to leave a Google review. Aim for at least 3 reviews this month.',
    },
    {
      key: 'contentFreshness',
      max: 20,
      hint: 'Publish at least 4 posts this month to maximise your content freshness score.',
    },
    {
      key: 'backlinkSignals',
      max: 15,
      hint: 'Build backlinks from local directories and industry partners to boost authority.',
    },
    {
      key: 'schemaCoverage',
      max: 10,
      hint: 'Complete your Brand DNA profile — add your business tone and industry.',
    },
    {
      key: 'socialProof',
      max: 10,
      hint: 'Encourage happy customers to leave high-quality reviews to lift your average rating.',
    },
  ];

  let biggestGap = -1;
  let bestHint =
    'Keep building your online presence to improve your Authority Score.';

  for (const pillar of pillars) {
    const gap = pillar.max - breakdown[pillar.key];
    if (gap > biggestGap) {
      biggestGap = gap;
      bestHint = pillar.hint;
    }
  }

  return bestHint;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ScoreRing({ score }: { score: number }) {
  const radius = 46;
  const circumference = 2 * Math.PI * radius;
  const filled = (score / 100) * circumference;
  const colour = getScoreColour(score);

  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: 112, height: 112 }}
    >
      <svg width="112" height="112" viewBox="0 0 112 112" fill="none">
        {/* Track */}
        <circle
          cx="56"
          cy="56"
          r={radius}
          stroke="#1f2937"
          strokeWidth="8"
          fill="none"
        />
        {/* Fill */}
        <circle
          cx="56"
          cy="56"
          r={radius}
          stroke={colour}
          strokeWidth="8"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${filled} ${circumference - filled}`}
          strokeDashoffset={circumference * 0.25}
          style={{ transition: 'stroke-dasharray 0.8s ease-out' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold text-white leading-none">
          {score}
        </span>
        <span className="text-xs text-gray-400 mt-0.5">/ 100</span>
      </div>
    </div>
  );
}

interface PillarBarProps {
  label: string;
  value: number;
  maxValue: number;
}

function PillarBar({ label, value, maxValue }: PillarBarProps) {
  const pct = Math.round((value / maxValue) * 100);
  const colour = getScoreColour(pct);

  return (
    <div className="flex items-center gap-3">
      <span className="w-36 text-xs text-gray-400 truncate shrink-0">
        {label}
      </span>
      <div className="flex-1 h-1.5 rounded-full bg-gray-800 overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{
            width: `${pct}%`,
            backgroundColor: colour,
            transition: 'width 0.8s ease-out',
          }}
        />
      </div>
      <span className="text-xs text-gray-500 w-12 text-right shrink-0">
        {value}/{maxValue}
      </span>
    </div>
  );
}

function AuthorityScoreSkeleton() {
  return (
    <div className="rounded-2xl bg-[#0d0d14] border border-white/5 p-6 animate-pulse">
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="h-4 w-32 bg-gray-800 rounded mb-2" />
          <div className="h-3 w-48 bg-gray-800 rounded" />
        </div>
        <div className="h-6 w-16 bg-gray-800 rounded-full" />
      </div>
      <div className="flex items-center gap-6 mb-6">
        <div className="w-28 h-28 rounded-full bg-gray-800" />
        <div className="flex-1 space-y-2">
          <div className="h-3 w-24 bg-gray-800 rounded" />
          <div className="h-6 w-16 bg-gray-800 rounded" />
          <div className="h-3 w-40 bg-gray-800 rounded" />
        </div>
      </div>
      <div className="space-y-2">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-3 bg-gray-800 rounded w-full" />
        ))}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function AuthorityScoreCard() {
  const { data, error, isLoading, mutate } = useSWR<AuthorityScoreResponse>(
    '/api/dashboard/authority-score',
    fetchJson,
    {
      refreshInterval: 300_000, // 5 min poll (server cache is 24h)
      dedupingInterval: 60_000, // 1 min dedup
    }
  );

  if (isLoading) return <AuthorityScoreSkeleton />;

  if (error || !data?.success) {
    return (
      <div className="rounded-2xl bg-[#0d0d14] border border-white/5 p-6">
        <p className="text-sm text-gray-500">Unable to load Authority Score.</p>
      </div>
    );
  }

  const { score, breakdown, computedAt, fromCache } = data.data;
  const colour = getScoreColour(score);
  const label = getScoreLabel(score);
  const hint = getTopImprovementHint(breakdown);
  const computedDate = new Date(computedAt).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="rounded-2xl bg-[#0d0d14] border border-white/5 p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <h3 className="text-sm font-semibold text-white">Authority Score</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            E.E.A.T. composite · v{data.data.signalsVersion}
          </p>
        </div>
        <button
          onClick={() => mutate()}
          className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
          title="Refresh score"
        >
          {fromCache ? 'Cached' : 'Live'} ↻
        </button>
      </div>

      {/* Score ring + label */}
      <div className="flex items-center gap-5 mb-6">
        <ScoreRing score={score} />
        <div>
          <p className="text-xs text-gray-500 mb-1">Overall</p>
          <p className="text-2xl font-bold" style={{ color: colour }}>
            {label}
          </p>
          <p className="text-xs text-gray-500 mt-1">Updated {computedDate}</p>
        </div>
      </div>

      {/* Pillar breakdown */}
      <div className="space-y-2.5 mb-5">
        <PillarBar
          label="GBP completeness"
          value={breakdown.gbpCompleteness}
          maxValue={25}
        />
        <PillarBar
          label="Review velocity"
          value={breakdown.reviewVelocity}
          maxValue={20}
        />
        <PillarBar
          label="Content freshness"
          value={breakdown.contentFreshness}
          maxValue={20}
        />
        <PillarBar
          label="Backlink signals"
          value={breakdown.backlinkSignals}
          maxValue={15}
        />
        <PillarBar
          label="Schema coverage"
          value={breakdown.schemaCoverage}
          maxValue={10}
        />
        <PillarBar
          label="Social proof"
          value={breakdown.socialProof}
          maxValue={10}
        />
      </div>

      {/* Improvement hint */}
      <div className="rounded-lg bg-orange-500/5 border border-orange-500/15 px-3 py-2.5">
        <p className="text-xs text-orange-300/80 leading-relaxed">
          <span className="font-semibold text-orange-300">Next step: </span>
          {hint}
        </p>
      </div>
    </div>
  );
}
