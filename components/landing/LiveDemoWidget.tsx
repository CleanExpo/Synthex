'use client';

import { useState, useRef } from 'react';
import type { AnalyzeResult } from '@/app/api/demo/analyze/route';
import { DemoConversionCard } from './DemoConversionCard';

type DemoState = 'idle' | 'loading' | 'result' | 'error';

const QUICK_DEMOS = [
  { label: 'Cafe', emoji: '☕', url: 'https://www.starbucks.com.au' },
  { label: 'Tradie', emoji: '🔨', url: 'https://www.hipages.com.au' },
  { label: 'Salon', emoji: '💇', url: 'https://www.toniandguy.com' },
  { label: 'Gym', emoji: '💪', url: 'https://www.f45training.com' },
];

/** Instagram card skeleton */
function InstagramSkeleton() {
  return (
    <div className="bg-charcoal-800 border border-white/[0.06] rounded-2xl overflow-hidden">
      <div className="w-full h-44 bg-charcoal-700 relative overflow-hidden">
        <div className="absolute inset-0 animate-shimmer bg-gradient-to-r from-transparent via-white/[0.05] to-transparent" />
      </div>
      <div className="p-4 space-y-2">
        <div className="h-3 bg-charcoal-700 rounded-full w-1/3" />
        <div className="h-3 bg-charcoal-700 rounded-full w-full" />
        <div className="h-3 bg-charcoal-700 rounded-full w-4/5" />
      </div>
    </div>
  );
}

function getEmoji(name: string): string {
  const l = name.toLowerCase();
  if (l.includes('cafe') || l.includes('coffee') || l.includes('starbucks'))
    return '☕';
  if (
    l.includes('tradie') ||
    l.includes('plumb') ||
    l.includes('electr') ||
    l.includes('build') ||
    l.includes('hipages')
  )
    return '🔨';
  if (
    l.includes('salon') ||
    l.includes('hair') ||
    l.includes('beauty') ||
    l.includes('toni')
  )
    return '💇';
  if (l.includes('gym') || l.includes('fit') || l.includes('f45')) return '💪';
  if (l.includes('clean') || l.includes('restor') || l.includes('disaster'))
    return '✨';
  if (l.includes('retail') || l.includes('fashion')) return '🛍️';
  if (l.includes('dental') || l.includes('health')) return '🏥';
  if (l.includes('tech') || l.includes('software')) return '💻';
  return '🏢';
}

/**
 * Instagram card — note: overflow-hidden is on image only, not the whole card,
 * so the caption can never be clipped by the container.
 */
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
    /* No overflow-hidden here — caption must never be clipped */
    <div className="bg-charcoal-800 border border-white/[0.06] rounded-2xl animate-fade-in">
      {/* Image — overflow-hidden only here, for rounded top corners */}
      <div className="w-full h-44 bg-charcoal-700 relative overflow-hidden rounded-t-2xl">
        {showShimmer && (
          <div className="absolute inset-0 animate-shimmer bg-gradient-to-r from-transparent via-white/[0.05] to-transparent" />
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

      {/* Caption — deliberately unconstrained */}
      <div className="p-4 rounded-b-2xl">
        <p className="text-white/50 text-xs font-semibold mb-1.5">@{handle}</p>
        <p className="text-white/80 text-sm leading-relaxed">{caption}</p>
      </div>
    </div>
  );
}

/**
 * Compact score row — shows 4 numbers inline.
 * Fits inside the hero without forcing vertical overflow.
 * When site couldn't be fetched, shows a clear warning instead of bogus 0/100.
 */
