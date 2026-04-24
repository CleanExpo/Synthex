'use client';

/**
 * BrandIQCard
 *
 * Displays the Brand IQ score for the current organisation.
 * Renders two states from a single component:
 *   • Locked  — blurred preview with lock icon + teaser copy
 *   • Unlocked — score ring, voice attributes, audience resonance,
 *               top trend insights, and 3 AI-generated next steps
 *
 * The unlock transition is a 0.6s CSS opacity + blur animation so the
 * card "reveals" when firstWinDetected flips true without a page reload.
 *
 * Data fetched via:
 *   GET /api/dashboard/brand-iq          — initial paint (locked/unlocked + scores)
 *   GET /api/dashboard/brand-iq?nextSteps=true — lazy-loaded after unlock
 *
 * @task SYN-527
 */

import useSWR from 'swr';
import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Lock,
  Sparkles,
  Zap,
  Target,
  Flame,
  Award,
  Loader2,
} from '@/components/icons';
import { cn } from '@/lib/utils';

// ── Fetcher ───────────────────────────────────────────────────────────────────

const fetchJson = (url: string) =>
  fetch(url, { credentials: 'include' }).then(r => r.json());

// ── Types ─────────────────────────────────────────────────────────────────────

interface BrandDnaSummary {
  businessName: string;
  industry: string;
  vertical: string;
  tone: string | null;
  formality: number | null;
  boldness: number | null;
  seoScore: number | null;
}

interface TrendInsightItem {
  id: string;
  platform: string;
  category: string;
  insight: string;
  confidence: number;
  dataPoints: number;
}

interface NextStepItem {
  action: string;
  reason: string;
}

interface BrandIQData {
  locked: boolean;
  brandScore: number;
  voiceConsistency: number;
  audienceResonance: number;
  brandDna: BrandDnaSummary | null;
  insights: TrendInsightItem[];
  nextSteps: NextStepItem[];
}

interface BrandIQResponse {
  success: boolean;
  data: BrandIQData;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ScoreRing({ score }: { score: number }) {
  const circumference = 2 * Math.PI * 46; // radius 46
  const offset = circumference - (score / 100) * circumference;
  const colour = score >= 75 ? '#f97316' : score >= 50 ? '#f59e0b' : '#64748b';

  return (
    <div className="relative w-28 h-28 flex-shrink-0">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
        {/* Track */}
        <circle
          cx="50"
          cy="50"
          r="46"
          fill="none"
          stroke="rgba(255,255,255,0.05)"
          strokeWidth="6"
        />
        {/* Progress arc */}
        <circle
          cx="50"
          cy="50"
          r="46"
          fill="none"
          stroke={colour}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-semibold text-white leading-none">
          {score}
        </span>
        <span className="text-[10px] text-white/40 mt-0.5">/100</span>
      </div>
    </div>
  );
}

function MetricBar({
  label,
  value,
  colour,
}: {
  label: string;
  value: number;
  colour: string;
}) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center">
        <span className="text-xs text-white/50">{label}</span>
        <span className="text-xs text-white/70 font-medium">{value}%</span>
      </div>
      <div className="h-1 bg-white/[0.06] rounded-full overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-700',
            colour
          )}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

function VoiceChip({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-sm bg-orange-500/[0.08] border border-orange-500/20 text-[11px] text-orange-300/80">
      <span className="text-white/40">{label}:</span> {value}
    </span>
  );
}

function CategoryBadge({ category }: { category: string }) {
  const colours: Record<string, string> = {
    hook: 'text-violet-300 bg-violet-500/10 border-violet-500/20',
    visual_style: 'text-cyan-300 bg-cyan-500/10 border-cyan-500/20',
    hashtag: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20',
    topic: 'text-amber-300 bg-amber-500/10 border-amber-500/20',
    format: 'text-blue-300 bg-blue-500/10 border-blue-500/20',
    cta: 'text-pink-300 bg-pink-500/10 border-pink-500/20',
  };
  return (
    <span
      className={cn(
        'inline-block px-1.5 py-0.5 text-[10px] rounded-sm border capitalize',
        colours[category] ?? 'text-white/40 bg-white/[0.04] border-white/[0.08]'
      )}
    >
      {category.replace('_', ' ')}
    </span>
  );
}

