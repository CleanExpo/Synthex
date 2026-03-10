'use client';

/**
 * Brand Profile Tab Component
 * Lets users view and edit their organisation's brand identity fields.
 *
 * Covers: name, description, logo (URL + upload), favicon, primaryColor,
 * website, industry, teamSize, abn, and social handles.
 *
 * @task SYN-55 - Brand Profile Setup
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Building,
  Globe,
  Loader2,
  Palette,
  Save,
  Upload,
  Users,
  X,
  AlertCircle,
} from '@/components/icons';
import { toast } from 'sonner';
import { useBrandProfile } from '@/hooks/use-brand-profile';
import type { BrandProfileUpdatePayload } from '@/app/api/brand-profile/types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

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
  'Non-profit',
  'Professional Services',
  'Manufacturing',
  'Other',
];

const TEAM_SIZE_OPTIONS = ['Solo', '2-10', '11-50', '51-200', '200+'] as const;

const SOCIAL_PLATFORMS = [
  { key: 'twitter', label: 'Twitter / X', placeholder: '@handle or URL' },
  { key: 'instagram', label: 'Instagram', placeholder: '@handle or URL' },
  { key: 'linkedin', label: 'LinkedIn', placeholder: 'company/name or URL' },
  { key: 'youtube', label: 'YouTube', placeholder: '@channel or URL' },
  { key: 'tiktok', label: 'TikTok', placeholder: '@handle or URL' },
  { key: 'facebook', label: 'Facebook', placeholder: 'page name or URL' },
  { key: 'pinterest', label: 'Pinterest', placeholder: '@handle or URL' },
  { key: 'reddit', label: 'Reddit', placeholder: 'r/community or URL' },
] as const;

const HEX_COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LocalProfile {
  name: string;
  description: string;
  logo: string;
  favicon: string;
  primaryColor: string;
  website: string;
  industry: string;
  teamSize: string;
  abn: string;
  socialHandles: Record<string, string>;
}

type ProfileField = keyof Omit<LocalProfile, 'socialHandles'>;

interface ValidationErrors {
  name?: string;
  primaryColor?: string;
  website?: string;
  abn?: string;
  description?: string;
  logo?: string;
  favicon?: string;
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function isValidUrl(str: string): boolean {
  try {
    new URL(str);
    return true;
  } catch {
    return false;
  }
}

const DEFAULT_COLOR = '#6366f1';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export interface BrandProfileTabProps {
  isSaving?: boolean;
}

export function BrandProfileTab({ isSaving: _externalSaving }: BrandProfileTabProps) {
  const { profile, isLoading, error, updateBrandProfile } = useBrandProfile();

  const [local, setLocal] = useState<LocalProfile>({
    name: '',
    description: '',
    logo: '',
    favicon: '',
    primaryColor: DEFAULT_COLOR,
    website: '',
    industry: '',
    teamSize: '',
    abn: '',
    socialHandles: {},
  });

  const [errors, setErrors] = useState<ValidationErrors>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Populate form once SWR data arrives
  useEffect(() => {
    if (profile) {
      setLocal({
        name: profile.name ?? '',
        description: profile.description ?? '',
        logo: profile.logo ?? '',
        favicon: profile.favicon ?? '',
        primaryColor: profile.primaryColor ?? DEFAULT_COLOR,
        website: profile.website ?? '',
        industry: profile.industry ?? '',
        teamSize: profile.teamSize ?? '',
        abn: profile.abn ?? '',
        socialHandles: profile.socialHandles ?? {},
      });
      setIsDirty(false);
    }
  }, [profile]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleChange = useCallback((field: ProfileField, value: string) => {
    setLocal((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[field as keyof ValidationErrors];
      return next;
    });
    setIsDirty(true);
  }, []);

  const handleSocialChange = useCallback((platform: string, value: string) => {
    setLocal((prev) => ({
      ...prev,
      socialHandles: { ...prev.socialHandles, [platform]: value },
    }));
    setIsDirty(true);
  }, []);

  const validate = useCallback((): boolean => {
    const newErrors: ValidationErrors = {};

    if (!local.name.trim()) {
      newErrors.name = 'Organisation name is required';
    } else if (local.name.length > 100) {
      newErrors.name = 'Name must be 100 characters or fewer';
    }

    if (local.primaryColor && !HEX_COLOR_REGEX.test(local.primaryColor)) {
      newErrors.primaryColor = 'Must be a valid hex colour (e.g. #6366f1)';
    }

    if (local.website && !isValidUrl(local.website)) {
      newErrors.website = 'Must be a valid URL (e.g. https://example.com)';
    }

    if (local.abn && local.abn.length > 20) {
      newErrors.abn = 'ABN must be 20 characters or fewer';
    }

    if (local.description && local.description.length > 500) {
      newErrors.description = 'Description must be 500 characters or fewer';
    }

    if (local.logo && !isValidUrl(local.logo)) {
      newErrors.logo = 'Must be a valid URL';
    }

    if (local.favicon && !isValidUrl(local.favicon)) {
      newErrors.favicon = 'Must be a valid URL';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [local]);

  const handleSave = useCallback(async () => {
    if (!validate()) {
      toast.error('Please fix the validation errors before saving');
      return;
    }

    setIsSaving(true);
    try {
      // Only send non-empty fields — avoids overwriting with empty strings
      const payload: BrandProfileUpdatePayload = {};

      if (local.name) payload.name = local.name;
      if (local.description !== undefined) payload.description = local.description;
      if (local.logo !== undefined) payload.logo = local.logo;
      if (local.favicon !== undefined) payload.favicon = local.favicon;
      if (local.primaryColor) payload.primaryColor = local.primaryColor;
      if (local.website !== undefined) payload.website = local.website;
      if (local.industry !== undefined) payload.industry = local.industry;
      if (local.teamSize !== undefined) payload.teamSize = local.teamSize;
      if (local.abn !== undefined) payload.abn = local.abn;

      // Clean up empty social handles
      const cleanedHandles: Record<string, string> = {};
      for (const [k, v] of Object.entries(local.socialHandles)) {
        if (v.trim()) cleanedHandles[k] = v.trim();
      }
      payload.socialHandles = cleanedHandles;

      await updateBrandProfile(payload);
      toast.success('Brand profile saved');
      setIsDirty(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save brand profile');
    } finally {
      setIsSaving(false);
    }
  }, [local, validate, updateBrandProfile]);

  const handleLogoUpload = useCallback(async (file: File) => {
    setIsUploadingLogo(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/media/upload', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Upload failed');
      handleChange('logo', json.data.url);
      toast.success('Logo uploaded successfully');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to upload logo');
    } finally {
      setIsUploadingLogo(false);
    }
  }, [handleChange]);

  // ---------------------------------------------------------------------------
  // Loading / error states
  // ---------------------------------------------------------------------------

  if (isLoading) {
    return (
      <Card variant="glass">
        <CardContent className="py-12">
          <div className="flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
            <p className="text-slate-400">Loading brand profile...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card variant="glass">
        <CardContent className="py-12">
          <div className="flex flex-col items-center justify-center gap-3 text-center">
            <AlertCircle className="w-8 h-8 text-red-400" />
            <p className="text-slate-400">Failed to load brand profile. Please refresh and try again.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const saving = isSaving;
  const previewColor = HEX_COLOR_REGEX.test(local.primaryColor)
    ? local.primaryColor
    : DEFAULT_COLOR;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* ------------------------------------------------------------------ */}
      {/* Card 1 — Brand Identity                                             */}
      {/* ------------------------------------------------------------------ */}
      <Card variant="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="w-5 h-5 text-cyan-400" />
            Brand Identity
          </CardTitle>
          <CardDescription>
            Your organisation&apos;s name, logo, and primary colour
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Organisation Name */}
          <div className="space-y-2">
            <Label htmlFor="bp-name">Organisation Name *</Label>
            <Input
              id="bp-name"
              value={local.name}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="Acme Corporation"
              maxLength={100}
              className="bg-white/5 border-white/10"
            />
            {errors.name && (
              <p className="text-sm text-red-400">{errors.name}</p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="bp-description">Description</Label>
            <Textarea
              id="bp-description"
              value={local.description}
              onChange={(e) => handleChange('description', e.target.value)}
              placeholder="A short description of your organisation..."
              maxLength={500}
              className="bg-white/5 border-white/10 min-h-[80px]"
            />
            <div className="flex justify-between items-center">
              {errors.description && (
                <p className="text-sm text-red-400">{errors.description}</p>
              )}
              <p className="text-xs text-slate-500 ml-auto">
                {local.description.length} / 500
              </p>
            </div>
          </div>

          {/* Logo */}
          <div className="space-y-2">
            <Label htmlFor="bp-logo">Logo URL</Label>
            <div className="flex gap-3">
              <Input
                id="bp-logo"
                value={local.logo}
                onChange={(e) => handleChange('logo', e.target.value)}
                placeholder="https://example.com/logo.png"
                className="bg-white/5 border-white/10 flex-1"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploadingLogo}
                className="bg-white/5 border-white/10 shrink-0"
              >
                {isUploadingLogo ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4" />
                )}
                <span className="ml-1.5">Upload</span>
              </Button>
              {local.logo && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleChange('logo', '')}
                  className="bg-white/5 border-white/10 shrink-0"
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
            {errors.logo && (
              <p className="text-sm text-red-400">{errors.logo}</p>
            )}
            <p className="text-xs text-slate-500">
              Paste a URL or click Upload to select a file (PNG, SVG recommended, max 10 MB).
            </p>
            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleLogoUpload(file);
                // Reset so the same file can be selected again
                e.target.value = '';
              }}
            />
          </div>

          {/* Favicon */}
          <div className="space-y-2">
            <Label htmlFor="bp-favicon">Favicon URL</Label>
            <div className="flex gap-3">
              <Input
                id="bp-favicon"
                value={local.favicon}
                onChange={(e) => handleChange('favicon', e.target.value)}
                placeholder="https://example.com/favicon.ico"
                className="bg-white/5 border-white/10 flex-1"
              />
              {local.favicon && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleChange('favicon', '')}
                  className="bg-white/5 border-white/10 shrink-0"
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
            {errors.favicon && (
              <p className="text-sm text-red-400">{errors.favicon}</p>
            )}
            <p className="text-xs text-slate-500">
              Recommended: ICO or PNG, 32 × 32 px.
            </p>
          </div>

          {/* Primary Colour */}
          <div className="space-y-2">
            <Label htmlFor="bp-primaryColor">Primary Colour</Label>
            <div className="flex gap-3 items-center">
              <input
                type="color"
                value={HEX_COLOR_REGEX.test(local.primaryColor) ? local.primaryColor : DEFAULT_COLOR}
                onChange={(e) => handleChange('primaryColor', e.target.value)}
                className="w-10 h-10 rounded-md border border-white/10 bg-transparent cursor-pointer shrink-0"
                aria-label="Pick primary colour"
              />
              <Input
                id="bp-primaryColor"
                value={local.primaryColor}
                onChange={(e) => handleChange('primaryColor', e.target.value)}
                placeholder="#6366f1"
                className="bg-white/5 border-white/10 font-mono"
              />
            </div>
            {errors.primaryColor && (
              <p className="text-sm text-red-400">{errors.primaryColor}</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ------------------------------------------------------------------ */}
      {/* Card 2 — Business Details                                          */}
      {/* ------------------------------------------------------------------ */}
      <Card variant="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building className="w-5 h-5 text-cyan-400" />
            Business Details
          </CardTitle>
          <CardDescription>
            Website, industry, team size, and ABN
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Website */}
          <div className="space-y-2">
            <Label htmlFor="bp-website">Website</Label>
            <div className="flex gap-3 items-center">
              <Globe className="w-4 h-4 text-slate-400 shrink-0" />
              <Input
                id="bp-website"
                value={local.website}
                onChange={(e) => handleChange('website', e.target.value)}
                placeholder="https://yourcompany.com"
                className="bg-white/5 border-white/10"
              />
            </div>
            {errors.website && (
              <p className="text-sm text-red-400">{errors.website}</p>
            )}
          </div>

          {/* Industry */}
          <div className="space-y-2">
            <Label htmlFor="bp-industry">Industry</Label>
            <select
              id="bp-industry"
              value={local.industry}
              onChange={(e) => handleChange('industry', e.target.value)}
              className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              <option value="">Select an industry...</option>
              {INDUSTRY_OPTIONS.map((opt) => (
                <option key={opt} value={opt} className="bg-slate-900">
                  {opt}
                </option>
              ))}
            </select>
          </div>

          {/* Team Size */}
          <div className="space-y-2">
            <Label htmlFor="bp-teamSize">Team Size</Label>
            <div className="flex gap-2 flex-wrap">
              {TEAM_SIZE_OPTIONS.map((size) => (
                <button
                  key={size}
                  type="button"
                  onClick={() => handleChange('teamSize', size)}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium border transition-colors ${
                    local.teamSize === size
                      ? 'border-cyan-500 bg-cyan-500/20 text-cyan-300'
                      : 'border-white/10 bg-white/5 text-slate-300 hover:border-white/20'
                  }`}
                >
                  <Users className="inline w-3.5 h-3.5 mr-1" />
                  {size}
                </button>
              ))}
            </div>
          </div>

          {/* ABN */}
          <div className="space-y-2">
            <Label htmlFor="bp-abn">ABN</Label>
            <Input
              id="bp-abn"
              value={local.abn}
              onChange={(e) => handleChange('abn', e.target.value)}
              placeholder="12 345 678 901"
              maxLength={20}
              className="bg-white/5 border-white/10"
            />
            {errors.abn && (
              <p className="text-sm text-red-400">{errors.abn}</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ------------------------------------------------------------------ */}
      {/* Card 3 — Social Handles                                            */}
      {/* ------------------------------------------------------------------ */}
      <Card variant="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-cyan-400" />
            Social Handles
          </CardTitle>
          <CardDescription>
            Links to your organisation&apos;s social media profiles
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {SOCIAL_PLATFORMS.map(({ key, label, placeholder }) => (
              <div key={key} className="space-y-2">
                <Label htmlFor={`bp-social-${key}`}>{label}</Label>
                <Input
                  id={`bp-social-${key}`}
                  value={local.socialHandles[key] ?? ''}
                  onChange={(e) => handleSocialChange(key, e.target.value)}
                  placeholder={placeholder}
                  className="bg-white/5 border-white/10"
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ------------------------------------------------------------------ */}
      {/* Card 4 — Live Preview                                              */}
      {/* ------------------------------------------------------------------ */}
      <Card variant="glass">
        <CardHeader>
          <CardTitle>Live Preview</CardTitle>
          <CardDescription>
            How your brand card will appear throughout Synthex
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            className="rounded-lg border border-white/10 overflow-hidden"
            style={{ background: '#0f172a' }}
          >
            {/* Preview Header */}
            <div
              className="flex items-center justify-between px-4 py-3 border-b border-white/10"
              style={{ background: previewColor + '20' }}
            >
              <div className="flex items-center gap-3">
                {local.logo ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={local.logo}
                    alt="Logo preview"
                    className="h-8 w-auto max-w-[120px] object-contain"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <div
                    className="w-8 h-8 rounded-md flex items-center justify-center text-white text-sm font-bold shrink-0"
                    style={{ background: previewColor }}
                  >
                    {(local.name || 'S').charAt(0).toUpperCase()}
                  </div>
                )}
                <span className="text-white font-semibold text-sm">
                  {local.name || 'Your Organisation'}
                </span>
              </div>
              <div
                className="w-3 h-3 rounded-full"
                style={{ background: previewColor }}
              />
            </div>

            {/* Preview Body */}
            <div className="p-4 space-y-3">
              {local.description && (
                <p className="text-slate-400 text-xs leading-relaxed line-clamp-2">
                  {local.description}
                </p>
              )}
              <div className="flex gap-3 flex-wrap">
                <div
                  className="px-3 py-1.5 rounded-md text-white text-xs font-medium"
                  style={{ background: previewColor }}
                >
                  Primary Button
                </div>
                {local.website && (
                  <span className="text-xs text-slate-400 flex items-center gap-1">
                    <Globe className="w-3 h-3" />
                    {local.website.replace(/^https?:\/\//, '')}
                  </span>
                )}
              </div>
              <div
                className="h-1 rounded-full w-2/3"
                style={{ background: previewColor }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ------------------------------------------------------------------ */}
      {/* Save Button                                                         */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex items-center justify-between">
        {isDirty && (
          <p className="text-xs text-amber-400">You have unsaved changes</p>
        )}
        <div className="ml-auto">
          <Button
            onClick={handleSave}
            disabled={saving || Object.keys(errors).length > 0}
            className="gradient-primary"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Save Brand Profile
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
