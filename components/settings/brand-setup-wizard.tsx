'use client';

/**
 * Brand Setup Wizard
 *
 * 4-step wizard that walks users through setting up their full brand profile
 * with an optional AI-powered BrandDNA extraction step.
 *
 * Steps:
 *  1  Business  — name, website, industry, team size, ABN
 *  2  Identity  — logo, primary colour, description / tagline
 *  3  Presence  — social handles
 *  4  Review    — live preview + BrandDNA AI extract + save
 */

import { useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Building,
  Globe,
  Palette,
  Users,
  CheckCircle,
  ChevronRight,
  ChevronLeft,
  Loader2,
  Upload,
  X,
  Sparkles,
  AlertCircle,
} from '@/components/icons';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useBrandProfile } from '@/hooks/use-brand-profile';
import type { BrandProfileUpdatePayload } from '@/app/api/brand-profile/types';

// ── Constants ────────────────────────────────────────────────────────────────

const INDUSTRY_OPTIONS = [
  'Technology',
  'Marketing & Advertising',
  'E-commerce',
  'Media & Entertainment',
  'Healthcare',
  'Finance & Insurance',
  'Education',
  'Real Estate',
  'Food & Beverage',
  'Fashion & Apparel',
  'Travel & Tourism',
  'Restoration & Remediation',
  'Trades & Construction',
  'Professional Services',
  'Non-profit',
  'Manufacturing',
  'Other',
];

const TEAM_SIZE_OPTIONS = ['Solo', '2–10', '11–50', '51–200', '200+'] as const;

const SOCIAL_PLATFORMS = [
  { key: 'instagram', label: 'Instagram', placeholder: '@handle' },
  { key: 'twitter', label: 'Twitter / X', placeholder: '@handle' },
  { key: 'linkedin', label: 'LinkedIn', placeholder: 'company/name' },
  { key: 'facebook', label: 'Facebook', placeholder: 'Page name or URL' },
  { key: 'youtube', label: 'YouTube', placeholder: '@channel' },
  { key: 'tiktok', label: 'TikTok', placeholder: '@handle' },
  { key: 'pinterest', label: 'Pinterest', placeholder: '@handle' },
  { key: 'reddit', label: 'Reddit', placeholder: 'r/community' },
] as const;

const HEX_REGEX = /^#[0-9A-Fa-f]{6}$/;
const DEFAULT_COLOR = '#f59e0b'; // amber-500

// ── Types ────────────────────────────────────────────────────────────────────

interface WizardData {
  // Step 1 — Business
  name: string;
  website: string;
  industry: string;
  teamSize: string;
  abn: string;
  // Step 2 — Identity
  logo: string;
  primaryColor: string;
  description: string;
  // Step 3 — Presence
  socialHandles: Record<string, string>;
}

const INITIAL_DATA: WizardData = {
  name: '',
  website: '',
  industry: '',
  teamSize: '',
  abn: '',
  logo: '',
  primaryColor: DEFAULT_COLOR,
  description: '',
  socialHandles: {},
};

// ── Step definitions ─────────────────────────────────────────────────────────

const STEPS = [
  { id: 1, label: 'Business', icon: Building },
  { id: 2, label: 'Identity', icon: Palette },
  { id: 3, label: 'Presence', icon: Globe },
  { id: 4, label: 'Review', icon: CheckCircle },
] as const;

// ── Field ────────────────────────────────────────────────────────────────────

function Field({
  label,
  required,
  error,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] uppercase tracking-[0.1em] text-white/50">
        {label}
        {required && <span className="text-amber-500/70 ml-1">*</span>}
      </label>
      {children}
      {error && (
        <p className="text-[10px] text-red-400/70 flex items-center gap-1">
          <AlertCircle className="w-3 h-3 flex-shrink-0" />
          {error}
        </p>
      )}
      {hint && !error && <p className="text-[10px] text-white/60">{hint}</p>}
    </div>
  );
}

const inputCls = (err?: string) =>
  cn(
    'w-full px-3 py-2.5 text-xs bg-white/[0.02] border-[0.5px] text-white/80 placeholder:text-white/40 rounded-sm',
    'focus:outline-none focus:border-amber-500/30 transition-colors',
    err ? 'border-red-500/30' : 'border-white/[0.06]'
  );

