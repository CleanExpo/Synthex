'use client';

import { useMemo, useState, type FormEvent } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Download,
  FileText,
  Globe,
  Loader2,
  Map,
  Sparkles,
} from '@/components/icons';
import type { OpportunityMap } from '@/lib/opportunity-map';
import { opportunityMapToMarkdown } from '@/lib/opportunity-map';

interface ScanResponse {
  scanId: string;
  map: OpportunityMap;
}

interface UtmAttribution {
  source?: string;
  medium?: string;
  campaign?: string;
}

function currentAttribution(): UtmAttribution {
  if (typeof window === 'undefined') return {};
  const params = new URLSearchParams(window.location.search);
  return {
    source: params.get('utm_source') ?? undefined,
    medium: params.get('utm_medium') ?? undefined,
    campaign: params.get('utm_campaign') ?? undefined,
  };
}

function downloadBrief(map: OpportunityMap) {
  const markdown = opportunityMapToMarkdown(map);
  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${map.brandContext.businessName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')}-opportunity-map.md`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function IntakePanel({
  onComplete,
}: {
  onComplete: (response: ScanResponse) => void;
}) {
  const [businessName, setBusinessName] = useState('');
  const [context, setContext] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!context.trim()) {
      setError('Paste at least your full website link to build the map.');
      return;
    }

    setLoading(true);
    try {
      const attribution = currentAttribution();
      const response = await fetch('/api/opportunity-map', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ...(businessName.trim() ? { businessName: businessName.trim() } : {}),
          context: context.trim(),
          ...attribution,
        }),
      });
      const body = (await response.json()) as ScanResponse | { error?: string };
      if (!response.ok || !('map' in body)) {
        setError(
          ('error' in body ? body.error : undefined) ??
            'The map could not be completed. Check the website and try again.'
        );
        return;
      }
      onComplete(body);
    } catch {
      setError(
        'The map service could not be reached. Check your connection and try again.'
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      id="build-map"
      onSubmit={submit}
      className="border border-white/[0.09] bg-sx-bg-panel/95 p-5 shadow-2xl shadow-black/30 md:p-7"
    >
      <div className="mb-6 flex items-start justify-between gap-5 border-b border-white/[0.07] pb-5">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--sx-evidence)]">
            Evidence intake
          </p>
          <h2 className="mt-2 text-xl font-semibold text-white">
            Paste everything once
          </h2>
        </div>
        <span className="grid h-10 w-10 place-items-center border border-[color:var(--sx-evidence)] bg-[var(--sx-evidence-surface)] text-[var(--sx-evidence-bright)]">
          <FileText className="h-5 w-5" />
        </span>
      </div>

      <label className="block">
        <span className="text-sm font-medium text-white/80">
          Business name <span className="text-white/35">(optional)</span>
        </span>
        <input
          value={businessName}
          onChange={event => setBusinessName(event.target.value)}
          maxLength={200}
          autoComplete="organization"
          placeholder="We can infer this from the website"
          className="mt-2 h-12 w-full border border-white/[0.1] bg-black/20 px-4 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-[var(--sx-evidence)] focus:ring-2 focus:ring-[var(--sx-evidence)]/10"
        />
      </label>

      <label className="mt-5 block">
        <span className="text-sm font-medium text-white/80">
          Website, social links and rough context
        </span>
        <textarea
          value={context}
          onChange={event => setContext(event.target.value)}
          maxLength={8_000}
          rows={9}
          required
          placeholder={
            'https://yourbusiness.com.au\nhttps://instagram.com/yourbusiness\n\nWe want more of the right enquiries without posting everywhere.'
          }
          className="mt-2 w-full resize-y border border-white/[0.1] bg-black/20 px-4 py-4 font-mono text-sm leading-7 text-white outline-none transition placeholder:text-white/22 focus:border-[var(--sx-evidence)] focus:ring-2 focus:ring-[var(--sx-evidence)]/10"
        />
      </label>

      <div className="mt-4 grid gap-2 text-xs leading-5 text-white/45 sm:grid-cols-3">
        <span>01 · Sources stay visible</span>
        <span>02 · Unknowns stay unknown</span>
        <span>03 · No account connection</span>
      </div>

      {error ? (
        <p
          role="alert"
          className="mt-5 border-l-2 border-orange-400 pl-3 text-sm text-orange-200"
        >
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={loading}
        className="mt-6 inline-flex h-13 w-full items-center justify-center gap-2 bg-sx-accent px-5 text-sm font-semibold text-black transition hover:bg-sx-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sx-accent-hover focus-visible:ring-offset-2 focus-visible:ring-offset-sx-bg-panel disabled:cursor-wait disabled:opacity-60"
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Reading the evidence…
          </>
        ) : (
          <>
            Build my free map
            <ArrowRight className="h-4 w-4" />
          </>
        )}
      </button>
      <p className="mt-3 text-center text-xs leading-5 text-white/35">
        The scan reads public pages. It does not connect accounts, publish
        content or spend money.
      </p>
    </form>
  );
}

