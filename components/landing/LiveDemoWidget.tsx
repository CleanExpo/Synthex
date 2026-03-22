'use client';

import { useState, useRef } from 'react';
import type { AnalyzeResult } from '@/app/api/demo/analyze/route';

type DemoState = 'idle' | 'loading' | 'result' | 'error';

const QUICK_DEMOS = [
  { label: 'Cafe', emoji: '☕', url: 'https://www.starbucks.com.au' },
  { label: 'Tradie', emoji: '🔨', url: 'https://www.hipages.com.au' },
  { label: 'Salon', emoji: '💇', url: 'https://www.toniandguy.com' },
  { label: 'Gym', emoji: '💪', url: 'https://www.f45training.com' },
];

/** Instagram card skeleton shimmer */
function InstagramSkeleton() {
  return (
    <div className="bg-charcoal-800 border border-white/[0.06] rounded-2xl overflow-hidden">
      <div className="w-full h-44 bg-charcoal-700 relative overflow-hidden">
        <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/[0.05] to-transparent" />
      </div>
      <div className="p-4 space-y-2">
        <div className="h-3 bg-charcoal-700 rounded-full w-1/3 relative overflow-hidden">
          <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.5s_infinite_0.2s] bg-gradient-to-r from-transparent via-white/[0.05] to-transparent" />
        </div>
        <div className="h-3 bg-charcoal-700 rounded-full w-full relative overflow-hidden">
          <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.5s_infinite_0.3s] bg-gradient-to-r from-transparent via-white/[0.05] to-transparent" />
        </div>
        <div className="h-3 bg-charcoal-700 rounded-full w-4/5 relative overflow-hidden">
          <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.5s_infinite_0.4s] bg-gradient-to-r from-transparent via-white/[0.05] to-transparent" />
        </div>
      </div>
    </div>
  );
}

/** Business-type emoji */
function getEmoji(name: string): string {
  const lower = name.toLowerCase();
  if (
    lower.includes('cafe') ||
    lower.includes('coffee') ||
    lower.includes('food')
  )
    return '☕';
  if (
    lower.includes('tradie') ||
    lower.includes('plumb') ||
    lower.includes('electr') ||
    lower.includes('build')
  )
    return '🔨';
  if (
    lower.includes('salon') ||
    lower.includes('hair') ||
    lower.includes('beauty')
  )
    return '💇';
  if (lower.includes('gym') || lower.includes('fit') || lower.includes('sport'))
    return '💪';
  if (lower.includes('clean') || lower.includes('restore')) return '✨';
  if (lower.includes('retail') || lower.includes('fashion')) return '🛍️';
  if (lower.includes('dental') || lower.includes('health')) return '🏥';
  if (lower.includes('tech') || lower.includes('software')) return '💻';
  return '🏢';
}

/** Rendered Instagram card with graceful image loading */
function InstagramCard({
  businessName,
  imageUrl,
  caption,
}: {
  businessName: string;
  imageUrl: string;
  caption: string;
}) {
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);

  const handle = businessName.toLowerCase().replace(/[^a-z0-9]/g, '');
  const showGradient = !imageUrl || imgError;
  const showShimmer = !!imageUrl && !imgLoaded && !imgError;

  return (
    <div className="bg-charcoal-800 border border-white/[0.06] rounded-2xl overflow-hidden animate-[fade-in_0.4s_ease-out_forwards]">
      {/* Image area */}
      <div className="w-full h-44 bg-charcoal-700 relative overflow-hidden">
        {showShimmer && (
          <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/[0.05] to-transparent" />
        )}
        {imageUrl && !imgError && (
          <img
            src={imageUrl}
            alt={`${businessName} post`}
            className={`w-full h-full object-cover transition-opacity duration-500 ${imgLoaded ? 'opacity-100' : 'opacity-0'}`}
            onLoad={() => setImgLoaded(true)}
            onError={() => setImgError(true)}
          />
        )}
        {showGradient && (
          <div className="absolute inset-0 bg-gradient-to-br from-amber-900/30 via-charcoal-700 to-charcoal-800 flex flex-col items-center justify-center gap-2">
            <div className="text-5xl">{getEmoji(businessName)}</div>
            <p className="text-white/40 text-[11px] tracking-wide font-medium">
              {businessName}
            </p>
          </div>
        )}
      </div>

      {/* Caption */}
      <div className="p-4">
        <p className="text-white/50 text-xs font-semibold mb-1.5">@{handle}</p>
        <p className="text-white/80 text-sm leading-relaxed">{caption}</p>
      </div>
    </div>
  );
}