// ── Locked state overlay ──────────────────────────────────────────────────────

function LockedOverlay() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center z-10 rounded-sm">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-[#060609]/80 backdrop-blur-[2px] rounded-sm" />
      {/* Content */}
      <div className="relative flex flex-col items-center gap-3 px-6 text-center">
        <div className="w-10 h-10 flex items-center justify-center bg-white/[0.04] border border-white/[0.08] rounded-sm">
          <Lock className="w-4 h-4 text-white/40" />
        </div>
        <div>
          <p className="text-sm font-medium text-white/70 mb-1">
            Brand IQ locked
          </p>
          <p className="text-xs text-white/40 max-w-[220px] leading-relaxed">
            Earn your first content win to unlock personalised brand
            intelligence.
          </p>
        </div>
        <a
          href="/dashboard/content/drafts"
          className="mt-1 inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-orange-500/20 hover:bg-orange-500/30 border border-orange-500/30 text-orange-300 rounded-sm transition-colors"
        >
          <Flame className="w-3.5 h-3.5" />
          Create your first post
        </a>
      </div>
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function BrandIQSkeleton() {
  return (
    <Card variant="glass">
      <CardContent className="p-5 space-y-4 animate-pulse">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 rounded-sm bg-white/[0.04]" />
          <div className="h-4 w-24 bg-white/[0.04] rounded-sm" />
        </div>
        <div className="flex gap-4 items-center">
          <div className="w-28 h-28 rounded-full bg-white/[0.04]" />
          <div className="flex-1 space-y-3">
            <div className="h-2 bg-white/[0.04] rounded-sm" />
            <div className="h-2 bg-white/[0.04] rounded-sm w-4/5" />
            <div className="h-2 bg-white/[0.04] rounded-sm w-3/5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function BrandIQCard() {
  const { data: raw, isLoading } = useSWR<BrandIQResponse>(
    '/api/dashboard/brand-iq',
    fetchJson,
    { refreshInterval: 120_000, dedupingInterval: 60_000 }
  );

  // Lazy-load next steps only once unlocked — avoids blocking initial paint
  const { data: nsRaw } = useSWR<BrandIQResponse>(
    raw?.data && !raw.data.locked
      ? '/api/dashboard/brand-iq?nextSteps=true'
      : null,
    fetchJson,
    { revalidateOnFocus: false, dedupingInterval: 300_000 }
  );

  // Track the "just unlocked" state for the reveal animation
  const [wasLocked, setWasLocked] = useState<boolean | null>(null);
  const [revealing, setRevealing] = useState(false);

  useEffect(() => {
    if (raw?.data == null) return undefined;
    const isLocked = raw.data.locked;
    if (wasLocked === true && isLocked === false) {
      // Transition: locked → unlocked
      setRevealing(true);
      const t = setTimeout(() => setRevealing(false), 600);
      return () => clearTimeout(t);
    }
    setWasLocked(isLocked);
    return undefined;
  }, [raw?.data?.locked]); // eslint-disable-line react-hooks/exhaustive-deps

  if (isLoading || !raw?.data) return <BrandIQSkeleton />;

  const data = raw.data;
  const nextSteps = nsRaw?.data?.nextSteps ?? [];

  return (
    <Card
      variant="glass"
      className={cn(
        'relative overflow-hidden transition-all duration-600',
        revealing && 'ring-1 ring-orange-500/30'
      )}
    >
      {/* Locked overlay sits above blurred content */}
      {data.locked && <LockedOverlay />}

      {/* Content (blurred when locked) */}
      <div
        className={cn(
          'transition-all duration-600',
          data.locked && 'blur-sm pointer-events-none select-none opacity-40'
        )}
      >
        <CardHeader className="pb-0">
          <CardTitle className="flex items-center gap-2 text-white/80 text-sm font-medium">
            <Sparkles className="w-4 h-4 text-orange-400" />
            Brand IQ
          </CardTitle>
        </CardHeader>

        <CardContent className="pt-4 space-y-5">
          {/* ── Score ring + metric bars ─────────────────────────── */}
          <div className="flex items-center gap-5">
            <ScoreRing score={data.brandScore} />
            <div className="flex-1 space-y-2.5">
              <MetricBar
                label="Voice consistency"
                value={data.voiceConsistency}
                colour="bg-orange-500"
              />
              <MetricBar
                label="Audience resonance"
                value={data.audienceResonance}
                colour="bg-violet-500"
              />
              {data.brandDna?.seoScore != null && (
                <MetricBar
                  label="SEO score"
                  value={data.brandDna.seoScore}
                  colour="bg-emerald-500"
                />
              )}
            </div>
          </div>

          {/* ── Brand voice chips ────────────────────────────────── */}
          {data.brandDna && (
            <div className="flex flex-wrap gap-1.5">
              {data.brandDna.tone && (
                <VoiceChip label="Tone" value={data.brandDna.tone} />
              )}
              {data.brandDna.formality != null && (
                <VoiceChip
                  label="Formality"
                  value={`${data.brandDna.formality}/5`}
                />
              )}
              {data.brandDna.boldness != null && (
                <VoiceChip
                  label="Boldness"
                  value={`${data.brandDna.boldness}/5`}
                />
              )}
            </div>
          )}

          {/* ── Top trend insights ───────────────────────────────── */}
          {data.insights.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <Target className="w-3.5 h-3.5 text-violet-400" />
                <span className="text-[11px] text-white/50 uppercase tracking-widest">
                  Content signals
                </span>
              </div>
              <div className="space-y-1.5">
                {data.insights.slice(0, 3).map(ins => (
                  <div
                    key={ins.id}
                    className="flex items-start gap-2 py-1.5 border-b border-white/[0.04] last:border-0"
                  >
                    <CategoryBadge category={ins.category} />
                    <p className="text-xs text-white/60 leading-relaxed flex-1">
                      {ins.insight}
                    </p>
                    <span className="text-[10px] text-white/30 flex-shrink-0 mt-0.5">
                      {Math.round(ins.confidence * 100)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── AI-generated next steps ──────────────────────────── */}
          {nextSteps.length > 0 ? (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <Zap className="w-3.5 h-3.5 text-orange-400" />
                <span className="text-[11px] text-white/50 uppercase tracking-widest">
                  Next steps
                </span>
              </div>
              <ol className="space-y-2">
                {nextSteps.map((step, i) => (
                  <li key={i} className="flex gap-2.5">
                    <span className="flex-shrink-0 w-4 h-4 rounded-full bg-orange-500/20 border border-orange-500/30 flex items-center justify-center text-[9px] text-orange-300 font-semibold mt-0.5">
                      {i + 1}
                    </span>
                    <div>
                      <p className="text-xs text-white/80 leading-snug">
                        {step.action}
                      </p>
                      <p className="text-[11px] text-white/40 mt-0.5 leading-relaxed">
                        {step.reason}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          ) : !data.locked ? (
            /* Placeholder while next steps load */
            <div className="flex items-center gap-2 py-1 text-xs text-white/30">
              <Loader2 className="w-3 h-3 animate-spin" />
              Generating next steps…
            </div>
          ) : null}

          {/* ── "Powered by" footer ──────────────────────────────── */}
          <div className="flex items-center gap-1.5 pt-1 border-t border-white/[0.04]">
            <Award className="w-3.5 h-3.5 text-white/20" />
            <span className="text-[10px] text-white/25">
              Powered by Brand DNA · updated in real time
            </span>
          </div>
        </CardContent>
      </div>
    </Card>
  );
}
