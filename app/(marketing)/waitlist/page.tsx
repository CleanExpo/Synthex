'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Loader2, CheckCircle, Mail } from '@/components/icons';
import { SynthexLogo } from '@/components/landing/synthex-logo';

export default function WaitlistPage() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<
    'idle' | 'loading' | 'success' | 'error'
  >('idle');
  const [errorMessage, setErrorMessage] = useState('');

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus('loading');
    setErrorMessage('');

    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data: { success?: boolean; error?: string } = await res.json();

      if (!res.ok) {
        setErrorMessage(
          data.error ?? 'Something went wrong. Please try again.'
        );
        setStatus('error');
        return;
      }

      setStatus('success');
    } catch {
      setErrorMessage(
        'Unable to connect. Please check your connection and try again.'
      );
      setStatus('error');
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#050508] px-4 py-10 relative overflow-hidden">
      {/* Subtle dot grid */}
      <div
        className="fixed inset-0 opacity-[0.025]"
        style={{
          backgroundImage: `radial-gradient(circle, rgba(255,255,255,0.6) 1px, transparent 1px)`,
          backgroundSize: '32px 32px',
        }}
      />
      {/* Ambient glow */}
      <div className="fixed top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-amber-500/[0.03] rounded-full blur-[120px] pointer-events-none" />

      <div className="relative z-10 w-full max-w-sm">
        {/* Logo + wordmark */}
        <div className="flex flex-col items-center gap-3 mb-8">
          <SynthexLogo className="w-9 h-9 opacity-90" />
          <span className="text-[10px] font-light tracking-[0.3em] text-white/50 uppercase">
            Synthex
          </span>
        </div>

        <div className="bg-[#0a0a12] border-[0.5px] border-white/[0.06] rounded-sm p-8">
          {status === 'success' ? (
            /* ── Success state ─────────────────────────────────────────────── */
            <div className="flex flex-col items-center gap-4 py-4 text-center">
              <CheckCircle className="w-10 h-10 text-amber-500/80" />
              <div className="space-y-1.5">
                <h1 className="text-lg font-light text-white">
                  You&apos;re on the list!
                </h1>
                <p className="text-[12px] text-white/50 leading-relaxed">
                  We&apos;ll be in touch when your spot is ready.
                </p>
              </div>
              <Link
                href="/"
                className="mt-2 text-[11px] text-amber-500/60 hover:text-amber-500/80 transition-colors"
              >
                Back to home
              </Link>
            </div>
          ) : (
            /* ── Waitlist form ──────────────────────────────────────────────── */
            <>
              <div className="mb-6">
                <h1 className="text-lg font-light text-white mb-1">
                  Request early access
                </h1>
                <p className="text-[11px] text-white/40 leading-relaxed">
                  Synthex is invite-only while we&apos;re in beta. Leave your
                  email and we&apos;ll reach out when your spot is ready.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label
                    htmlFor="email"
                    className="text-[10px] uppercase tracking-[0.1em] text-white/50"
                  >
                    Email address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/20 pointer-events-none" />
                    <input
                      id="email"
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      required
                      disabled={status === 'loading'}
                      className="w-full pl-9 pr-3 py-2.5 text-[13px] bg-white/[0.03] border-[0.5px] border-white/[0.08] rounded-sm text-white placeholder:text-white/20 focus:outline-none focus:border-amber-500/30 focus:bg-white/[0.05] transition-colors disabled:opacity-50"
                    />
                  </div>
                </div>

                {status === 'error' && (
                  <p className="text-[11px] text-red-400/70">{errorMessage}</p>
                )}

                <button
                  type="submit"
                  disabled={status === 'loading' || !email}
                  className="w-full flex items-center justify-center gap-2 py-2.5 text-xs font-medium rounded-sm bg-amber-500 hover:bg-amber-400 text-[#050508] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {status === 'loading' ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Joining&hellip;
                    </>
                  ) : (
                    'Join the waitlist'
                  )}
                </button>
              </form>

              <p className="text-[10px] text-white/40 text-center mt-5">
                Already have access?{' '}
                <Link
                  href="/login"
                  className="text-amber-500/60 hover:text-amber-500/80 transition-colors"
                >
                  Sign in
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
