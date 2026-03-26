'use client';

import { useState } from 'react';

type FormState = 'idle' | 'loading' | 'success' | 'error';

export function EmailCaptureSection() {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<FormState>('idle');
  const [errorMessage, setErrorMessage] = useState(
    'Something went wrong. Try again.'
  );

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!email || state === 'loading') return;

    setState('loading');
    setErrorMessage('Something went wrong. Try again.');

    try {
      const res = await fetch('/api/newsletter/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email }),
      });

      if (res.ok) {
        setState('success');
        setEmail('');
      } else {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setErrorMessage(data.error ?? 'Something went wrong. Try again.');
        setState('error');
      }
    } catch {
      setErrorMessage('Something went wrong. Try again.');
      setState('error');
    }
  }

  return (
    <section className="relative py-20 bg-charcoal-900 border-t border-white/[0.04]">
      {/* Subtle radial glow */}
      <div
        className="pointer-events-none absolute inset-0 flex items-center justify-center"
        aria-hidden="true"
      >
        <div className="w-[600px] h-[300px] rounded-full bg-orange-500/5 blur-3xl" />
      </div>

      <div className="relative max-w-2xl mx-auto px-6 text-center">
        <div>
          {/* Eyebrow pill */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/20 mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse flex-shrink-0" />
            <span className="text-[11px] font-semibold tracking-[0.15em] uppercase text-orange-400">
              Free updates
            </span>
          </div>

          <h2 className="text-3xl sm:text-4xl font-black text-white leading-tight mb-3">
            Stay ahead of the algorithm
          </h2>

          <p className="text-base text-white/50 mb-8 max-w-md mx-auto">
            Get AI marketing tips and Synthex updates. No spam, unsubscribe
            anytime.
          </p>

          {state === 'success' ? (
            <div className="inline-flex items-center gap-2.5 px-5 py-3 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 font-medium text-sm">
              <span className="w-2 h-2 rounded-full bg-green-400 flex-shrink-0" />
              You&apos;re on the list! Check your inbox.
            </div>
          ) : (
            <form
              onSubmit={handleSubmit}
              className="flex flex-col sm:flex-row gap-3 justify-center"
              noValidate
            >
              <label htmlFor="newsletter-email" className="sr-only">
                Email address
              </label>
              <input
                id="newsletter-email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                disabled={state === 'loading'}
                className="
                  flex-1 min-w-0 max-w-sm px-4 py-3 rounded-xl
                  bg-white/[0.05] border border-white/10
                  text-white placeholder:text-white/60 text-sm
                  focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/30
                  disabled:opacity-50 disabled:cursor-not-allowed
                  transition-colors
                "
              />
              <button
                type="submit"
                disabled={state === 'loading' || !email}
                className="
                  flex-shrink-0 px-6 py-3 rounded-xl
                  bg-orange-500 hover:bg-orange-400 active:bg-orange-600
                  text-charcoal-900 font-bold text-sm
                  disabled:opacity-50 disabled:cursor-not-allowed
                  transition-colors
                "
              >
                {state === 'loading' ? 'Subscribing…' : 'Get updates'}
              </button>
            </form>
          )}

          {state === 'error' && (
            <p className="mt-3 text-sm text-red-400" role="alert">
              {errorMessage}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