// ── Step 1 — Business ────────────────────────────────────────────────────────

function StepBusiness({
  data,
  onChange,
  errors,
}: {
  data: WizardData;
  onChange: (partial: Partial<WizardData>) => void;
  errors: Partial<Record<keyof WizardData, string>>;
}) {
  return (
    <div className="space-y-5">
      <Field label="Organisation Name" required error={errors.name}>
        <input
          type="text"
          value={data.name}
          onChange={e => onChange({ name: e.target.value })}
          placeholder="Acme Corporation"
          maxLength={100}
          className={inputCls(errors.name)}
        />
      </Field>

      <Field
        label="Website"
        error={errors.website}
        hint="Used for AI brand analysis — include https://"
      >
        <div className="relative">
          <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/60 pointer-events-none" />
          <input
            type="url"
            value={data.website}
            onChange={e => onChange({ website: e.target.value })}
            placeholder="https://yourcompany.com"
            className={cn(inputCls(errors.website), 'pl-9')}
          />
        </div>
      </Field>

      <Field label="Industry">
        <select
          value={data.industry}
          onChange={e => onChange({ industry: e.target.value })}
          className={cn(
            inputCls(),
            'appearance-none bg-[#0a0a12] cursor-pointer'
          )}
        >
          <option value="" disabled className="bg-[#0a0a12] text-white/40">
            Select your industry…
          </option>
          {INDUSTRY_OPTIONS.map(opt => (
            <option key={opt} value={opt} className="bg-[#0a0a12] text-white">
              {opt}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Team Size">
        <div className="flex flex-wrap gap-2">
          {TEAM_SIZE_OPTIONS.map(size => (
            <button
              key={size}
              type="button"
              onClick={() => onChange({ teamSize: size })}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 text-xs rounded-sm border-[0.5px] transition-colors',
                data.teamSize === size
                  ? 'border-amber-500/40 bg-amber-500/[0.08] text-amber-400'
                  : 'border-white/[0.06] bg-white/[0.02] text-white/50 hover:border-white/[0.12] hover:text-white/70'
              )}
            >
              <Users className="w-3 h-3" />
              {size}
            </button>
          ))}
        </div>
      </Field>

      <Field
        label="ABN"
        hint="Australian Business Number (optional)"
        error={errors.abn}
      >
        <input
          type="text"
          value={data.abn}
          onChange={e => onChange({ abn: e.target.value })}
          placeholder="12 345 678 901"
          maxLength={20}
          className={inputCls(errors.abn)}
        />
      </Field>
    </div>
  );
}

// ── Step 2 — Identity ────────────────────────────────────────────────────────

function StepIdentity({
  data,
  onChange,
  errors,
}: {
  data: WizardData;
  onChange: (partial: Partial<WizardData>) => void;
  errors: Partial<Record<keyof WizardData, string>>;
}) {
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/media/upload', {
        method: 'POST',
        credentials: 'include',
        body: fd,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Upload failed');
      onChange({ logo: json.data.url });
      toast.success('Logo uploaded');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const previewColor = HEX_REGEX.test(data.primaryColor)
    ? data.primaryColor
    : DEFAULT_COLOR;

  return (
    <div className="space-y-5">
      {/* Logo */}
      <Field
        label="Logo"
        hint="Paste a URL or upload a file (PNG, SVG recommended)"
        error={errors.logo}
      >
        <div className="flex gap-2">
          <input
            type="url"
            value={data.logo}
            onChange={e => onChange({ logo: e.target.value })}
            placeholder="https://example.com/logo.png"
            className={cn(inputCls(errors.logo), 'flex-1')}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-1.5 px-3 py-2.5 text-xs text-white/50 hover:text-white/80 bg-white/[0.02] hover:bg-white/[0.04] border-[0.5px] border-white/[0.06] hover:border-white/[0.12] rounded-sm transition-all disabled:opacity-50 whitespace-nowrap"
          >
            {uploading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Upload className="w-3.5 h-3.5" />
            )}
            Upload
          </button>
          {data.logo && (
            <button
              type="button"
              onClick={() => onChange({ logo: '' })}
              className="p-2.5 text-white/60 hover:text-white/60 bg-white/[0.02] border-[0.5px] border-white/[0.06] rounded-sm transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={e => {
            const f = e.target.files?.[0];
            if (f) handleUpload(f);
            e.target.value = '';
          }}
        />
        {/* Logo preview */}
        {data.logo && (
          <div className="mt-2 w-20 h-20 border-[0.5px] border-white/[0.06] rounded-sm bg-white/[0.02] flex items-center justify-center overflow-hidden">
            <img
              src={data.logo}
              alt="Logo preview"
              className="max-w-full max-h-full object-contain"
              onError={e => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          </div>
        )}
      </Field>

      {/* Primary Colour */}
      <Field
        label="Primary Brand Colour"
        hint="Hex code (e.g. #f59e0b)"
        error={errors.primaryColor}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-sm border-[0.5px] border-white/[0.06] flex-shrink-0 relative overflow-hidden cursor-pointer"
            style={{ background: previewColor }}
          >
            <input
              type="color"
              value={previewColor}
              onChange={e => onChange({ primaryColor: e.target.value })}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              aria-label="Pick colour"
            />
          </div>
          <input
            type="text"
            value={data.primaryColor}
            onChange={e => onChange({ primaryColor: e.target.value })}
            placeholder="#f59e0b"
            maxLength={7}
            className={cn(inputCls(errors.primaryColor), 'font-mono w-32')}
          />
        </div>
      </Field>

      {/* Description */}
      <Field
        label="Brand Description / Tagline"
        hint="Up to 500 characters — used for AI content generation"
        error={errors.description}
      >
        <textarea
          value={data.description}
          onChange={e => onChange({ description: e.target.value })}
          placeholder="We help small businesses grow through world-class social media automation…"
          maxLength={500}
          rows={3}
          className={cn(
            inputCls(errors.description),
            'resize-none leading-relaxed'
          )}
        />
        <p className="text-[10px] text-white/60 text-right -mt-1">
          {data.description.length} / 500
        </p>
      </Field>
    </div>
  );
}

// ── Step 3 — Presence ────────────────────────────────────────────────────────

function StepPresence({
  data,
  onChange,
}: {
  data: WizardData;
  onChange: (partial: Partial<WizardData>) => void;
}) {
  const handleSocial = (key: string, value: string) => {
    onChange({ socialHandles: { ...data.socialHandles, [key]: value } });
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-white/40 leading-relaxed">
        Add your social handles so Synthex can pre-fill content and track
        performance across platforms. All fields are optional.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {SOCIAL_PLATFORMS.map(({ key, label, placeholder }) => (
          <Field key={key} label={label}>
            <input
              type="text"
              value={data.socialHandles[key] ?? ''}
              onChange={e => handleSocial(key, e.target.value)}
              placeholder={placeholder}
              className={inputCls()}
            />
          </Field>
        ))}
      </div>
    </div>
  );
}

// ── Step 4 — Review ──────────────────────────────────────────────────────────

function StepReview({
  data,
  onExtract,
  extracting,
  extractDone,
  extractPreview,
}: {
  data: WizardData;
  onExtract: () => void;
  extracting: boolean;
  extractDone: boolean;
  extractPreview: {
    businessName: string;
    industry: string;
    firstPost: string;
  } | null;
}) {
  const previewColor = HEX_REGEX.test(data.primaryColor)
    ? data.primaryColor
    : DEFAULT_COLOR;

  const filledSocials = Object.entries(data.socialHandles).filter(([, v]) =>
    v.trim()
  );

  return (
    <div className="space-y-5">
      {/* Brand card preview */}
      <div>
        <p className="text-[10px] uppercase tracking-[0.1em] text-white/50 mb-3">
          Brand Preview
        </p>
        <div className="border-[0.5px] border-white/[0.06] rounded-sm overflow-hidden bg-[#050508]">
          {/* Header strip */}
          <div
            className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.06]"
            style={{ background: previewColor + '12' }}
          >
            {data.logo ? (
              <img
                src={data.logo}
                alt="Logo"
                className="w-8 h-8 rounded-sm object-contain bg-white/[0.04]"
                onError={e => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            ) : (
              <div
                className="w-8 h-8 rounded-sm flex items-center justify-center text-[#050508] text-xs font-bold flex-shrink-0"
                style={{ background: previewColor }}
              >
                {(data.name || 'B').charAt(0).toUpperCase()}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-light text-white truncate">
                {data.name || 'Your Organisation'}
              </p>
              {data.industry && (
                <p className="text-[10px] text-white/40">{data.industry}</p>
              )}
            </div>
            <div
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ background: previewColor }}
            />
          </div>

          {/* Body */}
          <div className="p-4 space-y-3">
            {data.description && (
              <p className="text-xs text-white/50 leading-relaxed line-clamp-2">
                {data.description}
              </p>
            )}
            <div className="flex flex-wrap gap-3 items-center">
              {data.website && (
                <span className="text-[10px] text-white/60 flex items-center gap-1">
                  <Globe className="w-3 h-3" />
                  {data.website.replace(/^https?:\/\//, '')}
                </span>
              )}
              {data.teamSize && (
                <span className="text-[10px] text-white/60 flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  {data.teamSize} people
                </span>
              )}
            </div>
            {filledSocials.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {filledSocials.map(([k, v]) => (
                  <span
                    key={k}
                    className="text-[10px] px-2 py-1 rounded-sm bg-white/[0.03] border-[0.5px] border-white/[0.06] text-white/40"
                  >
                    {k}: {v}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* AI BrandDNA extraction */}
      <div className="border-[0.5px] border-white/[0.06] rounded-sm p-4 space-y-3">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 flex items-center justify-center border-[0.5px] border-amber-500/20 bg-amber-500/[0.04] rounded-sm flex-shrink-0">
            <Sparkles className="w-4 h-4 text-amber-500/70" />
          </div>
          <div className="flex-1">
            <p className="text-xs text-white/70 font-medium">
              AI Brand Analysis
            </p>
            <p className="text-[10px] text-white/40 mt-0.5 leading-relaxed">
              Let Synthex analyse your website to extract your brand voice,
              target audience, and content themes — powering smarter content
              generation.
            </p>
          </div>
        </div>

        {extractDone && extractPreview ? (
          <div className="bg-amber-500/[0.04] border-[0.5px] border-amber-500/20 rounded-sm p-3 space-y-2">
            <p className="text-[10px] text-amber-500/80 uppercase tracking-[0.1em]">
              AI generated — first post preview
            </p>
            <p className="text-xs text-white/60 leading-relaxed">
              {extractPreview.firstPost}
            </p>
            <p className="text-[10px] text-white/60 flex items-center gap-1">
              <CheckCircle className="w-3 h-3 text-emerald-500/60" />
              Full brand extraction running in background
            </p>
          </div>
        ) : (
          <button
            type="button"
            onClick={onExtract}
            disabled={extracting || !data.website}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 text-xs rounded-sm border-[0.5px] transition-all',
              data.website
                ? 'border-amber-500/30 bg-amber-500/[0.06] text-amber-400/90 hover:bg-amber-500/[0.1] hover:text-amber-300'
                : 'border-white/[0.06] bg-white/[0.02] text-white/60 cursor-not-allowed',
              extracting && 'opacity-70 cursor-not-allowed'
            )}
          >
            {extracting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" />
            )}
            {extracting
              ? 'Analysing your brand…'
              : data.website
                ? 'Analyse my brand with AI'
                : 'Add a website URL to enable AI analysis'}
          </button>
        )}
      </div>

      {/* Summary checklist */}
      <div className="space-y-1.5">
        <p className="text-[10px] uppercase tracking-[0.1em] text-white/50 mb-2">
          Profile Summary
        </p>
        {(
          [
            ['Organisation Name', data.name],
            ['Website', data.website],
            ['Industry', data.industry],
            ['Team Size', data.teamSize],
            ['Logo', data.logo ? 'Provided' : ''],
            ['Primary Colour', data.primaryColor],
            ['Description', data.description ? 'Provided' : ''],
            [
              'Social Handles',
              filledSocials.length > 0 ? `${filledSocials.length} linked` : '',
            ],
          ] as [string, string][]
        ).map(([label, value]) => (
          <div
            key={label}
            className="flex items-center justify-between py-1.5 border-b border-white/[0.04]"
          >
            <span className="text-[10px] text-white/40">{label}</span>
            {value ? (
              <span className="text-[10px] text-white/60 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/60 flex-shrink-0" />
                {value.length > 40 ? value.slice(0, 37) + '…' : value}
              </span>
            ) : (
              <span className="text-[10px] text-white/60">—</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main Wizard Component ────────────────────────────────────────────────────

export function BrandSetupWizard() {
  const router = useRouter();
  const { updateBrandProfile } = useBrandProfile();

  const [step, setStep] = useState(1);
  const [data, setData] = useState<WizardData>(INITIAL_DATA);
  const [errors, setErrors] = useState<
    Partial<Record<keyof WizardData, string>>
  >({});
  const [saving, setSaving] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [extractDone, setExtractDone] = useState(false);
  const [extractPreview, setExtractPreview] = useState<{
    businessName: string;
    industry: string;
    firstPost: string;
  } | null>(null);

  const update = useCallback((partial: Partial<WizardData>) => {
    setData(prev => ({ ...prev, ...partial }));
    // Clear related errors
    const keys = Object.keys(partial) as (keyof WizardData)[];
    setErrors(prev => {
      const next = { ...prev };
      keys.forEach(k => delete next[k]);
      return next;
    });
  }, []);

  // ── Validation per step ──────────────────────────────────────────────────

  const validate = useCallback((): boolean => {
    const newErrors: Partial<Record<keyof WizardData, string>> = {};

    if (step === 1) {
      if (!data.name.trim()) newErrors.name = 'Organisation name is required';
      else if (data.name.length > 100) newErrors.name = 'Max 100 characters';

      if (data.website) {
        try {
          new URL(data.website);
        } catch {
          newErrors.website = 'Must be a valid URL (e.g. https://example.com)';
        }
      }
      if (data.abn && data.abn.length > 20) newErrors.abn = 'Max 20 characters';
    }

    if (step === 2) {
      if (data.primaryColor && !HEX_REGEX.test(data.primaryColor))
        newErrors.primaryColor = 'Must be a valid hex colour (e.g. #f59e0b)';
      if (data.logo) {
        try {
          new URL(data.logo);
        } catch {
          newErrors.logo = 'Must be a valid URL';
        }
      }
      if (data.description.length > 500)
        newErrors.description = 'Max 500 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [step, data]);

  const handleNext = () => {
    if (!validate()) return;
    setStep(s => Math.min(s + 1, 4));
  };

  const handleBack = () => setStep(s => Math.max(s - 1, 1));

  // ── BrandDNA extraction ──────────────────────────────────────────────────

  const handleExtract = async () => {
    if (!data.website) return;
    setExtracting(true);
    try {
      const res = await fetch('/api/brand-dna/extract', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: data.website }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Extraction failed');
      setExtractPreview(json.preview);
      setExtractDone(true);

      // Pre-fill name if empty
      if (!data.name && json.preview?.businessName) {
        update({ name: json.preview.businessName });
      }
      // Pre-fill industry if empty
      if (!data.industry && json.preview?.industry) {
        update({ industry: json.preview.industry });
      }

      toast.success('Brand analysis started — full results in ~30 seconds');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setExtracting(false);
    }
  };

  // ── Save ─────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    setSaving(true);
    try {
      const cleanHandles: Record<string, string> = {};
      for (const [k, v] of Object.entries(data.socialHandles)) {
        if (v.trim()) cleanHandles[k] = v.trim();
      }

      const payload: BrandProfileUpdatePayload = {
        name: data.name,
        description: data.description,
        logo: data.logo,
        primaryColor: data.primaryColor,
        website: data.website,
        industry: data.industry,
        teamSize: data.teamSize,
        abn: data.abn,
        socialHandles: cleanHandles,
      };

      await updateBrandProfile(payload);
      toast.success('Brand profile saved — your Synthex is ready!');
      router.push('/dashboard/settings/brand-profile');
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to save brand profile'
      );
    } finally {
      setSaving(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="max-w-2xl mx-auto">
      {/* Step indicator */}
      <div className="flex items-center gap-0 mb-8">
        {STEPS.map((s, i) => {
          const isActive = s.id === step;
          const isDone = s.id < step;
          return (
            <div key={s.id} className="flex items-center flex-1">
              <div className="flex flex-col items-center gap-1 flex-shrink-0">
                <div
                  className={cn(
                    'w-8 h-8 rounded-sm border-[0.5px] flex items-center justify-center transition-all',
                    isActive
                      ? 'border-amber-500/40 bg-amber-500/[0.08] text-amber-400'
                      : isDone
                        ? 'border-emerald-500/30 bg-emerald-500/[0.06] text-emerald-400'
                        : 'border-white/[0.06] bg-white/[0.02] text-white/60'
                  )}
                >
                  {isDone ? (
                    <CheckCircle className="w-4 h-4" />
                  ) : (
                    <s.icon className="w-3.5 h-3.5" />
                  )}
                </div>
                <span
                  className={cn(
                    'text-[9px] uppercase tracking-[0.1em]',
                    isActive
                      ? 'text-amber-400/80'
                      : isDone
                        ? 'text-emerald-400/60'
                        : 'text-white/60'
                  )}
                >
                  {s.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className={cn(
                    'h-px flex-1 mx-2 transition-all',
                    isDone ? 'bg-emerald-500/20' : 'bg-white/[0.04]'
                  )}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Step content */}
      <div className="bg-[#0a0a12] border-[0.5px] border-white/[0.06] rounded-sm p-6 sm:p-8">
        {/* Step header */}
        <div className="mb-6">
          <p className="text-[10px] uppercase tracking-[0.2em] text-white/60">
            Step {step} of {STEPS.length}
          </p>
          <h2 className="text-xl font-light text-white mt-1">
            {step === 1 && 'Business Details'}
            {step === 2 && 'Brand Identity'}
            {step === 3 && 'Social Presence'}
            {step === 4 && 'Review & Launch'}
          </h2>
          <p className="text-xs text-white/40 mt-1">
            {step === 1 && 'Tell us about your organisation'}
            {step === 2 && 'Set your logo, colours, and brand description'}
            {step === 3 && 'Link your social media accounts'}
            {step === 4 && 'Review your profile and save'}
          </p>
        </div>

        {/* Step component */}
        {step === 1 && (
          <StepBusiness data={data} onChange={update} errors={errors} />
        )}
        {step === 2 && (
          <StepIdentity data={data} onChange={update} errors={errors} />
        )}
        {step === 3 && <StepPresence data={data} onChange={update} />}
        {step === 4 && (
          <StepReview
            data={data}
            onExtract={handleExtract}
            extracting={extracting}
            extractDone={extractDone}
            extractPreview={extractPreview}
          />
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between mt-8 pt-5 border-t border-white/[0.06]">
          {step > 1 ? (
            <button
              type="button"
              onClick={handleBack}
              className="flex items-center gap-2 px-4 py-2.5 text-xs text-white/50 hover:text-white/70 bg-white/[0.02] hover:bg-white/[0.04] border-[0.5px] border-white/[0.06] hover:border-white/[0.12] rounded-sm transition-all"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              Back
            </button>
          ) : (
            <div />
          )}

          {step < 4 ? (
            <button
              type="button"
              onClick={handleNext}
              className="flex items-center gap-2 px-5 py-2.5 text-xs font-medium bg-amber-500 hover:bg-amber-400 text-[#050508] rounded-sm transition-colors"
            >
              Continue
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 text-xs font-medium bg-amber-500 hover:bg-amber-400 text-[#050508] rounded-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <CheckCircle className="w-3.5 h-3.5" />
              )}
              {saving ? 'Saving…' : 'Save & Launch'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
