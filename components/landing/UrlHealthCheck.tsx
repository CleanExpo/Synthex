'use client';

import { useState } from 'react';
import type { AnalyzeResult } from '@/app/api/demo/analyze/route';

type CheckState = 'idle' | 'loading' | 'result' | 'error';

/* ── Score card ───────────────────────────────────────────────────────── */
function ScoreCard({
  label,
  score,
  icon,
  tips,
}: {
  label: string;
  score: number;
  icon: string;
  tips: string[];
}) {
  const barColor =
    score >= 70
      ? 'bg-green-500'
      : score >= 40
        ? 'bg-amber-500'
        : 'bg-red-500/80';
  const ringColor =
    score >= 70
      ? 'border-green-500/30 text-green-400'
      : score >= 40
        ? 'border-amber-500/30 text-amber-400'
        : 'border-red-500/30 text-red-400';
  const badgeBg =
    score >= 70
      ? 'bg-green-500/10'
      : score >= 40
        ? 'bg-amber-500/10'
        : 'bg-red-500/10';

  const grade =
    score >= 80
      ? 'Excellent'
      : score >= 60
        ? 'Good'
        : score >= 40
          ? 'Needs work'
          : 'Poor';

  return (
    <div className="bg-[#0a0a12] border border-white/[0.06] rounded-xl p-5 space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="text-xl">{icon}</span>
          <span className="text-white/80 text-sm font-semibold">{label}</span>
        </div>
        <div
          className={`${badgeBg} border ${ringColor} rounded-lg px-3 py-1 text-center`}
        >
          <p
            className={`text-xl font-bold leading-none ${ringColor.split(' ')[1]}`}
          >
            {score}
          </p>
          <p className="text-[9px] text-white/60 mt-0.5">/100</p>
        </div>
      </div>

      {/* Bar */}
      <div className="w-full h-2 bg-white/[0.05] rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out ${barColor}`}
          style={{ width: `${score}%` }}
        />
      </div>

      {/* Grade */}
      <p className={`text-xs font-medium ${ringColor.split(' ')[1]}`}>
        {grade}
      </p>

      {/* Tips */}
      <ul className="space-y-1.5">
        {tips.map((tip, i) => (
          <li
            key={i}
            className="flex items-start gap-2 text-[11px] text-white/40 leading-relaxed"
          >
            <span className="mt-0.5 flex-shrink-0 text-white/60">›</span>
            <span>{tip}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ── Overall score ring ──────────────────────────────────────────────── */
function OverallScore({
  score,
  businessName,
}: {
  score: number;
  businessName: string;
}) {
  const color =
    score >= 70
      ? 'text-green-400'
      : score >= 40
        ? 'text-amber-400'
        : 'text-red-400';
  const label =
    score >= 70
      ? 'Strong online presence'
      : score >= 40
        ? 'Room to improve'
        : 'Needs attention';

  return (
    <div className="text-center space-y-2">
      <div className="inline-flex flex-col items-center justify-center w-28 h-28 rounded-full border-2 border-white/[0.08] bg-[#0a0a12]">
        <span className={`text-4xl font-bold ${color}`}>{score}</span>
        <span className="text-white/60 text-[10px] mt-0.5">/ 100</span>
      </div>
      <div>
        <p className="text-white font-semibold text-sm">{businessName}</p>
        <p className={`text-xs ${color}`}>{label}</p>
      </div>
    </div>
  );
}

/* ── Unreachable-site panel ──────────────────────────────────────────── */
function UnreachablePanel({
  result,
  onReset,
}: {
  result: AnalyzeResult;
  onReset: () => void;
}) {
  return (
    <div className="bg-[#0a0a12] border border-amber-500/20 rounded-2xl p-8 text-center space-y-4 animate-fade-in">
      <div className="text-4xl">🔒</div>
      <div>
        <p className="text-white/80 font-semibold text-base mb-2">
          Site couldn&apos;t be read
        </p>
        <p className="text-white/40 text-sm leading-relaxed max-w-md mx-auto">
          <strong className="text-white/60">{result.businessName}</strong>{' '}
          appears to block automated access (Cloudflare, server-side rendering,
          etc.). We can&apos;t score what we can&apos;t see.
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-3 pt-2">
        <button
          onClick={onReset}
          className="bg-white/[0.06] hover:bg-white/[0.10] text-white/60 font-semibold text-sm px-5 py-2.5 rounded-xl transition-colors"
        >
          Try a different URL
        </button>
        <a
          href="/signup"
          className="bg-amber-500 hover:bg-amber-400 text-charcoal-900 font-bold text-sm px-5 py-2.5 rounded-xl transition-colors"
        >
          Sign up for premium scan →
        </a>
      </div>
      <p className="text-white/60 text-xs">
        Synthex premium uses a headless browser to scan protected sites &mdash;
        no bots blocked.
      </p>
    </div>
  );
}

/* ── Result panel ────────────────────────────────────────────────────── */
function ResultPanel({ result }: { result: AnalyzeResult }) {
  const seoTips = [
    !result.hasTitle
      ? '⚠ Missing page title — add a descriptive <title> tag'
      : '✓ Page title is present',
    !result.hasDescription
      ? '⚠ No meta description — add one to improve search snippets'
      : '✓ Meta description found',
    result.scores.seo < 60
      ? '⚠ Consider adding an H1 heading and canonical URL'
      : '✓ Core SEO tags look good',
  ].filter(Boolean);

  const presenceTips = [
    !result.hasSocialLinks
      ? '⚠ No social media links found — link your Instagram & Facebook'
      : '✓ Social links detected',
    !result.hasPhone
      ? '⚠ No phone number visible — add contact details'
      : '✓ Phone number found',
    !result.hasAddress
      ? '⚠ Address not detected — helps local SEO'
      : '✓ Address found',
  ].filter(Boolean);

  const brandTips = [
    result.scores.brand < 35
      ? '⚠ Add Open Graph tags for better link previews on social'
      : '✓ Open Graph tags present',
    result.scores.brand < 65
      ? '⚠ Add schema.org LocalBusiness markup for rich search results'
      : '✓ Schema markup present',
    '→ Consistent brand imagery builds 3× more trust with visitors',
  ];

  return (
    <div className="space-y-6 animate-[fade-in_0.4s_ease-out_forwards]">
      {/* Overall score + meta */}
      <div className="flex flex-col sm:flex-row items-center gap-6 bg-[#0a0a12] border border-white/[0.06] rounded-xl p-5">
        <OverallScore
          score={result.scores.overall}
          businessName={result.businessName}
        />
        <div className="flex-1 space-y-2">
          <div className="flex flex-wrap gap-2">
            {result.loadedOk && (
              <span className="inline-flex items-center gap-1 text-[11px] bg-green-500/10 border border-green-500/20 text-green-400 px-2 py-0.5 rounded-full">
                ✓ Website reachable
              </span>
            )}
            {!result.loadedOk && (
              <span className="inline-flex items-center gap-1 text-[11px] bg-red-500/10 border border-red-500/20 text-red-400 px-2 py-0.5 rounded-full">
                ⚠ Site may be slow or blocked
              </span>
            )}
            <span className="inline-flex items-center gap-1 text-[11px] bg-white/[0.04] border border-white/[0.06] text-white/40 px-2 py-0.5 rounded-full">
              {result.industry}
            </span>
          </div>
          {result.description && (
            <p className="text-white/40 text-xs leading-relaxed line-clamp-3">
              {result.description}
            </p>
          )}
          <p className="text-white/60 text-[11px]">
            Analysed by Synthex — sign up free for your full report with fixes.
          </p>
        </div>
      </div>

      {/* Score cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <ScoreCard
          label="SEO"
          score={result.scores.seo}
          icon="🔍"
          tips={seoTips}
        />
        <ScoreCard
          label="Online Presence"
          score={result.scores.presence}
          icon="📡"
          tips={presenceTips}
        />
        <ScoreCard
          label="Brand Signals"
          score={result.scores.brand}
          icon="🎯"
          tips={brandTips}
        />
      </div>

      {/* CTA */}
      <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-5 flex flex-col sm:flex-row items-center gap-4">
        <div className="flex-1">
          <p className="text-white/80 text-sm font-semibold mb-1">
            Want the full fix list?
          </p>
          <p className="text-white/40 text-xs leading-relaxed">
            Sign up free and get a prioritised action plan, AI-generated social
            posts, and brand voice setup — all tailored to {result.businessName}
            .
          </p>
        </div>
        <a
          href="/signup"
          className="flex-shrink-0 bg-amber-500 hover:bg-amber-400 text-charcoal-900 font-bold text-sm px-5 py-2.5 rounded-xl transition-colors"
        >
          Get full report →
        </a>
      </div>
    </div>
  );
}

/* ── Loading skeleton ────────────────────────────────────────────────── */
function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="bg-[#0a0a12] border border-white/[0.06] rounded-xl p-5 flex items-center gap-6">
        <div className="w-28 h-28 rounded-full bg-white/[0.04] animate-pulse flex-shrink-0" />
        <div className="flex-1 space-y-3">
          <div className="h-4 bg-white/[0.04] rounded-full w-1/3 animate-pulse" />
          <div className="h-3 bg-white/[0.04] rounded-full w-full animate-pulse" />
          <div className="h-3 bg-white/[0.04] rounded-full w-3/4 animate-pulse" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        {[0, 1, 2].map(i => (
          <div
            key={i}
            className="bg-[#0a0a12] border border-white/[0.06] rounded-xl p-5 space-y-3"
            style={{ animationDelay: `${i * 0.1}s` }}
          >
            <div className="h-4 bg-white/[0.04] rounded-full w-1/2 animate-pulse" />
            <div className="h-2 bg-white/[0.04] rounded-full w-full animate-pulse" />
            <div className="h-3 bg-white/[0.04] rounded-full w-3/4 animate-pulse" />
            <div className="h-3 bg-white/[0.04] rounded-full w-full animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Main export ─────────────────────────────────────────────────────── */
export function UrlHealthCheck() {
  const [url, setUrl] = useState('');
  const [state, setState] = useState<CheckState>('idle');
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  const runCheck = async (targetUrl?: string) => {
    const src = (targetUrl ?? url).trim();
    if (!src || state === 'loading') return;

    const normalised = src.startsWith('http') ? src : `https://${src}`;

    setState('loading');
    setResult(null);
    setErrorMessage('');

    try {
      const res = await fetch('/api/demo/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ url: normalised }),
      });

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
      setResult(data);
      setState('result');
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Something went wrong'
      );
      setState('error');
    }
  };

  const reset = () => {
    setState('idle');
    setResult(null);
    setUrl('');
    setErrorMessage('');
  };

  return (
    <section id="health-check" className="relative py-24 px-4">
      {/* Ambient glow */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-amber-500/[0.04] blur-[120px] rounded-full" />
      </div>

      <div className="relative max-w-4xl mx-auto">
        {/* Section heading */}
        <div className="text-center mb-10">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block animate-pulse" />
            100% Free &mdash; No sign-up required
          </span>
          <h2 className="text-white text-3xl sm:text-4xl font-bold tracking-tight mb-3">
            Free URL Health Check
          </h2>
          <p className="text-white/40 text-base max-w-lg mx-auto leading-relaxed">
            Paste your website URL and get an instant SEO, presence, and brand
            analysis &mdash; powered by AI.
          </p>
        </div>

        {/* URL input */}
        <div className="bg-[#0a0a12] border border-white/[0.08] rounded-2xl p-2 flex gap-2 max-w-2xl mx-auto mb-10">
          <input
            type="url"
            value={url}
            onChange={e => setUrl(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') void runCheck();
            }}
            placeholder="https://yourbusiness.com.au"
            disabled={state === 'loading'}
            className="flex-1 bg-transparent px-4 py-3 text-white text-sm placeholder-white/25 focus:outline-none disabled:opacity-50"
          />
          {state === 'result' ? (
            <button
              onClick={reset}
              className="flex-shrink-0 bg-white/[0.06] hover:bg-white/[0.10] text-white/60 font-semibold rounded-xl px-5 py-3 text-sm transition-colors"
            >
              Reset
            </button>
          ) : (
            <button
              onClick={() => void runCheck()}
              disabled={!url.trim() || state === 'loading'}
              className="flex-shrink-0 bg-amber-500 hover:bg-amber-400 text-charcoal-900 font-bold rounded-xl px-6 py-3 text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {state === 'loading' ? (
                <span className="w-4 h-4 border-2 border-charcoal-900/30 border-t-charcoal-900 rounded-full animate-spin block" />
              ) : (
                'Check my site'
              )}
            </button>
          )}
        </div>

        {/* States */}
        {state === 'idle' && (
          <div className="text-center space-y-4">
            <div className="flex flex-wrap justify-center gap-3">
              {[
                { label: 'SEO Score', icon: '🔍' },
                { label: 'Online Presence', icon: '📡' },
                { label: 'Brand Signals', icon: '🎯' },
                { label: 'Actionable Tips', icon: '✅' },
              ].map(({ label, icon }) => (
                <div
                  key={label}
                  className="flex items-center gap-2 px-4 py-2 bg-[#0a0a12] border border-white/[0.06] rounded-full text-white/50 text-xs"
                >
                  <span>{icon}</span>
                  <span>{label}</span>
                </div>
              ))}
            </div>
            <p className="text-white/60 text-xs">Results in under 10 seconds</p>
          </div>
        )}

        {state === 'loading' && <LoadingSkeleton />}

        {state === 'error' && (
          <div className="text-center py-12 bg-[#0a0a12] border border-white/[0.06] rounded-2xl">
            <p className="text-red-400/80 text-base font-semibold mb-2">
              {errorMessage || 'Couldn\u2019t reach that URL'}
            </p>
            <p className="text-white/60 text-sm mb-6">
              The site may be blocking external requests, or the URL may be
              incorrect.
            </p>
            <button
              onClick={reset}
              className="bg-white/[0.06] hover:bg-white/[0.10] text-white/60 font-semibold text-sm px-5 py-2.5 rounded-xl transition-colors"
            >
              Try again
            </button>
          </div>
        )}

        {state === 'result' &&
          result &&
          (result.loadedOk ? (
            <ResultPanel result={result} />
          ) : (
            <UnreachablePanel result={result} onReset={reset} />
          ))}
      </div>
    </section>
  );
}