function ScoreSummary({ result }: { result: AnalyzeResult }) {
  // Site unreachable — showing 0/100 everywhere would be misleading
  if (!result.loadedOk) {
    return (
      <div className="mt-3 bg-amber-500/5 border border-amber-500/20 rounded-xl p-3 space-y-1.5">
        <p className="text-amber-400/80 text-xs font-semibold">
          ⚠&nbsp; Couldn&apos;t read this site
        </p>
        <p className="text-white/60 text-[11px] leading-relaxed">
          This site appears to block automated access (common with Cloudflare,
          etc.). The AI post above was generated from the domain name only —
          scores unavailable.
        </p>
        <p className="text-white/60 text-[10px]">
          Try{' '}
          <button
            className="text-amber-400/60 hover:text-amber-400/80 transition-colors underline-offset-2 underline"
            onClick={() => {
              /* handled by parent via chip */
            }}
          >
            starbucks.com.au
          </button>{' '}
          to see a live score, or sign up to scan protected sites.
        </p>
      </div>
    );
  }

  const col = (s: number) =>
    s >= 70 ? 'text-green-400' : s >= 40 ? 'text-amber-400' : 'text-red-400';

  const items = [
    { label: 'SEO', score: result.scores.seo },
    { label: 'Presence', score: result.scores.presence },
    { label: 'Brand', score: result.scores.brand },
    { label: 'Overall', score: result.scores.overall },
  ];

  return (
    <div className="mt-3 bg-charcoal-900/60 border border-white/[0.06] rounded-xl p-3">
      <div className="flex items-center justify-around">
        {items.map(({ label, score }, i) => (
          <div key={label} className="flex items-center gap-3">
            <div className="text-center">
              <p className={`text-lg font-bold leading-none ${col(score)}`}>
                {score}
              </p>
              <p className="text-white/60 text-[9px] mt-0.5">{label}</p>
            </div>
            {i < items.length - 1 && (
              <div className="w-px h-7 bg-white/[0.06]" />
            )}
          </div>
        ))}
      </div>
      <a
        href="#health-check"
        className="block text-center text-white/60 hover:text-amber-400/60 text-[10px] mt-2 transition-colors"
      >
        See full health report with tips &darr;
      </a>
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
          Sample preview &middot; sign up for live AI generation
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
 *  Main export
 * ───────────────────────────────────────────────────────────────────────── */
export function LiveDemoWidget() {
  const [url, setUrl] = useState('');
  const [state, setState] = useState<DemoState>('idle');
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [durationMs, setDurationMs] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const runAnalyze = async (targetUrl: string) => {
    if (!targetUrl.trim() || state === 'loading') return;
    const normalised = targetUrl.trim().startsWith('http')
      ? targetUrl.trim()
      : `https://${targetUrl.trim()}`;

    setState('loading');
    setResult(null);
    setErrorMessage('');
    const t0 = Date.now();

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 18000);
      const res = await fetch('/api/demo/analyze', {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ url: normalised }),
      });
      clearTimeout(timer);
      if (!res.ok) {
        let message = 'Something went wrong';
        try {
          const errBody = (await res.json()) as { error?: string };
          message = errBody.error ?? message;
        } catch {
          // Response wasn't JSON (e.g. plain-text 403 "Forbidden")
          message =
            res.status === 403
              ? 'Access blocked — please try on synthex.social'
              : res.status === 429
                ? 'Too many requests — please wait a moment'
                : `Error ${res.status}`;
        }
        throw new Error(message);
      }
      const data = (await res.json()) as AnalyzeResult;
      setDurationMs(Date.now() - t0);
      setResult(data);
      setState('result');
    } catch (err) {
      const isTimeout =
        err instanceof Error &&
        (err.name === 'AbortError' || err.message.includes('aborted'));
      setErrorMessage(
        isTimeout
          ? 'Analysis timed out — try a simpler URL or use a quick demo above'
          : err instanceof Error
            ? err.message
            : 'Something went wrong'
      );
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
    setErrorMessage('');
  };

  return (
    <div className="bg-charcoal-800/50 border border-white/[0.06] rounded-2xl p-5 backdrop-blur-sm">
      {/* Header */}
      <div className="mb-4">
        <p className="text-white/40 text-[10px] uppercase tracking-wider font-semibold mb-0.5">
          Free demo
        </p>
        <h3 className="text-white font-bold text-sm">Paste your website URL</h3>
        <p className="text-white/60 text-[11px] mt-0.5">
          AI reads your site &amp; generates a branded post + health check
        </p>
      </div>

      {/* URL input */}
      <form onSubmit={handleSubmit} className="mb-3">
        <div className="flex gap-2">
          <label htmlFor="live-demo-url" className="sr-only">
            Website URL
          </label>
          <input
            id="live-demo-url"
            ref={inputRef}
            type="url"
            value={url}
            onChange={e => setUrl(e.target.value)}
            placeholder="https://yourbusiness.com.au"
            disabled={state === 'loading'}
            className="flex-1 bg-charcoal-900/60 border border-white/[0.08] rounded-xl px-3 py-2 text-white text-xs placeholder-white/25 focus:outline-none focus:border-amber-500/40 transition-colors disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!url.trim() || state === 'loading'}
            aria-label={
              state === 'loading'
                ? 'Analysing your website…'
                : state === 'error'
                  ? 'Retry analysis'
                  : 'Analyse website'
            }
            className="bg-amber-500 text-charcoal-900 font-bold rounded-xl px-3 py-2 text-xs hover:bg-amber-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
          >
            {state === 'loading' ? (
              <span className="w-3.5 h-3.5 border-2 border-charcoal-900/30 border-t-charcoal-900 rounded-full animate-spin block" />
            ) : (
              '→'
            )}
          </button>
        </div>
      </form>

      {/* Quick-demo chips */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {QUICK_DEMOS.map(({ label, emoji, url: demoUrl }) => (
          <button
            key={label}
            type="button"
            onClick={() => handleChip(demoUrl)}
            disabled={state === 'loading'}
            aria-label={`Try quick demo: ${label}`}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-charcoal-700/60 border border-white/[0.06] text-white/45 hover:text-white hover:border-white/10 text-[11px] font-medium transition-all disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:ring-offset-2 focus:ring-offset-transparent"
          >
            <span>{emoji}</span>
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* ── States ── */}
      {state === 'idle' && (
        <div className="text-center py-6 text-white/60 text-xs">
          Paste any website URL, or try a quick demo above
        </div>
      )}

      {state === 'loading' && (
        <div role="status" aria-busy="true" aria-label="Loading preview…">
          <InstagramSkeleton />
          <p className="text-center text-white/60 text-[11px] mt-2 animate-pulse">
            Reading your website&hellip;
          </p>
        </div>
      )}

      {state === 'error' && (
        <div className="text-center py-6">
          <p className="text-red-400/70 text-sm mb-1.5">
            {errorMessage || 'Couldn\u2019t reach that URL'}
          </p>
          <p className="text-white/60 text-xs">
            Check the address, or try a quick demo above.
          </p>
          <button
            onClick={handleReset}
            className="mt-3 text-white/45 hover:text-white/65 text-xs transition-colors"
          >
            Try again &rarr;
          </button>
          {/* Recovery: show demo chips below error */}
          <div className="mt-4 pt-4 border-t border-white/10">
            <p className="text-white/40 text-[10px] uppercase tracking-[0.15em] mb-3">
              Or try a quick demo
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              {QUICK_DEMOS.map(({ label, emoji, url: demoUrl }) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => handleChip(demoUrl)}
                  aria-label={`Try quick demo: ${label}`}
                  className="px-3 py-1.5 rounded-full text-xs font-medium bg-white/[0.06] border border-white/10 text-white/60 hover:bg-white/10 hover:text-white/80 transition-all focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:ring-offset-2 focus:ring-offset-transparent"
                >
                  {emoji} {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {state === 'result' && result && (
        <div aria-live="polite" aria-atomic="false">
          <InstagramCard
            businessName={result.businessName}
            imageUrl={result.imageUrl}
            caption={result.caption}
          />
          <ScoreSummary result={result} />
          <div className="flex items-center justify-between mt-2.5">
            <p className="text-amber-400/60 text-[10px]">
              ✓ {(durationMs / 1000).toFixed(1)}s &middot; {result.industry}
            </p>
            <DemoBadge model={result.model} />
          </div>
          <DemoConversionCard
            businessName={result.businessName}
            caption={result.caption}
            onReset={handleReset}
          />
        </div>
      )}
    </div>
  );
}
