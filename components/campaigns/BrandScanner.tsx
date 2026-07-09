'use client';

/**
 * BrandScanner — Phase-8 campaign dashboard (SYN-381, Task 35).
 *
 * A three-state surface (idle → scanning → DNA card) that kicks off a Brand DNA
 * extraction for a website URL. It calls the existing governed endpoint
 * `POST /api/brand-dna/extract`, which returns an instant preview
 * (`{ preview: { businessName, industry, firstPost }, status: 'extracting' }`)
 * while the full pipeline persists in the background.
 *
 * The component surfaces the returned preview honestly — it never fabricates a
 * finished DNA. Errors (validation 400, no-org 403, 5xx) are shown as-is.
 */
import { useState } from 'react';
import { Sparkles, Globe, Loader2, AlertCircle } from '@/components/icons';

export interface BrandDnaPreview {
  businessName: string;
  industry: string;
  firstPost: string;
}

type ScanState =
  | { phase: 'idle' }
  | { phase: 'scanning'; url: string }
  | { phase: 'result'; url: string; preview: BrandDnaPreview }
  | { phase: 'error'; url: string; message: string };

export interface BrandScannerProps {
  /** Notified with the preview once a scan resolves (e.g. to seed a campaign). */
  onScanned?: (preview: BrandDnaPreview) => void;
}

export function BrandScanner({ onScanned }: BrandScannerProps) {
  const [url, setUrl] = useState('');
  const [state, setState] = useState<ScanState>({ phase: 'idle' });

  const scanning = state.phase === 'scanning';

  async function runScan(rawUrl: string) {
    const target = rawUrl.trim();
    if (!target) return;
    setState({ phase: 'scanning', url: target });
    try {
      const res = await fetch('/api/brand-dna/extract', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url: target }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(body.error ?? `Scan failed (${res.status})`);
      }
      const data = (await res.json()) as { preview?: BrandDnaPreview };
      if (!data.preview) {
        throw new Error('Scan returned no preview.');
      }
      setState({ phase: 'result', url: target, preview: data.preview });
      onScanned?.(data.preview);
    } catch (err) {
      setState({
        phase: 'error',
        url: target,
        message:
          err instanceof Error ? err.message : 'Could not scan this site.',
      });
    }
  }

  return (
    <section className="rounded-xl border border-white/[0.06] bg-white/[0.01] backdrop-blur-sm p-6">
      <div className="flex items-center gap-2">
        <Sparkles className="w-5 h-5 text-orange-400" />
        <h2 className="text-sm font-semibold text-white tracking-wide">
          Brand Scanner
        </h2>
      </div>
      <p className="mt-2 text-xs text-white/60 leading-relaxed">
        Paste your website and Synthex extracts your Brand DNA — name, industry,
        and a first post to seed a campaign.
      </p>

      <form
        className="mt-4 flex flex-col gap-2 sm:flex-row"
        onSubmit={e => {
          e.preventDefault();
          runScan(url);
        }}
      >
        <div className="relative flex-1">
          <Globe className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
          <input
            aria-label="Website URL"
            type="url"
            value={url}
            onChange={e => setUrl(e.target.value)}
            disabled={scanning}
            placeholder="https://example.com"
            className="w-full rounded-sm border border-white/10 bg-black/40 pl-9 pr-3 py-2 text-sm text-white outline-none focus:border-orange-400/40 disabled:opacity-50"
          />
        </div>
        <button
          type="submit"
          disabled={scanning || !url.trim()}
          className="inline-flex items-center justify-center gap-2 rounded-sm bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-400 disabled:opacity-50"
        >
          {scanning ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Scanning…
            </>
          ) : (
            'Scan site'
          )}
        </button>
      </form>

      {state.phase === 'scanning' && (
        <div
          role="status"
          className="mt-4 flex items-center gap-2 text-sm text-white/60"
        >
          <Loader2 className="h-4 w-4 animate-spin text-orange-400" />
          Reading <span className="text-white">{state.url}</span> and extracting
          Brand DNA…
        </div>
      )}

      {state.phase === 'result' && (
        <div className="mt-4 rounded-lg border border-orange-400/30 bg-orange-500/[0.06] p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-orange-300">
            Brand DNA
          </p>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex gap-2">
              <dt className="w-24 shrink-0 text-white/50">Business</dt>
              <dd className="text-white">{state.preview.businessName}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-24 shrink-0 text-white/50">Industry</dt>
              <dd className="text-white">{state.preview.industry}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-24 shrink-0 text-white/50">First post</dt>
              <dd className="text-white/80 whitespace-pre-wrap">
                {state.preview.firstPost}
              </dd>
            </div>
          </dl>
          <p className="mt-3 text-xs text-white/40">
            Full brand extraction continues in the background.
          </p>
        </div>
      )}

      {state.phase === 'error' && (
        <div
          role="alert"
          className="mt-4 flex items-start gap-2 rounded-lg border border-red-400/20 bg-red-500/10 p-3 text-sm text-red-200"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{state.message}</span>
        </div>
      )}
    </section>
  );
}
