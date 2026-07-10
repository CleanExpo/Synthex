'use client';

/**
 * TemplateCustomizationPanel (SYN-40)
 *
 * Brand-style customisation panel for the ad studio. Lets the user pick brand
 * colours, a curated font, CTA text and safe-zone grid positions for CTA/logo
 * per aspect ratio, seeded from BrandDNA defaults. Emits a deterministic
 * BrandOverlaySpec via `onChange` — the Remotion-consumable contract that the
 * RENDER STEP applies. Nothing here touches prompt text or calls any
 * generation API; the preview is a style reference only and is permanently
 * captioned as such.
 *
 * Deferred (not built here): logo→colour auto-detect, the compositing render
 * pass itself (SYN-43/48), freeform CTA drag.
 */
import { useEffect, useMemo, useState } from 'react';
import type { AdAspectRatio } from '@/lib/marketing-agency/artlist/ad-templates';
import {
  BRAND_FONTS,
  DEFAULT_BRAND_FONT_ID,
  FALLBACK_PRIMARY_COLOR,
  OVERLAY_GRID_POSITIONS,
  SAFE_ZONES,
  buildBrandOverlaySpec,
  type BrandOverlaySpec,
  type BrandStyleIssue,
  type OverlayGridPosition,
} from '@/lib/marketing-agency/brand-style';

/** BrandDNA-seeded (or preset-loaded) defaults for the panel. */
export interface TemplateCustomizationDefaults {
  primaryColor?: string | null;
  secondaryColor?: string | null;
  accentColor?: string | null;
  font?: string | null;
  logoUrl?: string | null;
  ctaText?: string | null;
}

export interface TemplateCustomizationPanelProps {
  /** Aspect ratio of the selected template — drives the safe-zone grid. */
  aspectRatio: AdAspectRatio;
  /** BrandDNA-seeded defaults (from /api/brand-presets). */
  defaults?: TemplateCustomizationDefaults;
  /** Fired with the current spec (or null while the style is invalid). */
  onChange?: (spec: BrandOverlaySpec | null) => void;
}

const PREVIEW_CAPTION =
  'style reference — applied by the render step, not the AI model';

const inputClass =
  'rounded-md border border-slate-300 px-2 py-1 text-sm text-slate-900';

function SafeZoneGrid({
  label,
  aspectRatio,
  allowed,
  value,
  onSelect,
}: {
  label: string;
  aspectRatio: AdAspectRatio;
  allowed: readonly OverlayGridPosition[];
  value: OverlayGridPosition;
  onSelect: (position: OverlayGridPosition) => void;
}) {
  return (
    <fieldset className="flex flex-col gap-1 border-0 p-0">
      <legend className="text-sm text-slate-700">
        {label} position ({aspectRatio} safe zone)
      </legend>
      <div
        role="group"
        aria-label={`${label} safe-zone grid`}
        className="grid w-40 grid-cols-3 gap-1"
      >
        {OVERLAY_GRID_POSITIONS.map(position => {
          const isAllowed = allowed.includes(position);
          const isSelected = value === position;
          return (
            <button
              key={position}
              type="button"
              disabled={!isAllowed}
              aria-pressed={isSelected}
              aria-label={`${label}: ${position}${isAllowed ? '' : ' (outside safe zone)'}`}
              title={
                isAllowed
                  ? position
                  : `${position} — outside the ${aspectRatio} safe zone`
              }
              onClick={() => onSelect(position)}
              className={`h-9 rounded border text-xs leading-tight ${
                isSelected
                  ? 'border-sky-600 bg-sky-500 text-white'
                  : isAllowed
                    ? 'cursor-pointer border-slate-300 bg-white text-slate-500 hover:border-sky-400'
                    : 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-300'
              }`}
            />
          );
        })}
      </div>
    </fieldset>
  );
}