function PreviewConstellation() {
  const nodes = [
    { label: 'Website', top: '18%', colour: 'var(--sx-evidence)' },
    { label: 'Social', top: '46%', colour: 'var(--sx-info)' },
    { label: 'Your notes', top: '74%', colour: 'var(--sx-intelligence)' },
  ];
  return (
    <div className="relative min-h-[560px] overflow-hidden border border-white/[0.07] bg-sx-bg-primary">
      <div className="absolute inset-0 opacity-40 [background-image:linear-gradient(rgba(255,255,255,.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.035)_1px,transparent_1px)] [background-size:36px_36px]" />
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 640 560"
        aria-hidden
      >
        <path
          d="M95 105 C220 105 210 265 320 280"
          fill="none"
          stroke="var(--sx-evidence)"
          strokeOpacity=".35"
        />
        <path
          d="M95 270 C210 270 215 280 320 280"
          fill="none"
          stroke="var(--sx-info)"
          strokeOpacity=".35"
        />
        <path
          d="M95 425 C220 425 215 295 320 280"
          fill="none"
          stroke="var(--sx-intelligence)"
          strokeOpacity=".35"
        />
        <path
          d="M320 280 C430 280 425 120 550 110"
          fill="none"
          stroke="var(--sx-accent)"
          strokeOpacity=".35"
        />
        <path
          d="M320 280 C435 280 440 280 550 280"
          fill="none"
          stroke="var(--sx-accent)"
          strokeOpacity=".45"
        />
        <path
          d="M320 280 C430 280 425 435 550 445"
          fill="none"
          stroke="var(--sx-accent)"
          strokeOpacity=".25"
        />
      </svg>
      {nodes.map(node => (
        <div
          key={node.label}
          className="absolute left-[5%] w-32 border bg-sx-bg-panel px-3 py-3"
          style={{ top: node.top, borderColor: node.colour }}
        >
          <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-white/40">
            Evidence
          </span>
          <p className="mt-1 text-sm text-white">{node.label}</p>
        </div>
      ))}
      <div className="absolute left-1/2 top-1/2 grid h-36 w-36 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-[color:var(--sx-evidence)] bg-[var(--sx-evidence-surface)] text-center shadow-[0_0_70px_rgba(65,214,195,.12)]">
        <div>
          <Sparkles className="mx-auto h-5 w-5 text-[var(--sx-evidence-bright)]" />
          <p className="mt-2 text-sm font-semibold text-white">Brand context</p>
          <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--sx-evidence-bright)]/70">
            Evidence field
          </p>
        </div>
      </div>
      {['Search demand', 'Offer clarity', 'Authority'].map((label, index) => (
        <div
          key={label}
          className="absolute right-[4%] w-36 border border-orange-400/25 bg-[var(--sx-opportunity-surface)] px-3 py-3"
          style={{ top: `${15 + index * 31}%` }}
        >
          <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-orange-300/60">
            Direction {index + 1}
          </span>
          <p className="mt-1 text-sm text-white">{label}</p>
        </div>
      ))}
      <div className="absolute inset-x-6 bottom-5 flex items-center justify-between border-t border-white/[0.07] pt-4 font-mono text-[11px] uppercase tracking-[0.16em] text-white/30">
        <span>Evidence → context → direction</span>
        <span>Inspectable, not automatic</span>
      </div>
    </div>
  );
}

