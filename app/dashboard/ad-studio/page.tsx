'use client';

/**
 * Ad Studio (SYN-40) — minimal reachable surface.
 *
 * Mounts the SYN-46 AdTemplateLibrary next to the SYN-40
 * TemplateCustomizationPanel. Selecting a template yields an
 * AdGenerationRequest; the panel yields a BrandOverlaySpec; the two are
 * composed HERE, in the UI layer, via `withBrandOverlay()` — a pure additive
 * spread, so brand fields never enter prompt text.
 *
 * No generation is triggered from this page: the live Artlist render and the
 * Remotion compositing pass are separate, founder-gated steps (SYN-43/48).
 */
import { useEffect, useMemo, useState } from 'react';
import AdTemplateLibrary from '@/components/marketing-agency/AdTemplateLibrary';
import TemplateCustomizationPanel, {
  type TemplateCustomizationDefaults,
} from '@/components/marketing-agency/TemplateCustomizationPanel';
import type { AdGenerationRequest } from '@/lib/marketing-agency/artlist/ad-templates';
import {
  withBrandOverlay,
  type BrandOverlaySpec,
} from '@/lib/marketing-agency/brand-style';

export default function AdStudioPage() {
  const [request, setRequest] = useState<AdGenerationRequest | null>(null);
  const [overlay, setOverlay] = useState<BrandOverlaySpec | null>(null);
  const [defaults, setDefaults] =
    useState<TemplateCustomizationDefaults | null>(null);

  // BrandDNA-seeded defaults: the first GET seeds a default preset from the
  // org's BrandDNA when none exist yet.
  useEffect(() => {
    let cancelled = false;
    fetch('/api/brand-presets')
      .then(res => (res.ok ? res.json() : null))
      .then(json => {
        if (cancelled) return;
        const preset = json?.presets?.[0];
        setDefaults(preset ?? {});
      })
      .catch(() => {
        if (!cancelled) setDefaults({});
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const branded = useMemo(() => {
    if (!request) return null;
    return overlay ? withBrandOverlay(request, overlay) : request;
  }, [request, overlay]);

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 p-6">
      <header>
        <h1 className="m-0 text-2xl font-bold text-slate-900">Ad Studio</h1>
        <p className="mt-1 text-sm text-slate-600">
          Pick a template, then apply your brand style. Brand colours, font,
          logo and CTA are applied by the render step — they never change the AI
          prompt.
        </p>
      </header>

      <AdTemplateLibrary onSelect={setRequest} />

      {defaults !== null && (
        <TemplateCustomizationPanel
          aspectRatio={request?.aspectRatio ?? '9:16'}
          defaults={defaults}
          onChange={setOverlay}
        />
      )}

      {branded && (
        <section
          aria-label="Composed generation request"
          className="rounded-xl border border-slate-200 bg-slate-50 p-4"
        >
          <h2 className="m-0 text-base font-semibold text-slate-900">
            Composed request (render-ready)
          </h2>
          <pre className="mt-2 max-h-72 overflow-auto rounded-md bg-white p-3 text-xs text-slate-700">
            {JSON.stringify(branded, null, 2)}
          </pre>
        </section>
      )}
    </main>
  );
}
