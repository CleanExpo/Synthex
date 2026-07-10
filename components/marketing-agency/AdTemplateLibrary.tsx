'use client';

/**
 * AdTemplateLibrary (SYN-46)
 *
 * Presentational gallery for the two curated ad templates (3D Product Spin,
 * Quick Social Clip). Renders each template's preview thumbnail, its curated
 * variables (product name, style, mood) and variants, and exposes a select
 * callback. Purely presentational + local state — it builds an Artlist
 * generation request via the shared `ad-templates` library and hands it to the
 * caller. It does NOT itself call any generation or ad-platform API; wiring the
 * live Artlist render is a separate, founder-gated step.
 */
import { useMemo, useState } from 'react';
import {
  AD_TEMPLATES,
  buildAdGenerationRequest,
  type AdGenerationRequest,
  type AdTemplate,
  type AdTemplateVariables,
  type AdTemplateVariantId,
} from '@/lib/marketing-agency/artlist/ad-templates';

export interface AdTemplateLibraryProps {
  /** Fired when the user selects a template + variant + variables. */
  onSelect?: (request: AdGenerationRequest) => void;
}

function defaultVariables(template: AdTemplate): AdTemplateVariables {
  const vars: AdTemplateVariables = {};
  for (const v of template.variables) {
    if (v.default) vars[v.key] = v.default;
  }
  return vars;
}

const fieldClass =
  'flex flex-col gap-1 text-sm text-slate-700 [&>select]:rounded-md [&>select]:border [&>select]:border-slate-300 [&>select]:px-2 [&>select]:py-1 [&>input]:rounded-md [&>input]:border [&>input]:border-slate-300 [&>input]:px-2 [&>input]:py-1';

function TemplateCard({
  template,
  onSelect,
}: {
  template: AdTemplate;
  onSelect?: (request: AdGenerationRequest) => void;
}) {
  const [variantId, setVariantId] = useState<AdTemplateVariantId>(
    template.variants[0]!.id
  );
  const [vars, setVars] = useState<AdTemplateVariables>(() =>
    defaultVariables(template)
  );

  const missingProductName = !vars.productName?.trim();

  const preview = useMemo(() => {
    if (missingProductName) return null;
    try {
      return buildAdGenerationRequest(template.id, vars, { variantId });
    } catch {
      return null;
    }
  }, [template.id, vars, variantId, missingProductName]);

  return (
    <article className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white">
      <img
        src={template.thumbnailUrl}
        alt={`${template.name} preview`}
        width={400}
        height={400}
        className="block h-auto w-full"
      />
      <div className="flex flex-col gap-3 p-4">
        <div>
          <h3 className="m-0 text-lg font-semibold text-slate-900">
            {template.name}
          </h3>
          <p className="mt-1 text-sm text-slate-600">{template.description}</p>
          <p className="mt-1.5 text-xs text-slate-500">
            {template.aspectRatio} · {template.durationSec}s · Artlist
          </p>
        </div>

        {template.variants.length > 1 && (
          <label className={fieldClass}>
            Variant
            <select
              value={variantId}
              onChange={e =>
                setVariantId(e.target.value as AdTemplateVariantId)
              }
            >
              {template.variants.map(v => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </label>
        )}

        {template.variables.map(schema => (
          <label key={schema.key} className={fieldClass}>
            {schema.label}
            {schema.options ? (
              <select
                value={vars[schema.key] ?? ''}
                onChange={e =>
                  setVars(prev => ({ ...prev, [schema.key]: e.target.value }))
                }
              >
                {schema.options.map(opt => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={vars[schema.key] ?? ''}
                placeholder={schema.label}
                onChange={e =>
                  setVars(prev => ({ ...prev, [schema.key]: e.target.value }))
                }
              />
            )}
          </label>
        ))}

        <button
          type="button"
          disabled={!preview}
          onClick={() => preview && onSelect?.(preview)}
          className="rounded-lg px-3 py-2 font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:bg-slate-300 enabled:cursor-pointer enabled:bg-sky-500 enabled:hover:bg-sky-600"
        >
          Use this template
        </button>
      </div>
    </article>
  );
}

export function AdTemplateLibrary({ onSelect }: AdTemplateLibraryProps) {
  return (
    <section
      aria-label="Ad template library"
      className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(280px,1fr))]"
    >
      {AD_TEMPLATES.map(template => (
        <TemplateCard
          key={template.id}
          template={template}
          onSelect={onSelect}
        />
      ))}
    </section>
  );
}

export default AdTemplateLibrary;
