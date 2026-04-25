'use client';

/**
 * BenchmarkTrialForm — public trial CTA on `/benchmark` (SYN-801).
 *
 * Small inline form: email + business name + optional phone. On submit the
 * payload is POSTed to the server-side signing shim at
 * `/api/internal/sign-lead`, which signs it with the shared HMAC secret and
 * forwards to `POST /api/leads` (SYN-794). The browser never sees the
 * signing secret.
 *
 * Analytics:
 *   - Augments — does NOT replace — the existing GA4 wiring from PR #87.
 *     Fires `benchmark_trial_cta_click` via the global hook installed by
 *     the BenchmarkAnalyticsIsland.
 *
 * On success the visitor is redirected to `/auth/signup` with the email
 * pre-filled and the original UTM parameters preserved so attribution
 * carries through into the signed-up account.
 */

import { useState, type FormEvent } from 'react';

interface GtagWindow extends Window {
  __synthexTrackBenchmarkCta?: () => void;
}

interface BenchmarkTrialFormProps {
  /** Tailwind classes applied to the submit button — matches the original
   *  CTA styling exactly so the visual surface does not regress. */
  buttonClassName: string;
  /** Optional id so multiple instances on the same page do not collide. */
  formId?: string;
}

interface UtmFields {
  source?: string;
  medium?: string;
  campaign?: string;
}

/** Read UTM parameters from the current URL. Returns an empty object on the
 *  server, where `window.location` is unavailable. */
function readUtm(): UtmFields {
  if (typeof window === 'undefined') return {};
  const params = new URLSearchParams(window.location.search);
  return {
    source: params.get('utm_source') ?? undefined,
    medium: params.get('utm_medium') ?? undefined,
    campaign: params.get('utm_campaign') ?? undefined,
  };
}

export function BenchmarkTrialForm({
  buttonClassName,
  formId = 'benchmark-trial-form',
}: BenchmarkTrialFormProps) {
  const [email, setEmail] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const trimmedEmail = email.trim();
    const trimmedBusiness = businessName.trim();
    const trimmedPhone = phone.trim();

    if (!trimmedEmail || !trimmedBusiness) {
      setError('Please enter your email and your business name.');
      return;
    }

    setSubmitting(true);

    // Preserve the existing GA4 instrumentation from PR #87.
    if (typeof window !== 'undefined') {
      const w = window as GtagWindow;
      w.__synthexTrackBenchmarkCta?.();
    }

    const utm = readUtm();

    try {
      const response = await fetch('/api/internal/sign-lead', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          contactMethod: 'form_submission',
          source: utm.source ?? 'benchmark_page',
          medium: utm.medium ?? 'web',
          campaign: utm.campaign ?? 'benchmark_launch',
          occurredAt: new Date().toISOString(),
          capturedFrom: '/benchmark',
          rawPayload: {
            email: trimmedEmail,
            businessName: trimmedBusiness,
            ...(trimmedPhone ? { phone: trimmedPhone } : {}),
          },
        }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          setError(
            'You have submitted this form a few times in quick succession. Please wait a moment and try again.'
          );
        } else if (response.status === 400) {
          setError('Please double-check your email and business name.');
        } else {
          setError(
            'We could not record your details just now. Please try again in a moment.'
          );
        }
        setSubmitting(false);
        return;
      }

      const params = new URLSearchParams({
        email: trimmedEmail,
        utm_source: utm.source ?? 'benchmark_page',
        utm_medium: utm.medium ?? 'web',
        utm_campaign: utm.campaign ?? 'benchmark_launch',
      });
      window.location.href = `/auth/signup?${params.toString()}`;
    } catch {
      setError(
        'We could not reach the server. Check your connection and try again.'
      );
      setSubmitting(false);
    }
  }

  return (
    <form
      id={formId}
      onSubmit={handleSubmit}
      noValidate
      className="mx-auto flex w-full max-w-xl flex-col gap-3"
    >
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <label className="flex flex-col text-left text-sm">
          <span className="mb-1 text-gray-300">Work email</span>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="you@yourbusiness.com.au"
            className="rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-gray-500 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-400/40"
          />
        </label>
        <label className="flex flex-col text-left text-sm">
          <span className="mb-1 text-gray-300">Business name</span>
          <input
            type="text"
            required
            autoComplete="organization"
            value={businessName}
            onChange={e => setBusinessName(e.target.value)}
            placeholder="Your organisation"
            className="rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-gray-500 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-400/40"
          />
        </label>
      </div>
      <label className="flex flex-col text-left text-sm">
        <span className="mb-1 text-gray-300">
          Phone <span className="text-gray-500">(optional, AU format)</span>
        </span>
        <input
          type="tel"
          autoComplete="tel"
          value={phone}
          onChange={e => setPhone(e.target.value)}
          placeholder="+61 4XX XXX XXX"
          className="rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-gray-500 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-400/40"
        />
      </label>

      {error ? (
        <p
          role="alert"
          className="text-left text-sm text-orange-300"
          data-testid="benchmark-trial-form-error"
        >
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={submitting}
        className={`${buttonClassName} disabled:cursor-not-allowed disabled:opacity-60`}
      >
        {submitting ? 'Starting your trial…' : 'Start your free trial'}
      </button>
      <p className="text-sm text-gray-400">
        14-day trial · No credit card required · Cancel anytime
      </p>
    </form>
  );
}