export function TemplateCustomizationPanel({
  aspectRatio,
  defaults,
  onChange,
}: TemplateCustomizationPanelProps) {
  const zone = SAFE_ZONES[aspectRatio];

  const [primaryColor, setPrimaryColor] = useState(
    defaults?.primaryColor ?? FALLBACK_PRIMARY_COLOR
  );
  const [secondaryColor, setSecondaryColor] = useState(
    defaults?.secondaryColor ?? ''
  );
  const [accentColor, setAccentColor] = useState(defaults?.accentColor ?? '');
  const [font, setFont] = useState(defaults?.font ?? DEFAULT_BRAND_FONT_ID);
  const [logoUrl, setLogoUrl] = useState(defaults?.logoUrl ?? '');
  const [ctaText, setCtaText] = useState(defaults?.ctaText ?? '');
  const [ctaPosition, setCtaPosition] = useState<OverlayGridPosition>(
    zone.defaultCtaPosition
  );
  const [logoPlacement, setLogoPlacement] = useState<OverlayGridPosition>(
    zone.defaultLogoPosition
  );

  // When the template (aspect ratio) changes, snap positions back inside the
  // new ratio's safe zone.
  useEffect(() => {
    setCtaPosition(prev =>
      zone.ctaPositions.includes(prev) ? prev : zone.defaultCtaPosition
    );
    setLogoPlacement(prev =>
      zone.logoPositions.includes(prev) ? prev : zone.defaultLogoPosition
    );
  }, [zone]);

  const build = useMemo(
    () =>
      buildBrandOverlaySpec(
        {
          primaryColor,
          secondaryColor: secondaryColor || null,
          accentColor: accentColor || null,
          font,
          logoUrl: logoUrl || null,
          ctaText: ctaText || null,
        },
        { aspectRatio, ctaPosition, logoPlacement }
      ),
    [
      primaryColor,
      secondaryColor,
      accentColor,
      font,
      logoUrl,
      ctaText,
      aspectRatio,
      ctaPosition,
      logoPlacement,
    ]
  );

  const spec = build.ok ? build.spec : null;
  const issues: BrandStyleIssue[] = build.ok ? [] : build.issues;

  useEffect(() => {
    onChange?.(spec);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spec]);

  const selectedFont = BRAND_FONTS.find(f => f.id === font);

  return (
    <section
      aria-label="Template customization"
      className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4"
    >
      <h3 className="m-0 text-lg font-semibold text-slate-900">
        Brand customisation
      </h3>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-sm text-slate-700">
          Primary colour
          <input
            type="text"
            value={primaryColor}
            onChange={e => setPrimaryColor(e.target.value)}
            placeholder="#RRGGBB"
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-slate-700">
          Secondary colour
          <input
            type="text"
            value={secondaryColor}
            onChange={e => setSecondaryColor(e.target.value)}
            placeholder="optional #RRGGBB"
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-slate-700">
          Accent colour
          <input
            type="text"
            value={accentColor}
            onChange={e => setAccentColor(e.target.value)}
            placeholder="optional #RRGGBB"
            className={inputClass}
          />
        </label>
      </div>

      <fieldset className="flex flex-col gap-1 border-0 p-0">
        <legend className="text-sm text-slate-700">Font</legend>
        <div
          role="group"
          aria-label="Font swatches"
          className="flex flex-wrap gap-2"
        >
          {BRAND_FONTS.map(f => (
            <button
              key={f.id}
              type="button"
              aria-pressed={font === f.id}
              onClick={() => setFont(f.id)}
              style={{ fontFamily: f.stack }}
              className={`rounded-md border px-3 py-1.5 text-sm ${
                font === f.id
                  ? 'border-sky-600 bg-sky-50 text-sky-900'
                  : 'cursor-pointer border-slate-300 bg-white text-slate-700 hover:border-sky-400'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm text-slate-700">
          CTA text
          <input
            type="text"
            value={ctaText}
            onChange={e => setCtaText(e.target.value)}
            placeholder="e.g. Shop now"
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-slate-700">
          Logo URL
          <input
            type="text"
            value={logoUrl}
            onChange={e => setLogoUrl(e.target.value)}
            placeholder="https:// (allowlisted origin)"
            className={inputClass}
          />
        </label>
      </div>

      <div className="flex flex-wrap gap-6">
        <SafeZoneGrid
          label="CTA"
          aspectRatio={aspectRatio}
          allowed={zone.ctaPositions}
          value={ctaPosition}
          onSelect={setCtaPosition}
        />
        <SafeZoneGrid
          label="Logo"
          aspectRatio={aspectRatio}
          allowed={zone.logoPositions}
          value={logoPlacement}
          onSelect={setLogoPlacement}
        />
      </div>

      {issues.length > 0 && (
        <ul
          aria-label="Brand style issues"
          className="m-0 list-disc pl-5 text-sm text-red-600"
        >
          {issues.map(issue => (
            <li key={`${issue.field}:${issue.message}`}>
              <strong>{issue.field}</strong>: {issue.message}
            </li>
          ))}
        </ul>
      )}

      <figure className="m-0 flex flex-col gap-1">
        <div
          aria-label="Brand style preview"
          className="flex h-28 items-center justify-center rounded-lg border border-slate-200 bg-slate-200"
          style={{
            // User-picked brand colour (data, not a design token) — falls back
            // to the bg-slate-200 class while the style is invalid.
            ...(spec ? { background: spec.colors.primary } : {}),
            fontFamily: selectedFont?.stack,
          }}
        >
          <span className="rounded px-3 py-1.5 text-sm font-semibold text-white">
            {ctaText.trim() || 'Your brand'}
          </span>
        </div>
        <figcaption className="text-xs italic text-slate-500">
          {PREVIEW_CAPTION}
        </figcaption>
      </figure>
    </section>
  );
}

export default TemplateCustomizationPanel;