/** Single score bar with label + tip */
function ScoreBar({
  label,
  score,
  tip,
}: {
  label: string;
  score: number;
  tip: string;
}) {
  const barColor =
    score >= 70
      ? 'bg-green-500'
      : score >= 40
        ? 'bg-amber-500'
        : 'bg-red-500/80';
  const textColor =
    score >= 70
      ? 'text-green-400'
      : score >= 40
        ? 'text-amber-400'
        : 'text-red-400';

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-white/60 text-xs">{label}</span>
        <span className={`text-xs font-bold ${textColor}`}>{score}/100</span>
      </div>
      <div className="w-full h-1.5 bg-white/[0.05] rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out ${barColor}`}
          style={{ width: `${score}%` }}
        />
      </div>
      <p className="text-white/30 text-[10px] leading-tight">{tip}</p>
    </div>
  );
}

/** Inline health check panel — shows under the Instagram card */
function HealthPanel({ result }: { result: AnalyzeResult }) {
  const seoTip = !result.hasTitle
    ? 'Add a descriptive page title tag'
    : !result.hasDescription
      ? 'Add a meta description to improve click-through rates'
      : 'SEO basics look solid ✓';

  const presenceTip = !result.hasSocialLinks
    ? 'Add links to your Instagram / Facebook'
    : !result.hasPhone
      ? 'Add a phone number so customers can call you'
      : 'Contact details are visible ✓';

  const brandTip =
    result.scores.brand < 40
      ? 'Add Open Graph tags and a schema.org business listing'
      : result.scores.brand < 70
        ? 'Add schema.org LocalBusiness markup for better visibility'
        : 'Brand signals are strong ✓';

  const overallColor =
    result.scores.overall >= 70
      ? 'bg-green-500/10 text-green-400 border-green-500/20'
      : result.scores.overall >= 40
        ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
        : 'bg-red-500/10 text-red-400 border-red-500/20';

  return (
    <div className="mt-3 bg-charcoal-900/60 border border-white/[0.06] rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-white/50 text-[11px] font-semibold uppercase tracking-wider">
          Website Health Check
        </p>
        <span
          className={`text-xs font-bold px-2 py-0.5 rounded-full border ${overallColor}`}
        >
          {result.scores.overall}/100
        </span>
      </div>
      <ScoreBar label="SEO" score={result.scores.seo} tip={seoTip} />
      <ScoreBar
        label="Online Presence"
        score={result.scores.presence}
        tip={presenceTip}
      />
      <ScoreBar
        label="Brand Signals"
        score={result.scores.brand}
        tip={brandTip}
      />
      <p className="text-[10px] text-white/25 pt-1 border-t border-white/[0.04]">
        Sign up free for your full report with prioritised recommendations.
      </p>
    </div>
  );
}

/** Model badge */
function DemoBadge({ model }: { model?: string }) {
  if (!model || model === 'sample') {
    return (
      <div className="flex items-center gap-2 mt-2">
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-[10px] text-amber-400/70">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400/60 inline-block" />
          Sample preview &middot; Sign up for live AI generation
        </span>
      </div>
    );
  }

  const isGemini = model.startsWith('gemini');
  const isLlama = model.includes('llama');
  const displayModel = isGemini
    ? 'Gemini 2.5 Flash'
    : (model.replace(':free', '').split('/').pop() ?? 'AI');

  return (
    <div className="flex items-center gap-2 mt-2">
      <span
        className={[
          'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px]',
          isGemini
            ? 'bg-blue-500/10 border border-blue-400/20 text-blue-300/70'
            : isLlama
              ? 'bg-purple-500/10 border border-purple-400/20 text-purple-300/70'
              : 'bg-white/[0.04] border border-white/[0.06] text-white/40',
        ].join(' ')}
      >
        <span
          className={[
            'w-1.5 h-1.5 rounded-full inline-block',
            isGemini
              ? 'bg-blue-400/70'
              : isLlama
                ? 'bg-purple-400/70'
                : 'bg-green-400/60',
          ].join(' ')}
        />
        Live AI &middot; {displayModel}
      </span>
    </div>
  );
}

/** ─────────────────────────────────────────────────────────────────────────
 *  Main widget
 * ───────────────────────────────────────────────────────────────────────── */
