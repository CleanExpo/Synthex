'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Loader2, Sparkles } from '@/components/icons';

interface CaptionResult {
  caption: string;
  tier: string;
}

type Status = 'idle' | 'loading' | 'done' | 'rate-limited' | 'error';

/**
 * No-signup caption generator on the public, rate-limited
 * POST /api/demo/caption route.
 */
export function CaptionDemo() {
  const [businessName, setBusinessName] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [result, setResult] = useState<CaptionResult | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const name = businessName.trim();
    if (!name) return;

    setStatus('loading');
    setResult(null);

    try {
      const res = await fetch('/api/demo/caption', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessName: name }),
      });

      if (res.status === 429) {
        setStatus('rate-limited');
        return;
      }

      const data: Partial<CaptionResult> = await res.json();
      if (!res.ok || typeof data.caption !== 'string') {
        setStatus('error');
        return;
      }

      setResult({ caption: data.caption, tier: data.tier ?? '' });
      setStatus('done');
    } catch {
      setStatus('error');
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-3 rounded-2xl border border-orange-500/20 bg-surface-base/80 p-6 sm:flex-row"
      >
        <label htmlFor="demo-business-name" className="sr-only">
          Business name
        </label>
        <input
          id="demo-business-name"
          type="text"
          required
          maxLength={80}
          value={businessName}
          onChange={e => setBusinessName(e.target.value)}
          placeholder="Your business name, e.g. Bondi Beach Cafe"
          className="flex-1 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-white placeholder:text-gray-500 focus:border-orange-500/50 focus:outline-none"
        />
        <button
          type="submit"
          disabled={status === 'loading'}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-orange-500 px-6 py-3 font-semibold text-charcoal-900 transition-colors hover:bg-orange-400 disabled:opacity-60"
        >
          {status === 'loading' ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          Generate caption
        </button>
      </form>

      <div aria-live="polite" className="mt-6">
        {status === 'rate-limited' && (
          <p className="text-center text-sm text-orange-300">
            You have generated a lot of captions in a short time. Please wait a
            minute and try again.
          </p>
        )}

        {status === 'error' && (
          <p className="text-center text-sm text-red-400">
            We could not generate a caption just now. Please try again.
          </p>
        )}

        {status === 'done' && result && (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-400">
              {result.tier === 'sample'
                ? 'Sample caption — live AI generation is unavailable right now'
                : 'Your caption'}
            </p>
            <p className="mt-3 whitespace-pre-line text-lg leading-relaxed text-white">
              {result.caption}
            </p>
            <Link
              href="/signup"
              className="mt-6 inline-flex items-center gap-2 font-semibold text-orange-400 hover:text-orange-300"
            >
              Create an account to plan and approve posts
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