function ResultConstellation({ map }: { map: OpportunityMap }) {
  return (
    <section
      aria-labelledby="map-heading"
      className="border border-white/[0.08] bg-sx-bg-primary"
    >
      <div className="flex flex-col gap-4 border-b border-white/[0.07] p-5 sm:flex-row sm:items-center sm:justify-between md:px-7">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--sx-evidence)]">
            Completed map
          </p>
          <h2
            id="map-heading"
            className="mt-2 text-2xl font-semibold text-white"
          >
            {map.brandContext.businessName}
          </h2>
        </div>
        <button
          type="button"
          onClick={() => downloadBrief(map)}
          className="inline-flex items-center justify-center gap-2 border border-white/[0.12] px-4 py-2.5 text-sm text-white/75 transition hover:border-white/30 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sx-evidence)]"
        >
          <Download className="h-4 w-4" />
          Download brief
        </button>
      </div>

      <div className="grid gap-px bg-white/[0.06] md:grid-cols-[0.75fr_1fr_1.3fr]">
        <div className="bg-sx-bg-secondary p-5 md:p-7">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-white/35">
            Evidence field
          </p>
          <div className="mt-5 space-y-3">
            {map.evidence.slice(0, 5).map(item => (
              <article
                key={item.id}
                className="border-l-2 border-[color:var(--sx-evidence)] bg-white/[0.025] px-3 py-3"
              >
                <div className="flex items-center gap-2 text-xs text-[var(--sx-evidence-bright)]">
                  {item.kind === 'website' ? (
                    <Globe className="h-3.5 w-3.5" />
                  ) : (
                    <FileText className="h-3.5 w-3.5" />
                  )}
                  {item.label}
                </div>
                <p className="mt-1.5 line-clamp-2 break-all text-xs leading-5 text-white/50">
                  {item.value}
                </p>
              </article>
            ))}
          </div>
          {map.gaps.length ? (
            <div className="mt-7">
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-white/35">
                Still unknown
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {map.gaps.map(gap => (
                  <span
                    key={gap.label}
                    className="border border-amber-300/20 bg-amber-300/[0.05] px-2.5 py-1 text-[11px] text-amber-100/70"
                  >
                    {gap.label}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div className="bg-sx-bg-secondary p-5 md:p-7">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--sx-evidence-bright)]">
            Brand core
          </p>
          <div className="mt-5 border border-[color:var(--sx-evidence)] bg-[var(--sx-evidence-surface)] p-5 shadow-[0_0_50px_rgba(65,214,195,.06)]">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-full border border-[color:var(--sx-evidence)] text-[var(--sx-evidence-bright)]">
                <Sparkles className="h-5 w-5" />
              </span>
              <div>
                <h3 className="font-semibold text-white">
                  {map.brandContext.businessName}
                </h3>
                <p className="mt-0.5 text-xs capitalize text-white/45">
                  {map.brandContext.industry ?? 'Industry unconfirmed'}
                </p>
              </div>
            </div>
            <p className="mt-5 text-sm leading-6 text-white/65">
              {map.brandContext.description ??
                'The offer description needs confirmation before production.'}
            </p>
            <dl className="mt-5 space-y-3 border-t border-white/[0.07] pt-4 text-xs">
              <div>
                <dt className="text-white/35">Audience</dt>
                <dd className="mt-1 text-white/70">
                  {map.brandContext.audience ?? 'Requires confirmation'}
                </dd>
              </div>
              <div>
                <dt className="text-white/35">Working tone</dt>
                <dd className="mt-1 capitalize text-white/70">
                  {map.brandContext.tone ?? 'Requires confirmation'}
                </dd>
              </div>
            </dl>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-2">
            {map.signals.map(signal => (
              <div
                key={signal.label}
                className="border border-white/[0.07] bg-black/10 p-3"
              >
                <p className="text-lg font-semibold text-white">
                  {signal.value}
                </p>
                <p className="mt-1 text-[11px] uppercase tracking-[0.12em] text-white/35">
                  {signal.label}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-sx-bg-secondary p-5 md:p-7">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-orange-300">
            Ranked directions
          </p>
          <div className="mt-5 space-y-3">
            {map.opportunities.map(item => (
              <article
                key={item.id}
                className="border border-orange-300/[0.14] bg-[var(--sx-opportunity-surface)] p-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex gap-3">
                    <span className="font-mono text-xs text-orange-300">
                      0{item.rank}
                    </span>
                    <div>
                      <h3 className="font-semibold text-white">{item.title}</h3>
                      <p className="mt-2 text-sm leading-6 text-white/58">
                        {item.direction}
                      </p>
                    </div>
                  </div>
                  <span className="shrink-0 border border-orange-300/25 px-2 py-1 font-mono text-xs text-orange-200">
                    {item.score}
                  </span>
                </div>
                <details className="mt-4 border-t border-white/[0.07] pt-3 text-xs text-white/55">
                  <summary className="cursor-pointer select-none text-white/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300">
                    Evidence and assumptions
                  </summary>
                  <div className="mt-3 space-y-2 leading-5">
                    {item.evidence.map(value => (
                      <p key={value}>Observed · {value}</p>
                    ))}
                    {item.assumptions.map(value => (
                      <p key={value}>Assumption · {value}</p>
                    ))}
                  </div>
                </details>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function HandoffPanel({
  scanId,
  map,
}: {
  scanId: string;
  map: OpportunityMap;
}) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [complete, setComplete] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const response = await fetch('/api/opportunity-map/handoff', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          scanId,
          name,
          email,
          ...(phone ? { phone } : {}),
          consent,
        }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(body.error ?? 'The handoff could not be recorded. Try again.');
        return;
      }
      setComplete(true);
    } catch {
      setError(
        'The handoff service could not be reached. Check your connection and try again.'
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (complete) {
    return (
      <section className="border border-[color:var(--sx-evidence)] bg-[var(--sx-evidence-surface)] p-6 md:p-8">
        <CheckCircle2 className="h-8 w-8 text-[var(--sx-evidence-bright)]" />
        <h2 className="mt-4 text-2xl font-semibold text-white">
          Your context is preserved.
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-white/60">
          Nexus has the map and your contact consent. The next contact can start
          from this evidence instead of repeating discovery.
        </p>
      </section>
    );
  }

  return (
    <section className="grid gap-px bg-white/[0.07] md:grid-cols-[1fr_1.05fr]">
      <div className="bg-sx-bg-panel p-6 md:p-8">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-orange-300">
          Recommended next move
        </p>
        <h2 className="mt-3 text-2xl font-semibold text-white">
          {map.serviceRecommendation.title}
        </h2>
        <p className="mt-4 text-sm leading-7 text-white/60">
          {map.serviceRecommendation.summary}
        </p>
        <div className="mt-6 flex items-end gap-4 border-t border-white/[0.07] pt-5">
          <div>
            <p className="text-4xl font-semibold text-white">{map.fit.score}</p>
            <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.16em] text-white/35">
              Commercial fit / 100
            </p>
          </div>
          <span className="mb-1 border border-orange-300/25 bg-orange-300/[0.06] px-2.5 py-1 text-xs capitalize text-orange-100">
            {map.fit.state.replace('-', ' ')}
          </span>
        </div>
        <p className="mt-4 text-xs leading-6 text-white/40">
          {map.fit.explanation}
        </p>
      </div>

      <form onSubmit={submit} className="bg-sx-bg-panel p-6 md:p-8">
        <h3 className="text-lg font-semibold text-white">
          Hand this map to Nexus
        </h3>
        <p className="mt-2 text-sm leading-6 text-white/50">
          Add contact details only if you want a service conversation. The map
          stays useful without this step.
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <label className="text-xs text-white/55">
            Name
            <input
              required
              minLength={2}
              maxLength={120}
              autoComplete="name"
              value={name}
              onChange={event => setName(event.target.value)}
              className="mt-2 h-11 w-full border border-white/[0.1] bg-black/20 px-3 text-sm text-white outline-none focus:border-orange-300/60 focus:ring-2 focus:ring-orange-300/10"
            />
          </label>
          <label className="text-xs text-white/55">
            Work email
            <input
              required
              type="email"
              maxLength={254}
              autoComplete="email"
              value={email}
              onChange={event => setEmail(event.target.value)}
              className="mt-2 h-11 w-full border border-white/[0.1] bg-black/20 px-3 text-sm text-white outline-none focus:border-orange-300/60 focus:ring-2 focus:ring-orange-300/10"
            />
          </label>
        </div>
        <label className="mt-3 block text-xs text-white/55">
          Phone <span className="text-white/30">(optional)</span>
          <input
            type="tel"
            maxLength={40}
            autoComplete="tel"
            value={phone}
            onChange={event => setPhone(event.target.value)}
            className="mt-2 h-11 w-full border border-white/[0.1] bg-black/20 px-3 text-sm text-white outline-none focus:border-orange-300/60 focus:ring-2 focus:ring-orange-300/10"
          />
        </label>
        <label className="mt-4 flex cursor-pointer items-start gap-3 text-xs leading-5 text-white/55">
          <input
            required
            type="checkbox"
            checked={consent}
            onChange={event => setConsent(event.target.checked)}
            className="mt-1 h-4 w-4 accent-[var(--sx-accent)]"
          />
          <span>
            I ask Unite-Group to contact me about this Opportunity Map and
            related services. This does not subscribe me to general marketing.
          </span>
        </label>
        {error ? (
          <p role="alert" className="mt-4 text-sm text-orange-200">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={submitting || !consent}
          className="mt-5 inline-flex h-12 w-full items-center justify-center gap-2 bg-sx-accent px-4 text-sm font-semibold text-black transition hover:bg-sx-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 disabled:cursor-not-allowed disabled:opacity-45"
        >
          {submitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ArrowRight className="h-4 w-4" />
          )}
          {submitting ? 'Preserving the handoff…' : 'Continue with this map'}
        </button>
      </form>
    </section>
  );
}

export function OpportunityMapExperience() {
  const [result, setResult] = useState<ScanResponse | null>(null);
  const stageLabel = useMemo(
    () => (result ? 'Map complete' : 'Free public scan'),
    [result]
  );

  return (
    <div className="min-h-screen bg-sx-bg-primary text-white">
      <section className="relative overflow-hidden border-b border-white/[0.06] pt-28 pb-16 md:pt-36 md:pb-20">
        <div className="absolute inset-0 opacity-35 [background-image:radial-gradient(circle_at_20%_20%,rgba(65,214,195,.16),transparent_28%),radial-gradient(circle_at_82%_30%,rgba(255,122,24,.14),transparent_24%)]" />
        <div className="absolute inset-0 opacity-25 [background-image:linear-gradient(rgba(255,255,255,.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.03)_1px,transparent_1px)] [background-size:48px_48px]" />
        <div className="relative mx-auto max-w-7xl px-5">
          <div className="flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.22em] text-[var(--sx-evidence-bright)]">
            <Map className="h-4 w-4" />
            {stageLabel}
          </div>
          <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_0.52fr] lg:items-end">
            <h1 className="max-w-4xl text-4xl font-semibold leading-[1.02] tracking-[-0.035em] text-white sm:text-5xl md:text-7xl">
              Find the next move hiding in your{' '}
              <span className="text-sx-accent-hover">existing evidence.</span>
            </h1>
            <p className="max-w-xl text-base leading-8 text-white/58 lg:pb-2">
              Paste your website, social links and rough context. The Marketing
              Extender turns them into three ranked growth directions—showing
              what is observed, inferred and still unknown.
            </p>
          </div>
          <div className="mt-10 flex flex-wrap gap-x-7 gap-y-3 border-t border-white/[0.07] pt-6 font-mono text-[11px] uppercase tracking-[0.15em] text-white/35">
            <span>Free</span>
            <span>No login</span>
            <span>No account connection</span>
            <span>No automatic publishing</span>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-10 md:py-16">
        {result ? (
          <div className="space-y-5">
            <ResultConstellation map={result.map} />
            <HandoffPanel scanId={result.scanId} map={result.map} />
          </div>
        ) : (
          <div className="grid gap-5 lg:grid-cols-[0.78fr_1.22fr]">
            <IntakePanel onComplete={setResult} />
            <div className="hidden lg:block">
              <PreviewConstellation />
            </div>
          </div>
        )}
      </section>

      <section className="border-t border-white/[0.06] bg-sx-bg-secondary py-16">
        <div className="mx-auto grid max-w-7xl gap-8 px-5 md:grid-cols-3">
          {[
            [
              'Evidence stays attached',
              'Every direction names the observed signal and any assumption that still needs testing.',
            ],
            [
              'Unknown stays visible',
              'Missing audience, offer, rights or performance context is shown instead of quietly invented.',
            ],
            [
              'Action needs consent',
              'The free map authorizes no publishing, spend, account access or service agreement.',
            ],
          ].map(([title, copy], index) => (
            <article key={title} className="border-t border-white/[0.1] pt-5">
              <span className="font-mono text-[11px] text-[var(--sx-evidence-bright)]">
                0{index + 1}
              </span>
              <h2 className="mt-3 text-lg font-semibold text-white">{title}</h2>
              <p className="mt-3 text-sm leading-7 text-white/48">{copy}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