export function LiveDemoWidget() {
  const [url, setUrl] = useState('');
  const [state, setState] = useState<DemoState>('idle');
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [durationMs, setDurationMs] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const runAnalyze = async (targetUrl: string) => {
    if (!targetUrl.trim() || state === 'loading') return;

    const normalised = targetUrl.trim().startsWith('http')
      ? targetUrl.trim()
      : `https://${targetUrl.trim()}`;

    setState('loading');
    setResult(null);
    const startMs = Date.now();

    try {
      const res = await fetch('/api/demo/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: normalised }),
      });

      if (res.status === 429) {
        // Rate limited — surface a friendly message
        setState('error');
        return;
      }

      if (!res.ok) throw new Error('analyze failed');

      const data = (await res.json()) as AnalyzeResult;
      setDurationMs(Date.now() - startMs);
      setResult(data);
      setState('result');
    } catch {
      setState('error');
    }
  };

  const handleChip = (demoUrl: string) => {
    setUrl(demoUrl);
    inputRef.current?.focus();
    setTimeout(() => void runAnalyze(demoUrl), 50);
  };

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    void runAnalyze(url);
  };

  const handleReset = () => {
    setState('idle');
    setResult(null);
    setUrl('');
  };

  return (
    <div className="bg-charcoal-800/50 border border-white/[0.06] rounded-2xl p-6 backdrop-blur-sm">
      {/* Header */}
      <div className="mb-4">
        <p className="text-white/40 text-xs uppercase tracking-wider font-semibold mb-1">
          Free demo
        </p>
        <h3 className="text-white font-bold text-base">
          Paste your website URL
        </h3>
        <p className="text-white/35 text-xs mt-0.5">
          We read your site and generate a real AI post&nbsp;+&nbsp;health check
          instantly
        </p>
      </div>

      {/* URL input */}
      <form onSubmit={handleSubmit} className="mb-4">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="url"
            value={url}
            onChange={e => setUrl(e.target.value)}
            placeholder="https://yourbusiness.com.au"
            disabled={state === 'loading'}
            className="flex-1 bg-charcoal-900/60 border border-white/[0.08] rounded-xl px-4 py-2.5 text-white text-sm placeholder-white/25 focus:outline-none focus:border-amber-500/40 transition-colors disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!url.trim() || state === 'loading'}
            className="bg-amber-500 text-charcoal-900 font-bold rounded-xl px-4 py-2.5 text-sm hover:bg-amber-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
          >
            {state === 'loading' ? (
              <span className="w-4 h-4 border-2 border-charcoal-900/30 border-t-charcoal-900 rounded-full animate-spin block" />
            ) : (
              '→'
            )}
          </button>
        </div>
      </form>

      {/* Quick-demo chips */}
      <div className="flex flex-wrap gap-2 mb-5">
        {QUICK_DEMOS.map(({ label, emoji, url: demoUrl }) => (
          <button
            key={label}
            type="button"
            onClick={() => handleChip(demoUrl)}
            disabled={state === 'loading'}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-charcoal-700/60 border border-white/[0.06] text-white/50 hover:text-white hover:border-white/10 text-xs font-medium transition-all disabled:opacity-40"
          >
            <span>{emoji}</span>
            <span>Try {label}</span>
          </button>
        ))}
      </div>

      {/* ── Content states ── */}
      {state === 'idle' && (
        <div className="text-center py-8 text-white/30 text-sm">
          Paste any website URL above, or try a quick demo
        </div>
      )}

      {state === 'loading' && (
        <div>
          <InstagramSkeleton />
          <p className="text-center text-white/40 text-xs mt-3 animate-pulse">
            Reading your website&hellip; generating AI post&hellip;
          </p>
        </div>
      )}

      {state === 'error' && (
        <div className="text-center py-8">
          <p className="text-red-400/70 text-sm mb-2">
            Couldn&apos;t reach that URL
          </p>
          <p className="text-white/30 text-xs">
            Double-check the address, or try one of the quick demos above.
          </p>
          <button
            onClick={handleReset}
            className="mt-3 text-white/50 hover:text-white/70 text-xs transition-colors"
          >
            Try again &rarr;
          </button>
        </div>
      )}

      {state === 'result' && result && (
        <div>
          <InstagramCard
            businessName={result.businessName}
            imageUrl={result.imageUrl}
            caption={result.caption}
          />
          <HealthPanel result={result} />
          <div className="flex items-center justify-between mt-3">
            <p className="text-amber-400/70 text-xs">
              ✓ Analysed in {(durationMs / 1000).toFixed(1)}s &middot;{' '}
              {result.industry}
            </p>
            <button
              onClick={handleReset}
              className="text-white/50 hover:text-white/70 text-xs transition-colors"
            >
              Try another &rarr;
            </button>
          </div>
          <DemoBadge model={result.model} />
          <p className="text-[10px] text-white/40 mt-1.5 leading-relaxed">
            Sign up to unlock Claude, GPT-4 &amp; Gemini Pro with your own brand
            voice.
          </p>
        </div>
      )}
    </div>
  );
}
