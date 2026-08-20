'use client';

/**
 * Brand Scanner — extracts Brand DNA preview from a website URL.
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
        credentials: 'include',
        body: JSON.stringify({ url: target }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Scan failed (${res.status})`);
      }
      const data = (await res.json()) as { preview?: BrandDnaPreview };
      if (!data.preview) throw new Error('Scan returned no preview.');
      setState({ phase: 'result', url: target, preview: data.preview });
      onScanned?.(data.preview);
    } catch (err) {
      setState({
        phase: 'error',
        url: target,
        message: err instanceof Error ? err.message : 'Could not scan this site.',
      });
    }
  }

  return (
    <div className="border-[0.5px] border-white/6 bg-white/1.5 rounded-sm p-5">
      <div className="mb-4">
        <p className="text-[9px] uppercase tracking-[0.22em] text-white/30 mb-0.5">Step 1</p>
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-orange-400" />
          <h3 className="text-sm font-medium text-white/80">Brand scanner</h3>
        </div>
        <p className="text-xs text-white/35 mt-1 max-w-xl">
          Paste your website — we extract business name, industry, and a seed post for your campaign.
        </p>
      </div>

      <form
        className="flex flex-col gap-2 sm:flex-row"
        onSubmit={e => {
          e.preventDefault();
          void runScan(url);
        }}
      >
        <div className="relative flex-1">
          <Globe className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
          <input
            aria-label="Website URL"
            type="url"
            value={url}
            onChange={e => setUrl(e.target.value)}
            disabled={scanning}
            placeholder="https://yourbusiness.com"
            className="w-full rounded-sm border-[0.5px] border-white/8 bg-black/30 pl-9 pr-3 py-2.5 text-sm text-white placeholder:text-white/25 outline-none focus:border-orange-400/35 disabled:opacity-50"
          />
        </div>
        <button
          type="submit"
          disabled={scanning || !url.trim()}
          className="inline-flex items-center justify-center gap-2 rounded-sm bg-orange-500 px-4 py-2.5 text-sm font-medium text-[#050505] hover:bg-orange-400 disabled:opacity-50 shrink-0"
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
        <div role="status" className="mt-4 flex items-center gap-2 text-xs text-white/45">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-orange-400" />
          Reading <span className="text-white/65 truncate">{state.url}</span>
        </div>
      )}

      {state.phase === 'result' && (
        <div className="mt-4 rounded-sm border-[0.5px] border-orange-400/25 bg-orange-500/4 p-4">
          <p className="text-[9px] uppercase tracking-[0.2em] text-orange-300/90">Brand DNA</p>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex gap-3">
              <dt className="w-20 shrink-0 text-white/40 text-xs">Business</dt>
              <dd className="text-white/85">{state.preview.businessName}</dd>
            </div>
            <div className="flex gap-3">
              <dt className="w-20 shrink-0 text-white/40 text-xs">Industry</dt>
              <dd className="text-white/85">{state.preview.industry}</dd>
            </div>
            <div className="flex gap-3">
              <dt className="w-20 shrink-0 text-white/40 text-xs">Seed post</dt>
              <dd className="text-white/65 text-xs whitespace-pre-wrap leading-relaxed">
                {state.preview.firstPost}
              </dd>
            </div>
          </dl>
          <p className="mt-3 text-[10px] text-white/30">
            Full extraction continues in the background.
          </p>
        </div>
      )}

      {state.phase === 'error' && (
        <div
          role="alert"
          className="mt-4 flex items-start gap-2 rounded-sm border-[0.5px] border-red-400/25 bg-red-500/10 p-3 text-xs text-red-200"
        >
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{state.message}</span>
        </div>
      )}
    </div>
  );
}
